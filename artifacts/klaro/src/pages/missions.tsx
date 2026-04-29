import { useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { useListInsights, usePatchInsightProgress, getListInsightsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Trophy, TrendingUp, AlertTriangle, AlertOctagon, Lightbulb, ChevronRight, CheckCircle2, Circle, X } from "lucide-react";

type Tone = "positive" | "warning" | "critical" | "neutral";

const TONE_CONFIG: Record<Tone, { icon: React.ReactNode; color: string; bg: string }> = {
  positive: { icon: <TrendingUp size={14} />,    color: "#10b981", bg: "rgba(16,185,129,0.10)" },
  warning:  { icon: <AlertTriangle size={14} />, color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  critical: { icon: <AlertOctagon size={14} />,  color: "#ef4444", bg: "rgba(239,68,68,0.10)" },
  neutral:  { icon: <Lightbulb size={14} />,     color: "#90f048", bg: "rgba(106,248,47,0.08)" },
};

type PinnedInsight = {
  id: number;
  title: string;
  description?: string | null;
  tone?: string | null;
  steps?: string[] | null;
  stepsProgress?: boolean[] | null;
  pinnedAt?: string | null;
  periodLabel?: string | null;
};

function MissionCard({
  insight,
  progress,
  onClick,
}: {
  insight: PinnedInsight;
  progress: boolean[];
  onClick: () => void;
}) {
  const tone = TONE_CONFIG[(insight.tone as Tone) ?? "neutral"] ?? TONE_CONFIG.neutral;
  const steps = insight.steps ?? [];
  const done = progress.filter(Boolean).length;
  const total = steps.length;
  const pct = total > 0 ? done / total : 0;
  const complete = total > 0 && done === total;

  return (
    <button
      onClick={onClick}
      className="w-full text-left glass rounded-2xl p-5 flex flex-col gap-3 border transition-colors hover:border-[var(--border-2)]"
      style={{ borderColor: complete ? `${tone.color}44` : "var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg grid place-items-center shrink-0"
          style={{ backgroundColor: tone.bg, color: tone.color }}
        >
          {tone.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-white leading-snug truncate">{insight.title}</div>
          {insight.periodLabel && (
            <div className="text-[11px] text-[var(--muted)] mt-0.5">{insight.periodLabel}</div>
          )}
        </div>
        {complete
          ? <CheckCircle2 size={18} className="shrink-0 text-[#10b981]" />
          : <ChevronRight size={16} className="shrink-0 text-[var(--muted)]" />}
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct * 100}%`,
                backgroundColor: complete ? "#10b981" : tone.color,
              }}
            />
          </div>
          <div className="text-[11px] text-[var(--muted)]">
            {done}/{total} {complete ? "· Concluído!" : "passos"}
          </div>
        </div>
      )}
    </button>
  );
}

function MissionDetail({
  insight,
  progress,
  onToggle,
  onClose,
}: {
  insight: PinnedInsight;
  progress: boolean[];
  onToggle: (i: number) => void;
  onClose: () => void;
}) {
  const steps = insight.steps ?? [];
  const done = progress.filter(Boolean).length;
  const total = steps.length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 flex flex-col gap-4 border border-[var(--border-2)] max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 rounded-full bg-[var(--muted)]/30 mx-auto sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.2)]">
            <Trophy size={13} className="text-[#10b981]" />
            <span className="text-[12px] font-semibold text-[#10b981]">Missão salva</span>
          </div>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div>
          <h3 className="text-[17px] font-bold text-white leading-snug">{insight.title}</h3>
          {insight.description && (
            <p className="text-[12.5px] text-[var(--muted)] mt-1.5 leading-relaxed line-clamp-3">
              {insight.description}
            </p>
          )}
        </div>

        {total > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(done / total) * 100}%`,
                  backgroundColor: done === total ? "#10b981" : "var(--accent)",
                }}
              />
            </div>
            <span className="text-[11px] text-[var(--muted)] shrink-0">{done}/{total}</span>
          </div>
        )}

        {steps.length > 0 && (
          <>
            <p className="text-[11.5px] text-[var(--muted)] uppercase tracking-wide">Passos para concluir:</p>
            <div className="flex flex-col gap-2.5">
              {steps.map((step, i) => (
                <button
                  key={i}
                  onClick={() => onToggle(i)}
                  className="flex items-center gap-3 text-left group"
                >
                  {progress[i]
                    ? <CheckCircle2 size={18} className="text-[#10b981] shrink-0" />
                    : <Circle size={18} className="text-[var(--muted)] shrink-0 group-hover:text-[var(--accent)]" />}
                  <span
                    className={`text-[13.5px] transition-colors ${
                      progress[i] ? "line-through text-[var(--muted)]" : "text-white"
                    }`}
                  >
                    {step}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-1 w-full py-3 rounded-xl border border-[var(--border)] text-[14px] font-semibold text-[var(--muted)] hover:text-white hover:border-[var(--border-2)] transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

export default function Missions() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const queryClient = useQueryClient();
  const { data: rawInsights, isLoading } = useListInsights({ query: { refetchOnMount: "always" } });
  const patchProgress = usePatchInsightProgress();
  const [selected, setSelected] = useState<PinnedInsight | null>(null);

  const insights = Array.isArray(rawInsights) ? (rawInsights as PinnedInsight[]) : [];
  const pinned = insights.filter((i) => !!i.pinnedAt);
  const selectedLive = selected ? (pinned.find((i) => i.id === selected.id) ?? selected) : null;

  function getProgress(insight: PinnedInsight): boolean[] {
    const steps = insight.steps ?? [];
    return insight.stepsProgress ?? steps.map(() => false);
  }

  function handleToggle(insightId: number, stepIdx: number) {
    const insight = pinned.find((i) => i.id === insightId);
    if (!insight) return;
    const current = getProgress(insight);
    const next = current.map((v, i) => (i === stepIdx ? !v : v));
    patchProgress.mutate({ id: insightId, stepsProgress: next }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() }),
    });
    // optimistic update
    queryClient.setQueryData(getListInsightsQueryKey(), (old: PinnedInsight[] | undefined) =>
      old?.map((i) => i.id === insightId ? { ...i, stepsProgress: next } : i)
    );
  }

  const completedCount = pinned.filter((i) => {
    const prog = getProgress(i);
    return prog.length > 0 && prog.every(Boolean);
  }).length;

  if (isAuthLoading) return null;

  return (
    <Layout title="Missões">
      <div className="space-y-5 max-w-xl">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-white">Missões</h1>
          {pinned.length > 0 && (
            <p className="text-[12.5px] text-[var(--muted)] mt-1">
              {completedCount} de {pinned.length} concluídas
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="glass rounded-2xl p-5 animate-pulse h-32" />
        ) : pinned.length === 0 ? (
          <div className="glass rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(16,185,129,0.10)] grid place-items-center">
              <Trophy size={22} className="text-[#10b981]" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-white">Nenhuma missão ainda</div>
              <p className="text-[12.5px] text-[var(--muted)] max-w-xs mt-1 leading-relaxed">
                Arraste um insight para baixo ou clique em "Salvar missão" para acompanhar seu progresso aqui.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pinned.map((insight) => (
              <MissionCard
                key={insight.id}
                insight={insight}
                progress={getProgress(insight)}
                onClick={() => setSelected(insight)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedLive && (
        <MissionDetail
          insight={selectedLive}
          progress={getProgress(selectedLive)}
          onToggle={(i) => handleToggle(selectedLive.id, i)}
          onClose={() => setSelected(null)}
        />
      )}
    </Layout>
  );
}
