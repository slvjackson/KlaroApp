import { Router } from "express";
import { db, subscriptionsTable, usersTable, transactionsTable, insightsTable, userActivitiesTable } from "@workspace/db";
import { eq, count, desc, isNull, and } from "drizzle-orm";
import type { BillingCycle } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { findOrCreateAsaasCustomer, createAsaasSubscription, cancelAsaasSubscription, deletePendingAsaasPayments } from "../lib/asaas";
import type { CreditCardData, CreditCardHolderInfo } from "../lib/asaas";
import { logger } from "../lib/logger";
import { calculateStreak } from "../lib/daily-tasks";

const router = Router();

const BILLING_CYCLES: BillingCycle[] = ["monthly", "semiannual", "annual"];

// GET /billing/status
router.get("/billing/status", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  if (!sub) {
    res.status(404).json({ error: "Sem assinatura." });
    return;
  }

  const now = new Date();

  // Compute effective status on read so the frontend reflects actual access.
  // Storage may say "active"/"trial" but the period/trial may have ended without renewal.
  let effectiveStatus: typeof sub.status = sub.status;
  if (sub.status === "trial" && sub.trialEndsAt && sub.trialEndsAt <= now) {
    effectiveStatus = "expired";
  } else if (sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd <= now) {
    effectiveStatus = "expired";
  } else if (sub.status === "overdue" && sub.currentPeriodEnd && sub.currentPeriodEnd <= now) {
    effectiveStatus = "expired";
  }

  // Persist the transition lazily so subsequent reads/middleware reflect it
  if (effectiveStatus !== sub.status) {
    await db
      .update(subscriptionsTable)
      .set({ status: effectiveStatus, updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, sub.id));
  }

  let trialDaysLeft: number | null = null;
  if (effectiveStatus === "trial" && sub.trialEndsAt) {
    trialDaysLeft = Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / 86_400_000));
  }

  res.json({
    status: effectiveStatus,
    billingCycle: sub.billingCycle ?? null,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    trialDaysLeft,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    // false when the Asaas link was cleared (cancelled). Combined with an
    // "active" status + future currentPeriodEnd, the frontend can offer
    // reactivation while the user still has paid access.
    autoRenew: !!sub.asaasSubscriptionId,
  });
});

// GET /billing/winback-context — personal data for the win-back paywall (expired users)
router.get("/billing/winback-context", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [user, sub, txCountRow, insightCountRow, activities] = await Promise.all([
    db.select({ name: usersTable.name, createdAt: usersTable.createdAt }).from(usersTable).where(eq(usersTable.id, userId)).then((r) => r[0]),
    db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).then((r) => r[0]),
    db.select({ c: count() }).from(transactionsTable).where(eq(transactionsTable.userId, userId)).then((r) => r[0]),
    db.select({ c: count() }).from(insightsTable).where(and(eq(insightsTable.userId, userId), isNull(insightsTable.archivedAt))).then((r) => r[0]),
    db.select({ activityDate: userActivitiesTable.activityDate }).from(userActivitiesTable)
      .where(eq(userActivitiesTable.userId, userId)).orderBy(desc(userActivitiesTable.activityDate)).limit(400),
  ]);

  if (!user || !sub) {
    res.status(404).json({ error: "Conta não encontrada." });
    return;
  }

  // hadPaidSubscription: did the user ever complete a paid period?
  const hadPaidSubscription = sub.currentPeriodEnd != null;

  // daysSinceExpired: take the most recent expiration anchor (currentPeriodEnd if paid, else trialEndsAt)
  const expirationAnchor = sub.currentPeriodEnd ?? sub.trialEndsAt ?? null;
  const daysSinceExpired = expirationAnchor
    ? Math.max(0, Math.floor((Date.now() - expirationAnchor.getTime()) / 86_400_000))
    : 0;

  // daysUsing: from signup until expiration (or until now if no anchor)
  const endRef = expirationAnchor ?? new Date();
  const daysUsing = Math.max(1, Math.ceil((endRef.getTime() - user.createdAt.getTime()) / 86_400_000));

  const streakDays = await calculateStreak(userId, activities.map((a) => a.activityDate));

  res.json({
    name: user.name,
    hadPaidSubscription,
    daysSinceExpired,
    daysUsing,
    transactionCount: Number(txCountRow?.c ?? 0),
    insightCount: Number(insightCountRow?.c ?? 0),
    streakDays,
    lastPlan: sub.billingCycle ?? null,
  });
});

