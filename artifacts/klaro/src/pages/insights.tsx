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
import { FeatureTutorial, TutorialButton, type TutorialStep } from "@/components/feature-tutorial";

const INSIGHTS_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Gere uma nova análise",
    body: "A IA varre suas transações no período e devolve insights práticos. Análises são geradas sob demanda — só quando você pede.",
    tip: "Rode toda segunda de manhã. Cinco minutos depois você tem o panorama da semana passada.",
    target: "#tutorial-insights-generate",
  },
  {
    title: "Mude o período",
    body: "Aqui você define qual recorte a IA analisa: último mês, 3 meses, 6 meses ou customizado. A profundidade da análise muda com a janela.",
    tip: "Períodos maiores acham padrões; períodos curtos acham o que mudou recentemente.",
    target: "#tutorial-insights-period",
  },
  {
    title: "Anatomia do insight",
    body: (
      <>
        Cada card tem um título, uma análise e — quando faz sentido — uma <b>recomendação prática</b>.
        Embaixo, três ações:
        <ul className="mt-2 space-y-1 list-disc pl-5">
          <li><b>Dispensar</b>: tira do carrossel mas mantém no histórico, caso queira revisitar depois.</li>
          <li><b>Descartar</b>: marca como pouco útil — a IA aprende com isso e ajusta as próximas.</li>
          <li><b>Criar missão</b>: transforma a recomendação em checklist acionável em Missões.</li>
        </ul>
      </>
    ),
    tip: "No desktop, use ← e → para navegar entre os insights sem tirar a mão do teclado.",
    target: "#tutorial-insights-card",
  },
  {
    title: "Consulte o histórico",
    body: "Toda análise gerada fica salva. Use o histórico para comparar como o negócio evoluiu mês a mês.",
    tip: "Reabra um insight antigo antes de gerar um novo — assim você vê o que melhorou (ou piorou).",
    target: "#tutorial-insights-history",
  },
];

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

// ─── Period generate modal ───────────────────────────────────────────────────

