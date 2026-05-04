import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Gift, AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { BillingStatus } from "@workspace/api-client-react";

const STORAGE_KEY = "trial_welcome_shown_date";
const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/billing", "/verify-email", "/forgot-password", "/reset-password"]);

function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

function shouldShow(billing: BillingStatus, location: string): boolean {
  if (PUBLIC_PATHS.has(location)) return false;
  if (billing.status !== "trial") return false;

  const isLastDay = (billing.trialDaysLeft ?? 1) <= 1;
  const shownToday = localStorage.getItem(STORAGE_KEY) === todayStr();
  return !shownToday || isLastDay;
}

interface Props {
  billing: BillingStatus;
}

export function TrialWelcomeModal({ billing }: Props) {
  const [location, navigate] = useLocation();
  const [visible, setVisible] = useState(false);
  const shown = useRef(false);

  const days = billing.trialDaysLeft ?? 7;
  const isLastDay = days <= 1;
  const expiryTime = billing.trialEndsAt
    ? new Date(billing.trialEndsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "23:59";

  useEffect(() => {
    if (shown.current) return;
    if (!shouldShow(billing, location)) return;
    shown.current = true;
    localStorage.setItem(STORAGE_KEY, todayStr());
    setVisible(true);
  }, [billing, location]);

  if (!visible) return null;

  const handleSubscribe = () => { setVisible(false); navigate("/billing"); };
  const handleSkip     = () => setVisible(false);

  const accentColor = isLastDay ? "#ef4444" : "#6af82f";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md glass rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl">

        {/* Close (hidden on last day) */}
        {!isLastDay && (
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
          >
            <X size={16} />
          </button>
        )}

        {/* Icon */}
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
          style={{ backgroundColor: `${accentColor}18` }}
        >
          {isLastDay ? "⏰" : "🎁"}
        </div>

        {/* Headline */}
        <div className="text-center space-y-2">
          <h2 className="text-[22px] font-bold text-foreground">
            {isLastDay ? "Seu teste termina amanhã" : "Presente para você!"}
          </h2>
          <p className="text-[13.5px] text-muted-foreground leading-relaxed">
            {isLastDay
              ? `Às ${expiryTime} você perde acesso à plataforma. Não deixe seu negócio sem controle.`
              : "Você ganhou acesso completo ao Klaro gratuitamente. Aproveite para conhecer tudo e ver como podemos transformar seu controle financeiro."}
          </p>
        </div>

        {/* Countdown */}
        <div
          className="flex flex-col items-center px-10 py-5 rounded-2xl border"
          style={{ borderColor: `${accentColor}30`, backgroundColor: `${accentColor}0c` }}
        >
          <span className="text-[52px] font-bold leading-none" style={{ color: accentColor }}>{days}</span>
          <span className="text-[13px] font-medium mt-1" style={{ color: accentColor }}>
            {days === 1 ? "dia restante" : "dias restantes"}
          </span>
        </div>

        {/* Urgent banner */}
        {isLastDay && (
          <div className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl border border-red-300/30 bg-red-500/8">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <p className="text-[12.5px] text-red-500">
              Acesso expira amanhã às <span className="font-semibold">{expiryTime}</span>
            </p>
          </div>
        )}

        {/* Features */}
        {!isLastDay && (
          <ul className="w-full space-y-2.5">
            {[
              "Insights gerados por IA sobre seu negócio",
              "Upload de extratos com extração automática",
              "Chat financeiro inteligente",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2.5">
                <CheckCircle2 size={14} className="shrink-0 mt-0.5" style={{ color: accentColor }} />
                <span className="text-[13px] text-muted-foreground">{f}</span>
              </li>
            ))}
          </ul>
        )}

        {/* CTAs */}
        <div className="w-full space-y-3">
          <button
            onClick={handleSubscribe}
            className="w-full py-3.5 rounded-xl font-semibold text-[14px] transition-all hover:brightness-105"
            style={{ backgroundColor: accentColor, color: "#09090b" }}
          >
            {isLastDay ? "Garantir meu acesso agora" : "Assinar e garantir acesso"}
          </button>

          <button
            onClick={handleSkip}
            className="w-full py-2 text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            {isLastDay ? "Continuar por hoje" : "Explorar primeiro"}
          </button>
        </div>
      </div>
    </div>
  );
}