// POST /billing/subscribe — create Asaas subscription (credit card or PIX)
router.post("/billing/subscribe", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { billingCycle, cpfCnpj, paymentMethod, creditCard, phone, postalCode, addressNumber } = req.body as {
    billingCycle?: BillingCycle;
    cpfCnpj?: string;
    paymentMethod?: "credit_card" | "pix";
    creditCard?: CreditCardData;
    phone?: string;
    postalCode?: string;
    addressNumber?: string;
  };

  if (!billingCycle || !BILLING_CYCLES.includes(billingCycle)) {
    res.status(400).json({ error: "billingCycle inválido. Use: monthly, semiannual ou annual." });
    return;
  }

  if (paymentMethod !== "credit_card" && paymentMethod !== "pix") {
    res.status(400).json({ error: "paymentMethod inválido. Use: credit_card ou pix." });
    return;
  }

  const cpfCnpjClean = cpfCnpj?.replace(/\D/g, "") || undefined;
  if (!cpfCnpjClean || (cpfCnpjClean.length !== 11 && cpfCnpjClean.length !== 14)) {
    res.status(400).json({ error: "CPF ou CNPJ inválido." });
    return;
  }

  if (paymentMethod === "credit_card") {
    if (!creditCard?.holderName || !creditCard.number || !creditCard.expiryMonth || !creditCard.expiryYear || !creditCard.ccv) {
      res.status(400).json({ error: "Dados do cartão incompletos." });
      return;
    }
  }

  try {
    const [user] = await db
      .select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (!user) {
      res.status(401).json({ error: "Usuário não encontrado." });
      return;
    }

    const [existingSub] = await db
      .select({
        asaasSubscriptionId: subscriptionsTable.asaasSubscriptionId,
        status: subscriptionsTable.status,
        currentPeriodEnd: subscriptionsTable.currentPeriodEnd,
        trialEndsAt: subscriptionsTable.trialEndsAt,
      })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId));

    if (existingSub?.asaasSubscriptionId) {
      // Delete pending payments first to invalidate any payment link the user might still pay
      // for the old subscription (prevents paying-old-getting-new exploit on plan switch).
      try {
        await deletePendingAsaasPayments(existingSub.asaasSubscriptionId);
      } catch {
        // Best-effort cleanup — webhook also rejects orphaned payments by subId mismatch
      }
      try {
        await cancelAsaasSubscription(existingSub.asaasSubscriptionId);
      } catch {
        // Already cancelled or not found in Asaas — safe to ignore
      }
    }

    const asaasCustomerId = await findOrCreateAsaasCustomer(
      user.name,
      user.email,
      `klaro_${userId}`,
      cpfCnpjClean,
    );

    const holderInfo: CreditCardHolderInfo = {
      name: user.name,
      email: user.email,
      cpfCnpj: cpfCnpjClean,
      phone,
      postalCode,
      addressNumber,
    };

    const remoteIp = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.ip ?? "0.0.0.0";

    // Reactivation / re-subscribe while paid (or trial) access is still valid:
    // don't charge again now — resume billing when the current access ends.
    const now = new Date();
    const accessUntil =
      existingSub?.status === "active" && existingSub.currentPeriodEnd && existingSub.currentPeriodEnd > now
        ? existingSub.currentPeriodEnd
        : existingSub?.status === "trial" && existingSub.trialEndsAt && existingSub.trialEndsAt > now
          ? existingSub.trialEndsAt
          : null;
    const nextDueDate = accessUntil ? accessUntil.toISOString().split("T")[0] : undefined;

    const result = await createAsaasSubscription(
      asaasCustomerId,
      billingCycle,
      paymentMethod,
      creditCard,
      holderInfo,
      remoteIp,
      nextDueDate,
    );

    await db
      .update(subscriptionsTable)
      .set({ asaasCustomerId, asaasSubscriptionId: result.asaasSubscriptionId, billingCycle, updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, userId));

    if (result.method === "pix") {
      res.json({ pixQrCode: result.pixQrCode, pixPayload: result.pixPayload, pixExpiresAt: result.pixExpiresAt });
    } else {
      res.json({});
    }
  } catch (err) {
    logger.error({ err }, "[billing/subscribe] error");
    // Surface the underlying cause (e.g. the Asaas response status + body) in
    // the response so failures are diagnosable without digging through logs.
    const detail = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Erro ao iniciar assinatura. Tente novamente.", detail });
  }
});

