import { useState, useEffect } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import {
  useListInsights,
  useGenerateInsights,
  useArchiveInsight,
  usePinInsight,
  useGetMe,
  getListInsightsQueryKey,
  type Insight,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Lightbulb, RefreshCw, AlertTriangle, AlertOctagon, TrendingUp,
  Upload, Trash2, Trophy, Clock, CheckCircle2, Circle, Info,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import type { InsightsCoverage } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { AnamneseCta } from "@/components/anamnese-cta";
import { GeneratingInsightsOverlay } from "@/components/generating-insights-overlay";

// ── Mini observable store — survives page unmounts, re-renders subscribers ──
let _genStartedAt: number | null = null;
const _genListeners = new Set<() => void>();
function genStart() { _genStartedAt = Date.now(); _genListeners.forEach((f) => f()); }
function genEnd()   { _genStartedAt = null;        _genListeners.forEach((f) => f()); }
function useGenStartedAt() {
  const [v, setV] = useState<number | null>(() => _genStartedAt);
  useEffect(() => {
    const sync = () => setV(_genStartedAt);
    _genListeners.add(sync);
    return () => { _genListeners.delete(sync); };
  }, []);
  return v;
}

// ─── Period options ───────────────────────────────────────────────────────────

import type { GenerateInsightsBodyPeriod } from "@workspace/api-client-react";

type Period = GenerateInsightsBodyPeriod;

const PERIODS: {
  key: Period;
  label: string;
  range: string;
  description: string;
  recommended?: boolean;
}[] = [
  {
    key: "30d",
    label: "30 dias",
    range: "Último mês",
    description: "Foco nas movimentações mais recentes. Bom para ajustes rápidos no caixa.",
  },
  {
    key: "3m",
    label: "3 meses",
    range: "Último trimestre",
    description: "Equilibra detalhes e tendências. Ideal para a maioria dos negócios.",
    recommended: true,
  },
  {
    key: "6m",
    label: "6 meses",
    range: "Último semestre",
    description: "Identifica sazonalidades e ciclos. Útil para planejar estoques e campanhas.",
  },
  {
    key: "12m",
    label: "12 meses",
    range: "Último ano",
    description: "Visão completa do ciclo anual. Melhor para planejamento e metas anuais.",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type InsightTone = "positive" | "warning" | "critical" | "neutral";

const TONE_CONFIG: Record<InsightTone, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  positive: {
    icon: <TrendingUp size={14} />,
    color: "#10b981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.20)",
  },
  warning: {
    icon: <AlertTriangle size={14} />,
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.20)",
  },
  critical: {
    icon: <AlertOctagon size={14} />,
    color: "#ef4444",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.20)",
  },
  neutral: {
    icon: <Lightbulb size={14} />,
    color: "#90f048",
    bg: "rgba(106,248,47,0.08)",
    border: "rgba(106,248,47,0.15)",
  },
};

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

function isStale(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() > STALE_MS;
}

// ─── Mission modal ─────────────────────────────────────────────────────────────

