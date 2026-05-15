import { useState } from "react";
import { useLocation } from "wouter";
import { useGetBillingStatus, useSubscribe, useCancelSubscription } from "@workspace/api-client-react";
import type { BillingCycle } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getBillingStatusQueryKey } from "@workspace/api-client-react";
import { CheckCircle2, Zap, AlertTriangle, Clock, XCircle, Loader2, ArrowLeft, CreditCard, QrCode, Copy, Check } from "lucide-react";
import { WinbackHeader } from "@/components/WinbackHeader";

// ─── Pricing ──────────────────────────────────────────────────────────────────

const PLANS: { cycle: BillingCycle; label: string; period: string; monthly: number; total: number; badge?: string }[] = [
  { cycle: "monthly",    label: "Mensal",    period: "por mês",      monthly: 149,  total: 149  },
  { cycle: "semiannual", label: "Semestral", period: "por semestre", monthly: 129,  total: 774,  badge: "Economize R$120" },
  { cycle: "annual",     label: "Anual",     period: "por ano",      monthly: 99,   total: 1188, badge: "Mais popular" },
];

const FEATURES = [
  "Upload ilimitado de arquivos (CSV, XLSX, imagens, PDF)",
  "Extração automática de transações por IA",
  "Insights financeiros personalizados para seu negócio",
  "Chat com IA para dúvidas sobre seu caixa",
  "Dashboard com tendências e categorias",
  "Suporte por WhatsApp",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCardNumber(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

function formatCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) =>
      d ? `${a}.${b}.${c}-${d}` : c ? `${a}.${b}.${c}` : b ? `${a}.${b}` : a
    );
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, d, e) =>
    e ? `${a}.${b}.${c}/${d}-${e}` : d ? `${a}.${b}.${c}/${d}` : c ? `${a}.${b}.${c}` : b ? `${a}.${b}` : a
  );
}

// ─── Status banner ────────────────────────────────────────────────────────────

function StatusBanner({ status, trialDaysLeft, currentPeriodEnd, billingCycle, autoRenew }: {
  status: string;
  trialDaysLeft?: number | null;
  currentPeriodEnd?: string | null;
  billingCycle?: string | null;
  autoRenew?: boolean;
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
          <p className="text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
            {autoRenew === false ? `Assinatura cancelada — Plano ${cycleLabel}` : `Assinatura ativa — Plano ${cycleLabel}`}
          </p>
          {until && (
            <p className="text-[12px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
              {autoRenew === false ? `Acesso até ${until} (não renova)` : `Próxima renovação: ${until}`}
            </p>
          )}
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
    overdue: "Pagamento pendente — regularize para continuar usando o Klaro.",
    expired: "Período de teste encerrado.",
  };

  return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border border-red-300/40 bg-red-500/8">
      <XCircle size={18} className="text-red-500 shrink-0" />
      <p className="text-[13px] text-red-600 dark:text-red-400">{labels[status] ?? "Assinatura inativa."}</p>
    </div>
  );
}

// ─── PIX Result ───────────────────────────────────────────────────────────────

