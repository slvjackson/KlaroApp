import { useMemo, useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getListInsightsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  Search, X, ChevronLeft, RotateCcw, Trash2,
  Lightbulb, AlertTriangle, AlertOctagon, TrendingUp, Clock, EyeOff,
} from "lucide-react";

// ─── Types & helpers ──────────────────────────────────────────────────────────

type Tone = "positive" | "warning" | "critical" | "neutral";

type HistoryInsight = {
  id: number;
  title: string;
  description: string;
  recommendation?: string | null;
  tone?: string | null;
  archivedAt?: string | null;
  archivedReason?: string | null;
  createdAt: string;
  periodLabel?: string | null;
};

type DerivedReason = "dismissed" | "discarded" | "auto_stale";

// Decide what state an item is in. The server only returns rows that match the
// "history" filter, so anything reaching this page is one of these three.
function deriveReason(item: HistoryInsight): DerivedReason {
  if (item.archivedReason === "dismissed") return "dismissed";
  if (item.archivedReason === "discarded") return "discarded";
  return "auto_stale";
}

const REASON_META: Record<DerivedReason, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  dismissed: { label: "Dispensado", color: "#94a3b8", bg: "rgba(148,163,184,0.10)", icon: <EyeOff size={11} /> },
  discarded: { label: "Descartado", color: "#f43f5e", bg: "rgba(244,63,94,0.10)",  icon: <Trash2 size={11} /> },
  auto_stale:{ label: "Vencido (>30d)", color: "#a78bfa", bg: "rgba(167,139,250,0.10)", icon: <Clock size={11} /> },
};

const TONE_META: Record<Tone, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  positive: { label: "Positivo", color: "#10b981", bg: "rgba(16,185,129,0.10)",  icon: <TrendingUp size={12} /> },
  warning:  { label: "Atenção",  color: "#f59e0b", bg: "rgba(245,158,11,0.10)",  icon: <AlertTriangle size={12} /> },
  critical: { label: "Crítico",  color: "#ef4444", bg: "rgba(239,68,68,0.10)",   icon: <AlertOctagon size={12} /> },
  neutral:  { label: "Geral",    color: "#90f048", bg: "rgba(106,248,47,0.08)",  icon: <Lightbulb size={12} /> },
};

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function monthBucket(iso: string): { key: string; label: string } {
  const d = new Date(iso);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const label = `${MONTHS_PT[d.getMonth()]} de ${d.getFullYear()}`;
  return { key, label };
}

// ─── API helpers (direct fetch — bypasses generated client) ──────────────────

const HISTORY_QUERY_KEY = ["insights", "history"] as const;

async function fetchHistory(): Promise<HistoryInsight[]> {
  const res = await fetch("/api/insights?status=history", { credentials: "include" });
  if (!res.ok) throw new Error(`Falha ao carregar histórico (${res.status})`);
  return res.json() as Promise<HistoryInsight[]>;
}

