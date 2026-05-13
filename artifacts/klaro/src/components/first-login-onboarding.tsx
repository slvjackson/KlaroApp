import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowLeft, ArrowLeftRight, LayoutDashboard, Lightbulb, MessageSquare, Sparkles, Trophy, Upload, X } from "lucide-react";
import { getGetMeQueryKey, type User } from "@workspace/api-client-react";
import { useOnboardingHighlight } from "@/contexts/onboarding-highlight-context";

// Each step points at a menu item (matches NAV_ITEMS href in layout.tsx) so the
// sidebar pulses on the matching link while this step is active. The user finishes
// the entire onboarding before exploring — no redirect button mid-flow.
const STEPS = [
  {
    title: "Comece pelo upload",
    description: "Envie extratos, planilhas ou fotos. A Klaro organiza os dados para você revisar.",
    Icon: Upload,
    menuHref: "/upload",
    menuLabel: "Upload",
  },
  {
    title: "Acompanhe o caixa",
    description: "Depois da confirmação, o dashboard mostra saldo, entradas, saídas e categorias.",
    Icon: LayoutDashboard,
    menuHref: "/dashboard",
    menuLabel: "Dashboard",
  },
  {
    title: "Revise as transações",
    description: "Em Transações você ajusta categorias, busca movimentações e exporta tudo. A IA aprende com seus ajustes.",
    Icon: ArrowLeftRight,
    menuHref: "/transactions",
    menuLabel: "Transações",
  },
  {
    title: "Gere insights",
    description: "A IA encontra padrões e transforma análises em recomendações práticas.",
    Icon: Lightbulb,
    menuHref: "/insights",
    menuLabel: "Insights",
  },
  {
    title: "Aceite missões",
    description: "Cada insight vira uma missão acionável com passos concretos. Clareza vira progresso.",
    Icon: Trophy,
    menuHref: "/missions",
    menuLabel: "Missões",
  },
  {
    title: "Pergunte ao Chat",
    description: "Tire dúvidas sobre o seu caixa em português. O Chat conhece seus números em tempo real.",
    Icon: MessageSquare,
    menuHref: "/chat",
    menuLabel: "Chat Klaro",
  },
  {
    title: "Personalize a IA",
    description: "Responda o diagnóstico do negócio para deixar as recomendações mais precisas.",
    Icon: Sparkles,
    menuHref: "/profile",
    menuLabel: "Perfil",
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
  const queryClient = useQueryClient();
  const { setHighlight } = useOnboardingHighlight();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const current = STEPS[step] ?? STEPS[0];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const firstName = useMemo(() => user.name?.split(" ")[0] || "bem-vindo", [user.name]);

  useEffect(() => {
    if (hasCompletedFirstLoginOnboarding(user)) onDone();
  }, [onDone, user]);

  // Broadcast which menu item to pulse while this step is open. Cleared on unmount.
  useEffect(() => {
    setHighlight(current.menuHref);
    return () => setHighlight(null);
  }, [current.menuHref, setHighlight]);

  async function finish() {
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
    setHighlight(null);
    onDone();
  }

  return (
    // Anchored to the right (desktop) / bottom (mobile) so the sidebar / bottom-nav
    // stay visible — the user can see the menu item pulse in real time. No backdrop
    // dim/blur so nothing competes with the highlight on the menu.
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <div className="absolute inset-x-0 bottom-0 md:inset-auto md:right-6 md:bottom-6 md:top-auto md:left-auto pointer-events-auto md:max-w-[420px] mb-16 md:mb-0">
        <div className="relative overflow-hidden rounded-t-3xl md:rounded-3xl border border-[var(--border-2)] p-5 sm:p-6 shadow-2xl glass-strong" style={{ background: "rgba(16,16,20,0.97)" }}>
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--muted)]/40 md:hidden" />

          <button
            type="button"
            onClick={() => finish()}
            disabled={saving}
            className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Fechar onboarding"
          >
            <X size={16} />
          </button>

          <div className="mb-4 pr-9">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#90f048]">
              Passo {step + 1} de {STEPS.length}
            </p>
            <h2 className="mt-1 text-[18px] font-bold tracking-tight text-white">
              {isFirst ? `Bem-vindo, ${firstName}` : current.title}
            </h2>
            {isFirst && (
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--muted)]">
                Um guia rápido. Em cada passo, observe o menu — vamos te mostrar onde encontrar cada feature.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[rgba(106,248,47,0.22)] bg-[rgba(106,248,47,0.10)] text-[#90f048]">
                <current.Icon size={18} />
              </div>
              <div className="min-w-0 flex-1">
                {!isFirst && (
                  <p className="text-[14px] font-semibold text-white">{current.title}</p>
                )}
                <p className={`text-[12.5px] leading-relaxed text-[var(--muted)] ${isFirst ? "" : "mt-1"}`}>
                  {current.description}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-lg border border-[rgba(106,248,47,0.18)] bg-[rgba(106,248,47,0.06)] px-3 py-2 text-[12px]">
              <span className="relative grid h-2 w-2 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#6af82f] opacity-60" />
                <span className="relative h-2 w-2 rounded-full bg-[#6af82f]" />
              </span>
              <span className="text-white/85">
                Veja no menu: <b className="text-[#90f048]">{current.menuLabel}</b> está piscando agora.
              </span>
            </div>
          </div>

          <div className="mt-5">
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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep((value) => value - 1)}
                disabled={isFirst || saving}
                className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--border-2)] hover:text-white disabled:opacity-30 disabled:hover:border-[var(--border)] disabled:hover:text-[var(--muted)]"
                aria-label="Passo anterior"
              >
                <ArrowLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => isLast ? finish() : setStep((value) => value + 1)}
                disabled={saving}
                className="btn-primary flex h-10 flex-1 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold"
              >
                {isLast ? "Concluir" : "Próximo"}
                {!isLast && <ArrowRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
