import { useState, useRef, useCallback, useEffect } from "react";
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
  Upload, ChevronLeft, ChevronRight, Trash2, Trophy, Clock,
  CheckCircle2, Circle,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { AnamneseCta } from "@/components/anamnese-cta";

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
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-[var(--muted)]/40 mx-auto sm:hidden" />

        {/* Badge */}
        <div className="flex items-center gap-2 self-start px-3 py-1.5 rounded-full bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.2)]">
          <Trophy size={13} className="text-[#10b981]" />
          <span className="text-[12px] font-semibold text-[#10b981]">Missão criada!</span>
        </div>

        <div>
          <h3 className="text-[16px] font-bold text-white leading-snug">{insight.title}</h3>
        </div>

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

type SwipeDir = "up" | "down" | null;

function InsightCard({
  insight,
  onArchive,
  onPin,
  dragState,
}: {
  insight: Insight;
  onArchive: () => void;
  onPin: () => void;
  dragState: { dir: SwipeDir; progress: number }; // 0..1
}) {
  const tone = (TONE_CONFIG[insight.tone as InsightTone] ?? TONE_CONFIG.neutral);
  const stale = isStale((insight as unknown as { createdAt?: string }).createdAt);

  const archiveOpacity = dragState.dir === "up" ? dragState.progress : 0;
  const saveOpacity = dragState.dir === "down" ? dragState.progress : 0;

  return (
    <div
      className="relative rounded-2xl p-5 flex flex-col gap-3 select-none border overflow-hidden"
      style={{ backgroundColor: "var(--card)", borderColor: tone.border }}
    >
      {/* Discard overlay */}
      {archiveOpacity > 0 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl pointer-events-none transition-opacity"
          style={{ backgroundColor: "rgba(239,68,68,0.15)", opacity: archiveOpacity }}
        >
          <Trash2 size={28} className="text-[#ef4444]" />
          <span className="text-[15px] font-bold text-[#ef4444]">Descartar</span>
        </div>
      )}

      {/* Save overlay */}
      {saveOpacity > 0 && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl pointer-events-none"
          style={{ backgroundColor: "rgba(16,185,129,0.15)", opacity: saveOpacity }}
        >
          <Trophy size={28} className="text-[#10b981]" />
          <span className="text-[15px] font-bold text-[#10b981]">Salvar missão</span>
        </div>
      )}

      {/* 7-day stale nudge */}
      {stale && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg border border-[rgba(245,158,11,0.25)] bg-[rgba(245,158,11,0.07)]">
          <Clock size={13} className="text-[#f59e0b] shrink-0 mt-0.5" />
          <p className="text-[11.5px] text-[#f59e0b] leading-snug">
            Esse insight está esperando uma decisão há mais de 7 dias. Descarte ou salve como missão.
          </p>
        </div>
      )}

      {/* Header */}
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

      {/* Action buttons */}
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
          <Trophy size={12} /> Salvar missão
        </button>
      </div>
    </div>
  );
}

// ─── Carousel ─────────────────────────────────────────────────────────────────

