import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, LayoutDashboard, Lightbulb, Sparkles, Upload, X } from "lucide-react";
import { getGetMeQueryKey, type User } from "@workspace/api-client-react";

const STEPS = [
  {
    title: "Comece pelo upload",
    description: "Envie extratos, planilhas ou fotos. A Klaro organiza os dados para você revisar.",
    Icon: Upload,
    action: "Enviar dados",
    href: "/upload",
  },
  {
    title: "Acompanhe o caixa",
    description: "Depois da confirmação, o dashboard mostra saldo, entradas, saídas e categorias.",
    Icon: LayoutDashboard,
    action: "Ver dashboard",
    href: "/dashboard",
  },
  {
    title: "Gere insights",
    description: "A IA encontra padrões e transforma análises em recomendações práticas.",
    Icon: Lightbulb,
    action: "Abrir insights",
    href: "/insights",
  },
  {
    title: "Personalize a IA",
    description: "Responda o diagnóstico do negócio para deixar as recomendações mais precisas.",
    Icon: Sparkles,
    action: "Fazer diagnóstico",
    href: "/anamnese",
  },
];

export function onboardingStorageKey(user: Pick<User, "id" | "email">) {
  return `klaro_first_login_onboarding_completed:${user.id || user.email}`;
}

export function hasCompletedFirstLoginOnboarding(user: User | undefined): boolean {
  if (!user) return true;
  const localFallback = typeof window !== "undefined" && localStorage.getItem(onboardingStorageKey(user)) === "true";
  return user.onboardingCompleted === true || localFallback;
}

export function FirstLoginOnboarding({
  user,
  onDone,
}: {
  user: User;
  onDone: () => void;
}) {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const current = STEPS[step] ?? STEPS[0];
  const isLast = step === STEPS.length - 1;
  const firstName = useMemo(() => user.name?.split(" ")[0] || "bem-vindo", [user.name]);

  useEffect(() => {
    if (hasCompletedFirstLoginOnboarding(user)) onDone();
  }, [onDone, user]);

  async function finish(targetHref?: string) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ onboardingCompleted: true }),
      });
      if (!res.ok) throw new Error("Falha ao concluir onboarding.");
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch {
      localStorage.setItem(onboardingStorageKey(user), "true");
    } finally {
      setSaving(false);
    }
    onDone();
    if (targetHref) navigate(targetHref);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="relative w-full overflow-hidden rounded-t-3xl border border-[var(--border-2)] p-5 shadow-2xl sm:max-w-xl sm:rounded-3xl sm:p-6 glass-strong">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--muted)]/40 sm:hidden" />

        <button
          type="button"
          onClick={() => finish()}
          disabled={saving}
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-white/5 hover:text-white"
          aria-label="Fechar onboarding"
        >
          <X size={16} />
        </button>

        <div className="mb-5 pr-9">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#90f048]">Primeiros passos</p>
          <h2 className="mt-1 text-[22px] font-bold tracking-tight text-white">Bem-vindo, {firstName}</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--muted)]">
            Um guia rápido para você chegar no primeiro insight sem procurar pelo caminho.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr] md:items-stretch">
          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.025)] p-3">
            <div className="space-y-1">
              {STEPS.map(({ title, Icon }, index) => {
                const active = index === step;
                const done = index < step;
                return (
                  <button
                    key={title}
                    type="button"
                    onClick={() => setStep(index)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "bg-[var(--accent-soft)] text-white"
                        : "text-[var(--muted)] hover:bg-white/[0.035] hover:text-white"
                    }`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                      active || done ? "bg-[rgba(106,248,47,0.14)] text-[#90f048]" : "bg-white/5"
                    }`}>
                      {done ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                    </span>
                    <span className="min-w-0 flex-1 text-[12.5px] font-semibold">{title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex min-h-[240px] flex-col rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[rgba(106,248,47,0.22)] bg-[rgba(106,248,47,0.10)] text-[#90f048]">
              <current.Icon size={20} />
            </div>
            <div className="mt-5">
              <p className="text-[15px] font-bold text-white">{current.title}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--muted)]">{current.description}</p>
            </div>

            <div className="mt-auto pt-5">
              <div className="mb-4 flex items-center gap-1.5">
                {STEPS.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => setStep(index)}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: index === step ? 22 : 8,
                      background: index === step ? "var(--accent)" : "var(--border-2)",
                    }}
                    aria-label={`Ir para etapa ${index + 1}`}
                  />
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => finish(current.href)}
                  disabled={saving}
                  className="btn-primary flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold"
                >
                  {current.action}
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => isLast ? finish() : setStep((value) => value + 1)}
                  disabled={saving}
                  className="h-10 rounded-xl border border-[var(--border)] px-4 text-[13px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--border-2)] hover:text-white"
                >
                  {isLast ? "Concluir" : "Próximo"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
