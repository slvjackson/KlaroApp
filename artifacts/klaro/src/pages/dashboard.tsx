import { useState, useMemo } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import {
  useGetDashboardSummary,
  useGetMonthlyTrend,
  useGetTransactionsByCategory,
  useListInsights,
  useListUploads,
  useListTransactions,
} from "@workspace/api-client-react";
import { Sparkline } from "@/components/Sparkline";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";
import {
  Wallet, TrendingUp, TrendingDown, Receipt,
  Lightbulb, Upload, ChevronRight, FileText,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupByCategory(
  transactions: { amount: number; category: string; type: string }[] | undefined,
  type: "income" | "expense",
): { category: string; total: number; type: string }[] {
  if (!Array.isArray(transactions)) return [];
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type === type) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total, type }))
    .sort((a, b) => b.total - a.total);
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const CAT_COLORS = [
  "#6af82f", "#10b981", "#f59e0b", "#e879f9",
  "#fb923c", "#14b8a6", "#60a5fa", "#f43f5e",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function brl0(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function fmtMonth(val: string | null | undefined) {
  if (!val) return "";
  const MONTHS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [y, m] = val.split("-");
  const label = MONTHS[parseInt(m, 10) - 1] ?? val;
  return y ? `${label}/${y}` : label;
}

function translateStatus(s: string) {
  if (s === "done") return "Processado";
  if (s === "failed") return "Erro";
  return "Processando";
}

// ─── SummaryCard ──────────────────────────────────────────────────────────────

interface SummaryCardProps {
  label: string;
  value: string;
  tone: "income" | "expense" | "brand" | "neutral";
  icon: React.ElementType;
  delta?: number;
  sparkPoints?: number[];
  sparkColor?: string;
  loading?: boolean;
}

function SummaryCard({ label, value, tone, icon: Icon, delta, sparkPoints, sparkColor, loading }: SummaryCardProps) {
  const up = (delta ?? 0) >= 0;

  const iconCls =
    tone === "income" ? "bg-[var(--income-soft)] text-[var(--income)]" :
    tone === "expense" ? "bg-[var(--expense-soft)] text-[var(--expense)]" :
    tone === "brand"   ? "bg-[var(--accent-soft)] text-[#90f048]" :
    "bg-white/5 text-white/70";

  const valCls =
    tone === "income"  ? "text-[var(--income)]" :
    tone === "expense" ? "text-[var(--expense)]" :
    "text-white";

  return (
    <div className="glass rounded-2xl p-4 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[var(--muted)]">{label}</div>
        <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${iconCls}`}>
          <Icon size={15} />
        </div>
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="h-7 w-28 rounded-md bg-white/5 animate-pulse" />
        ) : (
          <div className={`text-[20px] sm:text-[26px] font-bold tnum tracking-tight leading-none ${valCls}`}>{value}</div>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        {delta !== undefined && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold ${up ? "text-[var(--income)]" : "text-[var(--expense)]"}`}>
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{up ? "+" : ""}{delta}%</span>
            <span className="hidden sm:inline text-[var(--muted)] font-normal ml-1">vs mês anterior</span>
          </div>
        )}
        {sparkPoints && sparkColor && (
          <div className="ml-auto hidden sm:block">
            <Sparkline points={sparkPoints} color={sparkColor} width={72} height={24} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Monthly chart (custom SVG bars) ─────────────────────────────────────────

function MonthlyChart({
  data,
  selectedMonth,
  onSelectMonth,
}: {
  data: { month: string; income: number; expenses: number }[];
  selectedMonth: string | null;
  onSelectMonth: (month: string | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.flatMap((m) => [m.income, m.expenses]), 1);
  const hasSelection = selectedMonth !== null;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <div>
          <div className="text-[15px] font-semibold text-white">Fluxo Mensal</div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <div className="text-[12px] text-[var(--muted)]">Entradas vs. Saídas nos últimos meses</div>
            {hasSelection && (
              <button
                onClick={() => onSelectMonth(null)}
                className="text-[10.5px] px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[#90f048] hover:brightness-110 transition-all"
              >
                {fmtMonth(selectedMonth!)} · limpar ×
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11.5px]">
          <div className="flex items-center gap-1.5 text-[var(--muted)]">
            <span className="w-2 h-2 rounded-full bg-[var(--income)]" />Entradas
          </div>
          <div className="flex items-center gap-1.5 text-[var(--muted)]">
            <span className="w-2 h-2 rounded-full bg-[var(--expense)]" />Saídas
          </div>
        </div>
      </div>

      <div className="mt-5 relative h-[180px] flex items-end gap-3">
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border-t border-dashed border-white/5" />
          ))}
        </div>

        {data.map((m, i) => {
          const ih = (m.income / max) * 100;
          const eh = (m.expenses / max) * 100;
          const isHov = hover === i;
          const isSelected = selectedMonth === m.month;
          const isDimmed = hasSelection && !isSelected;

          return (
            <div
              key={m.month}
              className="flex-1 h-full flex flex-col items-center gap-1.5 cursor-pointer"
              style={{ opacity: isDimmed ? 0.3 : 1, transition: "opacity 0.2s" }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelectMonth(isSelected ? null : m.month)}
            >
              <div className="relative flex-1 w-full flex items-end justify-center gap-1">
                {(isHov || isSelected) && (
                  <div className="absolute -top-16 z-10 px-2.5 py-1.5 rounded-md bg-[#1a1a20] border border-[var(--border-2)] text-[11px] whitespace-nowrap shadow-xl left-1/2 -translate-x-1/2">
                    <div className="text-white font-semibold">{fmtMonth(m.month)}</div>
                    <div className="text-[var(--income)] tnum">+ {brl0(m.income)}</div>
                    <div className="text-[var(--expense)] tnum">− {brl0(m.expenses)}</div>
                  </div>
                )}
                <div
                  className="bar-income w-[11px] rounded-t-md transition-all"
                  style={{ height: ih + "%", boxShadow: isSelected ? "0 0 8px var(--income)" : undefined }}
                />
                <div
                  className="bar-expense w-[11px] rounded-t-md transition-all"
                  style={{ height: eh + "%", boxShadow: isSelected ? "0 0 8px var(--expense)" : undefined }}
                />
              </div>
              <div className={`text-[10.5px] transition-colors ${isSelected ? "text-white font-semibold" : isHov ? "text-white" : "text-[var(--muted)]"}`}>
                {fmtMonth(m.month)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Category donut (conic-gradient) ─────────────────────────────────────────

interface CatItem { category: string; total: number; type: string; }

function CategoryDonut({ data, selectedMonth }: { data: CatItem[]; selectedMonth: string | null }) {
  const [donutType, setDonutType] = useState<"expense" | "income">("expense");

  const filtered = useMemo(() => {
    const items = data.filter((c) => c.type === donutType);
    const top = items.slice(0, 7);
    const rest = items.slice(7);
    return rest.length > 0
      ? [...top, { category: "Outros", total: rest.reduce((s, c) => s + c.total, 0), type: donutType }]
      : top;
  }, [data, donutType]);

  const total = filtered.reduce((s, c) => s + c.total, 0);

  let cursor = 0;
  const stops = filtered.map((c, i) => {
    const from = (cursor / total) * 360;
    cursor += c.total;
    const to = (cursor / total) * 360;
    return `${CAT_COLORS[i % CAT_COLORS.length]} ${from.toFixed(1)}deg ${to.toFixed(1)}deg`;
  }).join(", ");

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold text-white">Por Categoria</div>
          <div className="flex items-center gap-1.5">
            <div className="text-[12px] text-[var(--muted)]">
              {selectedMonth ? fmtMonth(selectedMonth) : "Todo o período"}
            </div>
            {selectedMonth && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-soft)] text-[#90f048]">filtrado</span>
            )}
          </div>
        </div>
        <div className="flex gap-1 p-0.5 rounded-md bg-[rgba(255,255,255,0.04)] border border-[var(--border)]">
          <button
            onClick={() => setDonutType("expense")}
            className={`px-2.5 py-1 text-[10.5px] font-semibold rounded-[5px] transition-colors ${donutType === "expense" ? "bg-[var(--accent-soft)] text-white" : "text-[var(--muted)] hover:text-white"}`}
          >
            Saídas
          </button>
          <button
            onClick={() => setDonutType("income")}
            className={`px-2.5 py-1 text-[10.5px] font-semibold rounded-[5px] transition-colors ${donutType === "income" ? "bg-[var(--accent-soft)] text-white" : "text-[var(--muted)] hover:text-white"}`}
          >
            Entradas
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-[12px] text-[var(--muted)]">
          {donutType === "expense" ? "Sem despesas registradas." : "Sem entradas registradas."}
        </div>
      ) : (
        <>
          <div className="relative mx-auto mt-4" style={{ width: 148, height: 148 }}>
            <div
              className="w-full h-full rounded-full"
              style={{
                background: `conic-gradient(${stops})`,
                mask: "radial-gradient(circle, transparent 54px, #000 55px)",
                WebkitMask: "radial-gradient(circle, transparent 54px, #000 55px)",
              }}
            />
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-[9.5px] uppercase tracking-[0.18em] text-[var(--muted)]">Total</div>
                <div className="text-[16px] font-bold text-white tnum leading-tight">{brl0(total)}</div>
                <div className="text-[10px] text-[var(--muted)] mt-0.5">{filtered.length} categorias</div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-1.5">
            {filtered.slice(0, 5).map((c, i) => {
              const pct = total > 0 ? Math.round((c.total / total) * 100) : 0;
              return (
                <div key={c.category} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                  <div className="text-[11.5px] text-white/90 flex-1 truncate">{c.category}</div>
                  <div className="text-[10.5px] text-[var(--muted)] w-8 text-right tnum">{pct}%</div>
                  <div className="text-[11.5px] font-medium text-white w-[74px] text-right tnum">{brl0(c.total)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: monthlyTrend, isLoading: isMonthlyLoading } = useGetMonthlyTrend();
  const { data: categoryBreakdown, isLoading: isCategoryLoading } = useGetTransactionsByCategory();
  const { data: insights } = useListInsights();
  const { data: uploads } = useListUploads();
  const { data: allTx } = useListTransactions({ limit: 5000 });

  const monthly = (monthlyTrend ?? []) as { month: string; income: number; expenses: number }[];
  const catData = (categoryBreakdown ?? []) as { category: string; total: number; type: string }[];
  const allTxArr = (allTx ?? []) as { amount: number; category: string; type: string; date: string }[];

  // Filter transactions by selected month
  const filteredTx = useMemo(
    () => selectedMonth ? allTxArr.filter((t) => t.date.startsWith(selectedMonth)) : allTxArr,
    [selectedMonth, allTxArr],
  );

  // Category breakdown — client-side when month selected, API data otherwise
  const activeCatData = useMemo(
    () => selectedMonth
      ? [...groupByCategory(filteredTx, "expense"), ...groupByCategory(filteredTx, "income")]
      : catData,
    [selectedMonth, filteredTx, catData],
  );

  if (isAuthLoading) return null;

  // Summary values — from monthly trend when month selected
  const selectedTrend = selectedMonth ? monthly.find((m) => m.month === selectedMonth) : null;
  const totalIncome    = selectedTrend ? selectedTrend.income    : (summary?.totalIncome    ?? 0);
  const totalExpenses  = selectedTrend ? selectedTrend.expenses  : (summary?.totalExpenses  ?? 0);
  const netBalance     = selectedTrend ? selectedTrend.income - selectedTrend.expenses : (summary?.netBalance ?? 0);
  const txCount        = selectedMonth
    ? filteredTx.length
    : (summary?.transactionCount ?? 0);

  // Sparkline points
  const incomePoints  = monthly.map((m) => m.income);
  const expensePoints = monthly.map((m) => m.expenses);

  function lastDelta(points: number[]) {
    if (points.length < 2) return undefined;
    const prev = points[points.length - 2];
    const curr = points[points.length - 1];
    if (!prev) return undefined;
    return Math.round(((curr - prev) / prev) * 100);
  }

  return (
    <Layout title="Dashboard">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <SummaryCard
            label="Saldo líquido"
            value={brl(netBalance)}
            tone={netBalance >= 0 ? "brand" : "expense"}
            icon={Wallet}
            delta={lastDelta(incomePoints.map((i, idx) => i - (expensePoints[idx] ?? 0)))}
            sparkPoints={incomePoints.length >= 2 ? incomePoints : undefined}
            sparkColor="var(--accent)"
            loading={isSummaryLoading}
          />
          <SummaryCard
            label="Entradas"
            value={brl(totalIncome)}
            tone="income"
            icon={TrendingUp}
            delta={lastDelta(incomePoints)}
            sparkPoints={incomePoints.length >= 2 ? incomePoints : undefined}
            sparkColor="var(--income)"
            loading={isSummaryLoading}
          />
          <SummaryCard
            label="Saídas"
            value={brl(totalExpenses)}
            tone="expense"
            icon={TrendingDown}
            delta={lastDelta(expensePoints)}
            sparkPoints={expensePoints.length >= 2 ? expensePoints : undefined}
            sparkColor="var(--expense)"
            loading={isSummaryLoading}
          />
          <SummaryCard
            label="Transações"
            value={String(txCount)}
            tone="neutral"
            icon={Receipt}
            loading={isSummaryLoading}
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Bar chart */}
          <div className="col-span-1 lg:col-span-2">
            {isMonthlyLoading ? (
              <div className="glass rounded-2xl p-5 h-[280px] animate-pulse" />
            ) : monthly.length === 0 ? (
              <div className="glass rounded-2xl p-5 flex flex-col items-center justify-center h-[280px] gap-3">
                <Upload size={32} className="text-[var(--muted)]/40" />
                <p className="text-[13px] text-[var(--muted)]">Sem dados mensais ainda.</p>
                <Link href="/upload" className="text-[12px] text-[var(--accent)] hover:brightness-110">
                  Fazer upload
                </Link>
              </div>
            ) : (
              <MonthlyChart
                data={monthly}
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
              />
            )}
          </div>

          {/* Donut */}
          <div className="col-span-1">
            {isCategoryLoading ? (
              <div className="glass rounded-2xl p-5 h-full animate-pulse" />
            ) : (
              <CategoryDonut data={activeCatData} selectedMonth={selectedMonth} />
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Insights */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Lightbulb size={15} className="text-[#90f048]" />
                <div className="text-[15px] font-semibold text-white">Insights Recentes</div>
              </div>
              <Link href="/insights" className="flex items-center gap-1 text-[11.5px] text-[var(--muted)] hover:text-white">
                Ver todos <ChevronRight size={12} />
              </Link>
            </div>

            {insights && insights.length > 0 ? (
              <div className="space-y-2">
                {insights.slice(0, 3).map((ins) => (
                  <div key={ins.id} className="p-3 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.015)] hover:border-[var(--border-2)] transition-colors">
                    <div className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-md grid place-items-center shrink-0 mt-0.5 bg-[var(--income-soft)] text-[var(--income)]">
                        <TrendingUp size={13} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[12.5px] font-semibold text-white leading-snug">{ins.title}</div>
                        <div className="text-[11.5px] text-[var(--muted)] leading-relaxed mt-0.5 line-clamp-2">{ins.description}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <Lightbulb size={28} className="text-[var(--muted)]/40" />
                <p className="text-[12.5px] text-[var(--muted)]">Nenhum insight gerado ainda.</p>
                <Link href="/upload" className="text-[12px] text-[var(--accent)] hover:brightness-110">
                  Faça um upload para começar
                </Link>
              </div>
            )}
          </div>

          {/* Uploads */}
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Upload size={15} className="text-[var(--muted)]" />
                <div className="text-[15px] font-semibold text-white">Uploads Recentes</div>
              </div>
              <Link href="/upload" className="flex items-center gap-1 text-[11.5px] text-[var(--muted)] hover:text-white">
                Novo upload <ChevronRight size={12} />
              </Link>
            </div>

            {uploads && uploads.length > 0 ? (
              <div className="space-y-2">
                {[...uploads].reverse().slice(0, 5).map((upload) => (
                  <div key={upload.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.015)]">
                    <div className="w-8 h-8 bg-white/5 rounded-lg grid place-items-center shrink-0">
                      <FileText size={15} className="text-[var(--muted)]" />
                    </div>
                    <div className="flex-1 min-w-0 leading-tight">
                      <div className="text-[12.5px] font-medium text-white truncate">{upload.fileName}</div>
                      <div className="text-[11px] text-[var(--muted)]">
                        {upload.createdAt ? format(new Date(upload.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "—"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        upload.processingStatus === "done"   ? "bg-[var(--income-soft)] text-[var(--income)]" :
                        upload.processingStatus === "failed" ? "bg-[var(--expense-soft)] text-[var(--expense)]" :
                        "bg-white/5 text-[var(--muted)]"
                      }`}>
                        {translateStatus(upload.processingStatus)}
                      </span>
                      {upload.processingStatus === "done" && (
                        <Link href={`/review/${upload.id}`} className="text-[11px] text-[var(--accent)] hover:brightness-110">
                          Revisar
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                <Upload size={28} className="text-[var(--muted)]/40" />
                <p className="text-[12.5px] text-[var(--muted)]">Nenhum upload feito ainda.</p>
                <Link href="/upload" className="text-[12px] text-[var(--accent)] hover:brightness-110">
                  Fazer primeiro upload
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
