import { Router } from "express";
import { db, usersTable, subscriptionsTable, transactionsTable, insightsTable, parsedRecordsTable, rawInputsTable, operationalCostsTable, tokenUsagesTable } from "@workspace/db";
import { eq, gte, count, sum } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { requireAdmin } from "../middlewares/admin";
import { sendPasswordResetEmail } from "../lib/email";
import { cancelAsaasSubscription } from "../lib/asaas";
import { logger } from "../lib/logger";
import crypto from "crypto";

const router = Router();

router.use(requireAuth, requireAdmin);

// ─── Users ────────────────────────────────────────────────────────────────────

// GET /admin/users — list all users with subscription + token usage data
router.get("/admin/users", async (req, res): Promise<void> => {
  const [users, tokenStats, costs, activeSubs] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        isAdmin: usersTable.isAdmin,
        status: usersTable.status,
        createdAt: usersTable.createdAt,
        emailVerifiedAt: usersTable.emailVerifiedAt,
        subStatus: subscriptionsTable.status,
        billingCycle: subscriptionsTable.billingCycle,
        trialEndsAt: subscriptionsTable.trialEndsAt,
        currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
        asaasSubscriptionId: subscriptionsTable.asaasSubscriptionId,
      })
      .from(usersTable)
      .leftJoin(subscriptionsTable, eq(subscriptionsTable.userId, usersTable.id))
      .orderBy(usersTable.createdAt),

    db
      .select({
        userId: tokenUsagesTable.userId,
        totalInput:  sum(tokenUsagesTable.inputTokens),
        totalOutput: sum(tokenUsagesTable.outputTokens),
        callCount:   count(),
      })
      .from(tokenUsagesTable)
      .groupBy(tokenUsagesTable.userId),

    db.select().from(operationalCostsTable),

    db.select({ userId: subscriptionsTable.userId }).from(subscriptionsTable)
      .where(eq(subscriptionsTable.status, "active")),
  ]);

  const totalMonthlyCosts = costs.reduce((s, c) => s + Number(c.amountMonthly), 0);
  const activeCount = activeSubs.length;
  const costPerUser = activeCount > 0 ? totalMonthlyCosts / activeCount : 0;

  const tokenMap = new Map(
    tokenStats.map((t) => [t.userId, {
      inputTokens:  Number(t.totalInput ?? 0),
      outputTokens: Number(t.totalOutput ?? 0),
      callCount:    Number(t.callCount ?? 0),
    }])
  );

  const enriched = users.map((u) => {
    const tk = tokenMap.get(u.id) ?? { inputTokens: 0, outputTokens: 0, callCount: 0 };
    // Estimate token cost: use sonnet pricing as a conservative estimate
    const tokenCostUSDValue = (tk.inputTokens / 1_000_000) * 3.0 + (tk.outputTokens / 1_000_000) * 15.0;
    return {
      ...u,
      tokenInputTotal:  tk.inputTokens,
      tokenOutputTotal: tk.outputTokens,
      tokenCallCount:   tk.callCount,
      tokenCostUSD:     tokenCostUSDValue,
      operationalCostShare: costPerUser,
    };
  });

  res.json({ users: enriched });
});

// PATCH /admin/users/:id/status — set user account status
router.patch("/admin/users/:id/status", async (req, res): Promise<void> => {
  const targetId = Number(req.params.id);
  const { status } = req.body as { status?: string };

  if (!status || !["active", "inactive", "blocked"].includes(status)) {
    res.status(400).json({ error: "status inválido. Use: active, inactive ou blocked." });
    return;
  }

  await db
    .update(usersTable)
    .set({ status: status as "active" | "inactive" | "blocked" })
    .where(eq(usersTable.id, targetId));

  res.json({ message: "Status atualizado." });
});