// POST /billing/webhook — Asaas events (no auth required)
router.post("/billing/webhook", async (req, res): Promise<void> => {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const receivedToken = req.headers["asaas-access-token"];
  if (expectedToken && receivedToken !== expectedToken) {
    logger.warn({ receivedToken, expectedToken }, "[billing/webhook] token mismatch");
    res.status(401).send("unauthorized");
    return;
  }

  const body = req.body as {
    event?: string;
    payment?: { subscription?: string; customer?: string };
    subscription?: { id?: string };
  };

  const event = body.event ?? "";
  const asaasSubId = body.payment?.subscription ?? body.subscription?.id;
  const asaasCustomerId = body.payment?.customer;

  logger.info({ event, asaasSubId, asaasCustomerId }, "[billing/webhook] received");

  if (!asaasSubId && !asaasCustomerId) {
    res.status(200).send("ok");
    return;
  }

  async function findSub() {
    if (asaasSubId) {
      const [s] = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.asaasSubscriptionId, asaasSubId));
      if (s) return s;
    }
    if (asaasCustomerId) {
      const [s] = await db
        .select()
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.asaasCustomerId, asaasCustomerId));
      if (s) return s;
    }
    return undefined;
  }

  try {
    const sub = await findSub();
    if (!sub) {
      logger.warn({ asaasSubId, asaasCustomerId, event }, "[billing/webhook] no subscription found");
      res.status(200).send("ok");
      return;
    }

    // Orphan check: if the webhook references a specific Asaas subscription that doesn't match
    // the current one in our DB, the event is for a previous (cancelled/replaced) subscription.
    // We must not let it mutate the current user's access state.
    const isOrphan = !!asaasSubId && asaasSubId !== sub.asaasSubscriptionId;
    if (isOrphan) {
      logger.warn(
        { event, asaasSubId, currentSubId: sub.asaasSubscriptionId, subId: sub.id },
        "[billing/webhook] event for orphaned subscription — ignoring",
      );
      res.status(200).send("ok");
      return;
    }

    const now = new Date();
    const stillInTrial = sub.status === "trial" && sub.trialEndsAt && sub.trialEndsAt > now;
    const stillInPaidPeriod = sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd > now;
    const stillHasAccess = stillInTrial || stillInPaidPeriod;

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      const periodEnd = new Date();
      if (sub.billingCycle === "monthly")         periodEnd.setMonth(periodEnd.getMonth() + 1);
      else if (sub.billingCycle === "semiannual") periodEnd.setMonth(periodEnd.getMonth() + 6);
      else if (sub.billingCycle === "annual")     periodEnd.setFullYear(periodEnd.getFullYear() + 1);

      await db
        .update(subscriptionsTable)
        .set({ status: "active", currentPeriodEnd: periodEnd, updatedAt: new Date() })
        .where(eq(subscriptionsTable.id, sub.id));

      logger.info({ subId: sub.id, periodEnd }, "[billing/webhook] subscription activated");
    } else if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_REPROVED_BY_RISK_ANALYSIS") {
      // Mark overdue only if the user has no other guarantee of access (no trial / paid period running).
      // Otherwise the user is still entitled to use the app.
      if (!stillHasAccess) {
        await db
          .update(subscriptionsTable)
          .set({ status: "overdue", updatedAt: new Date() })
          .where(eq(subscriptionsTable.id, sub.id));
      } else {
        logger.info(
          { subId: sub.id, status: sub.status },
          "[billing/webhook] payment overdue but user still in trial/paid period — keeping access",
        );
      }
    } else if (
      event === "SUBSCRIPTION_CANCELLED" ||
      event === "SUBSCRIPTION_INACTIVATED" ||
      event === "SUBSCRIPTION_DELETED" ||
      event === "PAYMENT_REFUNDED"
    ) {
      // Cancellation in Asaas does NOT mean immediate access loss. The user keeps access until
      // their trial or paid period ends. We only flip status to "expired" when access is over.
      if (stillHasAccess) {
        await db
          .update(subscriptionsTable)
          .set({ asaasSubscriptionId: null, updatedAt: new Date() })
          .where(eq(subscriptionsTable.id, sub.id));
        logger.info(
          { subId: sub.id, status: sub.status },
          "[billing/webhook] subscription cancelled in Asaas — user keeps access until period end",
        );
      } else {
        await db
          .update(subscriptionsTable)
          .set({ status: "expired", asaasSubscriptionId: null, updatedAt: new Date() })
          .where(eq(subscriptionsTable.id, sub.id));
      }
    }
  } catch (err) {
    logger.error({ err }, "[billing/webhook] processing error");
  }

  res.status(200).send("ok");
});