function InsightCarousel({ queue, onArchive, onPin }: {
  queue: Insight[];
  onArchive: (id: number) => void;
  onPin: (item: Insight) => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exitDir, setExitDir] = useState<"up" | "down" | null>(null);
  const dragStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const V_UP = -100;
  const V_DOWN = 100;

  // Clamp index when queue shrinks
  useEffect(() => {
    if (currentIdx >= queue.length && queue.length > 0) {
      setCurrentIdx(queue.length - 1);
    }
  }, [queue.length]);

  // Reset drag when changing cards
  useEffect(() => {
    setDragY(0);
    setExitDir(null);
  }, [currentIdx]);

  const goPrev = () => setCurrentIdx((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIdx((i) => Math.min(queue.length - 1, i + 1));

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [queue.length]);

  // ── Mouse/touch drag for vertical swipe ────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || dragStartY.current === null) return;
    setDragY(e.clientY - dragStartY.current);
  };

  const handlePointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    if (dragY < V_UP) {
      setExitDir("up");
      setTimeout(() => onArchive(queue[currentIdx].id), 300);
    } else if (dragY > V_DOWN) {
      setExitDir("down");
      setTimeout(() => onPin(queue[currentIdx]), 300);
    } else {
      setDragY(0);
    }
    dragStartY.current = null;
  }, [dragging, dragY, currentIdx, queue, onArchive, onPin]);

  const progress = Math.min(1, Math.abs(dragY) / 100);
  const swipeDir: SwipeDir = dragY < -20 ? "up" : dragY > 20 ? "down" : null;

  const cardTranslateY = exitDir === "up" ? -400 : exitDir === "down" ? 400 : dragY;
  const cardOpacity = exitDir ? 0 : 1;

  return (
    <div className="flex flex-col gap-4">
      {/* Card stage */}
      <div className="relative flex items-center gap-3">
        {/* Prev button */}
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="w-8 h-8 grid place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors disabled:opacity-20 shrink-0"
        >
          <ChevronLeft size={18} />
        </button>

        {/* Card container */}
        <div
          ref={containerRef}
          className="flex-1 relative cursor-grab active:cursor-grabbing"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            style={{
              transform: `translateY(${cardTranslateY}px)`,
              opacity: cardOpacity,
              transition: dragging ? "none" : "transform 0.3s cubic-bezier(0.32,0,0.67,0), opacity 0.3s ease",
            }}
          >
            {queue[currentIdx] && (
              <InsightCard
                insight={queue[currentIdx]}
                onArchive={() => onArchive(queue[currentIdx].id)}
                onPin={() => onPin(queue[currentIdx])}
                dragState={{ dir: swipeDir, progress }}
              />
            )}
          </div>

          {/* Peek at next card below (subtle) */}
          {currentIdx < queue.length - 1 && (
            <div
              className="absolute inset-x-0 -bottom-2 -z-10 mx-2 h-6 rounded-2xl opacity-30"
              style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            />
          )}

          {/* Swipe hint labels */}
          {dragY < -20 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[11px] font-bold text-[#ef4444]/70 uppercase tracking-widest absolute top-3">
                ↑ Descartar
              </span>
            </div>
          )}
          {dragY > 20 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[11px] font-bold text-[#10b981]/70 uppercase tracking-widest absolute bottom-3">
                ↓ Salvar missão
              </span>
            </div>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={goNext}
          disabled={currentIdx === queue.length - 1}
          className="w-8 h-8 grid place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors disabled:opacity-20 shrink-0"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Dots + counter */}
      {queue.length > 1 && (
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5">
            {queue.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIdx(i)}
                className="transition-all rounded-full"
                style={{
                  width: i === currentIdx ? 18 : 6,
                  height: 6,
                  backgroundColor: i === currentIdx ? "var(--accent)" : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>
          <span className="text-[11px] text-[var(--muted)]">
            {currentIdx + 1} / {queue.length}
          </span>
        </div>
      )}

      {/* Swipe hint (first-time) */}
      <p className="text-center text-[11px] text-[var(--muted)]/60 leading-snug">
        Arraste para cima para descartar · Arraste para baixo para salvar missão · Use ← → para navegar
      </p>
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
  const bp = (user as unknown as { businessProfile?: Record<string, unknown> } | undefined)?.businessProfile;
  const anamneseCompleted = !!bp?.anamneseCompleted;

  useEffect(() => {
    if (!isLoading && rawInsights) setQueue(rawInsights);
  }, [rawInsights, isLoading]);

  const handleGenerate = () => {
    generateInsights.mutate({}, {
      onSuccess: (data: unknown) => {
        queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
        if (Array.isArray(data)) setQueue(data as Insight[]);
        setAttempted(true);
      },
      onError: () => setAttempted(true),
    });
  };

  const handleArchive = (id: number) => {
    archiveInsight.mutate(id);
    setQueue((prev) => prev.filter((i) => i.id !== id));
  };

  const handlePin = (item: Insight) => {
    pinInsight.mutate(item.id, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
        setMission(data);
      },
    });
    setQueue((prev) => prev.filter((i) => i.id !== item.id));
    setMission(item);
  };

  if (isAuthLoading) return null;

  return (
    <Layout title="Insights">
      <div className="space-y-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
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

        <AnamneseCta completed={anamneseCompleted} />

        {/* Content */}
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
          <InsightCarousel queue={queue} onArchive={handleArchive} onPin={handlePin} />
        )}
      </div>

      {/* Mission modal */}
      {mission && <MissionModal insight={mission} isPending={pinInsight.isPending} onClose={() => setMission(null)} />}
    </Layout>
  );
}
