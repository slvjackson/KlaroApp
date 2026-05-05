import type { BillingCycle } from "@workspace/db";

const BASE = process.env.ASAAS_SANDBOX === "true"
  ? "https://sandbox.asaas.com/api/v3"
  : "https://api.asaas.com/api/v3";

const KEY = process.env.ASAAS_API_KEY ?? "";

async function asaasReq<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "access_token": KEY,
      "Content-Type": "application/json",
      "User-Agent": "Klaro/1.0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asaas ${method} ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

interface AsaasCustomer {
  id: string;
}

interface AsaasSubscription {
  id: string;
}

interface AsaasPayment {
  id: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
}

interface AsaasPixQrCode {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

interface AsaasList<T> {
  data: T[];
}

export interface CreditCardData {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface CreditCardHolderInfo {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  postalCode?: string;
  addressNumber?: string;
}

const CYCLE_MAP: Record<BillingCycle, string> = {
  monthly:    "MONTHLY",
  semiannual: "SEMIANNUALLY",
  annual:     "YEARLY",
};

// Monthly price per cycle in BRL
const PRICE_MAP: Record<BillingCycle, number> = {
  monthly:   149,
  semiannual: 774,   // 129 × 6
  annual:    1188,   // 99 × 12
};

const LABEL_MAP: Record<BillingCycle, string> = {
  monthly:   "Mensal",
  semiannual: "Semestral",
  annual:    "Anual",
};

function nextDueDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0]!;
}

export async function findOrCreateAsaasCustomer(
  name: string,
  email: string,
  externalRef: string,
  cpfCnpj?: string,
): Promise<string> {
  const list = await asaasReq<AsaasList<AsaasCustomer>>(
    "GET",
    `/customers?email=${encodeURIComponent(email)}&limit=1`,
  );

  if (list.data.length > 0) {
    const existing = list.data[0]!;
    if (cpfCnpj) {
      await asaasReq("PUT", `/customers/${existing.id}`, { cpfCnpj });
    }
    return existing.id;
  }

  const customer = await asaasReq<AsaasCustomer>("POST", "/customers", {
    name,
    email,
    externalReference: externalRef,
    notificationDisabled: false,
    ...(cpfCnpj ? { cpfCnpj } : {}),
  });
  return customer.id;
}

export type SubscriptionResult =
  | { asaasSubscriptionId: string; method: "credit_card" }
  | { asaasSubscriptionId: string; method: "pix"; pixQrCode: string; pixPayload: string; pixExpiresAt: string };

export async function createAsaasSubscription(
  customerId: string,
  billingCycle: BillingCycle,
  method: "credit_card" | "pix",
  creditCard?: CreditCardData,
  creditCardHolderInfo?: CreditCardHolderInfo,
  remoteIp?: string,
): Promise<SubscriptionResult> {
  const base = {
    customer: customerId,
    value: PRICE_MAP[billingCycle],
    nextDueDate: nextDueDateStr(),
    cycle: CYCLE_MAP[billingCycle],
    description: `Klaro Pro — ${LABEL_MAP[billingCycle]}`,
  };

  if (method === "credit_card") {
    const sub = await asaasReq<AsaasSubscription>("POST", "/subscriptions", {
      ...base,
      billingType: "CREDIT_CARD",
      creditCard,
      creditCardHolderInfo,
      remoteIp: remoteIp ?? "0.0.0.0",
    });
    return { asaasSubscriptionId: sub.id, method: "credit_card" };
  }

  // PIX
  const sub = await asaasReq<AsaasSubscription>("POST", "/subscriptions", {
    ...base,
    billingType: "PIX",
  });

  const payments = await asaasReq<AsaasList<AsaasPayment>>(
    "GET",
    `/subscriptions/${sub.id}/payments?status=PENDING&limit=1`,
  );

  const firstPayment = payments.data[0];
  if (!firstPayment) {
    throw new Error("Asaas PIX: nenhum pagamento pendente encontrado após criação da assinatura");
  }

  const qr = await asaasReq<AsaasPixQrCode>("GET", `/payments/${firstPayment.id}/pixQrCode`);

  return {
    asaasSubscriptionId: sub.id,
    method: "pix",
    pixQrCode: qr.encodedImage,
    pixPayload: qr.payload,
    pixExpiresAt: qr.expirationDate,
  };
}

export async function cancelAsaasSubscription(asaasSubscriptionId: string): Promise<void> {
  await asaasReq("DELETE", `/subscriptions/${asaasSubscriptionId}`);
}

// Lists pending payments for a subscription and deletes each one.
// Used when switching plans to invalidate any payment link the user might still pay
// for the previous (now cancelled) subscription.
export async function deletePendingAsaasPayments(asaasSubscriptionId: string): Promise<void> {
  const PENDING_STATUSES = ["PENDING", "AWAITING_RISK_ANALYSIS", "OVERDUE"];
  for (const status of PENDING_STATUSES) {
    try {
      const list = await asaasReq<AsaasList<AsaasPayment>>(
        "GET",
        `/subscriptions/${asaasSubscriptionId}/payments?status=${status}&limit=100`,
      );
      for (const payment of list.data) {
        try {
          await asaasReq("DELETE", `/payments/${payment.id}`);
        } catch {
          // Already paid/deleted/refunded — ignore
        }
      }
    } catch {
      // Subscription may have no payments in this status — ignore
    }
  }
}