// POST /billing/withdrawal-validation — Asaas withdrawal authorization (always approve)
router.post("/billing/withdrawal-validation", async (_req, res): Promise<void> => {
  res.json({ authorized: true });
});

// DELETE /billing/subscription — stop auto-renewal (keeps access until trial/period ends)
router.delete("/billing/subscription", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  if (!sub) {
    res.status(404).json({ error: "Nenhuma assinatura encontrada." });
    return;
  }

  try {
    // Only call Asaas when there is an active subscription link. If it's
    // already null (auto-renewal off, or a prior cancel cleared it), there's
    // nothing to cancel remotely — proceed to settle the local state so the
    // user still gets a clean confirmation instead of a 404/error.
    if (sub.asaasSubscriptionId) {
      await deletePendingAsaasPayments(sub.asaasSubscriptionId);
      await cancelAsaasSubscription(sub.asaasSubscriptionId);
    }

    const now = new Date();
    const stillInTrial = sub.status === "trial" && sub.trialEndsAt && sub.trialEndsAt > now;
    const stillInPaidPeriod = sub.status === "active" && sub.currentPeriodEnd && sub.currentPeriodEnd > now;

    if (stillInTrial || stillInPaidPeriod) {
      // Keep status — user retains access until trial/paid period ends. Just clear the Asaas link.
      await db
        .update(subscriptionsTable)
        .set({ asaasSubscriptionId: null, updatedAt: new Date() })
        .where(eq(subscriptionsTable.userId, userId));

      const endLabel = stillInTrial
        ? "fim do seu período de avaliação"
        : "fim do período já pago";
      res.json({ message: `Assinatura cancelada. Você mantém acesso até o ${endLabel}.` });
    } else {
      // No access remaining — flip to expired
      await db
        .update(subscriptionsTable)
        .set({ status: "expired", asaasSubscriptionId: null, updatedAt: new Date() })
        .where(eq(subscriptionsTable.userId, userId));

      res.json({ message: "Assinatura cancelada." });
    }
  } catch (err) {
    logger.error({ err }, "[billing/cancel] error");
    res.status(500).json({ error: "Erro ao cancelar assinatura. Tente novamente." });
  }
});

export default router;
