import { useMemo, useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { useListTransactions } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { Pencil, Plus, Search, X, Inbox } from "lucide-react";
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
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

  const summary = useMemo(() => {
    return filtered.reduce(
      (acc, t) => {
        if (t.type === "income") acc.income += t.amount;
        else acc.expense += t.amount;
        return acc;
      },
      { income: 0, expense: 0 },
    );
  }, [filtered]);

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(tx: TransactionData) {
    setEditing(tx);
    setDialogOpen(true);
  }

  const FILTERS: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "income", label: "Receitas" },
    { key: "expense", label: "Despesas" },
  ];

  return (
    <Layout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Transações</h1>
            <p className="text-sm text-muted-foreground mt-1">Todas as suas transações confirmadas.</p>
          </div>
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Type chips */}
          <div className="flex gap-1 p-1 bg-card border border-border" style={{ borderRadius: "10px" }}>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={{ borderRadius: "7px" }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Month selector */}
          <select
            value={month ?? ""}
            onChange={(e) => setMonth(e.target.value || null)}
            className="h-8 px-3 text-xs bg-card border border-border text-muted-foreground hover:text-foreground transition-colors"
            style={{ borderRadius: "8px" }}
          >
            <option value="">Todos os meses</option>
            {monthOptions.map((m) => (
              <option key={m.key} value={m.key}>{m.label}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar descrição ou categoria..."
              className="pl-8 pr-8 h-8 text-xs bg-card border-border text-white"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Summary bar */}
        {!isLoading && (
          <div className="flex flex-wrap gap-4 px-1 text-xs text-muted-foreground">
            <span>
              {filtered.length} {filtered.length === 1 ? "transação" : "transações"}
            </span>
            <span className="text-primary font-medium">+{formatCurrency(summary.income)}</span>
            <span className="text-destructive font-medium">-{formatCurrency(summary.expense)}</span>
            <span className="font-semibold text-white">
              Saldo: {formatCurrency(summary.income - summary.expense)}
            </span>
          </div>
        )}

        {/* Table */}
        <div className="bg-card border border-border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Descrição</TableHead>
                <TableHead className="text-xs">Categoria</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="border-border">
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Inbox className="w-8 h-8" />
                      <p className="text-sm">
                        {search || month || filter !== "all"
                          ? "Nenhum resultado para este filtro."
                          : "Sem transações ainda."}
                      </p>
                      <button
                        onClick={openAdd}
                        className="text-xs text-primary hover:underline"
                      >
                        Adicionar manualmente
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow
                    key={t.id}
                    className="border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => openEdit(t)}
                  >
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(t.date + "T12:00:00"), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="font-medium text-white text-sm">{t.description}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.category}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.type === "income"
                            ? "bg-primary/10 text-primary"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {t.type === "income" ? "Entrada" : "Saída"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      <span className={t.type === "income" ? "text-primary" : "text-white"}>
                        {t.type === "expense" ? "-" : ""}
                        {formatCurrency(t.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={openAdd}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center z-50"
        style={{ borderRadius: "16px" }}
        aria-label="Nova transação"
      >
        <Plus className="w-6 h-6" />
      </button>

      <TransactionDialog
        open={dialogOpen}
        editing={editing}
        onClose={() => setDialogOpen(false)}
      />
    </Layout>
  );
}
