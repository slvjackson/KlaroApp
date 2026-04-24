import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { useListInsights, useGenerateInsights, getListInsightsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Lightbulb, RefreshCw, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

export default function Insights() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const queryClient = useQueryClient();
  const { data: insights, isLoading } = useListInsights();
  const generateInsights = useGenerateInsights();

  const handleGenerate = () => {
    generateInsights.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
      },
    });
  };

  if (isAuthLoading) return null;

  function getIcon(title: string) {
    const t = title.toLowerCase();
    if (t.includes("aumento") || t.includes("crescimento") || t.includes("positivo"))
      return <TrendingUp size={13} />;
    if (t.includes("queda") || t.includes("redução") || t.includes("negativo"))
      return <TrendingDown size={13} />;
    if (t.includes("alerta") || t.includes("atenção"))
      return <AlertCircle size={13} />;
    return <Lightbulb size={13} />;
  }

  function getTone(title: string) {
    const t = title.toLowerCase();
    if (t.includes("aumento") || t.includes("crescimento") || t.includes("positivo")) return "good";
    if (t.includes("alerta") || t.includes("atenção")) return "warn";
    return "neutral";
  }

  return (
    <Layout title="Insights">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-white">Insights</h1>
            <p className="text-[12.5px] text-[var(--muted)] mt-1">Análises automáticas sobre a saúde do seu negócio.</p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generateInsights.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] text-[12.5px] text-[var(--muted)] hover:text-white hover:border-[var(--border-2)] transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={generateInsights.isPending ? "animate-spin" : ""} />
            {generateInsights.isPending ? "Analisando…" : "Gerar novos insights"}
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass rounded-2xl p-5 animate-pulse h-40" />
            ))}
          </div>
        ) : !insights || insights.length === 0 ? (
          <div className="glass rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] grid place-items-center">
              <Lightbulb size={22} className="text-[#a18bff]" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-white">Nenhum insight disponível</div>
              <p className="text-[12.5px] text-[var(--muted)] max-w-xs mt-1 leading-relaxed">
                Adicione mais transações para que nossa IA possa analisar seu negócio.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generateInsights.isPending}
              className="btn-primary px-5 py-2 rounded-xl text-[13px] font-semibold text-white disabled:opacity-50"
            >
              Gerar análise
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {insights.map((insight) => {
              const tone = getTone(insight.title);
              const iconCls =
                tone === "good" ? "bg-[var(--income-soft)] text-[var(--income)]" :
                tone === "warn" ? "bg-[rgba(245,158,11,0.12)] text-[#f59e0b]" :
                "bg-[var(--accent-soft)] text-[#a18bff]";

              return (
                <div
                  key={insight.id}
                  className="glass rounded-2xl p-5 hover:border-[var(--border-2)] transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${iconCls}`}>
                      {getIcon(insight.title)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-white leading-snug">{insight.title}</div>
                      {insight.periodLabel && (
                        <div className="text-[11px] text-[var(--muted)] mt-0.5">{insight.periodLabel}</div>
                      )}
                    </div>
                  </div>

                  <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">{insight.description}</p>

                  {insight.recommendation && (
                    <div className="mt-3 pt-3 border-t border-[var(--border)]">
                      <div className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-[0.14em] mb-1">Recomendação</div>
                      <p className="text-[12.5px] text-[var(--accent)] leading-relaxed">{insight.recommendation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
