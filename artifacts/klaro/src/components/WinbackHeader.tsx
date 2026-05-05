import { useQuery } from "@tanstack/react-query";
import { Heart, Flame, Receipt, Lightbulb, Calendar, Mail } from "lucide-react";

interface WinbackContext {
  name: string;
  hadPaidSubscription: boolean;
  daysSinceExpired: number;
  daysUsing: number;
  transactionCount: number;
  insightCount: number;
  streakDays: number;
  lastPlan: string | null;
}

async function fetchWinback(): Promise<WinbackContext> {
  const res = await fetch("/api/billing/winback-context", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load winback context");
  return res.json() as Promise<WinbackContext>;
}

const SUPPORT_EMAIL = "contato@appklaro.com.br";

export function WinbackHeader() {
  const { data, isLoading } = useQuery<WinbackContext>({
    queryKey: ["/billing/winback-context"],
    queryFn: fetchWinback,
    refetchOnWindowFocus: false,
  });

  if (isLoading || !data) {
    return <div className="h-32 rounded-2xl bg-muted animate-pulse" />;
  }

  const isReturning = data.hadPaidSubscription;

  // Pick stats that are non-zero to show
  const stats = [
    data.transactionCount > 0 && {
      icon: Receipt,
      value: data.transactionCount.toLocaleString("pt-BR"),
      label: data.transactionCount === 1 ? "transação registrada" : "transações registradas",
    },
    data.insightCount > 0 && {
      icon: Lightbulb,
      value: data.insightCount.toLocaleString("pt-BR"),
      label: data.insightCount === 1 ? "insight gerado" : "insights gerados",
    },
    data.streakDays > 0 && {
      icon: Flame,
      value: data.streakDays.toLocaleString("pt-BR"),
      label: data.streakDays === 1 ? "dia de sequência" : "dias de sequência",
    },
    data.daysUsing >= 3 && {
      icon: Calendar,
      value: data.daysUsing.toLocaleString("pt-BR"),
      label: data.daysUsing === 1 ? "dia de Klaro" : "dias de Klaro",
    },
  ].filter(Boolean) as { icon: typeof Receipt; value: string; label: string }[];

  const subjectLine = isReturning
    ? `Cancelei minha assinatura Klaro — ${data.name}`
    : `Não vou continuar no Klaro — ${data.name}`;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-2">
          <Heart size={28} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          {isReturning ? `Bem-vindo de volta, ${firstName(data.name)}` : `Seu período acabou, ${firstName(data.name)}`}
        </h1>
        <p className="text-[14px] text-muted-foreground max-w-md mx-auto">
          {isReturning
            ? "Que bom te ver por aqui de novo. Sua conta e seus dados estão preservados — basta reativar pra continuar de onde parou."
            : "Você experimentou o Klaro nos últimos dias. Continue agora pra manter acesso aos seus dados, insights e rotinas."}
        </p>
      </div>

      {/* Stats grid — only shown if there's something meaningful */}
      {stats.length > 0 && (
        <div className="glass rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground text-center mb-4">
            O que está te esperando
          </p>
          <div className={`grid gap-3 ${stats.length === 1 ? "grid-cols-1" : stats.length === 2 ? "grid-cols-2" : stats.length === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
            {stats.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="text-center">
                  <Icon size={16} className="mx-auto text-primary mb-1.5" />
                  <div className="text-[20px] font-bold text-foreground tnum">{s.value}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Loss-aversion message */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <Heart size={14} className="text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-foreground mb-1">Seus dados continuam aqui</p>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            Tudo que você categorizou, registrou e descobriu fica salvo. Quando voltar,
            é só seguir do ponto exato — sem perder nenhum insight ou histórico.
          </p>
        </div>
      </div>

      {/* Soft "talk to us" CTA */}
      <div className="text-center">
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subjectLine)}`}
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Mail size={11} />
          Quer falar com a gente antes? <span className="underline ml-0.5">Manda um e-mail</span>
        </a>
      </div>
    </div>
  );
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}
