import { useRequireAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Link } from "wouter";
import { Loader2, ArrowRight } from "lucide-react";
import { ScoreGauge, scoreColor, scoreLabel } from "@/components/HealthScoreCard";
import type { HealthScore } from "@/components/HealthScoreCard";

async function fetchHealthScore(): Promise<HealthScore> {
  const res = await fetch("/api/dashboard/health-score", { credentials: "include" });
  if (!res.ok) throw new Error("health-score fetch failed");
  return res.json() as Promise<HealthScore>;
}

interface ComponentMeta {
  key: string;
  label: string;
  actionLabel: string;
  actionHref: string;
}

const COMPONENT_META: ComponentMeta[] = [
  { key: "anamnese",      label: "Perfil do negócio",  actionLabel: "Completar diagnóstico", actionHref: "/anamnese" },
  { key: "dados",         label: "Dados em dia",        actionLabel: "Enviar dados",           actionHref: "/upload" },
  { key: "categorizacao", label: "Categorização",       actionLabel: "Revisar transações",     actionHref: "/transactions" },
  { key: "margem",        label: "Margem positiva",     actionLabel: "Ver insights",           actionHref: "/insights" },
  { key: "engajamento",   label: "Rotina diária",       actionLabel: "Ir para dashboard",      actionHref: "/dashboard" },
  { key: "missoes",       label: "Missões de insights", actionLabel: "Ver missões",            actionHref: "/missions" },
];

interface ComponentItem { value: number; max: number; [key: string]: unknown }

function ComponentRow({ item, meta }: { item: ComponentItem; meta: ComponentMeta }) {
  const pct = Math.min(1, item.value / item.max);
  const done = item.value >= item.max;
  const color = done ? "#2DD4BF" : item.value > 0 ? "#A78BFA" : "rgba(255,255,255,0.15)";

  return (
    <div className="flex items-center gap-4 py-3 border-b border-[var(--border)] last:border-0">
      <div className="shrink-0 w-2 h-2 rounded-full mt-0.5" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-white mb-1.5">{meta.label}</div>
        <div className="h-[4px] rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct * 100}%`, background: color }}
          />
        </div>
      </div>
      {!done ? (
        <Link
          href={meta.actionHref}
          className="shrink-0 flex items-center gap-1 text-[11.5px] text-[var(--accent)] hover:brightness-110 transition whitespace-nowrap"
        >
          {meta.actionLabel}
          <ArrowRight size={11} />
        </Link>
      ) : (
        <span className="shrink-0 text-[11.5px] text-[#7FE5C2] font-medium">Completo</span>
      )}
    </div>
  );
}

export default function Saude() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const { data, isLoading } = useQuery<HealthScore>({
    queryKey: ["/dashboard/health-score"],
    queryFn: fetchHealthScore,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  if (isAuthLoading) return null;

  return (
    <Layout title="Saúde da Gestão">
      <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-white">Saúde da Gestão</h1>
          <p className="text-[12.5px] text-[var(--muted)] mt-1">
            Entenda o que compõe sua pontuação e o que você pode fazer para melhorá-la.
          </p>
        </div>

        {isLoading || !data ? (
          <div className="glass rounded-2xl p-8 flex items-center justify-center">
            <Loader2 size={18} className="text-[var(--muted)] animate-spin" />
          </div>
        ) : (
          <>
            {/* Score hero */}
            <div className="glass rounded-2xl p-6 flex flex-col items-center gap-2">
              <ScoreGauge score={data.score} />
              <p className="text-[12px] text-[var(--muted)] text-center max-w-xs">
                Sua pontuação é calculada com base em seis dimensões do uso da plataforma.
              </p>
            </div>

            {/* Breakdown */}
            <div className="glass rounded-2xl px-5 py-2">
              {COMPONENT_META.map((meta) => {
                const item = (data.components as Record<string, ComponentItem>)[meta.key];
                if (!item) return null;
                return <ComponentRow key={meta.key} item={item} meta={meta} />;
              })}
            </div>

            {/* Context note */}
            <div className="text-[11.5px] text-[var(--muted)] leading-relaxed px-1">
              A pontuação é atualizada em tempo real conforme você usa a plataforma. Clique nos links acima para agir em cada dimensão.
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
