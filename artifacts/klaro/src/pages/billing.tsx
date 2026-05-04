import { useState } from "react";
import { useGetBillingStatus, useSubscribe, useCancelSubscription } from "@workspace/api-client-react";
import type { BillingCycle } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getBillingStatusQueryKey } from "@workspace/api-client-react";
import { CheckCircle2, Zap, AlertTriangle, Clock, XCircle, Loader2 } from "lucide-react";

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PLANS: { cycle: BillingCycle; label: string; period: string; monthly: number; total: number; badge?: string }[] = [
  { cycle: "monthly",    label: "Mensal",    period: "por mês",     monthly: 149,  total: 149  },
  { cycle: "semiannual", label: "Semestral", period: "por semestre", monthly: 129, total: 774,  badge: "Economize R$120" },
  { cycle: "annual",     label: "Anual",     period: "por ano",      monthly: 99,  total: 1188, badge: "Mais popular" },
];

const FEATURES = [
  "Upload ilimitado de arquivos (CSV, XLSX, imagens, PDF)",
  "Extração automática de transações por IA",
  "Insights financeiros personalizados para seu negócio",
  "Chat com IA para dúvidas sobre seu caixa",
  "Dashboard com tendências e categorias",
  "Suporte por WhatsApp",
];

// ─── Status banner ────────────────────────────────────────────────────────────

function StatusBanner({ status, trialDaysLeft, currentPeriodEnd, billingCycle }: {
  status: string;
  trialDaysLeft?: number | null;
  currentPeriodEnd?: string | null;
  billingCycle?: string | null;
}) {
  if (status === "active") {
    const until = currentPeriodEnd
      ? new Date(currentPeriodEnd).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
      : null;
    const cycleLabel = billingCycle === "monthly" ? "Mensal" : billingCycle === "semiannual" ? "Semestral" : "Anual";
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/8">
        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
        <div>
          <p className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">Assinatura ativa — Plano {cycleLabel}</p>
          {until && <p className="text-[12px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Próxima renovação: {until}</p>}
        </div>
      </div>
    );
  }

  if (status === "trial") {
    const days = trialDaysLeft ?? 0;
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.07)]">
        <Clock size={18} className="text-[#f59e0b] shrink-0" />
        <div>
          <p className="text-[13px] font-semibold text-[#f59e0b]">Período de teste</p>
          <p className="text-[12px] text-[#f59e0b]/80 mt-0.5">
            {days > 0 ? `${days} ${days === 1 ? "dia restante" : "dias restantes"}` : "Expira hoje — assine para continuar."}
          </p>
        </div>
      </div>
    );
  }

  const labels: Record<string, string> = {
    overdue:   "Pagamento pendente — regularize para continuar usando o Klaro.",
    cancelled: "Assinatura cancelada.",
    expired:   "Período de teste encerrado.",
  };

  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-red-300/40 bg-red-500/8">
      <XCircle size={18} className="text-red-500 shrink-0" />
      <p className="text-[13px] text-red-600 dark:text-red-400">{labels[status] ?? "Assinatura inativa."}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Billing() {
  const queryClient = useQueryClient();
  const { data: billing, isLoading } = useGetBillingStatus();
  const subscribeMutation = useSubscribe();
  const cancelMutation = useCancelSubscription();

  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("annual");
  const [error, setError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleSubscribe = () => {
    setError(null);
    subscribeMutation.mutate(
      { data: { billingCycle: selectedCycle } },
      {
        onSuccess: ({ paymentUrl }) => {
          window.open(paymentUrl, "_blank", "noopener");
        },
        onError: () => setError("Erro ao iniciar assinatura. Tente novamente."),
      },
    );
  };

  const handleCancel = () => {
    cancelMutation.mutate(undefined, {
      onSuccess: () => {
        setShowCancelConfirm(false);
        queryClient.invalidateQueries({ queryKey: getBillingStatusQueryKey() });
      },
      onError: () => setError("Erro ao cancelar assinatura."),
    });
  };

  const isActive = billing?.status === "active";

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
            <Zap size={28} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Klaro Pro</h1>
          <p className="text-[14px] text-muted-foreground">
            Controle financeiro completo com inteligência artificial para o seu negócio.
          </p>
        </div>

        {/* Subscription status */}
        {isLoading ? (
          <div className="h-16 rounded-2xl bg-muted animate-pulse" />
        ) : billing ? (
          <StatusBanner
            status={billing.status}
            trialDaysLeft={billing.trialDaysLeft}
            currentPeriodEnd={billing.currentPeriodEnd}
            billingCycle={billing.billingCycle}
          />
        ) : null}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-300/40 bg-red-500/8">
            <AlertTriangle size={15} className="text-red-500 shrink-0" />
            <p className="text-[12.5px] text-red-600 dark:text-red-400 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-1">×</button>
          </div>
        )}

        {/* Plan selector (only if not active) */}
        {!isActive && (
          <div className="glass rounded-2xl p-6 space-y-5">
            <p className="text-[13px] font-semibold text-foreground">Escolha seu plano</p>

            <div className="space-y-3">
              {PLANS.map((plan) => {
                const selected = selectedCycle === plan.cycle;
                return (
                  <button
                    key={plan.cycle}
                    onClick={() => setSelectedCycle(plan.cycle)}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected ? "border-primary" : "border-muted-foreground/40"}`}>
                          {selected && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <div>
                          <span className="text-[14px] font-semibold text-foreground">{plan.label}</span>
                          {plan.badge && (
                            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              {plan.badge}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[17px] font-bold text-foreground">R${plan.monthly}</span>
                        <span className="text-[12px] text-muted-foreground">/mês</span>
                        {plan.cycle !== "monthly" && (
                          <p className="text-[11px] text-muted-foreground">R${plan.total} {plan.period}</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleSubscribe}
              disabled={subscribeMutation.isPending}
              className="btn-primary w-full py-3.5 rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {subscribeMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Aguarde…</>
              ) : (
                "Assinar agora"
              )}
            </button>

            <p className="text-[11px] text-center text-muted-foreground">
              Pagamento seguro via PIX. Após o pagamento, sua conta é ativada automaticamente.
            </p>
          </div>
        )}

        {/* Features */}
        <div className="glass rounded-2xl p-6 space-y-4">
          <p className="text-[13px] font-semibold text-foreground">O que está incluído</p>
          <ul className="space-y-3">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <CheckCircle2 size={15} className="text-primary shrink-0 mt-0.5" />
                <span className="text-[13px] text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cancel (only when active) */}
        {isActive && !showCancelConfirm && (
          <div className="text-center">
            <button
              onClick={() => setShowCancelConfirm(true)}
              className="text-[12px] text-muted-foreground hover:text-red-500 underline underline-offset-2 transition-colors"
            >
              Cancelar assinatura
            </button>
          </div>
        )}

        {showCancelConfirm && (
          <div className="glass rounded-2xl p-6 space-y-4 border border-red-300/30">
            <p className="text-[13px] font-semibold text-foreground">Confirmar cancelamento</p>
            <p className="text-[12.5px] text-muted-foreground">
              Após cancelar, você perderá acesso ao Klaro ao fim do período atual. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[13px] font-medium hover:bg-red-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {cancelMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                Cancelar assinatura
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