// POST /admin/users/:id/reset-password — send password reset email
router.post("/admin/users/:id/reset-password", async (req, res): Promise<void> => {
  const targetId = Number(req.params.id);

  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, targetId));

  if (!user) {
    res.status(404).json({ error: "Usuário não encontrado." });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  await db
    .update(usersTable)
    .set({ passwordResetToken: token, passwordResetExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
    .where(eq(usersTable.id, user.id));

  sendPasswordResetEmail(user.email, user.name, token).catch((e) =>
    logger.error({ err: e }, "Failed to send admin-triggered password reset email")
  );

  res.json({ message: "E-mail de redefinição enviado." });
});

// PATCH /admin/users/:id/subscription — change subscription plan/status
router.patch("/admin/users/:id/subscription", async (req, res): Promise<void> => {
  const targetId = Number(req.params.id);
  const { status, billingCycle } = req.body as {
    status?: "trial" | "active" | "overdue" | "expired";
    billingCycle?: "monthly" | "semiannual" | "annual" | null;
  };

  const validStatuses = ["trial", "active", "overdue", "expired"];
  if (status && !validStatuses.includes(status)) {
    res.status(400).json({ error: "status inválido." });
    return;
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (status !== undefined) patch.status = status;
  if (billingCycle !== undefined) patch.billingCycle = billingCycle;

  if (status === "active") {
    // Recompute currentPeriodEnd from the (new or existing) cycle
    const [current] = await db
      .select({ billingCycle: subscriptionsTable.billingCycle })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, targetId));
    const effectiveCycle = (billingCycle ?? current?.billingCycle ?? "monthly") as "monthly" | "semiannual" | "annual";
    const periodEnd = new Date();
    if (effectiveCycle === "monthly")         periodEnd.setMonth(periodEnd.getMonth() + 1);
    else if (effectiveCycle === "semiannual") periodEnd.setMonth(periodEnd.getMonth() + 6);
    else if (effectiveCycle === "annual")     periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    patch.currentPeriodEnd = periodEnd;
    patch.billingCycle = effectiveCycle;
  } else if (status === "trial") {
    // Restart trial: 7 days from now, clear paid-period anchor
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 7);
    patch.trialEndsAt = trialEndsAt;
    patch.currentPeriodEnd = null;
  }

  await db
    .update(subscriptionsTable)
    .set(patch)
    .where(eq(subscriptionsTable.userId, targetId));

  res.json({ message: "Assinatura atualizada." });
});

// DELETE /admin/users/:id/subscription — cancel subscription in Asaas; user keeps access
// until current period/trial ends (only flips to expired if no access remaining).
router.delete("/admin/users/:id/subscription", async (req, res): Promise<void> => {
  const targetId = Number(req.params.id);

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, targetId));

  if (!sub) {
    res.status(404).json({ error: "Assinatura não encontrada." });
    return;
  }

  if (sub.asaasSubscriptionId) {
    try {
      await cancelAsaasSubscription(sub.asaasSubscriptionId);
    } catch {
      // safe to ignore if already cancelled
    }
  }

  const now = new Date();
  const stillInTrial = sub.status === "trial" && sub.trialEndsAt && sub.trialEndsAt > now;
  const stillInPaidPeriod = sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd > now;

  if (stillInTrial || stillInPaidPeriod) {
    await db
      .update(subscriptionsTable)
      .set({ asaasSubscriptionId: null, updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, targetId));
    res.json({ message: "Assinatura cancelada (acesso mantido até o fim do período atual)." });
  } else {
    await db
      .update(subscriptionsTable)
      .set({ status: "expired", asaasSubscriptionId: null, updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, targetId));
    res.json({ message: "Assinatura cancelada." });
  }
});

// ─── Clear test data ──────────────────────────────────────────────────────────

