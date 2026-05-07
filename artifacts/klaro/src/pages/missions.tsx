import { useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { usePatchInsightProgress, getListInsightsQueryKey } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, TrendingUp, AlertTriangle, AlertOctagon, Lightbulb, ChevronRight, CheckCircle2, Circle, X, Pencil, Plus, Loader2, Trash2, ArrowUp, ArrowDown, Archive, RotateCcw } from "lucide-react";
import { RichContent } from "@/components/rich-content";

// ─── Reusable steps editor ────────────────────────────────────────────────────

function StepsEditor({ steps, onChange }: { steps: string[]; onChange: (next: string[]) => void }) {
  const update = (i: number, v: string) => onChange(steps.map((s, idx) => (idx === i ? v : s)));
  const remove = (i: number) => onChange(steps.filter((_, idx) => idx !== i));
  const add = () => onChange([...steps, ""]);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="text-[11px] text-[var(--muted)] tnum mt-2.5 w-4 text-right shrink-0">{i + 1}.</span>
          <textarea
            value={step}
            onChange={(e) => update(i, e.target.value)}
            rows={1}
            placeholder="Descreva o passo…"
            className="field flex-1 text-[12.5px] resize-none leading-snug py-2"
          />
          <div className="flex flex-col gap-0.5 mt-0.5">
            <button
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="p-1 rounded text-[var(--muted)] hover:text-white disabled:opacity-20 disabled:pointer-events-none"
              aria-label="Mover para cima"
            >
              <ArrowUp size={12} />
            </button>
            <button
              onClick={() => move(i, 1)}
              disabled={i === steps.length - 1}
              className="p-1 rounded text-[var(--muted)] hover:text-white disabled:opacity-20 disabled:pointer-events-none"
              aria-label="Mover para baixo"
            >
              <ArrowDown size={12} />
            </button>
          </div>
          <button
            onClick={() => remove(i)}
            className="p-1.5 mt-0.5 rounded-lg text-[var(--muted)] hover:text-[#f43f5e] hover:bg-[rgba(244,63,94,0.08)]"
            aria-label="Remover passo"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="self-start flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
      >
        <Plus size={12} /> Adicionar passo
      </button>
    </div>
  );
}

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
  archivedAt?: string | null;
  archivedReason?: string | null;
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

async function patchInsight(id: number, body: { title?: string; description?: string; periodLabel?: string; steps?: string[] }): Promise<void> {
  const res = await fetch(`/api/insights/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Falha ao atualizar (${res.status})`);
}

async function lifecycleAction(id: number, action: "archive" | "restore"): Promise<void> {
  const res = await fetch(`/api/insights/${id}/${action}`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Falha em ${action} (${res.status})`);
}

async function deleteInsight(id: number): Promise<void> {
  const res = await fetch(`/api/insights/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) throw new Error(`Falha ao excluir (${res.status})`);
}

const MISSIONS_QUERY_KEY = ["missions", "all"] as const;

async function fetchAllForMissions(): Promise<PinnedInsight[]> {
  const res = await fetch("/api/insights?status=all", { credentials: "include" });
  if (!res.ok) throw new Error(`Falha ao listar (${res.status})`);
  return res.json() as Promise<PinnedInsight[]>;
}

