import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import {
  useGetDashboardSummary,
  useGetMonthlyTrend,
  useGetTransactionsByCategory,
  useListInsights,
  useListUploads,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "wouter";
import {
  Wallet, TrendingUp, TrendingDown, Receipt,
  FileText, Lightbulb, Upload, ChevronRight,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  "#39FF14", // primary green
  "#60A5FA", // blue
  "#F59E0B", // amber
  "#F472B6", // pink
  "#A78BFA", // violet
  "#34D399", // emerald
  "#FB923C", // orange
  "#38BDF8", // sky
];

const MONTH_SHORT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatMonthKey(val: string) {
  const parts = val.split("-");
  if (parts.length === 2) {
    const m = parseInt(parts[1], 10) - 1;
    return `${MONTH_SHORT[m]}/${parts[0].slice(2)}`;
  }
  return val;
}

function translateStatus(status: string) {
  if (status === "done") return "Processado";
  if (status === "failed") return "Erro";
  return "Processando";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  valueClass,
  icon: Icon,
  iconBg,
  sub,
  loading,
}: {
  label: string;
  value: string;
  valueClass: string;
  icon: React.ElementType;
  iconBg: string;
  sub?: string;
  loading: boolean;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
            {loading ? (
              <Skeleton className="h-7 w-28 bg-muted mt-1" />
            ) : (
              <p className={`text-2xl font-bold tracking-tight ${valueClass}`}>{value}</p>
            )}
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Custom donut legend
function DonutLegend({
  data,
  total,
}: {
  data: { category: string; total: number }[];
  total: number;
}) {
  return (
    <div className="flex flex-col justify-center gap-2 min-w-0 flex-1">
      {data.map((entry, i) => {
        const pct = total > 0 ? Math.round((entry.total / total) * 100) : 0;
        return (
          <div key={entry.category} className="flex items-center gap-2 min-w-0">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            <span className="text-xs text-muted-foreground truncate flex-1">{entry.category}</span>
            <span className="text-xs text-muted-foreground shrink-0">{pct}%</span>
            <span className="text-xs font-medium text-white shrink-0 w-20 text-right">
              {formatCurrency(entry.total)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { isLoading: isAuthLoading } = useRequireAuth();

  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: monthlyTrend, isLoading: isMonthlyLoading } = useGetMonthlyTrend();
  const { data: categoryBreakdown, isLoading: isCategoryLoading } = useGetTransactionsByCategory();
  const { data: insights, isLoading: isInsightsLoading } = useListInsights();
  const { data: uploads, isLoading: isUploadsLoading } = useListUploads();

  if (isAuthLoading) return null;

  const netBalance = summary?.netBalance ?? 0;
  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpenses = summary?.totalExpenses ?? 0;
  const txCount = summary?.transactionCount ?? 0;

  const catData = (categoryBreakdown ?? []) as { category: string; total: number }[];
  const catTotal = catData.reduce((s, c) => s + c.total, 0);

  // Top 7 categories, group rest as "Outros"
  const TOP_N = 7;
  const topCats = catData.slice(0, TOP_N);
  const rest = catData.slice(TOP_N);
  const donutData =
    rest.length > 0
      ? [...topCats, { category: "Outros", total: rest.reduce((s, c) => s + c.total, 0) }]
      : topCats;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Visão geral das suas finanças.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Saldo líquido"
            value={formatCurrency(netBalance)}
            valueClass={netBalance >= 0 ? "text-primary" : "text-destructive"}
            icon={Wallet}
            iconBg={netBalance >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}
            sub="Mês atual"
            loading={isSummaryLoading}
          />
          <SummaryCard
            label="Entradas"
            value={formatCurrency(totalIncome)}
            valueClass="text-primary"
            icon={TrendingUp}
            iconBg="bg-primary/10 text-primary"
            sub="Receitas do mês"
            loading={isSummaryLoading}
          />
          <SummaryCard
            label="Saídas"
            value={formatCurrency(totalExpenses)}
            valueClass="text-destructive"
            icon={TrendingDown}
            iconBg="bg-destructive/10 text-destructive"
            sub="Despesas do mês"
            loading={isSummaryLoading}
          />
          <SummaryCard
            label="Transações"
            value={String(txCount)}
            valueClass="text-white"
            icon={Receipt}
            iconBg="bg-secondary text-muted-foreground"
            sub="No período"
            loading={isSummaryLoading}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar chart – Fluxo Mensal */}
          <Card className="col-span-1 lg:col-span-2 bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Fluxo Mensal</CardTitle>
              <p className="text-xs text-muted-foreground">Entradas vs. Saídas por mês</p>
            </CardHeader>
            <CardContent className="h-[280px] pr-2">
              {isMonthlyLoading ? (
                <Skeleton className="w-full h-full bg-muted" />
              ) : (monthlyTrend ?? []).length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                  Sem dados para exibir.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={monthlyTrend ?? []}
                    margin={{ top: 10, right: 8, left: 0, bottom: 0 }}
                    barCategoryGap="30%"
                    barGap={3}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                    <XAxis
                      dataKey="month"
                      stroke="#555"
                      tick={{ fill: "#888", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatMonthKey}
                    />
                    <YAxis
                      stroke="#555"
                      tick={{ fill: "#888", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={60}
                      tickFormatter={(v) => `R$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                    />
                    <RechartsTooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{
                        backgroundColor: "#1a1a1a",
                        borderColor: "#333",
                        borderRadius: 8,
                        color: "#fff",
                        fontSize: 12,
                      }}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === "income" ? "Entradas" : "Saídas",
                      ]}
                      labelFormatter={formatMonthKey}
                    />
                    <Legend
                      formatter={(value) => (value === "income" ? "Entradas" : "Saídas")}
                      wrapperStyle={{ fontSize: 12, color: "#888", paddingTop: 8 }}
                    />
                    <Bar dataKey="income" fill="#39FF14" name="income" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="expenses" fill="#FF6B6B" name="expenses" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Donut – Saídas por Categoria */}
          <Card className="col-span-1 bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-base">Saídas por Categoria</CardTitle>
              <p className="text-xs text-muted-foreground">Distribuição de despesas</p>
            </CardHeader>
            <CardContent>
              {isCategoryLoading ? (
                <Skeleton className="w-full h-48 bg-muted" />
              ) : donutData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                  Sem despesas registradas.
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Donut + center label */}
                  <div className="relative mx-auto" style={{ width: 160, height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          cx="50%"
                          cy="50%"
                          innerRadius={52}
                          outerRadius={72}
                          paddingAngle={3}
                          dataKey="total"
                          nameKey="category"
                          startAngle={90}
                          endAngle={-270}
                          strokeWidth={0}
                        >
                          {donutData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "#1a1a1a",
                            borderColor: "#333",
                            borderRadius: 8,
                            color: "#fff",
                            fontSize: 12,
                          }}
                          formatter={(value: number, _: string, props: { payload?: { category?: string } }) => [
                            formatCurrency(value),
                            props.payload?.category ?? "",
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Center label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</span>
                      <span className="text-sm font-bold text-white leading-tight">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                          maximumFractionDigits: 0,
                        }).format(catTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Legend */}
                  <DonutLegend data={donutData} total={catTotal} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Insights */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-primary" />
                  <CardTitle className="text-white text-base">Insights Recentes</CardTitle>
                </div>
                <Link
                  href="/insights"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Ver todos <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {isInsightsLoading ? (
                <>
                  <Skeleton className="h-16 w-full bg-muted" />
                  <Skeleton className="h-16 w-full bg-muted" />
                  <Skeleton className="h-16 w-full bg-muted" />
                </>
              ) : insights && insights.length > 0 ? (
                insights.slice(0, 3).map((insight) => (
                  <div
                    key={insight.id}
                    className="p-3 bg-background border border-border rounded-lg border-l-2 border-l-primary"
                  >
                    <p className="text-sm font-semibold text-white leading-snug mb-0.5">
                      {insight.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {insight.description}
                    </p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <Lightbulb className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nenhum insight gerado ainda.</p>
                  <Link href="/upload" className="text-xs text-primary hover:underline">
                    Faça um upload para começar
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Uploads */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-white text-base">Uploads Recentes</CardTitle>
                </div>
                <Link
                  href="/upload"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  Novo upload <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {isUploadsLoading ? (
                <>
                  <Skeleton className="h-12 w-full bg-muted" />
                  <Skeleton className="h-12 w-full bg-muted" />
                  <Skeleton className="h-12 w-full bg-muted" />
                </>
              ) : uploads && uploads.length > 0 ? (
                uploads.slice(0, 5).map((upload) => (
                  <div
                    key={upload.id}
                    className="flex items-center gap-3 p-2.5 bg-background border border-border rounded-lg"
                  >
                    <div className="w-8 h-8 bg-secondary rounded-md flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{upload.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(upload.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          upload.processingStatus === "done"
                            ? "bg-primary/15 text-primary"
                            : upload.processingStatus === "failed"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {translateStatus(upload.processingStatus)}
                      </span>
                      {upload.processingStatus === "done" && (
                        <Link
                          href={`/review/${upload.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Revisar
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                  <Upload className="w-8 h-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Nenhum upload feito ainda.</p>
                  <Link href="/upload" className="text-xs text-primary hover:underline">
                    Fazer primeiro upload
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