// DELETE /admin/clear-tests — wipe all data for the admin's own account
router.delete("/admin/clear-tests", async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  // Safety: only admins can reach here (middleware), and only for their own account
  const rawInputIds = await db
    .select({ id: rawInputsTable.id })
    .from(rawInputsTable)
    .where(eq(rawInputsTable.userId, userId));

  const rawInputIdList = rawInputIds.map((r) => r.id);

  if (rawInputIdList.length > 0) {
    for (const rawId of rawInputIdList) {
      await db.delete(parsedRecordsTable).where(eq(parsedRecordsTable.rawInputId, rawId));
    }
    for (const rawId of rawInputIdList) {
      await db.delete(rawInputsTable).where(eq(rawInputsTable.id, rawId));
    }
  }

  await db.delete(transactionsTable).where(eq(transactionsTable.userId, userId));
  await db.delete(insightsTable).where(eq(insightsTable.userId, userId));

  logger.info({ userId }, "[admin/clear-tests] data cleared");
  res.json({ message: "Dados de teste apagados." });
});

// ─── Metrics ──────────────────────────────────────────────────────────────────

const MRR_BY_CYCLE: Record<string, number> = {
  monthly:   149,
  semiannual: 129,
  annual:     99,
};

// GET /admin/metrics — SaaS KPI dashboard
router.get("/admin/metrics", async (req, res): Promise<void> => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  // All subscriptions
  const allSubs = await db
    .select({
      status: subscriptionsTable.status,
      billingCycle: subscriptionsTable.billingCycle,
      updatedAt: subscriptionsTable.updatedAt,
      createdAt: subscriptionsTable.createdAt,
      currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
    })
    .from(subscriptionsTable);

  const activeSubs = allSubs.filter((s) => s.status === "active");
  const trialSubs = allSubs.filter((s) => s.status === "trial");

  // Churned subscriptions: had a paid period (currentPeriodEnd != null) that ended → status "expired".
  // This excludes trial expirations (which never had a paid period) so they don't pollute churn metrics.
  const churnedSubs = allSubs.filter(
    (s) => s.status === "expired" && s.currentPeriodEnd != null,
  );
  // Window: those whose paid period ended within the last 30 days
  const churnedSubsLast30 = churnedSubs.filter(
    (s) => s.currentPeriodEnd != null && s.currentPeriodEnd >= thirtyDaysAgo,
  );

  // MRR = sum of monthly-equivalent revenue for active paying subscribers
  const mrr = activeSubs.reduce((sum, s) => {
    const monthly = s.billingCycle ? (MRR_BY_CYCLE[s.billingCycle] ?? 0) : 0;
    return sum + monthly;
  }, 0);

  const arr = mrr * 12;
  const activeCount = activeSubs.length;
  const trialCount = trialSubs.length;
  const totalUsers = allSubs.length;
  const arpu = activeCount > 0 ? mrr / activeCount : 0;

  // Denominator: paying users who existed at the start of the 30-day window
  // (currently active) + (churned during the window — they were active at start)
  const activeAtStart = activeCount + churnedSubsLast30.length;

  const monthlyChurnRate = activeAtStart > 0 ? churnedSubsLast30.length / activeAtStart : 0;
  // Linear annualisation — avoids the compound formula inflating small samples
  // (e.g. 1 cancellation / 4 users = 25% monthly → 97% compound annual, vs 25%*12 = 300% capped at 100%)
  const annualChurnRate = Math.min(monthlyChurnRate * 12, 1);

  // LTV = ARPU / monthly_churn_rate (if churn > 0)
  const ltv = monthlyChurnRate > 0 ? arpu / monthlyChurnRate : null;

  // New MRR (active subs created in last 30 days)
  const newMrr = activeSubs
    .filter((s) => s.createdAt >= thirtyDaysAgo)
    .reduce((sum, s) => sum + (s.billingCycle ? (MRR_BY_CYCLE[s.billingCycle] ?? 0) : 0), 0);

  // Churned MRR (paid subs that expired in the last 30 days)
  const churnedMrrValue = churnedSubsLast30
    .reduce((sum, s) => sum + (s.billingCycle ? (MRR_BY_CYCLE[s.billingCycle] ?? 0) : 0), 0);

  // Starting MRR proxy: active now + churned within window who were created before window
  const startingMrr = [
    ...activeSubs,
    ...churnedSubsLast30.filter((s) => s.createdAt < thirtyDaysAgo),
  ].reduce((sum, s) => sum + (s.billingCycle ? (MRR_BY_CYCLE[s.billingCycle] ?? 0) : 0), 0);

  const nrr = startingMrr > 0 ? (startingMrr + newMrr - churnedMrrValue) / startingMrr : null;

  // New users in last 30 days
  const [newUsersRow] = await db
    .select({ cnt: count() })
    .from(usersTable)
    .where(gte(usersTable.createdAt, thirtyDaysAgo));
  const newUsersLast30 = Number(newUsersRow?.cnt ?? 0);

  // Operational costs
  const costs = await db.select().from(operationalCostsTable);
  const totalMonthlyCosts = costs.reduce((sum, c) => sum + Number(c.amountMonthly), 0);

  // Unit economics: cost per active user
  const costPerUser = activeCount > 0 ? totalMonthlyCosts / activeCount : null;

  // Trial conversion rate (active / (active + trial))
  const conversionDenominator = activeCount + trialCount;
  const trialConversionRate = conversionDenominator > 0 ? activeCount / conversionDenominator : null;

  res.json({
    mrr,
    arr,
    arpu,
    activeSubscribers: activeCount,
    trialUsers: trialCount,
    totalUsers,
    newUsersLast30,
    monthlyChurnRate,
    annualChurnRate,
    ltv,
    nrr,
    newMrr,
    churnedMrr: churnedMrrValue,
    totalMonthlyCosts,
    costPerUser,
    trialConversionRate,
    grossMarginEstimate: mrr > 0 ? (mrr - totalMonthlyCosts) / mrr : null,
    paybackMonths: arpu > 0 && totalMonthlyCosts > 0 ? totalMonthlyCosts / arpu : null,
  });
});