function PixResult({ qrCode, payload, expiresAt }: { qrCode: string; payload: string; expiresAt: string }) {
  const [copied, setCopied] = useState(false);

  const expires = new Date(expiresAt).toLocaleString("pt-BR", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });

  const copy = () => {
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-4 text-center">
      <div className="flex items-center justify-center gap-2">
        <QrCode size={16} className="text-primary" />
        <p className="text-[13px] font-semibold text-foreground">Pague via PIX</p>
      </div>
      <img
        src={`data:image/png;base64,${qrCode}`}
        alt="QR Code PIX"
        className="mx-auto w-48 h-48 rounded-xl"
      />
      <p className="text-[11px] text-muted-foreground">Válido até {expires}</p>
      <button
        onClick={copy}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-muted hover:bg-muted/80 transition-colors text-[13px] font-medium text-foreground"
      >
        {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        {copied ? "Copiado!" : "Copiar código copia e cola"}
      </button>
      <p className="text-[11px] text-muted-foreground">
        Após o pagamento, sua conta será ativada automaticamente em instantes.
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Billing() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: billing, isLoading } = useGetBillingStatus();
  const subscribeMutation = useSubscribe();
  const cancelMutation = useCancelSubscription();

  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("annual");
  const [paymentMethod, setPaymentMethod] = useState<"credit_card" | "pix">("credit_card");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showRetention, setShowRetention] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; payload: string; expiresAt: string } | null>(null);

  const handleSubscribe = () => {
    setError(null);
    const digits = cpfCnpj.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      setError("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }

    const creditCard = paymentMethod === "credit_card" ? {
      holderName: cardName.trim(),
      number: cardNumber.replace(/\s/g, ""),
      expiryMonth: cardExpiry.split("/")[0] ?? "",
      expiryYear: `20${cardExpiry.split("/")[1] ?? ""}`,
      ccv: cardCvv,
    } : undefined;

    if (paymentMethod === "credit_card") {
      if (!creditCard!.holderName || creditCard!.number.length < 16 || creditCard!.expiryMonth.length < 2 || !creditCard!.ccv) {
        setError("Preencha todos os dados do cartão.");
        return;
      }
    }

    subscribeMutation.mutate(
      { data: { billingCycle: selectedCycle, cpfCnpj: digits, paymentMethod, creditCard } },
      {
        onSuccess: (data) => {
          if (paymentMethod === "pix" && data.pixQrCode) {
            setPixData({ qrCode: data.pixQrCode, payload: data.pixPayload!, expiresAt: data.pixExpiresAt! });
          } else {
            // Deferred reactivation (PIX/card with paid access remaining) or
            // card subscription — no QR. Surface the server's message.
            const msg = (data as { message?: string }).message;
            if (msg) setNotice(msg);
            else if (reactivating) setNotice("Assinatura reativada com sucesso.");
            setReactivating(false);
            queryClient.invalidateQueries({ queryKey: getBillingStatusQueryKey() });
          }
        },
        onError: () => setError("Erro ao iniciar assinatura. Tente novamente."),
      },
    );
  };

  const handleCancel = () => {
    setError(null);
    cancelMutation.mutate(undefined, {
      onSuccess: (data: unknown) => {
        setShowCancelConfirm(false);
        setNotice((data as { message?: string })?.message ?? "Assinatura cancelada.");
        queryClient.invalidateQueries({ queryKey: getBillingStatusQueryKey() });
      },
      onError: (err: unknown) => {
        setShowCancelConfirm(false);
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setError(msg ?? "Erro ao cancelar assinatura. Tente novamente.");
      },
    });
  };

  const isActive = billing?.status === "active";
  // autoRenew comes from the billing status (false once cancelled). When the
  // user cancelled but the paid period hasn't ended yet, status is still
  // "active" — offer reactivation instead of another cancel.
  const autoRenew = (billing as { autoRenew?: boolean } | undefined)?.autoRenew;
  const canceledButActive = isActive && autoRenew === false;
  const accessUntil = billing?.currentPeriodEnd
    ? new Date(billing.currentPeriodEnd).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-5 py-12 space-y-8">

        {/* Back — to landing page if expired (no dashboard access), to dashboard otherwise */}
        {billing?.status === "expired" ? (
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} />
            Voltar à página inicial
          </button>
        ) : (
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} />
            Voltar ao dashboard
          </button>
        )}

        {/* Header — winback for expired users, default for everyone else */}
        {isLoading ? (
          <div className="h-32 rounded-2xl bg-muted animate-pulse" />
        ) : billing?.status === "expired" ? (
          <WinbackHeader />
        ) : (
          <>
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
                <Zap size={28} className="text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Assine Klaro</h1>
              <p className="text-[14px] text-muted-foreground">
                Controle financeiro completo com inteligência artificial para o seu negócio.
              </p>
            </div>
            {billing && (
              <StatusBanner
                status={billing.status}
                trialDaysLeft={billing.trialDaysLeft}
                currentPeriodEnd={billing.currentPeriodEnd}
                billingCycle={billing.billingCycle}
                autoRenew={autoRenew}
              />
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-300/40 bg-red-500/8">
            <AlertTriangle size={15} className="text-red-500 shrink-0" />
            <p className="text-[12.5px] text-red-600 dark:text-red-400 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-1">×</button>
          </div>
        )}

        {/* Success notice */}
        {notice && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-green-300/40 bg-green-500/8">
            <p className="text-[12.5px] text-green-700 dark:text-green-400 flex-1">{notice}</p>
            <button onClick={() => setNotice(null)} className="text-green-500 hover:text-green-700 ml-1">×</button>
          </div>
        )}

        {/* PIX result after subscribe */}
        {pixData && (
          <PixResult qrCode={pixData.qrCode} payload={pixData.payload} expiresAt={pixData.expiresAt} />
        )}

        {/* Reactivation banner — cancelled but still within paid period */}
        {canceledButActive && !reactivating && !pixData && (
          <div className="glass rounded-2xl p-6 space-y-4 border border-[rgba(245,158,11,0.3)]">
            <p className="text-[13px] font-semibold text-foreground">Assinatura cancelada</p>
            <p className="text-[12.5px] text-muted-foreground">
              {accessUntil
                ? `Você cancelou a renovação automática, mas mantém acesso ao Klaro até ${accessUntil}. Reative para não perder o acesso — você não será cobrado novamente até o fim do período já pago.`
                : "Você cancelou a renovação automática. Reative para manter o acesso ao Klaro."}
            </p>
            <button
              onClick={() => { setReactivating(true); setNotice(null); setError(null); }}
              className="w-full py-2.5 rounded-xl bg-primary text-white text-[13px] font-semibold hover:bg-primary/90 transition-colors"
            >
              Reativar assinatura
            </button>
          </div>
        )}

        {/* Plan selector + payment form (when not active, or reactivating) */}
        {(!isActive || reactivating) && !pixData && (
          <div className="glass rounded-2xl p-6 space-y-5">
            <p className="text-[13px] font-semibold text-foreground">
              {reactivating ? "Reativar assinatura" : "Escolha seu plano"}
            </p>
            {reactivating && (
              <div className="px-4 py-3 rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.07)]">
                <p className="text-[12px] text-[#f59e0b]">
                  {accessUntil
                    ? `Você não será cobrado agora. Seu acesso atual segue até ${accessUntil} e a próxima cobrança (${selectedCycle === "monthly" ? "Mensal" : selectedCycle === "semiannual" ? "Semestral" : "Anual"}) será gerada nessa data. No PIX, a cobrança chega na data — nada para pagar hoje.`
                    : "Você autoriza a próxima cobrança; nada será cobrado agora."}
                </p>
              </div>
            )}

            {/* Plan options */}
            <div className="space-y-3">
              {PLANS.map((plan) => {
                const selected = selectedCycle === plan.cycle;
                return (
                  <button
                    key={plan.cycle}
                    onClick={() => setSelectedCycle(plan.cycle)}
                    className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all ${
                      selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"
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

            {/* Payment method toggle */}
            <div className="flex rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setPaymentMethod("credit_card")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium transition-colors ${
                  paymentMethod === "credit_card" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <CreditCard size={14} />
                Cartão
              </button>
              <button
                onClick={() => setPaymentMethod("pix")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-medium transition-colors ${
                  paymentMethod === "pix" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <QrCode size={14} />
                PIX
              </button>
            </div>

            {/* CPF/CNPJ */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">CPF ou CNPJ</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>

            {/* Credit card fields */}
            {paymentMethod === "credit_card" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-muted-foreground">Número do cartão</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0000 0000 0000 0000"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-muted-foreground">Nome no cartão</label>
                  <input
                    type="text"
                    placeholder="Como aparece no cartão"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value.toUpperCase())}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-muted-foreground">Validade</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="MM/AA"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-medium text-muted-foreground">CVV</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="123"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background text-[14px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleSubscribe}
              disabled={subscribeMutation.isPending}
              className="btn-primary w-full py-3.5 rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {subscribeMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Aguarde…</>
              ) : reactivating ? (
                "Reativar assinatura"
              ) : paymentMethod === "pix" ? (
                "Gerar QR Code PIX"
              ) : (
                "Assinar agora"
              )}
            </button>

            <p className="text-[11px] text-center text-muted-foreground">
              {reactivating
                ? "Nada será cobrado agora — a cobrança ocorre na data de renovação."
                : paymentMethod === "pix"
                  ? "Após o pagamento via PIX, sua conta é ativada automaticamente."
                  : "Pagamento seguro. Sem taxas ocultas."}
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

        {/* Exit reactivation flow */}
        {reactivating && (
          <div className="text-center">
            <button
              onClick={() => setReactivating(false)}
              className="text-[12px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Voltar
            </button>
          </div>
        )}

        {/* Cancel (only when active and still auto-renewing) */}
        {isActive && !canceledButActive && !reactivating && !showRetention && !showCancelConfirm && (
          <div className="text-center">
            <button
              onClick={() => setShowRetention(true)}
              className="text-[12px] text-muted-foreground hover:text-red-500 underline underline-offset-2 transition-colors"
            >
              Cancelar assinatura
            </button>
          </div>
        )}

        {/* Retention — try to keep the customer before final cancel */}
        {showRetention && !showCancelConfirm && (
          <div className="glass rounded-2xl p-6 space-y-4 border border-primary/30">
            <p className="text-[14px] font-semibold text-foreground">Antes de cancelar…</p>
            <p className="text-[12.5px] text-muted-foreground">
              O Klaro continua organizando suas finanças automaticamente — extração por IA, insights
              do seu negócio e dashboard em tempo real. Cancelando, você perde tudo isso ao fim do
              período atual.
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              Está com alguma dificuldade ou achou caro? Fale com a gente antes — talvez a gente
              consiga resolver ou encontrar um plano melhor pra você.
            </p>
            <a
              href={`mailto:contato@appklaro.com.br?subject=${encodeURIComponent("Preciso de ajuda antes de cancelar o Klaro")}`}
              className="block w-full text-center py-2.5 rounded-xl border border-primary/40 text-[13px] font-medium text-primary hover:bg-primary/5 transition-colors"
            >
              Falar com o suporte
            </a>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRetention(false)}
                className="flex-1 py-2.5 rounded-xl bg-primary text-white text-[13px] font-semibold hover:bg-primary/90 transition-colors"
              >
                Manter assinatura
              </button>
              <button
                onClick={() => { setShowRetention(false); setShowCancelConfirm(true); }}
                className="flex-1 py-2.5 rounded-xl border border-border text-[13px] font-medium text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors"
              >
                Quero cancelar mesmo assim
              </button>
            </div>
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
