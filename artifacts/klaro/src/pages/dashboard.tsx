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
import { FeatureTutorial, TutorialButton, type TutorialStep } from "@/components/feature-tutorial";

const DASHBOARD_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Visão geral em um lance",
    body: "O card principal mostra saldo, receitas e despesas do período. A linha tracejada compara com o mês anterior.",
    tip: "Toque no valor para alternar entre saldo, receitas e despesas.",
    target: "#tutorial-dashboard-hero",
  },
  {
    title: "Hoje, em tempo real",
    body: "O card 'Hoje' rotaciona destaques do dia: novas transações, alertas e movimentações importantes.",
    tip: "Confira no início do dia — ele dá a temperatura antes de você abrir qualquer relatório.",
    target: "#tutorial-dashboard-today",
  },
  {
    title: "Mês a mês",
    body: "O gráfico mostra a evolução do caixa nos últimos meses. Clique em uma barra para filtrar os outros cards por aquele mês.",
    tip: "Veja se o resultado do mês atual está acima ou abaixo da média antes de tomar decisões.",
    target: "#tutorial-dashboard-monthly",
  },
  {
    title: "Saúde da gestão",
    body: "Um score que mistura cobertura de uploads, consistência de categorização e revisão de transações. Subir esse número é o sinal mais simples de que você está com a casa em ordem.",
    tip: "Score baixo? Geralmente é falta de upload recente ou transações sem categoria. Atacando isso ele sobe rápido.",
    target: "#tutorial-dashboard-health",
  },
  {
    title: "Nível e ranking",
    body: "Cada ação no Klaro (upload, revisão, missão concluída) soma XP. O nível mostra sua evolução como gestor — e desbloqueia recursos conforme avança.",
    tip: "Faça pelo menos uma ação por dia. Pequenas pontuações regulares te levam mais longe que um pico isolado.",
    target: "#tutorial-dashboard-level",
  },
  {
    title: "Categorias que pesam",
    body: "O donut revela onde seu dinheiro entra e sai. Cores quentes = despesa, verde = receita.",
    tip: "Se uma fatia cresceu de repente, vá em Transações filtrar essa categoria para entender o motivo.",
    target: "#tutorial-dashboard-categories",
  },
  {
    title: "Tarefas diárias + streak",
    body: "Pequenas missões que aparecem a cada dia: revisar uma transação, conferir um insight, marcar uma meta. Cumprir mantém o streak — sua sequência consecutiva.",
    tip: "Streak não é vaidade — ele força o hábito de abrir o Klaro todo dia, o que multiplica o valor do produto.",
    target: "#tutorial-dashboard-routine",
  },
];
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

// Paleta Neo-Brutalismo moderno: pastéis saturados + contrastes profundos + acento elétrico
const CAT_COLORS = [
  "#7FE5C2", // mint
  "#C2B5FF", // lavender
  "#FF9580", // coral
  "#D9FF1F", // lime (acento elétrico)
  "#2A3FC9", // royal blue profundo
  "#8A38FF", // roxo vibrante
  "#FFB68A", // peach
  "#E8E8E8", // cinza claro neutro
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
            <span className="w-2 h-2 rounded-full bg-[var(--chart-mint)]" />Entradas
          </div>
          <div className="flex items-center gap-1.5 text-[var(--muted)]">
            <span className="w-2 h-2 rounded-full bg-[var(--chart-coral)]" />Saídas
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
                    <div className="text-[var(--chart-mint)] tnum">+ {brl0(m.income)}</div>
                    <div className="text-[var(--chart-coral)] tnum">− {brl0(m.expenses)}</div>
                  </div>
                )}
                <div className="chart-bar-income w-[9px] rounded-t-md transition-all" style={{ height: ih + "%", boxShadow: isSelected ? "0 0 8px var(--chart-mint)" : undefined }} />
                <div className="chart-bar-expense w-[9px] rounded-t-md transition-all" style={{ height: eh + "%", boxShadow: isSelected ? "0 0 8px var(--chart-coral)" : undefined }} />
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
        <div className="flex flex-col items-center gap-5 flex-1 min-h-0">
          <div className="relative shrink-0" style={{ width: 168, height: 168 }}>
            <div
              className="w-full h-full rounded-full"
              style={{
                background: `conic-gradient(${stops})`,
                mask: "radial-gradient(circle, transparent 60px, #000 61px)",
                WebkitMask: "radial-gradient(circle, transparent 60px, #000 61px)",
              }}
            />
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">Total</div>
                <div className="text-[14px] font-bold text-white tnum leading-tight">{brl0(total)}</div>
              </div>
            </div>
          </div>
          <div className="w-full space-y-1">
            {filtered.slice(0, 6).map((c, i) => {
              const pct = total > 0 ? Math.round((c.total / total) * 100) : 0;
              return (
                <div key={c.category} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                  <div className="text-[10.5px] text-white/80 flex-1 truncate">{c.category}</div>
                  <div className="text-[10px] text-[var(--muted)] w-7 text-right tnum">{pct}%</div>
                  <div className="text-[10.5px] font-medium text-white w-16 text-right tnum">{brl0(c.total)}</div>
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
  const [tutorialOpen, setTutorialOpen] = useState(false);

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

        <div className="flex items-center justify-end">
          <TutorialButton onClick={() => setTutorialOpen(true)} />
        </div>

        {/* ── Row 1: Hero balance ── */}
        <div id="tutorial-dashboard-hero">
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
        </div>

        {/* ── Row 1.5: Card "Hoje" rotativo ── */}
        <div id="tutorial-dashboard-today">
          <TodayCard />
        </div>

        {/* ── Row 2: Analysis ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          {/* Fluxo mensal */}
          <div id="tutorial-dashboard-monthly" className="min-h-[260px]">
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
            <div id="tutorial-dashboard-health">
              <HealthScoreCard />
            </div>
            <div id="tutorial-dashboard-level">
              <LevelCard />
            </div>
          </div>
        </div>

        {/* ── Row 3: Category + Routine ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
          {/* Por categoria */}
          <div id="tutorial-dashboard-categories" className="min-h-[240px]">
            {isCategoryLoading ? (
              <div className="glass rounded-2xl h-full animate-pulse" />
            ) : (
              <CategoryDonut data={activeCatData} selectedMonth={selectedMonth} />
            )}
          </div>

          {/* Rotina diária */}
          <div id="tutorial-dashboard-routine" className="glass rounded-2xl p-5">
            <DailyHeader />
          </div>
        </div>

      </div>

      <FeatureTutorial
        open={tutorialOpen}
        steps={DASHBOARD_TUTORIAL_STEPS}
        onClose={() => setTutorialOpen(false)}
      />
    </Layout>
  );
}