// ─── Operational Costs ────────────────────────────────────────────────────────

router.get("/admin/costs", async (_req, res): Promise<void> => {
  const costs = await db.select().from(operationalCostsTable).orderBy(operationalCostsTable.category);
  res.json({ costs });
});

router.post("/admin/costs", async (req, res): Promise<void> => {
  const { category, name, amountMonthly, notes } = req.body as {
    category?: string;
    name?: string;
    amountMonthly?: number;
    notes?: string;
  };

  const validCategories = ["api", "server", "salary", "marketing", "other"];
  if (!category || !validCategories.includes(category)) {
    res.status(400).json({ error: "category inválida." });
    return;
  }
  if (!name?.trim()) {
    res.status(400).json({ error: "name é obrigatório." });
    return;
  }
  if (typeof amountMonthly !== "number" || amountMonthly < 0) {
    res.status(400).json({ error: "amountMonthly inválido." });
    return;
  }

  const [cost] = await db
    .insert(operationalCostsTable)
    .values({
      category: category as "api" | "server" | "salary" | "marketing" | "other",
      name: name.trim(),
      amountMonthly: String(amountMonthly),
      notes: notes?.trim() || null,
    })
    .returning();

  res.status(201).json({ cost });
});

router.put("/admin/costs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { category, name, amountMonthly, notes } = req.body as {
    category?: string;
    name?: string;
    amountMonthly?: number;
    notes?: string;
  };

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  const validCategories = ["api", "server", "salary", "marketing", "other"];
  if (category) {
    if (!validCategories.includes(category)) {
      res.status(400).json({ error: "category inválida." });
      return;
    }
    patch.category = category;
  }
  if (name !== undefined) patch.name = name.trim();
  if (amountMonthly !== undefined) patch.amountMonthly = String(amountMonthly);
  if (notes !== undefined) patch.notes = notes?.trim() || null;

  await db.update(operationalCostsTable).set(patch).where(eq(operationalCostsTable.id, id));
  res.json({ message: "Custo atualizado." });
});

router.delete("/admin/costs/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(operationalCostsTable).where(eq(operationalCostsTable.id, id));
  res.json({ message: "Custo removido." });
});

export default router;
