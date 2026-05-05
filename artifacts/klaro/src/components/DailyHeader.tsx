import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Flame, Tag, TrendingDown, CheckCircle, MessageCircleQuestion,
  Sparkles, Lightbulb, User, Target, Check, ArrowRight, Loader2, Eye, EyeOff,
} from "lucide-react";

interface DailyTask {
  id: number;
  key: string;
  title: string;
  description: string;
  cta: string;
  deepLink: string;
  icon: string;
  category: string;
  params: Record<string, unknown> | null;
  completedAt: string | null;
}

interface DailyToday {
  streak: number;
  activeToday: boolean;
  today: string;
  tasks: DailyTask[];
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Tag, TrendingDown, CheckCircle, MessageCircleQuestion,
  Sparkles, Lightbulb, User, Target,
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Streak label by tier ────────────────────────────────────────────────────

function streakLabel(streak: number): string {
  if (streak === 0) return "Comece sua sequência";
  if (streak === 1) return "1º dia! Continue.";
  if (streak < 7) return "Mantendo o ritmo";
  if (streak < 14) return "Você está em chamas";
  if (streak < 30) return "Disciplina nível mestre";
  return "Lendário";
}

// ─── Question task (special: requires answer) ────────────────────────────────

function QuestionCard({ task, onComplete }: { task: DailyTask; onComplete: () => void }) {
  const qc = useQueryClient();
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isDone = !!task.completedAt;

  const completeMutation = useMutation({
    mutationFn: async () => {
      return api(`/daily/tasks/${task.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ answer }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/daily/today"] });
      onComplete();
    },
  });

  const Icon = ICON_MAP[task.icon] ?? MessageCircleQuestion;

  return (
    <div className={`glass rounded-xl p-4 flex flex-col gap-3 transition-opacity ${isDone ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-lg bg-[rgba(106,248,47,0.1)] flex items-center justify-center shrink-0">
          {isDone ? <Check size={13} className="text-[var(--accent)]" /> : <Icon size={13} className="text-[var(--accent)]" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-0.5">Pergunta do dia</div>
          <div className="text-[12.5px] font-medium text-white leading-snug">{task.title}</div>
        </div>
      </div>

      {!isDone && (
        <>
          <textarea
            className="field text-[12px] resize-none"
            rows={2}
            placeholder="Responda em 1-2 frases..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={400}
          />
          <button
            disabled={!answer.trim() || submitting || completeMutation.isPending}
            onClick={() => { setSubmitting(true); completeMutation.mutate(); }}
            className="btn-primary text-[11.5px] py-1.5 rounded-lg disabled:opacity-50"
          >
            {completeMutation.isPending ? <Loader2 size={11} className="animate-spin inline" /> : "Salvar reflexão"}
          </button>
        </>
      )}

      {isDone && (
        <div className="text-[10.5px] text-[var(--accent)] flex items-center gap-1">
          <Check size={11} /> Reflexão registrada
        </div>
      )}
    </div>
  );
}

// ─── Generic task card ───────────────────────────────────────────────────────

function TaskCard({ task, onComplete }: { task: DailyTask; onComplete: () => void }) {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const isDone = !!task.completedAt;
  const Icon = ICON_MAP[task.icon] ?? Sparkles;

  const completeMutation = useMutation({
    mutationFn: async () => api(`/daily/tasks/${task.id}/complete`, { method: "POST", body: "{}" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/daily/today"] });
      onComplete();
    },
  });

  return (
    <div className={`glass rounded-xl p-4 flex flex-col gap-3 transition-opacity ${isDone ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-lg bg-[rgba(106,248,47,0.1)] flex items-center justify-center shrink-0">
          {isDone ? <Check size={13} className="text-[var(--accent)]" /> : <Icon size={13} className="text-[var(--accent)]" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12.5px] font-medium text-white leading-snug">{task.title}</div>
          <div className="text-[11px] text-[var(--muted)] mt-0.5 leading-snug">{task.description}</div>
        </div>
      </div>

      {!isDone ? (
        <div className="flex gap-2">
          {task.deepLink && (
            <button
              onClick={() => setLocation(task.deepLink)}
              className="flex-1 flex items-center justify-center gap-1 text-[11.5px] py-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-white transition-colors"
            >
              {task.cta}
              <ArrowRight size={10} />
            </button>
          )}
          <button
            disabled={completeMutation.isPending}
            onClick={() => completeMutation.mutate()}
            className="btn-primary text-[11.5px] px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {completeMutation.isPending ? <Loader2 size={11} className="animate-spin" /> : "Concluir"}
          </button>
        </div>
      ) : (
        <div className="text-[10.5px] text-[var(--accent)] flex items-center gap-1">
          <Check size={11} /> Concluído
        </div>
      )}
    </div>
  );
}

// ─── Main DailyHeader ────────────────────────────────────────────────────────

export function DailyHeader() {
  const { data, isLoading } = useQuery<DailyToday>({
    queryKey: ["/daily/today"],
    queryFn: () => api("/daily/today"),
    refetchOnWindowFocus: false,
  });

  const [celebrate, setCelebrate] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  function handleComplete() {
    // Trigger celebration if all tasks just completed
    if (data && data.tasks.filter((t) => t.completedAt).length === data.tasks.length - 1) {
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 2500);
    }
  }

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-4 mb-6 flex items-center justify-center">
        <Loader2 size={16} className="text-[var(--muted)] animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const completedCount = data.tasks.filter((t) => t.completedAt).length;
  const total = data.tasks.length;
  const allDone = total > 0 && completedCount === total;

  const visibleTasks = showCompleted ? data.tasks : data.tasks.filter((t) => !t.completedAt);

  return (
    <div>
      {/* Streak header — compact when all tasks done */}
      {allDone ? (
        <div className="flex items-center justify-between gap-3 mb-3 px-1">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${data.streak > 0 ? "bg-[rgba(255,138,76,0.12)]" : "bg-[rgba(255,255,255,0.04)]"}`}>
              <Flame size={13} className={data.streak > 0 ? "text-[#ff8a4c]" : "text-[var(--muted)]"} />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[14px] font-semibold text-white">{data.streak}</span>
              <span className="text-[11px] text-[var(--muted)]">{data.streak === 1 ? "dia" : "dias"}</span>
            </div>
            <span className="text-[11px] text-[var(--accent)] font-medium ml-1">· tudo feito hoje</span>
            {celebrate && (
              <span className="text-[10.5px] text-[var(--accent)] font-semibold ml-1 animate-pulse">+1 streak!</span>
            )}
          </div>
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-white transition-colors"
          >
            {showCompleted ? <EyeOff size={11} /> : <Eye size={11} />}
            {showCompleted ? "Ocultar tarefas" : "Ver tarefas"}
          </button>
        </div>
      ) : (
        <div className="glass rounded-2xl p-4 mb-3 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${data.streak > 0 ? "bg-[rgba(255,138,76,0.12)]" : "bg-[rgba(255,255,255,0.04)]"}`}>
            <Flame size={22} className={data.streak > 0 ? "text-[#ff8a4c]" : "text-[var(--muted)]"} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[24px] font-bold text-white">{data.streak}</span>
              <span className="text-[12px] text-[var(--muted)]">{data.streak === 1 ? "dia seguido" : "dias seguidos"}</span>
            </div>
            <div className="text-[11.5px] text-[var(--muted)]">{streakLabel(data.streak)}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="flex items-center gap-2 justify-end">
              <div>
                <div className="text-[11px] text-[var(--muted)] mb-0.5">Hoje</div>
                <div className="text-[14px] font-semibold text-white">{completedCount}/{total}</div>
              </div>
              {completedCount > 0 && (
                <button
                  onClick={() => setShowCompleted((v) => !v)}
                  className="text-[var(--muted)] hover:text-white transition-colors p-1 ml-1"
                  title={showCompleted ? "Ocultar concluídas" : "Ver concluídas"}
                >
                  {showCompleted ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
            </div>
            {celebrate && (
              <div className="text-[10.5px] text-[var(--accent)] font-semibold mt-0.5 animate-pulse">+1 streak!</div>
            )}
          </div>
        </div>
      )}

      {/* Task cards — hidden when all done unless user toggled visibility */}
      {visibleTasks.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5">
          {visibleTasks.map((task) =>
            task.key === "business_question" ? (
              <QuestionCard key={task.id} task={task} onComplete={handleComplete} />
            ) : (
              <TaskCard key={task.id} task={task} onComplete={handleComplete} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
