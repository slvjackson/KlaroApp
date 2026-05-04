import { Router } from "express";
import { db, subscriptionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BillingCycle } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { findOrCreateAsaasCustomer, createAsaasSubscription, cancelAsaasSubscription } from "../lib/asaas";
import { logger } from "../lib/logger";

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
  let trialDaysLeft: number | null = null;
  if (sub.status === "trial" && sub.trialEndsAt) {
    trialDaysLeft = Math.max(0, Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / 86_400_000));
  }

  res.json({
    status: sub.status,
    billingCycle: sub.billingCycle ?? null,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    trialDaysLeft,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
  });
});

// POST /billing/subscribe — create Asaas subscription and return payment URL
router.post("/billing/subscribe", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { billingCycle } = req.body as { billingCycle?: BillingCycle };

  if (!billingCycle || !BILLING_CYCLES.includes(billingCycle)) {
    res.status(400).json({ error: "billingCycle inválido. Use: monthly, semiannual ou annual." });
    return;
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

    const asaasCustomerId = await findOrCreateAsaasCustomer(
      user.name,
      user.email,
      `klaro_${userId}`,
    );

    const { asaasSubscriptionId, paymentUrl } = await createAsaasSubscription(
      asaasCustomerId,
      billingCycle,
    );

    await db
      .update(subscriptionsTable)
      .set({ asaasCustomerId, asaasSubscriptionId, billingCycle, updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, userId));

    res.json({ paymentUrl });
  } catch (err) {
    logger.error({ err }, "[billing/subscribe] error");
    res.status(500).json({ error: "Erro ao iniciar assinatura. Tente novamente." });
  }
});

// POST /billing/webhook — Asaas events (no auth required)
router.post("/billing/webhook", async (req, res): Promise<void> => {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (expectedToken && req.headers["asaas-access-token"] !== expectedToken) {
    res.status(401).send("unauthorized");
    return;
  }

  const body = req.body as {
    event?: string;
    payment?: { subscription?: string };
    subscription?: { id?: string };
  };

  const event = body.event ?? "";
  const asaasSubId = body.payment?.subscription ?? body.subscription?.id;

  logger.info({ event, asaasSubId }, "[billing/webhook] received");

  if (!asaasSubId) {
    res.status(200).send("ok");
    return;
  }

  try {
    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      const [sub] = await db
        .select({ id: subscriptionsTable.id, billingCycle: subscriptionsTable.billingCycle })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.asaasSubscriptionId, asaasSubId));

      if (sub) {
        const periodEnd = new Date();
        if (sub.billingCycle === "monthly")    periodEnd.setMonth(periodEnd.getMonth() + 1);
        else if (sub.billingCycle === "semiannual") periodEnd.setMonth(periodEnd.getMonth() + 6);
        else if (sub.billingCycle === "annual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);

        await db
          .update(subscriptionsTable)
          .set({ status: "active", currentPeriodEnd: periodEnd, updatedAt: new Date() })
          .where(eq(subscriptionsTable.id, sub.id));
      }
    } else if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_REPROVED_BY_RISK_ANALYSIS") {
      await db
        .update(subscriptionsTable)
        .set({ status: "overdue", updatedAt: new Date() })
        .where(eq(subscriptionsTable.asaasSubscriptionId, asaasSubId));
    } else if (
      event === "SUBSCRIPTION_CANCELLED" ||
      event === "SUBSCRIPTION_INACTIVATED" ||
      event === "SUBSCRIPTION_DELETED" ||
      event === "PAYMENT_REFUNDED"
    ) {
      await db
        .update(subscriptionsTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(subscriptionsTable.asaasSubscriptionId, asaasSubId));
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

// DELETE /billing/subscription — cancel active subscription
router.delete("/billing/subscription", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  if (!sub?.asaasSubscriptionId) {
    res.status(404).json({ error: "Nenhuma assinatura ativa encontrada." });
    return;
  }

  try {
    await cancelAsaasSubscription(sub.asaasSubscriptionId);
    await db
      .update(subscriptionsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(subscriptionsTable.userId, userId));

    res.json({ message: "Assinatura cancelada." });
  } catch (err) {
    logger.error({ err }, "[billing/cancel] error");
    res.status(500).json({ error: "Erro ao cancelar assinatura. Tente novamente." });
  }
});

export default router;