function PeriodGenerateModal({
  period,
  isPending,
  onChangePeriod,
  onClose,
  onGenerate,
}: {
  period: Period;
  isPending: boolean;
  onChangePeriod: (period: Period) => void;
  onClose: () => void;
  onGenerate: () => void;
}) {
  const selected = PERIODS.find((p) => p.key === period) ?? PERIODS[1];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={isPending ? undefined : onClose} />
      <div className="relative w-full rounded-t-3xl border border-[var(--border-2)] p-4 sm:max-w-md sm:rounded-2xl sm:p-5 glass-strong">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--muted)]/40 sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[rgba(106,248,47,0.24)] bg-[rgba(106,248,47,0.10)] text-[#90f048]">
              <CalendarRange size={17} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white">Gerar insights</h2>
              <p className="mt-0.5 text-[12px] text-[var(--muted)]">Escolha o recorte da análise.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="grid h-8 w-8 place-items-center rounded-lg text-[20px] leading-none text-[var(--muted)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-white disabled:opacity-40"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {PERIODS.map((p) => {
            const active = p.key === period;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onChangePeriod(p.key)}
                disabled={isPending}
                className={`min-h-[76px] rounded-xl border p-3 text-left transition-all disabled:pointer-events-none disabled:opacity-50 ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[rgba(255,255,255,0.025)] hover:border-[var(--border-2)] hover:bg-[rgba(255,255,255,0.04)]"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-[13px] font-bold ${active ? "text-[#90f048]" : "text-white"}`}>{p.label}</span>
                  {p.recommended && (
                    <span className="rounded-full bg-[rgba(106,248,47,0.12)] px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wide text-[#90f048] ring-1 ring-[rgba(106,248,47,0.24)]">
                      Rec.
                    </span>
                  )}
                </div>
                <p className={`mt-1 text-[11px] font-medium ${active ? "text-[#90f048]/85" : "text-[var(--muted)]"}`}>
                  {p.range}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.025)] px-3 py-2.5">
          <p className="text-[11.5px] leading-relaxed text-[var(--muted)]">{selected.description}</p>
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={isPending}
          className="btn-primary mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13.5px] font-semibold disabled:opacity-50"
        >
          <RefreshCw size={14} className={isPending ? "animate-spin" : ""} />
          {isPending ? "Analisando…" : `Gerar com ${selected.label}`}
        </button>
      </div>
    </div>
  );
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
  const [draftPeriod, setDraftPeriod] = useState<Period>("3m");
  const [periodFormOpen, setPeriodFormOpen] = useState(false);
  const [coverage, setCoverage] = useState<InsightsCoverage | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [coverageDetailsOpen, setCoverageDetailsOpen] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const genStartedAt = useGenStartedAt();
  const [currentIndex, setCurrentIndex] = useState(0);
  const bp = (user as unknown as { businessProfile?: Record<string, unknown> } | undefined)?.businessProfile;
  const anamneseCompleted = !!bp?.anamneseCompleted;
  const selectedPeriodInfo = PERIODS.find((p) => p.key === selectedPeriod) ?? PERIODS[1];
  const coverageNotice = coverage?.hasGap ? buildCoverageNotice(coverage) : null;

  const openPeriodForm = () => {
    setDraftPeriod(selectedPeriod);
    setPeriodFormOpen(true);
  };

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

  const handleGenerate = (period: Period = selectedPeriod) => {
    setSelectedPeriod(period);
    setPeriodFormOpen(false);
    genStart();
    setGenError(null);
    generateInsights.mutate({ period }, {
      onSuccess: (data) => {
        genEnd();
        queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
        setCoverage(data.coverage ?? null);
        setCoverageDetailsOpen(false);
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
      <div className="space-y-5 md:space-y-6">
        {genStartedAt !== null && (
          <GeneratingInsightsOverlay startedAt={genStartedAt} />
        )}
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="max-w-4xl">
            <h1 className="text-[22px] font-bold tracking-tight text-white">Insights</h1>
            <p className="text-[12.5px] text-[var(--muted)] mt-1">Análises automáticas sobre a saúde do seu negócio.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <TutorialButton onClick={() => setTutorialOpen(true)} />
            <Link
              id="tutorial-insights-history"
              href="/insights/historico"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.04)] border border-[var(--border)] transition-colors"
            >
              <Clock size={12} /> Histórico
            </Link>
          </div>
        </div>

        {/* Generate action */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            id="tutorial-insights-generate"
            type="button"
            onClick={openPeriodForm}
            disabled={generateInsights.isPending}
            className="btn-primary flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13.5px] font-semibold disabled:opacity-50 sm:w-auto"
          >
            <RefreshCw size={14} className={generateInsights.isPending ? "animate-spin" : ""} />
            {generateInsights.isPending ? "Analisando…" : "Gerar insights"}
          </button>

          <button
            id="tutorial-insights-period"
            type="button"
            onClick={openPeriodForm}
            disabled={generateInsights.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.025)] px-3 py-2 text-[11.5px] font-medium text-[var(--muted)] transition-colors hover:border-[var(--border-2)] hover:text-white disabled:opacity-50 sm:justify-start"
            title="Alterar período da próxima análise"
          >
            <CalendarRange size={13} />
            Última escolha: <span className="text-white">{selectedPeriodInfo.label}</span>
          </button>
        </div>

        {/* Coverage details */}
        {coverageNotice && (
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              onClick={() => setCoverageDetailsOpen((open) => !open)}
              aria-expanded={coverageDetailsOpen}
              className="group inline-flex items-center gap-2 rounded-full border border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.055)] px-3 py-1.5 text-[11.5px] font-semibold text-[#fbbf24] transition-all hover:border-[rgba(245,158,11,0.38)] hover:bg-[rgba(245,158,11,0.09)]"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#f59e0b] opacity-35" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#f59e0b]" />
              </span>
              {coverageNotice.title}
              <Info size={13} className="opacity-70 transition-opacity group-hover:opacity-100" />
            </button>

            {coverageDetailsOpen && (
              <div className="fadeUp w-full rounded-xl border border-[rgba(245,158,11,0.22)] bg-[rgba(20,20,24,0.84)] px-3.5 py-3 shadow-[0_14px_40px_-28px_rgba(0,0,0,0.9)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[11.5px] leading-snug text-[#f59e0b]/90">
                    {coverageNotice.detail} Insights gerados com os dados encontrados.
                  </p>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.07)] px-2 py-1 text-[10.5px] font-medium text-[#fbbf24]">
                      Pedido: {coverageNotice.requestedLabel}
                    </span>
                    <span className="rounded-full border border-[rgba(245,158,11,0.18)] bg-[rgba(245,158,11,0.07)] px-2 py-1 text-[10.5px] font-medium text-[#fbbf24]">
                      Dados: {coverageNotice.foundLabel}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-snug text-[var(--muted)]">
                  {coverageNotice.availability}
                </p>
              </div>
            )}
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
                    onClick={openPeriodForm}
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
                  onClick={openPeriodForm}
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
              <div className="relative pb-2 xl:max-w-4xl">
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
              <div id="tutorial-insights-card" key={currentIndex} className="relative" style={{ zIndex: 2 }}>
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

      {periodFormOpen && (
        <PeriodGenerateModal
          period={draftPeriod}
          isPending={generateInsights.isPending}
          onChangePeriod={setDraftPeriod}
          onClose={() => setPeriodFormOpen(false)}
          onGenerate={() => handleGenerate(draftPeriod)}
        />
      )}

      {mission && (
        <MissionModal
          insight={mission}
          isPending={pinInsight.isPending}
          onClose={() => setMission(null)}
        />
      )}

      <FeatureTutorial
        open={tutorialOpen}
        steps={INSIGHTS_TUTORIAL_STEPS}
        onClose={() => setTutorialOpen(false)}
      />
    </Layout>
  );
}
