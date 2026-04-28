import { useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import {
  useListInsights,
  useGenerateInsights,
  useArchiveInsight,
  getListInsightsQueryKey,
  type Insight,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Lightbulb, RefreshCw, AlertTriangle, AlertOctagon, TrendingUp, Upload, X, Share2, Check } from "lucide-react";
import { Link } from "wouter";

export default function Insights() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const queryClient = useQueryClient();
  const { data: insights, isLoading } = useListInsights();
  const generateInsights = useGenerateInsights();
  const archiveInsight = useArchiveInsight();
  const [attempted, setAttempted] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleGenerate = () => {
    generateInsights.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
        setAttempted(true);
      },
      onError: () => setAttempted(true),
    });
  };

  const handleArchive = (id: number) => {
    queryClient.setQueryData(getListInsightsQueryKey(), (old: Insight[] | undefined) =>
      old ? old.filter((i) => i.id !== id) : old
    );
    archiveInsight.mutate(id, {
      onError: () => queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() }),
    });
  };

  const handleShare = async (insight: Insight) => {
    const text = `${insight.title}\n\n${insight.description}${insight.recommendation ? `\n\nRecomendação: ${insight.recommendation}` : ""}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: insight.title, text });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(text);
    setCopiedId(insight.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isAuthLoading) return null;

  const TONE_CONFIG = {
    positive: {
      icon: <TrendingUp size={13} />,
      badge: "bg-[rgba(16,185,129,0.12)] text-[#10b981]",
      border: "border-[rgba(16,185,129,0.2)]",
    },
    warning: {
      icon: <AlertTriangle size={13} />,
      badge: "bg-[rgba(245,158,11,0.12)] text-[#f59e0b]",
      border: "border-[rgba(245,158,11,0.2)]",
    },
    critical: {
      icon: <AlertOctagon size={13} />,
      badge: "bg-[rgba(239,68,68,0.12)] text-[#ef4444]",
      border: "border-[rgba(239,68,68,0.2)]",
    },
    neutral: {
      icon: <Lightbulb size={13} />,
      badge: "bg-[var(--accent-soft)] text-[#90f048]",
      border: "",
    },
  } as const;

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
            {attempted ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-[rgba(245,158,11,0.12)] grid place-items-center">
                  <Upload size={22} className="text-[#f59e0b]" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-white">Não foi possível gerar insights</div>
                  <p className="text-[12.5px] text-[var(--muted)] max-w-sm mt-1 leading-relaxed">
                    Verifique se suas transações foram <strong className="text-white">confirmadas</strong> após o upload (tela de revisão → "Confirmar Registros"). Se já confirmou, tente gerar novamente.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link href="/upload" className="btn-primary px-5 py-2 rounded-xl text-[13px] font-semibold inline-flex items-center gap-1.5">
                    <Upload size={13} />
                    Fazer upload
                  </Link>
                  <button
                    onClick={handleGenerate}
                    disabled={generateInsights.isPending}
                    className="px-5 py-2 rounded-xl text-[13px] font-medium border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-[var(--border-2)] transition-colors disabled:opacity-50"
                  >
                    Tentar novamente
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-[var(--accent-soft)] grid place-items-center">
                  <Lightbulb size={22} className="text-[#90f048]" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-white">Nenhum insight ainda</div>
                  <p className="text-[12.5px] text-[var(--muted)] max-w-xs mt-1 leading-relaxed">
                    Gere uma análise automática com base nas suas transações.
                  </p>
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generateInsights.isPending}
                  className="btn-primary px-5 py-2 rounded-xl text-[13px] font-semibold disabled:opacity-50"
                >
                  Gerar análise
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {insights.map((insight) => {
              const cfg = TONE_CONFIG[insight.tone ?? "neutral"] ?? TONE_CONFIG.neutral;
              const copied = copiedId === insight.id;

              return (
                <div
                  key={insight.id}
                  className={`glass rounded-2xl p-5 transition-colors border ${cfg.border || "border-[var(--border)]"} hover:border-[var(--border-2)]`}
                >
                  {/* Header row */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${cfg.badge}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-white leading-snug">{insight.title}</div>
                      {insight.periodLabel && (
                        <div className="text-[11px] text-[var(--muted)] mt-0.5">{insight.periodLabel}</div>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleShare(insight)}
                        title={copied ? "Copiado!" : "Compartilhar"}
                        className="w-7 h-7 grid place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors"
                      >
                        {copied ? <Check size={13} className="text-[#10b981]" /> : <Share2 size={13} />}
                      </button>
                      <button
                        onClick={() => handleArchive(insight.id)}
                        title="Arquivar"
                        className="w-7 h-7 grid place-items-center rounded-lg text-[var(--muted)] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] transition-colors"
                      >
                        <X size={13} />
                      </button>
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
