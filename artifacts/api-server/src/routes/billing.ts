import { Router } from "express";
import { db, subscriptionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { BillingCycle } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { findOrCreateAsaasCustomer, createAsaasSubscription, cancelAsaasSubscription } from "../lib/asaas";
import type { CreditCardData, CreditCardHolderInfo } from "../lib/asaas";
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
      .select({ asaasSubscriptionId: subscriptionsTable.asaasSubscriptionId })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId));

    if (existingSub?.asaasSubscriptionId) {
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

    const result = await createAsaasSubscription(
      asaasCustomerId,
      billingCycle,
      paymentMethod,
      creditCard,
      holderInfo,
      remoteIp,
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
    res.status(500).json({ error: "Erro ao iniciar assinatura. Tente novamente." });
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
        .select({ id: subscriptionsTable.id, billingCycle: subscriptionsTable.billingCycle })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.asaasSubscriptionId, asaasSubId));
      if (s) return s;
    }
    if (asaasCustomerId) {
      const [s] = await db
        .select({ id: subscriptionsTable.id, billingCycle: subscriptionsTable.billingCycle })
        .from(subscriptionsTable)
        .where(eq(subscriptionsTable.asaasCustomerId, asaasCustomerId));
      if (s) return s;
    }
    return undefined;
  }

  try {
    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      const sub = await findSub();

      if (sub) {
        const periodEnd = new Date();
        if (sub.billingCycle === "monthly")         periodEnd.setMonth(periodEnd.getMonth() + 1);
        else if (sub.billingCycle === "semiannual") periodEnd.setMonth(periodEnd.getMonth() + 6);
        else if (sub.billingCycle === "annual")     periodEnd.setFullYear(periodEnd.getFullYear() + 1);

        await db
          .update(subscriptionsTable)
          .set({ status: "active", currentPeriodEnd: periodEnd, updatedAt: new Date() })
          .where(eq(subscriptionsTable.id, sub.id));

        logger.info({ subId: sub.id, periodEnd }, "[billing/webhook] subscription activated");
      } else {
        logger.warn({ asaasSubId, asaasCustomerId }, "[billing/webhook] no subscription found for payment");
      }
    } else if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_REPROVED_BY_RISK_ANALYSIS") {
      const sub = await findSub();
      if (sub) {
        await db
          .update(subscriptionsTable)
          .set({ status: "overdue", updatedAt: new Date() })
          .where(eq(subscriptionsTable.id, sub.id));
      }
    } else if (
      event === "SUBSCRIPTION_CANCELLED" ||
      event === "SUBSCRIPTION_INACTIVATED" ||
      event === "SUBSCRIPTION_DELETED" ||
      event === "PAYMENT_REFUNDED"
    ) {
      const sub = await findSub();
      if (sub) await db
        .update(subscriptionsTable)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(subscriptionsTable.id, sub.id));
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