async function restore(id: number): Promise<void> {
  const res = await fetch(`/api/insights/${id}/restore`, {
    method: "PATCH",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`Falha ao restaurar (${res.status})`);
}

async function hardDelete(id: number): Promise<void> {
  const res = await fetch(`/api/insights/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok && res.status !== 204) throw new Error(`Falha ao excluir (${res.status})`);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ReasonFilter = "all" | DerivedReason;
type ToneFilter = "all" | Tone;

export default function InsightsHistory() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: HISTORY_QUERY_KEY,
    queryFn: fetchHistory,
    refetchOnMount: "always",
  });

  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<ReasonFilter>("all");
  const [toneFilter, setToneFilter] = useState<ToneFilter>("all");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: HISTORY_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
  }

  async function handleRestore(id: number) {
    try {
      await restore(id);
      invalidateAll();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete(id: number) {
    try {
      await hardDelete(id);
      setConfirmDelete(null);
      invalidateAll();
    } catch (err) {
      console.error(err);
    }
  }

  const items = data ?? [];

  // Filter pipeline: search → reason → tone, then group by month.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (q) {
        const haystack = `${item.title} ${item.description}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (reasonFilter !== "all" && deriveReason(item) !== reasonFilter) return false;
      if (toneFilter !== "all" && (item.tone ?? "neutral") !== toneFilter) return false;
      return true;
    });
  }, [items, search, reasonFilter, toneFilter]);

  const grouped = useMemo(() => {
    const sorted = [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const groups = new Map<string, { label: string; items: HistoryInsight[] }>();
    for (const item of sorted) {
      const { key, label } = monthBucket(item.createdAt);
      if (!groups.has(key)) groups.set(key, { label, items: [] });
      groups.get(key)!.items.push(item);
    }
    return [...groups.values()];
  }, [filtered]);

  // Counts shown next to each filter chip — total of items matching the OTHER filters
  // (so the chip's own value still shows possibilities). Simpler: just show counts on
  // the unfiltered set, ignoring search.
  const reasonCounts = useMemo(() => {
    const counts = { dismissed: 0, discarded: 0, auto_stale: 0 } as Record<DerivedReason, number>;
    for (const i of items) counts[deriveReason(i)]++;
    return counts;
  }, [items]);

  if (isAuthLoading) return null;

  return (
    <Layout title="Histórico de insights">
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <Link href="/insights" className="inline-flex items-center gap-1 text-[12px] text-[var(--muted)] hover:text-white mb-2">
            <ChevronLeft size={14} /> Voltar para insights
          </Link>
          <h1 className="text-[22px] font-bold tracking-tight text-white">Histórico de insights</h1>
          <p className="text-[12.5px] text-[var(--muted)] mt-1">
            Tudo que saiu do carrossel ativo continua aqui — você pode restaurar ou excluir definitivamente.
          </p>
        </div>

        {/* Search + filters */}
        <div className="glass rounded-2xl p-4 flex flex-col gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título ou conteúdo…"
              className="field py-2 text-[12.5px] w-full"
              style={{ paddingLeft: "2.25rem", paddingRight: "2.25rem" }}
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10.5px] uppercase tracking-wide text-[var(--muted)] mr-1">Estado:</span>
              {([
                { key: "all" as const,         label: "Todos",     count: items.length },
                { key: "dismissed" as const,   label: "Dispensados", count: reasonCounts.dismissed },
                { key: "discarded" as const,   label: "Descartados", count: reasonCounts.discarded },
                { key: "auto_stale" as const,  label: "Vencidos",   count: reasonCounts.auto_stale },
              ]).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setReasonFilter(f.key)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                    reasonFilter === f.key ? "bg-[var(--accent-soft)] text-white" : "text-[var(--muted)] hover:text-white"
                  }`}
                >
                  {f.label}
                  {f.count > 0 && <span className="text-[10px] opacity-70 tnum">{f.count}</span>}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10.5px] uppercase tracking-wide text-[var(--muted)] mr-1">Tom:</span>
              {([
                { key: "all" as const, label: "Todos" },
                { key: "critical" as const, label: "Crítico" },
                { key: "warning" as const, label: "Atenção" },
                { key: "positive" as const, label: "Positivo" },
                { key: "neutral" as const, label: "Geral" },
              ]).map((f) => (
                <button
                  key={f.key}
                  onClick={() => setToneFilter(f.key)}
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    toneFilter === f.key ? "bg-[var(--accent-soft)] text-white" : "text-[var(--muted)] hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="glass rounded-2xl p-5 animate-pulse h-32" />
        ) : grouped.length === 0 ? (
          <div className="glass rounded-2xl p-12 flex flex-col items-center gap-3 text-center">
            <Clock size={22} className="text-[var(--muted)]" />
            <div>
              <div className="text-[14px] font-semibold text-white">
                {items.length === 0 ? "Nada no histórico ainda" : "Nenhum insight bate com esses filtros"}
              </div>
              <p className="text-[12px] text-[var(--muted)] max-w-xs mt-1 leading-relaxed">
                {items.length === 0
                  ? "Insights dispensados, descartados ou vencidos vão aparecer aqui."
                  : "Tente ajustar a busca ou os filtros."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {grouped.map((group) => (
              <div key={group.label} className="flex flex-col gap-2">
                <div className="text-[10.5px] uppercase tracking-[0.12em] text-[var(--muted)] px-1">
                  {group.label}
                </div>
                <div className="flex flex-col gap-2">
                  {group.items.map((item) => {
                    const reason = deriveReason(item);
                    const reasonMeta = REASON_META[reason];
                    const tone = (item.tone as Tone | null) ?? "neutral";
                    const toneMeta = TONE_META[tone];
                    return (
                      <div key={item.id} className="glass rounded-xl p-4 flex flex-col gap-3 border border-[var(--border)]">
                        <div className="flex items-start gap-3">
                          <div
                            className="w-7 h-7 rounded-lg grid place-items-center shrink-0"
                            style={{ backgroundColor: toneMeta.bg, color: toneMeta.color }}
                          >
                            {toneMeta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[13.5px] font-semibold text-white leading-snug">{item.title}</div>
                            <p className="text-[12px] text-[var(--muted)] mt-1 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                                style={{ backgroundColor: reasonMeta.bg, color: reasonMeta.color }}
                              >
                                {reasonMeta.icon} {reasonMeta.label}
                              </span>
                              {item.periodLabel && (
                                <span className="text-[10px] text-[var(--muted)]">· {item.periodLabel}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleRestore(item.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
                          >
                            <RotateCcw size={12} /> Restaurar
                          </button>
                          {confirmDelete === item.id ? (
                            <div className="flex items-center gap-1.5 ml-auto">
                              <span className="text-[11px] text-[var(--muted)]">Excluir definitivamente?</span>
                              <button
                                onClick={() => setConfirmDelete(null)}
                                className="px-2 py-1 rounded text-[11px] font-medium text-[var(--muted)] hover:text-white"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="px-2 py-1 rounded bg-[#f43f5e] text-white text-[11px] font-semibold hover:brightness-110"
                              >
                                Excluir
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(item.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-medium text-[var(--muted)] hover:text-[#f43f5e] hover:bg-[rgba(244,63,94,0.08)] transition-colors ml-auto"
                            >
                              <Trash2 size={12} /> Excluir
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