function MissionModal({ insight, isPending, onClose }: { insight: Insight; isPending: boolean; onClose: () => void }) {
  const [, navigate] = useLocation();
  const steps = insight.steps ?? [];
  const [checked, setChecked] = useState<boolean[]>([]);

  useEffect(() => {
    setChecked((insight.steps ?? []).map(() => false));
  }, [insight.steps]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 flex flex-col gap-4 border border-[var(--border-2)]">
        <div className="w-10 h-1 rounded-full bg-[var(--muted)]/40 mx-auto sm:hidden" />

        <div className="flex items-center gap-2 self-start px-3 py-1.5 rounded-full bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.2)]">
          <Trophy size={13} className="text-[#10b981]" />
          <span className="text-[12px] font-semibold text-[#10b981]">Missão criada!</span>
        </div>

        <h3 className="text-[16px] font-bold text-white leading-snug">{insight.title}</h3>

        {isPending ? (
          <div className="flex flex-col items-center gap-3 py-5">
            <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
            <p className="text-[12.5px] text-[var(--muted)]">Gerando plano de ação…</p>
          </div>
        ) : (
          <>
            {steps.length > 0 && (
              <p className="text-[12.5px] text-[var(--muted)]">Passos para colocar em prática:</p>
            )}
            <div className="flex flex-col gap-2.5">
              {steps.map((step, i) => (
                <button
                  key={i}
                  onClick={() => setChecked((prev) => prev.map((v, idx) => idx === i ? !v : v))}
                  className="flex items-center gap-3 text-left group"
                >
                  {checked[i]
                    ? <CheckCircle2 size={18} className="text-[#10b981] shrink-0" />
                    : <Circle size={18} className="text-[var(--muted)] shrink-0 group-hover:text-[var(--accent)]" />}
                  <span className={`text-[13.5px] transition-colors ${checked[i] ? "line-through text-[var(--muted)]" : "text-white"}`}>
                    {step}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={() => { onClose(); navigate("/missions"); }}
          disabled={isPending}
          className="btn-primary w-full py-3 rounded-xl text-[14px] font-semibold mt-1 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? "Aguarde…" : "Ver missão →"}
        </button>
      </div>
    </div>
  );
}

// ─── Insight card ──────────────────────────────────────────────────────────────

function InsightCard({
  insight,
  onArchive,
  onPin,
}: {
  insight: Insight;
  onArchive: () => void;
  onPin: () => void;
}) {
  const tone = TONE_CONFIG[insight.tone as InsightTone] ?? TONE_CONFIG.neutral;
  const stale = isStale((insight as unknown as { createdAt?: string }).createdAt);

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 border"
      style={{ backgroundColor: "var(--card)", borderColor: tone.border }}
    >
      {stale && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.07)]">
          <Clock size={13} className="text-[#f59e0b] shrink-0 mt-0.5" />
          <p className="text-[11.5px] text-[#f59e0b] leading-snug">
            Esse insight tem mais de 7 dias. Descarte ou salve como missão.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg grid place-items-center shrink-0"
            style={{ backgroundColor: tone.bg, color: tone.color }}
          >
            {tone.icon}
          </div>
          <span className="text-[13.5px] font-semibold text-white leading-snug">{insight.title}</span>
        </div>
        {insight.periodLabel && (
          <span className="text-[10.5px] text-[var(--muted)] uppercase tracking-wide shrink-0">{insight.periodLabel}</span>
        )}
      </div>

      <p className="text-[13px] text-[var(--muted)] leading-relaxed">{insight.description}</p>

      {insight.recommendation && (
        <div
          className="px-3 py-2.5 rounded-lg border-l-[3px] text-[12.5px] leading-relaxed"
          style={{ backgroundColor: `${tone.color}10`, borderColor: tone.color, color: "var(--foreground)" }}
        >
          {insight.recommendation}
        </div>
      )}

      <div className="flex items-center gap-2 pt-1 mt-auto">
        <button
          onClick={onArchive}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--muted)] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] border border-transparent hover:border-[rgba(239,68,68,0.2)] transition-all"
        >
          <Trash2 size={12} /> Descartar
        </button>
        <button
          onClick={onPin}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--muted)] hover:text-[#10b981] hover:bg-[rgba(16,185,129,0.08)] border border-transparent hover:border-[rgba(16,185,129,0.2)] transition-all"
        >
          <Trophy size={12} /> Criar missão
        </button>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Insights() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const { data: rawInsights, isLoading } = useListInsights();
  const generateInsights = useGenerateInsights();
  const archiveInsight = useArchiveInsight();
  const pinInsight = usePinInsight();
  const [queue, setQueue] = useState<Insight[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [mission, setMission] = useState<Insight | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("3m");
  const [coverage, setCoverage] = useState<InsightsCoverage | null>(null);
  const genStartedAt = useGenStartedAt();
  const [currentIndex, setCurrentIndex] = useState(0);
  const bp = (user as unknown as { businessProfile?: Record<string, unknown> } | undefined)?.businessProfile;
  const anamneseCompleted = !!bp?.anamneseCompleted;

  useEffect(() => {
    if (!isLoading && rawInsights) {
      setQueue((rawInsights as Insight[]).filter((i) => !i.pinnedAt));
      setCurrentIndex(0);
    }
  }, [rawInsights, isLoading]);

  // Keyboard navigation for desktop
  useEffect(() => {
    if (queue.length === 0) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setCurrentIndex((i) => Math.min(queue.length - 1, i + 1));
      if (e.key === "ArrowLeft")  setCurrentIndex((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queue.length]);

  const handleGenerate = () => {
    genStart();
    generateInsights.mutate({ period: selectedPeriod }, {
      onSuccess: (data) => {
        genEnd();
        queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
        setCoverage(data.coverage ?? null);
        setQueue((data.insights ?? []).filter((i) => !i.pinnedAt));
        setAttempted(true);
      },
      onError: () => {
        genEnd();
        setAttempted(true);
      },
    });
  };

  const handleArchive = (id: number) => {
    archiveInsight.mutate(id);
    setQueue((prev) => {
      const next = prev.filter((i) => i.id !== id);
      setCurrentIndex((ci) => Math.min(ci, Math.max(0, next.length - 1)));
      return next;
    });
  };

  const handlePin = (item: Insight) => {
    pinInsight.mutate(item.id, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
        if (data) setMission(data);
      },
    });
    setQueue((prev) => prev.filter((i) => i.id !== item.id));
    setMission(item);
  };

  if (isAuthLoading) return null;

  return (
    <Layout title="Insights">
      <div className="relative space-y-5 max-w-3xl min-h-[400px]">
        {genStartedAt !== null && (
          <GeneratingInsightsOverlay startedAt={genStartedAt} />
        )}
        {/* Header */}
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-white">Insights</h1>
          <p className="text-[12.5px] text-[var(--muted)] mt-1">Análises automáticas sobre a saúde do seu negócio.</p>
        </div>

        {/* Period selector */}
        <div className="glass rounded-2xl p-5 flex flex-col gap-4 border border-[var(--border)]">
          <div>
            <p className="text-[13.5px] font-semibold text-white">Qual período a IA deve analisar?</p>
            <p className="text-[12px] text-[var(--muted)] mt-1 leading-relaxed">
              A IA vai usar as transações desse período como fonte de dados para identificar padrões e gerar recomendações para o seu negócio.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {PERIODS.map((p) => {
              const selected = selectedPeriod === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setSelectedPeriod(p.key)}
                  disabled={generateInsights.isPending}
                  className={`flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all disabled:pointer-events-none ${
                    selected
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                      : "border-[var(--border)] bg-[rgba(255,255,255,0.02)] hover:border-[var(--border-2)]"
                  }`}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-[14px] font-bold ${selected ? "text-[#90f048]" : "text-white"}`}>
                      {p.label}
                    </span>
                    {p.recommended && (
                      <span className="text-[9px] font-bold uppercase tracking-wide text-[#90f048] bg-[rgba(106,248,47,0.12)] px-1.5 py-0.5 rounded-full border border-[rgba(106,248,47,0.3)]">
                        Recomendado
                      </span>
                    )}
                  </div>
                  <span className={`text-[11px] font-medium ${selected ? "text-[#90f048]/80" : "text-[var(--muted)]"}`}>
                    {p.range}
                  </span>
                  <span className="text-[11px] text-[var(--muted)] leading-snug mt-0.5">
                    {p.description}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generateInsights.isPending}
            className="btn-primary w-full py-3 rounded-xl text-[13.5px] font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={14} className={generateInsights.isPending ? "animate-spin" : ""} />
            {generateInsights.isPending ? "Analisando…" : "Gerar insights"}
          </button>
        </div>

        {/* Coverage warning */}
        {coverage?.hasGap && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.07)]">
            <Info size={15} className="text-[#f59e0b] shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-[#f59e0b] leading-relaxed">
              <span className="font-semibold">Dados insuficientes para o período solicitado. </span>
              {(() => {
                const label = PERIODS.find(p => p.key === coverage.requestedPeriod)?.label ?? coverage.requestedPeriod;
                const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

                if (coverage.actualDays === 0) {
                  // No data at all in the requested window
                  return <>Você pediu <span className="font-semibold">{label}</span>, mas não há transações registradas nesse intervalo.{coverage.lastDataDate && <> Seus dados mais recentes são de <span className="font-semibold">{fmtDate(coverage.lastDataDate)}</span>.</>}</>;
                }
                if (coverage.endGapDays >= 14 && coverage.startGapDays < 7) {
                  // Data is present but doesn't reach close to today (gap at the end)
                  return <>Você pediu <span className="font-semibold">{label}</span>, mas seus dados mais recentes neste período são de <span className="font-semibold">{coverage.actualEnd ? fmtDate(coverage.actualEnd) : "?"}</span> — os últimos <span className="font-semibold">{coverage.endGapDays} dias</span> não têm registros. Os insights foram gerados com os dados disponíveis.</>;
                }
                if (coverage.startGapDays >= 7 && coverage.endGapDays < 14) {
                  // Gap at the beginning only
                  return <>Você pediu <span className="font-semibold">{label}</span>, mas seus registros cobrem apenas <span className="font-semibold">{coverage.actualDays} {coverage.actualDays === 1 ? "dia" : "dias"}</span> desse período. Os insights foram gerados com os dados disponíveis.</>;
                }
                // Both gaps
                return <>Você pediu <span className="font-semibold">{label}</span>, mas seus dados nesse período vão de <span className="font-semibold">{coverage.actualStart ? fmtDate(coverage.actualStart) : "?"}</span> a <span className="font-semibold">{coverage.actualEnd ? fmtDate(coverage.actualEnd) : "?"}</span> ({coverage.actualDays} {coverage.actualDays === 1 ? "dia" : "dias"}). Os insights foram gerados com os dados disponíveis.</>;
              })()}
            </p>
          </div>
        )}

        <AnamneseCta completed={anamneseCompleted} />

        {isLoading ? (
          <div className="glass rounded-2xl p-5 animate-pulse h-52" />
        ) : queue.length === 0 ? (
          <div className="glass rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
            {attempted ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-[rgba(245,158,11,0.12)] grid place-items-center">
                  <Upload size={22} className="text-[#f59e0b]" />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-white">Não foi possível gerar insights</div>
                  <p className="text-[12.5px] text-[var(--muted)] max-w-sm mt-1 leading-relaxed">
                    Verifique se suas transações foram <strong className="text-white">confirmadas</strong> após o upload.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link href="/upload" className="btn-primary px-5 py-2 rounded-xl text-[13px] font-semibold inline-flex items-center gap-1.5">
                    <Upload size={13} /> Fazer upload
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
                  {generateInsights.isPending ? "Analisando…" : "Gerar análise"}
                </button>
              </>
            )}
          </div>
        ) : (
          // ── Deck view ──────────────────────────────────────────────────────
          <div>
            {/* Stacked layers behind the active card */}
            <div className="relative pb-2">
              {queue.length > 2 && (
                <div
                  className="absolute inset-x-6 top-2 bottom-0 rounded-2xl border border-[var(--border)]"
                  style={{ background: "var(--card)", opacity: 0.3, zIndex: 0 }}
                />
              )}
              {queue.length > 1 && (
                <div
                  className="absolute inset-x-3 top-1 bottom-0 rounded-2xl border border-[var(--border)]"
                  style={{ background: "var(--card)", opacity: 0.6, zIndex: 1 }}
                />
              )}
              <div key={currentIndex} className="relative" style={{ zIndex: 2 }}>
                <InsightCard
                  insight={queue[currentIndex]!}
                  onArchive={() => handleArchive(queue[currentIndex]!.id)}
                  onPin={() => handlePin(queue[currentIndex]!)}
                />
              </div>
            </div>

            {/* Navigation row */}
            <div className="flex items-center justify-between mt-4 px-1">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12.5px] text-[var(--muted)] hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft size={15} /> Anterior
              </button>

              {/* Dots */}
              <div className="flex items-center gap-1.5">
                {queue.slice(0, 8).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIndex(i)}
                    className="rounded-full transition-all duration-200"
                    style={{
                      width: i === currentIndex ? 16 : 8,
                      height: 8,
                      background: i === currentIndex ? "var(--accent)" : "var(--border-2)",
                    }}
                  />
                ))}
                {queue.length > 8 && (
                  <span className="text-[11px] text-[var(--muted)] ml-1">+{queue.length - 8}</span>
                )}
              </div>

              <button
                onClick={() => setCurrentIndex((i) => Math.min(queue.length - 1, i + 1))}
                disabled={currentIndex === queue.length - 1}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-[12.5px] text-[var(--muted)] hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-colors"
              >
                Próximo <ChevronRight size={15} />
              </button>
            </div>

            <p className="text-center text-[11px] mt-1.5 opacity-40" style={{ color: "var(--muted)" }}>
              {currentIndex + 1} de {queue.length} insights · use ← → para navegar
            </p>
          </div>
        )}
      </div>

      {mission && (
        <MissionModal
          insight={mission}
          isPending={pinInsight.isPending}
          onClose={() => setMission(null)}
        />
      )}
    </Layout>
  );
}
