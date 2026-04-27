import { useEffect, useMemo, useRef, useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { useListTransactions } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListTransactionsQueryKey } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Pencil, Plus, Search, X, Inbox, ArrowUp, ArrowDown, CheckSquare, Square, Trash2, Check, Loader2 } from "lucide-react";
import { TransactionDialog, type TransactionData } from "@/components/TransactionDialog";

type FilterType = "all" | "income" | "expense";

const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function buildMonthOptions(transactions: TransactionData[]): { key: string; label: string }[] {
  const set = new Set<string>();
  for (const t of transactions) set.add(t.date.slice(0, 7));
  return [...set].sort().reverse().map((key) => {
    const [y, m] = key.split("-");
    return { key, label: `${MONTH_SHORT[parseInt(m, 10) - 1]}/${y.slice(2)}` };
  });
}

function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function brToISO(br: string) {
  const [day, month, year] = br.split('/');
  if (!day || !month || !year || year.length < 4) return null;
  const d = new Date(`${year}-${month}-${day}T12:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

const CAT_ICONS: Record<string, string> = {
  alimentação: "🍽", restaurante: "🍽", mercado: "🛒", supermercado: "🛒",
  transporte: "🚗", uber: "🚗", gasolina: "⛽",
  saúde: "💊", farmácia: "💊", médico: "🏥",
  entretenimento: "🎬", lazer: "🎭",
  educação: "📚", curso: "📚",
  salário: "💰", receita: "💰", venda: "💰",
  moradia: "🏠", aluguel: "🏠",
  serviços: "⚙️", assinatura: "📱",
};

function catIcon(cat: string) {
  const lower = cat.toLowerCase();
  for (const [key, icon] of Object.entries(CAT_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "📂";
}

export default function Transactions() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const { data: rawTransactions, isLoading } = useListTransactions({ limit: 500 });
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState<string | null>(null);

  // Single-item action sheet
  const [actionItem, setActionItem] = useState<TransactionData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionData | null>(null);

  // Categories for bulk panel
  const [existingCats, setExistingCats] = useState<string[]>([]);
  const [suggestedCats, setSuggestedCats] = useState<string[]>([]);
  const [sessionCats, setSessionCats] = useState<string[]>([]);
  const [addingCustomCat, setAddingCustomCat] = useState(false);
  const [customCatInput, setCustomCatInput] = useState("");
  const customCatRef = useRef<HTMLInputElement>(null);

  // Bulk selection
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkType, setBulkType] = useState<"" | "income" | "expense">("");
  const [bulkDate, setBulkDate] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    fetch("/api/transactions/categories")
      .then((r) => r.json())
      .then((d) => { setExistingCats(d.existing ?? []); setSuggestedCats(d.suggestions ?? []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (addingCustomCat) customCatRef.current?.focus();
  }, [addingCustomCat]);

  if (isAuthLoading) return null;

  const transactions = (rawTransactions ?? []) as TransactionData[];
  const monthOptions = useMemo(() => buildMonthOptions(transactions), [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (filter !== "all" && t.type !== filter) return false;
      if (month && !t.date.startsWith(month)) return false;
      if (q && !`${t.description} ${t.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [transactions, filter, search, month]);

  const filteredIds = useMemo(() => filtered.map((t) => t.id), [filtered]);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  const summary = useMemo(() =>
    filtered.reduce((acc, t) => {
      if (t.type === "income") acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    }, { income: 0, expense: 0 }),
  [filtered]);

  const allCatChips = useMemo(() => [...existingCats, ...sessionCats], [existingCats, sessionCats]);
  const visibleSuggestions = useMemo(() => {
    const seen = new Set(allCatChips.map((c) => c.toLowerCase()));
    return suggestedCats.filter((c) => !seen.has(c.toLowerCase()));
  }, [allCatChips, suggestedCats]);

  function confirmCustomCat() {
    const val = customCatInput.trim();
    setAddingCustomCat(false);
    setCustomCatInput("");
    if (!val) return;
    if (![...existingCats, ...sessionCats].some((c) => c.toLowerCase() === val.toLowerCase())) {
      setSessionCats((prev) => [...prev, val]);
    }
    setBulkCategory(val);
  }

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => { const next = new Set(prev); filteredIds.forEach((id) => next.delete(id)); return next; });
    } else {
      setSelected((prev) => new Set([...prev, ...filteredIds]));
    }
  }

  function toggleRow(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function handleDeleteSingle() {
    if (!actionItem) return;
    setDeleting(true);
    try {
      await fetch(`/api/transactions/${actionItem.id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["getDashboardSummary"] });
      setActionItem(null);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleBulkApply() {
    if (selected.size === 0) return;
    if (!bulkCategory && !bulkType && !bulkDate.trim()) return;
    const isoDate = bulkDate.trim() ? brToISO(bulkDate.trim()) : null;
    setBulkApplying(true);
    try {
      await fetch("/api/transactions/bulk-update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [...selected],
          ...(bulkCategory && { category: bulkCategory }),
          ...(bulkType && { type: bulkType }),
          ...(isoDate && { date: isoDate }),
        }),
      });
      queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["getDashboardSummary"] });
      setSelected(new Set());
      setBulkCategory("");
      setBulkType("");
      setBulkDate("");
    } finally {
      setBulkApplying(false);
    }
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} transaç${selected.size > 1 ? "ões" : "ão"}? Esta ação não pode ser desfeita.`)) return;
    setBulkDeleting(true);
    try {
      await fetch("/api/transactions/bulk-delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected] }),
      });
      queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey() });
      queryClient.invalidateQueries({ queryKey: ["getDashboardSummary"] });
      setSelected(new Set());
    } finally {
      setBulkDeleting(false);
    }
  }

  const canApply = someSelected && (!!bulkCategory || !!bulkType || !!bulkDate.trim());

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "income", label: "Entradas" },
    { key: "expense", label: "Saídas" },
  ];

  return (
    <Layout title="Transações">
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-white">Transações</h1>
          <p className="text-[12.5px] text-[var(--muted)] mt-1">Todas as suas transações confirmadas.</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 p-0.5 rounded-md bg-[rgba(255,255,255,0.04)] border border-[var(--border)]">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 text-[10.5px] font-semibold rounded-[5px] transition-colors ${
                  filter === f.key ? "bg-[var(--accent-soft)] text-white" : "text-[var(--muted)] hover:text-white"
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          <select value={month ?? ""} onChange={(e) => setMonth(e.target.value || null)}
            className="field px-3 py-1.5 text-[12px] rounded-lg" style={{ width: "auto" }}>
            <option value="">Todos os meses</option>
            {monthOptions.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>

          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none z-10" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por descrição ou categoria…"
              className="field pl-9 pr-9 py-2 text-[12.5px]" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white z-10">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Summary bar */}
        {!isLoading && (
          <div className="flex flex-wrap items-center gap-4 px-1 text-[12px]">
            <span className="text-[var(--muted)]">
              {filtered.length} {filtered.length === 1 ? "transação" : "transações"}
            </span>
            <span className="text-[var(--income)] font-semibold tnum">+{brl(summary.income)}</span>
            <span className="text-[var(--expense)] font-semibold tnum">−{brl(summary.expense)}</span>
            <span className={`font-bold tnum ${summary.income - summary.expense >= 0 ? "text-white" : "text-[var(--expense)]"}`}>
              Saldo: {brl(summary.income - summary.expense)}
            </span>
          </div>
        )}

        {/* Bulk action panel */}
        {someSelected && (
          <div className="glass-strong rounded-2xl p-4 space-y-3 border border-[var(--accent)]/20">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-white">
                {selected.size} selecionada{selected.size > 1 ? "s" : ""}
              </span>
              <button onClick={() => setSelected(new Set())} className="text-[11px] text-[var(--muted)] hover:text-white">
                Limpar seleção
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-[0.12em]">Categoria</p>
              <div className="flex flex-wrap gap-1.5">
                {allCatChips.map((cat) => (
                  <button key={cat} type="button" onClick={() => setBulkCategory(bulkCategory === cat ? "" : cat)}
                    className={`chip ${bulkCategory === cat ? "chip-on" : ""}`}>
                    {cat}
                  </button>
                ))}
                {addingCustomCat ? (
                  <div className="flex items-center gap-1">
                    <input ref={customCatRef}
                      className="field h-[30px] px-2 py-0 text-[12px] w-36 rounded-full"
                      placeholder="Nova categoria…"
                      value={customCatInput}
                      onChange={(e) => setCustomCatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); confirmCustomCat(); }
                        if (e.key === "Escape") { setAddingCustomCat(false); setCustomCatInput(""); }
                      }} />
                    <button type="button" onClick={confirmCustomCat}
                      className="w-[30px] h-[30px] grid place-items-center rounded-full bg-[var(--accent)] text-[#09090b] shrink-0">
                      <Check size={12} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAddingCustomCat(true)}
                    className="chip flex items-center gap-1" title="Adicionar categoria">
                    <Plus size={11} />
                  </button>
                )}
              </div>
              {visibleSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-[var(--muted)] self-center">Sugestões:</span>
                  {visibleSuggestions.map((cat) => (
                    <button key={cat} type="button"
                      onClick={() => { setSessionCats((p) => [...p, cat]); setBulkCategory(cat); }}
                      className={`chip border-dashed ${bulkCategory === cat ? "chip-on" : ""}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex gap-0.5 p-0.5 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[var(--border)]">
                {([["", "Manter"], ["income", "Entrada"], ["expense", "Saída"]] as const).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => setBulkType(val as any)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-[7px] transition-colors ${
                      bulkType === val
                        ? val === "income" ? "bg-[var(--income-soft)] text-[var(--income)]"
                          : val === "expense" ? "bg-[var(--expense-soft)] text-[var(--expense)]"
                          : "bg-white/10 text-white"
                        : "text-[var(--muted)] hover:text-white"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              <input className="field h-9 px-3 py-0 text-[12px] rounded-lg w-[130px]"
                placeholder="dd/mm/aaaa" value={bulkDate}
                onChange={(e) => setBulkDate(e.target.value)} inputMode="numeric" />

              <button onClick={handleBulkApply} disabled={bulkApplying || !canApply}
                className="btn-primary h-9 px-5 rounded-xl text-[12.5px] font-semibold flex items-center gap-2 disabled:opacity-50">
                {bulkApplying ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Aplicar em {selected.size}
              </button>

              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                className="h-9 px-4 rounded-xl text-[12px] font-semibold flex items-center gap-2 border border-[rgba(244,63,94,0.4)] text-[var(--expense)] hover:bg-[rgba(244,63,94,0.08)] transition-colors disabled:opacity-50 ml-auto">
                {bulkDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Excluir {selected.size}
              </button>
            </div>
          </div>
        )}

        {/* Transaction list */}
        <div className="glass rounded-2xl overflow-hidden">
          {!isLoading && filtered.length > 0 && (
            <div className="flex items-center gap-3 px-5 py-2 border-b border-[var(--border)] bg-white/[0.015]">
              <button onClick={toggleAll} className="text-[var(--muted)] hover:text-white transition-colors">
                {allSelected
                  ? <CheckSquare size={14} className="text-[var(--accent)]" />
                  : <Square size={14} />}
              </button>
              <span className="text-[11px] text-[var(--muted)]">
                {someSelected ? `${selected.size} selecionada${selected.size > 1 ? "s" : ""}` : "Selecionar todas"}
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-lg bg-white/5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-white/5 rounded w-44" />
                    <div className="h-3 bg-white/5 rounded w-24" />
                  </div>
                  <div className="h-4 bg-white/5 rounded w-20" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <Inbox size={32} className="text-[var(--muted)]/40" />
              <p className="text-[13px] text-[var(--muted)]">
                {search || month || filter !== "all" ? "Nenhum resultado para este filtro." : "Sem transações ainda."}
              </p>
              <button onClick={() => { setEditing(null); setDialogOpen(true); }}
                className="text-[12px] text-[var(--accent)] hover:brightness-110">
                Adicionar manualmente
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {filtered.map((t) => {
                const isIn = t.type === "income";
                const isChecked = selected.has(t.id);
                return (
                  <div key={t.id}
                    onClick={() => { setActionItem(t); setConfirmDelete(false); }}
                    className={`group flex items-center gap-3 px-5 py-3 transition-colors cursor-pointer ${
                      isChecked ? "bg-[var(--accent-soft)]/20" : "hover:bg-white/[0.025]"
                    }`}>
                    <button onClick={(e) => toggleRow(t.id, e)}
                      className="shrink-0 text-[var(--muted)] hover:text-white transition-colors">
                      {isChecked
                        ? <CheckSquare size={14} className="text-[var(--accent)]" />
                        : <Square size={14} />}
                    </button>
                    <div className={`w-9 h-9 rounded-lg grid place-items-center text-base shrink-0 ${isIn ? "bg-[var(--income-soft)]" : "bg-white/5"}`}>
                      {catIcon(t.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-white truncate">{t.description}</div>
                      <div className="text-[11px] text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
                        <span>{t.category}</span>
                        <span>·</span>
                        <span>{format(new Date(t.date.slice(0, 10) + "T12:00:00"), "dd/MM/yyyy")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={`text-[13.5px] font-semibold tnum ${isIn ? "text-[var(--income)]" : "text-white"}`}>
                        {isIn ? "+ " : "− "}{brl(Math.abs(t.amount))}
                      </div>
                      <div className={`w-5 h-5 rounded-full grid place-items-center ${isIn ? "bg-[var(--income-soft)] text-[var(--income)]" : "bg-[var(--expense-soft)] text-[var(--expense)]"}`}>
                        {isIn ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--muted)] transition-all">
                        <Pencil size={13} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <button onClick={() => { setEditing(null); setDialogOpen(true); }}
        className="btn-primary fixed bottom-8 right-8 w-14 h-14 rounded-2xl grid place-items-center z-50 shadow-[0_12px_32px_-12px_rgba(106,248,47,0.8)]"
        aria-label="Nova transação">
        <Plus size={22} className="text-white" />
      </button>

      {/* Action sheet — edit or delete a single transaction */}
      {actionItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setActionItem(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="glass-strong rounded-2xl p-5 w-full max-w-sm relative z-10 fadeUp"
            onClick={(e) => e.stopPropagation()}>

            {!confirmDelete ? (
              <>
                {/* Transaction summary */}
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-10 h-10 rounded-xl grid place-items-center text-lg ${
                      actionItem.type === "income" ? "bg-[var(--income-soft)]" : "bg-white/5"
                    }`}>
                      {catIcon(actionItem.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[14px] font-semibold text-white truncate">{actionItem.description}</div>
                      <div className="text-[11px] text-[var(--muted)]">{actionItem.category}</div>
                    </div>
                    <button onClick={() => setActionItem(null)}
                      className="w-7 h-7 grid place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex items-baseline justify-between px-1">
                    <span className={`text-[22px] font-bold ${actionItem.type === "income" ? "text-[var(--income)]" : "text-white"}`}>
                      {actionItem.type === "income" ? "+" : "−"} {brl(Math.abs(actionItem.amount))}
                    </span>
                    <span className="text-[12px] text-[var(--muted)]">
                      {format(new Date(actionItem.date.slice(0, 10) + "T12:00:00"), "dd/MM/yyyy")}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setActionItem(null); setEditing(actionItem); setDialogOpen(true); }}
                    className="btn-primary flex-1 h-10 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2">
                    <Pencil size={13} />
                    Editar
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="h-10 px-4 rounded-xl border border-[rgba(244,63,94,0.35)] text-[var(--expense)] text-[13px] font-semibold hover:bg-[rgba(244,63,94,0.08)] transition-colors flex items-center gap-2">
                    <Trash2 size={13} />
                    Excluir
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Delete confirmation */}
                <div className="mb-5 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-[rgba(244,63,94,0.12)] border border-[rgba(244,63,94,0.25)] grid place-items-center mx-auto mb-3">
                    <Trash2 size={20} className="text-[var(--expense)]" />
                  </div>
                  <p className="text-[15px] font-semibold text-white mb-1">Excluir transação?</p>
                  <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">
                    <span className="text-white font-medium">"{actionItem.description}"</span> será removida permanentemente.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmDelete(false)}
                    className="flex-1 h-10 rounded-xl border border-[var(--border)] text-[var(--muted)] text-[13px] font-medium hover:text-white hover:border-white/20 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={handleDeleteSingle} disabled={deleting}
                    className="flex-1 h-10 rounded-xl bg-[rgba(244,63,94,0.12)] border border-[rgba(244,63,94,0.4)] text-[var(--expense)] text-[13px] font-semibold hover:bg-[rgba(244,63,94,0.2)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Confirmar exclusão
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <TransactionDialog open={dialogOpen} editing={editing} onClose={() => setDialogOpen(false)} />
    </Layout>
  );
}
