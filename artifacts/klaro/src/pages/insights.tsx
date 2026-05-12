import { useState, useEffect } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import {
  useListInsights,
  useGenerateInsights,
  usePinInsight,
  useGetMe,
  getListInsightsQueryKey,
  type Insight,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Lightbulb, RefreshCw, AlertTriangle, AlertOctagon, TrendingUp,
  Upload, Trash2, Trophy, Clock, CheckCircle2, Circle, Info,
  ChevronLeft, ChevronRight, EyeOff, CalendarRange,
} from "lucide-react";
import type { InsightsCoverage } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { AnamneseCta } from "@/components/anamnese-cta";
import { GeneratingInsightsOverlay } from "@/components/generating-insights-overlay";
import { RichContent } from "@/components/rich-content";

// ─── Lifecycle endpoints (direct fetch — bypasses generated client) ──────────

async function lifecycleAction(id: number, action: "dismiss" | "discard" | "archive" | "restore"): Promise<void> {
  const res = await fetch(`/api/insights/${id}/${action}`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Falha em ${action} (${res.status})`);
}

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

const PERIOD_DAYS: Record<Period, number> = {
  "30d": 30,
  "3m": 90,
  "6m": 180,
  "12m": 365,
};

function formatCoverageDate(date?: string | null): string {
  if (!date) return "?";
  return new Date(`${date}T00:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function buildCoverageNotice(coverage: InsightsCoverage) {
  const requestedLabel = PERIODS.find((p) => p.key === coverage.requestedPeriod)?.label ?? coverage.requestedPeriod;
  const availablePeriods = coverage.actualDays > 0
    ? PERIODS
        .filter((p) => PERIOD_DAYS[p.key] <= coverage.actualDays + 2)
        .map((p) => p.label)
    : [];

  const foundLabel = coverage.actualDays === 0
    ? "Sem transações"
    : coverage.actualStart === coverage.actualEnd
      ? `${coverage.actualDays} dia em ${formatCoverageDate(coverage.actualStart)}`
      : `${coverage.actualDays} dias · ${formatCoverageDate(coverage.actualStart)} a ${formatCoverageDate(coverage.actualEnd)}`;

  if (coverage.actualDays === 0) {
    return {
      title: `Sem dados em ${requestedLabel}`,
      requestedLabel,
      foundLabel,
      detail: coverage.lastDataDate
        ? `Último registro: ${formatCoverageDate(coverage.lastDataDate)}.`
        : "Nenhum lançamento encontrado ainda.",
      availability: "Envie dados recentes ou escolha um período que inclua seus lançamentos.",
    };
  }

  const detail = coverage.endGapDays >= 14 && coverage.startGapDays < 7
    ? `Últimos ${coverage.endGapDays} dias sem registros.`
    : coverage.startGapDays >= 7 && coverage.endGapDays < 14
      ? "Os registros começam depois do início solicitado."
      : "Há lacunas no começo e no fim do período.";

  return {
    title: `Dados parciais em ${requestedLabel}`,
    requestedLabel,
    foundLabel,
    detail,
    availability: availablePeriods.length > 0
      ? `Melhor cobertura: ${availablePeriods.join(", ")}.`
      : "Cobertura parcial para qualquer período.",
  };
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
  onDismiss,
  onDiscard,
  onPin,
}: {
  insight: Insight;
  onDismiss: () => void;
  onDiscard: () => void;
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

      <div className="text-[var(--muted)] leading-relaxed">
        <RichContent text={insight.description} />
      </div>

      {insight.recommendation && (
        <div
          className="px-3 py-2.5 rounded-lg border-l-[3px] leading-relaxed"
          style={{ backgroundColor: `${tone.color}10`, borderColor: tone.color, color: "var(--foreground)" }}
        >
          <RichContent text={insight.recommendation} />
        </div>
      )}

      <div className="flex items-center gap-1.5 pt-1 mt-auto flex-wrap">
        <button
          onClick={onDismiss}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.04)] border border-transparent hover:border-[var(--border)] transition-all"
          title="Tirar do carrossel sem descartar — fica disponível no histórico"
        >
          <EyeOff size={12} /> Dispensar
        </button>
        <button
          onClick={onDiscard}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium text-[var(--muted)] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.08)] border border-transparent hover:border-[rgba(239,68,68,0.2)] transition-all"
          title="Marcar como pouco útil"
        >
          <Trash2 size={12} /> Descartar
        </button>
        <button
          onClick={onPin}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium text-[var(--muted)] hover:text-[#10b981] hover:bg-[rgba(16,185,129,0.08)] border border-transparent hover:border-[rgba(16,185,129,0.2)] transition-all ml-auto"
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
  const pinInsight = usePinInsight();
  const [queue, setQueue] = useState<Insight[]>([]);
  const [attempted, setAttempted] = useState(false);
  const [mission, setMission] = useState<Insight | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("3m");
  const [coverage, setCoverage] = useState<InsightsCoverage | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const genStartedAt = useGenStartedAt();
  const [currentIndex, setCurrentIndex] = useState(0);
  const bp = (user as unknown as { businessProfile?: Record<string, unknown> } | undefined)?.businessProfile;
  const anamneseCompleted = !!bp?.anamneseCompleted;
  const selectedPeriodInfo = PERIODS.find((p) => p.key === selectedPeriod) ?? PERIODS[1];
  const coverageNotice = coverage?.hasGap ? buildCoverageNotice(coverage) : null;

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
    setGenError(null);
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
        setGenError("Erro ao gerar insights. Verifique sua conexão e tente novamente.");
        setAttempted(true);
      },
    });
  };

  // Remove from carousel + fire lifecycle mutation. Optimistic — rollback isn't worth it
  // for soft actions; if the request fails, the next refetch reconciles state.
  const handleLifecycle = (id: number, action: "dismiss" | "discard") => {
    setQueue((prev) => {
      const next = prev.filter((i) => i.id !== id);
      setCurrentIndex((ci) => Math.min(ci, Math.max(0, next.length - 1)));
      return next;
    });
    lifecycleAction(id, action)
      .then(() => queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() }))
      .catch((err) => setGenError(err instanceof Error ? err.message : "Erro ao processar ação."));
  };

  const handlePin = (item: Insight) => {
    pinInsight.mutate(item.id, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
        if (data) setMission(data);
      },
      onError: () => {
        queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
        setMission(null);
        setGenError("Não foi possível criar a missão. Tente novamente.");
      },
    });
    setQueue((prev) => {
      const next = prev.filter((i) => i.id !== item.id);
      setCurrentIndex((ci) => Math.min(ci, Math.max(0, next.length - 1)));
      return next;
    });
    setMission(item);
  };

  if (isAuthLoading) return null;

  return (
    <Layout title="Insights">
      <div className="max-w-2xl mx-auto space-y-6">
        {genStartedAt !== null && (
          <GeneratingInsightsOverlay startedAt={genStartedAt} />
        )}
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-white">Insights</h1>
            <p className="text-[12.5px] text-[var(--muted)] mt-1">Análises automáticas sobre a saúde do seu negócio.</p>
          </div>
          <Link
            href="/insights/historico"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.04)] border border-[var(--border)] transition-colors shrink-0"
          >
            <Clock size={12} /> Histórico
          </Link>
        </div>

        {/* Period selector */}
        <div className="glass rounded-2xl p-3 sm:p-3.5 border border-[var(--border)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-2.5 sm:w-44 sm:shrink-0">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[rgba(106,248,47,0.24)] bg-[rgba(106,248,47,0.10)] text-[#90f048]">
                <CalendarRange size={16} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">Período</p>
                  {selectedPeriodInfo.recommended && (
                    <span className="rounded-full bg-[rgba(106,248,47,0.12)] px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-[#90f048] ring-1 ring-[rgba(106,248,47,0.24)]">
                      Rec.
                    </span>
                  )}
                </div>
                <p className="truncate text-[13px] font-semibold text-white">{selectedPeriodInfo.range}</p>
              </div>
            </div>

            <div
              role="radiogroup"
              aria-label="Período da análise"
              className="grid grid-cols-4 gap-1 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.025)] p-1 sm:flex-1"
            >
              {PERIODS.map((p) => {
                const selected = selectedPeriod === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedPeriod(p.key)}
                    disabled={generateInsights.isPending}
                    title={p.description}
                    className={`relative h-9 rounded-lg px-2 text-[11.5px] font-semibold transition-all disabled:pointer-events-none disabled:opacity-50 ${
                      selected
                        ? "bg-[var(--accent)] text-[#09090b] shadow-[0_8px_22px_-16px_rgba(106,248,47,0.9)]"
                        : "text-[var(--muted)] hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
                    }`}
                  >
                    {p.recommended && !selected && (
                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#90f048]" />
                    )}
                    {p.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleGenerate}
              disabled={generateInsights.isPending}
              className="btn-primary flex h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold disabled:opacity-50 sm:w-auto sm:shrink-0"
            >
              <RefreshCw size={14} className={generateInsights.isPending ? "animate-spin" : ""} />
              <span>{generateInsights.isPending ? "Analisando…" : "Gerar"}</span>
              <span className="hidden sm:inline">insights</span>
            </button>
          </div>

          <p className="mt-2.5 border-t border-[var(--border)] pt-2.5 text-[11.5px] leading-relaxed text-[var(--muted)] sm:ml-[11.5rem]">
            {selectedPeriodInfo.description}
          </p>
        </div>

        {/* Coverage warning */}
        {coverageNotice && (
          <div className="rounded-xl border border-[rgba(245,158,11,0.24)] bg-[rgba(245,158,11,0.06)] px-3.5 py-3">
            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[rgba(245,158,11,0.12)] text-[#f59e0b]">
                <Info size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[12.5px] font-semibold text-[#fbbf24]">{coverageNotice.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-[#f59e0b]/85">
                      {coverageNotice.detail} Insights gerados com os dados encontrados.
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <span className="rounded-full border border-[rgba(245,158,11,0.22)] bg-[rgba(0,0,0,0.12)] px-2 py-1 text-[10.5px] font-medium text-[#fbbf24]">
                      Pedido: {coverageNotice.requestedLabel}
                    </span>
                    <span className="rounded-full border border-[rgba(245,158,11,0.22)] bg-[rgba(0,0,0,0.12)] px-2 py-1 text-[10.5px] font-medium text-[#fbbf24]">
                      Dados: {coverageNotice.foundLabel}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-[var(--muted)]">
                  {coverageNotice.availability}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Generation error */}
        {genError && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl border border-red-300/40 bg-red-500/8 dark:bg-red-950/20">
            <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-red-600 dark:text-red-400 leading-relaxed flex-1">{genError}</p>
            <button onClick={() => setGenError(null)} className="text-red-400 hover:text-red-600 text-base leading-none ml-1">×</button>
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
                  onDismiss={() => handleLifecycle(queue[currentIndex]!.id, "dismiss")}
                  onDiscard={() => handleLifecycle(queue[currentIndex]!.id, "discard")}
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
