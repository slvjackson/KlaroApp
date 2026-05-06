import { useState, useMemo } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import {
  useGetDashboardSummary,
  useGetMonthlyTrend,
  useGetTransactionsByCategory,
  useListTransactions,
} from "@workspace/api-client-react";
import { Sparkline } from "@/components/Sparkline";
import { DailyHeader } from "@/components/DailyHeader";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { LevelCard } from "@/components/LevelCard";
import { TodayCard } from "@/components/TodayCard";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, Upload } from "lucide-react";

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

const CAT_COLORS = [
  "#6af82f", "#10b981", "#f59e0b", "#e879f9",
  "#fb923c", "#14b8a6", "#60a5fa", "#f43f5e",
];

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

// ─── Hero Balance Card ────────────────────────────────────────────────────────

interface HeroProps {
  balance: number;
  income: number;
  expenses: number;
  txCount: number;
  delta?: number;
  sparkPoints?: number[];
  loading: boolean;
  selectedMonth: string | null;
}

function HeroBalanceCard({ balance, income, expenses, txCount, delta, sparkPoints, loading, selectedMonth }: HeroProps) {
  const positive = balance >= 0;
  const up = (delta ?? 0) >= 0;

  return (
    <div className="glass rounded-2xl p-5 md:p-6">
      {/* Balance headline */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[var(--muted)] mb-2.5">
            Saldo líquido{selectedMonth ? ` · ${fmtMonth(selectedMonth)}` : ""}
          </div>
          {loading ? (
            <div className="h-10 w-48 rounded-lg bg-white/5 animate-pulse" />
          ) : (
            <div className={`text-[34px] sm:text-[42px] font-bold tnum tracking-tight leading-none ${positive ? "text-white" : "text-[var(--expense)]"}`}>
              {brl(balance)}
            </div>
          )}
          {!loading && delta !== undefined && (
            <div className={`flex items-center gap-1 mt-2.5 text-[12px] font-semibold ${up ? "text-[var(--income)]" : "text-[var(--expense)]"}`}>
              {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              <span>{up ? "+" : ""}{delta}%</span>
              <span className="text-[var(--muted)] font-normal ml-0.5">vs mês anterior</span>
            </div>
          )}
        </div>
        {sparkPoints && sparkPoints.length >= 2 && (
          <div className="hidden sm:block shrink-0 mt-1">
            <Sparkline
              points={sparkPoints}
              color={positive ? "var(--accent)" : "var(--expense)"}
              width={140}
              height={52}
            />
          </div>
        )}
      </div>

      {/* Supporting strip */}
      <div className="mt-5 pt-4 border-t border-[var(--border)] grid grid-cols-3 gap-3 sm:gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--muted)] mb-1">Entradas</div>
          {loading
            ? <div className="h-5 w-20 rounded bg-white/5 animate-pulse" />
            : <div className="text-[15px] sm:text-[17px] font-semibold tnum text-[var(--income)] truncate">{brl0(income)}</div>
          }
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--muted)] mb-1">Saídas</div>
          {loading
            ? <div className="h-5 w-20 rounded bg-white/5 animate-pulse" />
            : <div className="text-[15px] sm:text-[17px] font-semibold tnum text-[var(--expense)] truncate">{brl0(expenses)}</div>
          }
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--muted)] mb-1">Transações</div>
          {loading
            ? <div className="h-5 w-10 rounded bg-white/5 animate-pulse" />
            : <div className="text-[15px] sm:text-[17px] font-semibold tnum text-white">{txCount}</div>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Monthly chart ────────────────────────────────────────────────────────────

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
    <div className="glass rounded-2xl p-5 h-full flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <div>
          <div className="text-[13px] font-semibold text-white">Fluxo Mensal</div>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <div className="text-[11.5px] text-[var(--muted)]">Entradas vs. Saídas</div>
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
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5 text-[var(--muted)]">
            <span className="w-2 h-2 rounded-full bg-[var(--income)]" />Entradas
          </div>
          <div className="flex items-center gap-1.5 text-[var(--muted)]">
            <span className="w-2 h-2 rounded-full bg-[var(--expense)]" />Saídas
          </div>
        </div>
      </div>

      <div className="mt-4 relative h-[160px] flex items-end gap-2 flex-1">
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
                <div className="bar-income w-[9px] rounded-t-md transition-all" style={{ height: ih + "%", boxShadow: isSelected ? "0 0 8px var(--income)" : undefined }} />
                <div className="bar-expense w-[9px] rounded-t-md transition-all" style={{ height: eh + "%", boxShadow: isSelected ? "0 0 8px var(--expense)" : undefined }} />
              </div>
              <div className={`text-[9.5px] transition-colors ${isSelected ? "text-white font-semibold" : isHov ? "text-white" : "text-[var(--muted)]"}`}>
                {fmtMonth(m.month)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Category donut ───────────────────────────────────────────────────────────

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
    <div className="glass rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[13px] font-semibold text-white">Por Categoria</div>
          <div className="flex items-center gap-1.5">
            <div className="text-[11.5px] text-[var(--muted)]">
              {selectedMonth ? fmtMonth(selectedMonth) : "Todo o período"}
            </div>
            {selectedMonth && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent-soft)] text-[#90f048]">filtrado</span>
            )}
          </div>
        </div>
        <div className="flex gap-1 p-0.5 rounded-md bg-[rgba(255,255,255,0.04)] border border-[var(--border)]">
          <button onClick={() => setDonutType("expense")} className={`px-2.5 py-1 text-[10.5px] font-semibold rounded-[5px] transition-colors ${donutType === "expense" ? "bg-[var(--accent-soft)] text-white" : "text-[var(--muted)] hover:text-white"}`}>Saídas</button>
          <button onClick={() => setDonutType("income")}  className={`px-2.5 py-1 text-[10.5px] font-semibold rounded-[5px] transition-colors ${donutType === "income"  ? "bg-[var(--accent-soft)] text-white" : "text-[var(--muted)] hover:text-white"}`}>Entradas</button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex items-center justify-center flex-1 text-[12px] text-[var(--muted)]">
          {donutType === "expense" ? "Sem despesas registradas." : "Sem entradas registradas."}
        </div>
      ) : (
        <div className="flex items-center gap-5 flex-1 min-h-0">
          <div className="relative shrink-0" style={{ width: 120, height: 120 }}>
            <div
              className="w-full h-full rounded-full"
              style={{
                background: `conic-gradient(${stops})`,
                mask: "radial-gradient(circle, transparent 42px, #000 43px)",
                WebkitMask: "radial-gradient(circle, transparent 42px, #000 43px)",
              }}
            />
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">Total</div>
                <div className="text-[13px] font-bold text-white tnum leading-tight">{brl0(total)}</div>
              </div>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1.5">
            {filtered.slice(0, 6).map((c, i) => {
              const pct = total > 0 ? Math.round((c.total / total) * 100) : 0;
              return (
                <div key={c.category} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                  <div className="text-[11px] text-white/80 flex-1 truncate">{c.category}</div>
                  <div className="text-[10px] text-[var(--muted)] w-7 text-right tnum">{pct}%</div>
                  <div className="text-[11px] font-medium text-white w-16 text-right tnum">{brl0(c.total)}</div>
                </div>
              );
            })}
          </div>
        </div>
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
  const { data: allTx } = useListTransactions({ limit: 5000 });

  const monthly = (monthlyTrend ?? []) as { month: string; income: number; expenses: number }[];
  const catData = (categoryBreakdown ?? []) as { category: string; total: number; type: string }[];
  const allTxArr = (allTx ?? []) as { amount: number; category: string; type: string; date: string }[];

  const filteredTx = useMemo(
    () => selectedMonth ? allTxArr.filter((t) => t.date.startsWith(selectedMonth)) : allTxArr,
    [selectedMonth, allTxArr],
  );

  const activeCatData = useMemo(
    () => selectedMonth
      ? [...groupByCategory(filteredTx, "expense"), ...groupByCategory(filteredTx, "income")]
      : catData,
    [selectedMonth, filteredTx, catData],
  );

  if (isAuthLoading) return null;

  const selectedTrend = selectedMonth ? monthly.find((m) => m.month === selectedMonth) : null;
  const totalIncome   = selectedTrend ? selectedTrend.income   : (summary?.totalIncome   ?? 0);
  const totalExpenses = selectedTrend ? selectedTrend.expenses : (summary?.totalExpenses ?? 0);
  const netBalance    = selectedTrend ? selectedTrend.income - selectedTrend.expenses : (summary?.netBalance ?? 0);
  const txCount       = selectedMonth ? filteredTx.length : (summary?.transactionCount ?? 0);

  const incomePoints  = monthly.map((m) => m.income);
  const expensePoints = monthly.map((m) => m.expenses);

  function lastDelta(points: number[]) {
    if (points.length < 2) return undefined;
    const prev = points[points.length - 2];
    const curr = points[points.length - 1];
    if (!prev) return undefined;
    return Math.round(((curr - prev) / prev) * 100);
  }

  const balanceDelta = lastDelta(
    incomePoints.map((inc, i) => inc - (expensePoints[i] ?? 0))
  );

  return (
    <Layout title="Dashboard">
      <div className="space-y-4 md:space-y-5">

        {/* ── Row 1: Hero balance ── */}
        <HeroBalanceCard
          balance={netBalance}
          income={totalIncome}
          expenses={totalExpenses}
          txCount={txCount}
          delta={balanceDelta}
          sparkPoints={incomePoints.length >= 2 ? incomePoints : undefined}
          loading={isSummaryLoading}
          selectedMonth={selectedMonth}
        />

        {/* ── Row 1.5: Card "Hoje" rotativo ── */}
        <TodayCard />

        {/* ── Row 2: Analysis ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          {/* Fluxo mensal */}
          <div className="min-h-[260px]">
            {isMonthlyLoading ? (
              <div className="glass rounded-2xl h-full animate-pulse" />
            ) : monthly.length === 0 ? (
              <div className="glass rounded-2xl p-5 h-full flex flex-col items-center justify-center gap-3">
                <Upload size={28} className="text-[var(--muted)]/40" />
                <p className="text-[13px] text-[var(--muted)]">Sem dados mensais ainda.</p>
                <Link href="/upload" className="text-[12px] text-[var(--accent)] hover:brightness-110">Fazer upload</Link>
              </div>
            ) : (
              <MonthlyChart data={monthly} selectedMonth={selectedMonth} onSelectMonth={setSelectedMonth} />
            )}
          </div>

          {/* Saúde + Nível */}
          <div className="flex flex-col gap-4">
            <HealthScoreCard />
            <LevelCard />
          </div>
        </div>

        {/* ── Row 3: Category + Routine ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          {/* Por categoria */}
          <div className="min-h-[240px]">
            {isCategoryLoading ? (
              <div className="glass rounded-2xl h-full animate-pulse" />
            ) : (
              <CategoryDonut data={activeCatData} selectedMonth={selectedMonth} />
            )}
          </div>

          {/* Rotina diária */}
          <div className="glass rounded-2xl p-5">
            <DailyHeader />
          </div>
        </div>

      </div>
    </Layout>
  );
}
