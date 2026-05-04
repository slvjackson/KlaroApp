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
  invoiceUrl: string;
  bankSlipUrl?: string;
}

interface AsaasList<T> {
  data: T[];
}

const CYCLE_MAP: Record<BillingCycle, string> = {
  monthly:   "MONTHLY",
  semiannual: "SEMIANNUAL",
  annual:    "YEARLY",
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
    // Update CPF/CNPJ if provided and not already set
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

export async function createAsaasSubscription(
  customerId: string,
  billingCycle: BillingCycle,
): Promise<{ asaasSubscriptionId: string; paymentUrl: string }> {
  const MAX_INSTALLMENTS: Record<BillingCycle, number> = {
    monthly:    1,
    semiannual: 3,
    annual:     12,
  };

  const sub = await asaasReq<AsaasSubscription>("POST", "/subscriptions", {
    customer: customerId,
    billingType: "UNDEFINED",
    value: PRICE_MAP[billingCycle],
    nextDueDate: nextDueDateStr(),
    cycle: CYCLE_MAP[billingCycle],
    description: `Klaro Pro — ${LABEL_MAP[billingCycle]}`,
    maxInstallmentCount: MAX_INSTALLMENTS[billingCycle],
  });

  // Retrieve the first pending payment to get the invoice URL
  const payments = await asaasReq<AsaasList<AsaasPayment>>(
    "GET",
    `/subscriptions/${sub.id}/payments?status=PENDING&limit=1`,
  );

  const first = payments.data[0];
  const paymentUrl = first?.invoiceUrl ?? first?.bankSlipUrl ?? "";

  return { asaasSubscriptionId: sub.id, paymentUrl };
}

export async function cancelAsaasSubscription(asaasSubscriptionId: string): Promise<void> {
  await asaasReq("DELETE", `/subscriptions/${asaasSubscriptionId}`);
}