function MissionDetail({
  insight,
  progress,
  onToggle,
  onClose,
  onSaved,
  onArchive,
  onRestore,
  onDelete,
}: {
  insight: PinnedInsight;
  progress: boolean[];
  onToggle: (i: number) => void;
  onClose: () => void;
  onSaved: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const isArchived = !!insight.archivedAt;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const steps = insight.steps ?? [];
  const done = progress.filter(Boolean).length;
  const total = steps.length;

  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(insight.title);
  const [descDraft, setDescDraft] = useState(insight.description ?? "");
  const [stepsDraft, setStepsDraft] = useState<string[]>(insight.steps ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setTitleDraft(insight.title);
    setDescDraft(insight.description ?? "");
    setStepsDraft(insight.steps ?? []);
    setError(null);
    setEditing(true);
  }

  async function saveEdit() {
    const title = titleDraft.trim();
    if (!title) { setError("O título não pode ficar vazio."); return; }
    const cleanSteps = stepsDraft.map((s) => s.trim()).filter((s) => s.length > 0);
    setSaving(true);
    setError(null);
    try {
      await patchInsight(insight.id, { title, description: descDraft.trim(), steps: cleanSteps });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={editing ? undefined : onClose} />
      <div className="relative glass rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 flex flex-col gap-4 border border-[var(--border-2)] max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 rounded-full bg-[var(--muted)]/30 mx-auto sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(16,185,129,0.12)] border border-[rgba(16,185,129,0.2)]">
            <Trophy size={13} className="text-[#10b981]" />
            <span className="text-[12px] font-semibold text-[#10b981]">Missão salva</span>
          </div>
          <div className="flex items-center gap-1">
            {!editing && (
              <button
                onClick={startEdit}
                className="p-1.5 rounded-lg text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-colors"
                aria-label="Editar"
              >
                <Pencil size={15} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.05)] transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {editing ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[10.5px] uppercase tracking-wide text-[var(--muted)]">Título</label>
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                className="field mt-1 text-[15px] font-semibold w-full"
                autoFocus
              />
            </div>
            <div>
              <label className="text-[10.5px] uppercase tracking-wide text-[var(--muted)]">Descrição</label>
              <textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                rows={5}
                className="field mt-1 text-[12.5px] w-full resize-y leading-relaxed"
                placeholder="Descreva o contexto da missão. Markdown é suportado."
              />
            </div>
            <div>
              <label className="text-[10.5px] uppercase tracking-wide text-[var(--muted)]">Passos</label>
              <div className="mt-1.5">
                <StepsEditor steps={stepsDraft} onChange={setStepsDraft} />
              </div>
            </div>
            {error && <p className="text-[12px] text-[#f43f5e]">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[13px] font-semibold text-[var(--muted)] hover:text-white disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 btn-primary py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-[17px] font-bold text-white leading-snug">{insight.title}</h3>
            {insight.description && (
              <div className="text-[var(--muted)] mt-1.5 leading-relaxed">
                <RichContent text={insight.description} />
              </div>
            )}
          </div>
        )}

        {!editing && total > 0 && (
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

        {!editing && steps.length > 0 && (
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

        {!editing && (
          <div className="flex flex-col gap-2 mt-1">
            <div className="flex gap-2">
              {isArchived ? (
                <button
                  onClick={onRestore}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[var(--border)] text-[12.5px] font-medium text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                >
                  <RotateCcw size={13} /> Desarquivar
                </button>
              ) : (
                <button
                  onClick={onArchive}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[var(--border)] text-[12.5px] font-medium text-[var(--muted)] hover:text-white hover:border-[var(--border-2)] transition-colors"
                  title="Tira a missão da lista ativa — pode ser restaurada depois"
                >
                  <Archive size={13} /> Arquivar
                </button>
              )}
              <button
                onClick={() => setConfirmingDelete(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[var(--border)] text-[12.5px] font-medium text-[var(--muted)] hover:text-[#f43f5e] hover:border-[#f43f5e]/40 hover:bg-[rgba(244,63,94,0.05)] transition-colors"
                title="Exclui permanentemente — não dá pra desfazer"
              >
                <Trash2 size={13} /> Excluir
              </button>
            </div>

            {confirmingDelete && (
              <div className="rounded-xl border border-[#f43f5e]/30 bg-[rgba(244,63,94,0.05)] p-3 flex flex-col gap-2">
                <p className="text-[12px] text-white">Excluir essa missão? Essa ação <strong>não pode ser desfeita</strong>.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="flex-1 py-2 rounded-lg border border-[var(--border)] text-[12px] font-medium text-[var(--muted)] hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={onDelete}
                    className="flex-1 py-2 rounded-lg bg-[#f43f5e] text-white text-[12px] font-semibold hover:brightness-110"
                  >
                    Excluir definitivamente
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl border border-[var(--border)] text-[14px] font-semibold text-[var(--muted)] hover:text-white hover:border-[var(--border-2)] transition-colors"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create mission modal ─────────────────────────────────────────────────────

async function createMission(payload: { title: string; description: string; steps: string[] }): Promise<void> {
  const saveRes = await fetch("/api/insights", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: payload.title, description: payload.description }),
  });
  if (!saveRes.ok) throw new Error(`Falha ao criar (${saveRes.status})`);
  const saved = await saveRes.json() as { id: number };

  // If user provided manual steps, persist them BEFORE pinning so the pin endpoint
  // skips AI generation and uses these instead.
  if (payload.steps.length > 0) {
    await patchInsight(saved.id, { steps: payload.steps });
  }

  const pinRes = await fetch(`/api/insights/${saved.id}/pin`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!pinRes.ok) throw new Error(`Falha ao fixar como missão (${pinRes.status})`);
}

function CreateMissionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const t = title.trim();
    const d = description.trim();
    if (!t) { setError("O título é obrigatório."); return; }
    if (!d) { setError("A descrição é obrigatória."); return; }
    const cleanSteps = steps.map((s) => s.trim()).filter((s) => s.length > 0);
    setSaving(true);
    setError(null);
    try {
      await createMission({ title: t, description: d, steps: cleanSteps });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar missão.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative glass rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md p-6 flex flex-col gap-4 border border-[var(--border-2)] max-h-[85vh] overflow-y-auto">
        <div className="w-10 h-1 rounded-full bg-[var(--muted)]/30 mx-auto sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[rgba(106,248,47,0.12)] border border-[rgba(106,248,47,0.2)]">
            <Plus size={13} className="text-[var(--accent)]" />
            <span className="text-[12px] font-semibold text-[var(--accent)]">Nova missão</span>
          </div>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-white disabled:opacity-50">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="text-[10.5px] uppercase tracking-wide text-[var(--muted)]">Título</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Renegociar contrato com fornecedor X"
            className="field mt-1 text-[15px] font-semibold w-full"
            autoFocus
          />
        </div>

        <div>
          <label className="text-[10.5px] uppercase tracking-wide text-[var(--muted)]">Descrição</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contexto e motivação da missão. Markdown é suportado."
            rows={6}
            className="field mt-1 text-[12.5px] w-full resize-y leading-relaxed"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label className="text-[10.5px] uppercase tracking-wide text-[var(--muted)]">Passos</label>
            <span className="text-[10.5px] text-[var(--muted)]">opcional</span>
          </div>
          <div className="mt-1.5">
            <StepsEditor steps={steps} onChange={setSteps} />
          </div>
          {steps.length === 0 && (
            <p className="text-[11px] text-[var(--muted)] leading-relaxed mt-2">
              Deixe em branco para a IA gerar os passos automaticamente com base na descrição.
            </p>
          )}
        </div>

        {error && <p className="text-[12px] text-[#f43f5e]">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-[var(--border)] text-[13px] font-semibold text-[var(--muted)] hover:text-white disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 btn-primary py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {saving ? "Criando…" : "Criar missão"}
          </button>
        </div>
      </div>
    </div>
  );
}

type Tab = "active" | "completed" | "archived";

export default function Missions() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const queryClient = useQueryClient();
  const { data: rawAll, isLoading } = useQuery({
    queryKey: MISSIONS_QUERY_KEY,
    queryFn: fetchAllForMissions,
    refetchOnMount: "always",
  });
  const patchProgress = usePatchInsightProgress();
  const [selected, setSelected] = useState<PinnedInsight | null>(null);
  const [tab, setTab] = useState<Tab>("active");

  const insights = Array.isArray(rawAll) ? rawAll : [];
  const allMissions = insights.filter((i) => !!i.pinnedAt);

  // Concluída = todos passos marcados (derivado de stepsProgress, sem campo no DB).
  function isCompleted(m: PinnedInsight): boolean {
    const steps = m.steps ?? [];
    const prog = m.stepsProgress ?? steps.map(() => false);
    return prog.length > 0 && prog.every(Boolean);
  }

  const archivedMissions = allMissions.filter((m) => !!m.archivedAt);
  const activeMissions = allMissions.filter((m) => !m.archivedAt && !isCompleted(m));
  const completedMissions = allMissions.filter((m) => !m.archivedAt && isCompleted(m));

  const tabMissions = tab === "active" ? activeMissions : tab === "completed" ? completedMissions : archivedMissions;
  const selectedLive = selected ? (allMissions.find((i) => i.id === selected.id) ?? selected) : null;

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: MISSIONS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
  }

  async function handleArchive() {
    if (!selectedLive) return;
    try {
      await lifecycleAction(selectedLive.id, "archive");
      invalidateAll();
      setSelected(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRestore() {
    if (!selectedLive) return;
    try {
      await lifecycleAction(selectedLive.id, "restore");
      invalidateAll();
      setSelected(null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete() {
    if (!selectedLive) return;
    try {
      await deleteInsight(selectedLive.id);
      invalidateAll();
      setSelected(null);
    } catch (err) {
      console.error(err);
    }
  }

  function getProgress(insight: PinnedInsight): boolean[] {
    const steps = insight.steps ?? [];
    return insight.stepsProgress ?? steps.map(() => false);
  }

  function handleToggle(insightId: number, stepIdx: number) {
    const insight = allMissions.find((i) => i.id === insightId);
    if (!insight) return;
    const current = getProgress(insight);
    const next = current.map((v, i) => (i === stepIdx ? !v : v));
    patchProgress.mutate({ id: insightId, stepsProgress: next }, {
      onSuccess: invalidateAll,
    });
    // Optimistic — apply on the missions query cache directly.
    queryClient.setQueryData(MISSIONS_QUERY_KEY, (old: PinnedInsight[] | undefined) =>
      old?.map((i) => i.id === insightId ? { ...i, stepsProgress: next } : i)
    );
  }

  const [creating, setCreating] = useState(false);

  function handleSavedEdit() {
    invalidateAll();
  }

  function handleCreated() {
    setCreating(false);
    invalidateAll();
  }

  if (isAuthLoading) return null;

  return (
    <Layout title="Missões">
      <div className="max-w-2xl mx-auto space-y-5 max-w-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-white">Missões</h1>
            {allMissions.length > 0 && (
              <p className="text-[12.5px] text-[var(--muted)] mt-1">
                {completedMissions.length} de {activeMissions.length + completedMissions.length} concluídas
              </p>
            )}
          </div>
          <button
            onClick={() => setCreating(true)}
            className="btn-primary px-3 py-2 rounded-xl text-[12.5px] font-semibold flex items-center gap-1.5 shrink-0"
          >
            <Plus size={14} /> Nova missão
          </button>
        </div>

        <div className="flex gap-1 p-0.5 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[var(--border)] w-fit">
          {([
            { key: "active",    label: "Em andamento", count: activeMissions.length },
            { key: "completed", label: "Concluídas",   count: completedMissions.length },
            { key: "archived",  label: "Arquivadas",   count: archivedMissions.length },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                tab === t.key ? "bg-[var(--accent-soft)] text-white" : "text-[var(--muted)] hover:text-white"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className={`text-[10.5px] tnum ${tab === t.key ? "text-white/70" : "text-[var(--muted)]/70"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="glass rounded-2xl p-5 animate-pulse h-32" />
        ) : tabMissions.length === 0 ? (
          <div className="glass rounded-2xl p-12 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-[rgba(16,185,129,0.10)] grid place-items-center">
              <Trophy size={22} className="text-[#10b981]" />
            </div>
            <div>
              <div className="text-[15px] font-semibold text-white">
                {tab === "active" ? "Nenhuma missão em andamento"
                  : tab === "completed" ? "Nenhuma missão concluída ainda"
                  : "Nenhuma missão arquivada"}
              </div>
              <p className="text-[12.5px] text-[var(--muted)] max-w-xs mt-1 leading-relaxed">
                {tab === "active"
                  ? "Crie uma direto pelo botão acima ou salve um insight como missão."
                  : tab === "completed"
                  ? "Quando você concluir todos os passos de uma missão ela aparece aqui."
                  : "Missões que você arquivar ficam guardadas aqui."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tabMissions.map((insight) => (
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
          onSaved={handleSavedEdit}
          onArchive={handleArchive}
          onRestore={handleRestore}
          onDelete={handleDelete}
        />
      )}

      {creating && (
        <CreateMissionModal
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}
    </Layout>
  );
}
