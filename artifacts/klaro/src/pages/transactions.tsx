import { useMemo, useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { useListTransactions } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Pencil, Plus, Search, X, Inbox, ArrowUp, ArrowDown } from "lucide-react";
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

  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionData | null>(null);

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

  const summary = useMemo(() =>
    filtered.reduce((acc, t) => {
      if (t.type === "income") acc.income += t.amount;
      else acc.expense += t.amount;
      return acc;
    }, { income: 0, expense: 0 }),
  [filtered]);

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
          {/* Type chips */}
          <div className="flex gap-1 p-0.5 rounded-md bg-[rgba(255,255,255,0.04)] border border-[var(--border)]">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-2.5 py-1 text-[10.5px] font-semibold rounded-[5px] transition-colors ${
                  filter === f.key ? "bg-[var(--accent-soft)] text-white" : "text-[var(--muted)] hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Month */}
          <select
            value={month ?? ""}
            onChange={(e) => setMonth(e.target.value || null)}
            className="field px-3 py-1.5 text-[12px] rounded-lg"
            style={{ width: "auto" }}
          >
            <option value="">Todos os meses</option>
            {monthOptions.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar descrição ou categoria…"
              className="field pl-9 pr-9 py-2 text-[12.5px]"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white">
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

        {/* Transaction list */}
        <div className="glass rounded-2xl overflow-hidden">
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
              <button onClick={() => { setEditing(null); setDialogOpen(true); }} className="text-[12px] text-[var(--accent)] hover:brightness-110">
                Adicionar manualmente
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {filtered.map((t) => {
                const isIn = t.type === "income";
                return (
                  <div
                    key={t.id}
                    onClick={() => { setEditing(t); setDialogOpen(true); }}
                    className="group flex items-center gap-3 px-5 py-3 hover:bg-white/[0.025] transition-colors cursor-pointer"
                  >
                    <div className={`w-9 h-9 rounded-lg grid place-items-center text-base shrink-0 ${
                      isIn ? "bg-[var(--income-soft)]" : "bg-white/5"
                    }`}>
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
                      <div className={`w-5 h-5 rounded-full grid place-items-center ${
                        isIn ? "bg-[var(--income-soft)] text-[var(--income)]" : "bg-[var(--expense-soft)] text-[var(--expense)]"
                      }`}>
                        {isIn ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditing(t); setDialogOpen(true); }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5 transition-all"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => { setEditing(null); setDialogOpen(true); }}
        className="btn-primary fixed bottom-8 right-8 w-14 h-14 rounded-2xl grid place-items-center z-50 shadow-[0_12px_32px_-12px_rgba(106,248,47,0.8)]"
        aria-label="Nova transação"
      >
        <Plus size={22} className="text-white" />
      </button>

      <TransactionDialog
        open={dialogOpen}
        editing={editing}
        onClose={() => setDialogOpen(false)}
      />
    </Layout>
  );
}
