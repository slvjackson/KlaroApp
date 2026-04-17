import { Feather } from "@expo/vector-icons";
import {
  useGetDashboardSummary,
  useGetMonthlyTrend,
  useListTransactions,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SpeedDialFab } from "@/components/SpeedDialFab";
import { GoalProgress } from "@/components/GoalProgress";
import { MetricCard } from "@/components/MetricCard";
import { TransactionRow } from "@/components/TransactionRow";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactionForm } from "@/contexts/TransactionFormContext";
import { useColors } from "@/hooks/useColors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function fBRL(value: number, compact = false): string {
  if (compact && value >= 1000)
    return `R$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0,
  }).format(value);
}

function fMonth(yyyymm: string): string {
  return MONTH_SHORT[parseInt(yyyymm.split("-")[1], 10) - 1] ?? yyyymm;
}

function fMonthFull(yyyymm: string): string {
  const [year, month] = yyyymm.split("-");
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
}

function currentMonthKey() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonthLabel() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return MONTH_NAMES[d.getUTCMonth()];
}

function groupByCategory(
  transactions: { amount: number; category: string }[] | undefined
): { category: string; total: number }[] {
  if (!Array.isArray(transactions)) return [];
  const map = new Map<string, number>();
  for (const t of transactions) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

// ─── KPI Tooltip ──────────────────────────────────────────────────────────────

const KPI_EXPLANATIONS: Record<string, string> = {
  "Crescimento": "Variação percentual da receita em relação ao mês anterior.",
  "Melhor mês": "O mês com maior receita total registrada.",
  "Índice despesa": "Percentual das despesas em relação à receita. Abaixo de 70% é saudável.",
  "Ticket médio": "Valor médio recebido por transação de receita.",
  "Receita": "Total de entradas no período selecionado.",
  "Despesas": "Total de saídas no período selecionado.",
};

function KpiTooltip({ label }: { label: string }) {
  const colors = useColors();
  const [visible, setVisible] = useState(false);
  const explanation = KPI_EXPLANATIONS[label];
  if (!explanation) return null;
  return (
    <>
      <Pressable onPress={() => setVisible(true)} hitSlop={8}>
        <Feather name="info" size={12} color={colors.mutedForeground} />
      </Pressable>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.tooltipOverlay} onPress={() => setVisible(false)}>
          <View style={[styles.tooltipBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Text style={[styles.tooltipTitle, { color: colors.foreground }]}>{label}</Text>
            <Text style={[styles.tooltipBody, { color: colors.mutedForeground }]}>{explanation}</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Monthly bar chart ────────────────────────────────────────────────────────

function MonthlyBarChart({
  data,
  selectedMonth,
  onSelectMonth,
}: {
  data: { month: string; income: number; expenses: number }[];
  selectedMonth: string | null;
  onSelectMonth: (month: string | null) => void;
}) {
  const colors = useColors();
  const last6 = data.slice(-6);
  if (last6.length === 0) return null;

  const maxVal = Math.max(...last6.flatMap((d) => [d.income, d.expenses]), 1);
  const BAR_MAX_H = 90;
  const BAR_W = 14;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={styles.legendRow}>
        <View style={styles.legend}>
          {[{ label: "Receita", color: colors.income }, { label: "Despesa", color: colors.expense }].map((l) => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: l.color }]} />
              <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{l.label}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.tapHint, { color: colors.mutedForeground }]}>Toque para filtrar</Text>
      </View>

      <View style={styles.barsRow}>
        {last6.map((d) => {
          const hasData = d.income > 0 || d.expenses > 0;
          const ih = hasData ? Math.max((d.income / maxVal) * BAR_MAX_H, 2) : 0;
          const eh = hasData ? Math.max((d.expenses / maxVal) * BAR_MAX_H, 2) : 0;
          const isSelected = selectedMonth === d.month;
          const isDimmed = selectedMonth !== null && !isSelected;

          return (
            <Pressable
              key={d.month}
              onPress={() => {
                if (!hasData) return;
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectMonth(isSelected ? null : d.month);
              }}
              style={({ pressed }) => [
                styles.barGroup,
                { opacity: isDimmed ? 0.3 : (!hasData ? 0.4 : pressed ? 0.7 : 1) },
              ]}
            >
              <View style={[styles.barsAligned, { height: BAR_MAX_H }]}>
                {ih > 0 && <View style={{ height: ih, width: BAR_W, backgroundColor: colors.income, borderRadius: 3, ...(isSelected && { opacity: 1 }) }} />}
                {ih === 0 && <View style={{ width: BAR_W }} />}
                {eh > 0 && <View style={{ height: eh, width: BAR_W, backgroundColor: colors.expense, borderRadius: 3, ...(isSelected && { opacity: 1 }) }} />}
                {eh === 0 && <View style={{ width: BAR_W }} />}
              </View>
              <Text style={[styles.barLabel, { color: isSelected ? colors.primary : colors.mutedForeground }, isSelected && { fontFamily: "Inter_600SemiBold" }]}>
                {fMonth(d.month)}
              </Text>
              {isSelected && <View style={[styles.barDot, { backgroundColor: colors.primary }]} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Horizontal bars ──────────────────────────────────────────────────────────

function HorizontalBars({
  data,
  color,
  onCategoryPress,
}: {
  data: { category: string; total: number }[];
  color: string;
  onCategoryPress?: () => void;
}) {
  const colors = useColors();
  if (data.length === 0) return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>
        Sem transações neste período
      </Text>
    </View>
  );

  const maxVal = Math.max(...data.map((d) => d.total), 1);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      {data.map((item, i) => (
        <Pressable
          key={item.category}
          onPress={onCategoryPress}
          style={({ pressed }) => [
            i > 0 && { marginTop: 14 },
            { opacity: pressed && onCategoryPress ? 0.7 : 1 },
          ]}
        >
          <View style={styles.hBarHeader}>
            <Text style={[styles.hBarLabel, { color: colors.foreground }]} numberOfLines={1}>{item.category}</Text>
            <View style={styles.hBarRight}>
              <Text style={[styles.hBarValue, { color: colors.mutedForeground }]}>{fBRL(item.total, true)}</Text>
              {onCategoryPress && <Feather name="chevron-right" size={12} color={colors.mutedForeground} />}
            </View>
          </View>
          <View style={[styles.hBarTrack, { backgroundColor: colors.secondary }]}>
            <View style={[styles.hBarFill, { width: `${(item.total / maxVal) * 100}%` as `${number}%`, backgroundColor: color }]} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Quick metrics ────────────────────────────────────────────────────────────

interface Summary { totalIncome?: number; totalExpenses?: number; transactionCount?: number; }

function QuickMetrics({
  summary,
  trend,
  selectedMonth,
}: {
  summary: Summary;
  trend: { month: string; income: number; expenses: number }[];
  selectedMonth: string | null;
}) {
  const colors = useColors();

  const last2 = trend.slice(-2);
  const momGrowth =
    last2.length === 2 && last2[0].income > 0
      ? ((last2[1].income - last2[0].income) / last2[0].income) * 100
      : null;

  const bestMonth = trend.length > 0
    ? trend.reduce((b, m) => (m.income > b.income ? m : b), trend[0])
    : null;

  const expRatio =
    (summary.totalIncome ?? 0) > 0
      ? Math.round(((summary.totalExpenses ?? 0) / (summary.totalIncome ?? 1)) * 100)
      : null;

  const avgTicket =
    (summary.transactionCount ?? 0) > 0 && (summary.totalIncome ?? 0) > 0
      ? (summary.totalIncome! / summary.transactionCount!)
      : null;

  const cards = selectedMonth
    ? [
        { label: "Receita", value: fBRL(summary.totalIncome ?? 0, true), sub: fMonth(selectedMonth), valueColor: colors.income },
        { label: "Despesas", value: fBRL(summary.totalExpenses ?? 0, true), sub: fMonth(selectedMonth), valueColor: colors.expense },
        { label: "Índice despesa", value: expRatio != null ? `${expRatio}%` : "—", sub: "sobre receita", valueColor: expRatio != null ? (expRatio <= 70 ? colors.income : colors.expense) : colors.mutedForeground },
        { label: "Ticket médio", value: avgTicket != null ? fBRL(avgTicket, true) : "—", sub: "por transação", valueColor: colors.foreground },
      ]
    : [
        { label: "Crescimento", value: momGrowth != null ? `${momGrowth >= 0 ? "+" : ""}${momGrowth.toFixed(1)}%` : "—", sub: "mês a mês", valueColor: momGrowth != null ? (momGrowth >= 0 ? colors.income : colors.expense) : colors.mutedForeground },
        { label: "Melhor mês", value: bestMonth ? fMonth(bestMonth.month) : "—", sub: bestMonth ? fBRL(bestMonth.income, true) : "", valueColor: colors.foreground },
        { label: "Índice despesa", value: expRatio != null ? `${expRatio}%` : "—", sub: "sobre receita", valueColor: expRatio != null ? (expRatio <= 70 ? colors.income : colors.expense) : colors.mutedForeground },
        { label: "Ticket médio", value: avgTicket != null ? fBRL(avgTicket, true) : "—", sub: "por transação", valueColor: colors.foreground },
      ];

  return (
    <View style={styles.metricsGrid2}>
      {cards.map((c) => (
        <View key={c.label} style={[styles.kpiCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <View style={styles.kpiLabelRow}>
            <Text style={[styles.kpiLabel, { color: colors.mutedForeground }]}>{c.label}</Text>
            <KpiTooltip label={c.label} />
          </View>
          <Text style={[styles.kpiValue, { color: c.valueColor }]}>{c.value}</Text>
          {c.sub ? <Text style={[styles.kpiSub, { color: colors.mutedForeground }]}>{c.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

// ─── Filter badge ─────────────────────────────────────────────────────────────

function FilterBadge({ month, onClear }: { month: string; onClear: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onClear}
      style={[styles.filterBadge, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}44`, borderRadius: colors.radius }]}
    >
      <Feather name="filter" size={12} color={colors.primary} />
      <Text style={[styles.filterBadgeText, { color: colors.primary }]}>{fMonthFull(month)}</Text>
      <Feather name="x" size={12} color={colors.primary} />
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { openAdd } = useTransactionForm();

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const { data: summary, refetch: refetchSummary } = useGetDashboardSummary();
  const { data: trend, isLoading: trendLoading, refetch: refetchTrend } = useGetMonthlyTrend();
  const { data: recentTx, isLoading: recentLoading, refetch: refetchRecent } =
    useListTransactions({ limit: 5 });
  const { data: allIncomeTx, refetch: refetchIncome } = useListTransactions({
    type: "income", limit: 5000,
  });
  const { data: allExpenseTx, refetch: refetchExpense } = useListTransactions({
    type: "expense", limit: 5000,
  });

  const isLoading = trendLoading || recentLoading;
  const monthKey = currentMonthKey();
  const monthLabel = currentMonthLabel();
  const trendData = Array.isArray(trend) ? trend : [];

  // Current-month metrics (always current month regardless of selectedMonth)
  const currentTrend = trendData.find((d) => d.month === monthKey);
  const prevMonthKey = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }, [monthKey]);
  const prevTrend = trendData.find((d) => d.month === prevMonthKey);

  const monthIncome = currentTrend?.income ?? 0;
  const monthExpenses = currentTrend?.expenses ?? 0;
  const monthNet = monthIncome - monthExpenses;

  const incomeTrend =
    prevTrend && prevTrend.income > 0
      ? ((monthIncome - prevTrend.income) / prevTrend.income) * 100
      : null;
  const expenseTrend =
    prevTrend && prevTrend.expenses > 0
      ? ((monthExpenses - prevTrend.expenses) / prevTrend.expenses) * 100
      : null;

  // Revenue for goal card (current month from income transactions)
  const monthRevenue = useMemo(() => {
    if (!Array.isArray(allIncomeTx)) return 0;
    return allIncomeTx
      .filter((t) => t.date.startsWith(monthKey))
      .reduce((s, t) => s + t.amount, 0);
  }, [allIncomeTx, monthKey]);

  const revenueGoal = user?.businessProfile?.monthlyRevenueGoal ?? 0;

  // Filtered transactions for category analysis (react to selectedMonth)
  const filteredIncomeTx = useMemo(() => {
    if (!selectedMonth || !Array.isArray(allIncomeTx)) return allIncomeTx;
    return allIncomeTx.filter((t) => t.date.startsWith(selectedMonth));
  }, [selectedMonth, allIncomeTx]);

  const filteredExpenseTx = useMemo(() => {
    if (!selectedMonth || !Array.isArray(allExpenseTx)) return allExpenseTx;
    return allExpenseTx.filter((t) => t.date.startsWith(selectedMonth));
  }, [selectedMonth, allExpenseTx]);

  const topIncome = useMemo(() => groupByCategory(filteredIncomeTx), [filteredIncomeTx]);
  const topExpenses = useMemo(() => groupByCategory(filteredExpenseTx), [filteredExpenseTx]);

  const filteredSummary = useMemo<Summary>(() => {
    if (!selectedMonth) return summary ?? {};
    const inc = Array.isArray(allIncomeTx) ? allIncomeTx.filter((t) => t.date.startsWith(selectedMonth)) : [];
    const exp = Array.isArray(allExpenseTx) ? allExpenseTx.filter((t) => t.date.startsWith(selectedMonth)) : [];
    return {
      totalIncome: inc.reduce((s, t) => s + t.amount, 0),
      totalExpenses: exp.reduce((s, t) => s + t.amount, 0),
      transactionCount: inc.length,
    };
  }, [selectedMonth, allIncomeTx, allExpenseTx, summary]);

  const filteredTrend = useMemo(() => {
    if (!selectedMonth) return trendData;
    const idx = trendData.findIndex((d) => d.month === selectedMonth);
    if (idx === -1) return trendData.filter((d) => d.month === selectedMonth);
    return trendData.slice(Math.max(0, idx - 1), idx + 1);
  }, [selectedMonth, trendData]);

  async function handleRefresh() {
    setSelectedMonth(null);
    await Promise.all([
      refetchSummary(),
      refetchTrend(),
      refetchRecent(),
      refetchIncome(),
      refetchExpense(),
    ]);
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const btmPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={[styles.root, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: btmPad + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Olá,</Text>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {user?.name?.split(" ")[0] ?? "Usuário"} 👋
            </Text>
          </View>
          <Text style={[styles.period, { color: colors.mutedForeground }]}>{monthLabel}</Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <>
            {/* Current-month metric cards */}
            <View style={styles.metricsRow}>
              <MetricCard
                label={`Receita · ${monthLabel.slice(0, 3)}`}
                value={formatBRL(monthIncome)}
                accent
                trendPct={incomeTrend}
              />
              <MetricCard
                label={`Despesas · ${monthLabel.slice(0, 3)}`}
                value={formatBRL(monthExpenses)}
                valueColor={colors.expense}
                trendPct={expenseTrend}
                trendInverse
              />
            </View>
            <View style={styles.metricsRow}>
              <MetricCard
                label={`Saldo · ${monthLabel.slice(0, 3)}`}
                value={formatBRL(monthNet)}
                valueColor={monthNet >= 0 ? colors.income : colors.expense}
                sublabel={`Total histórico: ${formatBRL(summary?.netBalance ?? 0)}`}
              />
            </View>

            {/* Goal progress */}
            <GoalProgress
              current={monthRevenue}
              goal={revenueGoal}
              label="Meta do mês"
              onPress={revenueGoal === 0 ? () => router.push("/(tabs)/profile") : undefined}
            />

            {/* Monthly evolution chart */}
            {trendData.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Evolução Mensal</Text>
                <MonthlyBarChart
                  data={trendData}
                  selectedMonth={selectedMonth}
                  onSelectMonth={setSelectedMonth}
                />
              </View>
            )}

            {/* Filter badge */}
            {selectedMonth && (
              <FilterBadge month={selectedMonth} onClear={() => setSelectedMonth(null)} />
            )}

            {/* KPI grid */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Indicadores{selectedMonth ? ` · ${fMonth(selectedMonth)}` : ""}
              </Text>
              <QuickMetrics
                summary={filteredSummary}
                trend={filteredTrend}
                selectedMonth={selectedMonth}
              />
            </View>

            {/* Top expense categories */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Principais Despesas{selectedMonth ? ` · ${fMonth(selectedMonth)}` : ""}
              </Text>
              <HorizontalBars
                data={topExpenses}
                color={colors.expense}
                onCategoryPress={() => router.push("/(tabs)/transactions")}
              />
            </View>

            {/* Top income categories */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Principais Receitas{selectedMonth ? ` · ${fMonth(selectedMonth)}` : ""}
              </Text>
              <HorizontalBars
                data={topIncome}
                color={colors.income}
                onCategoryPress={() => router.push("/(tabs)/transactions")}
              />
            </View>

            {/* Recent transactions */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recentes</Text>
                <Pressable onPress={() => router.push("/(tabs)/transactions")}>
                  <Text style={[styles.seeAll, { color: colors.primary }]}>Ver todas</Text>
                </Pressable>
              </View>

              {!recentTx || recentTx.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }]}>
                  <Feather name="inbox" size={32} color={colors.mutedForeground} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                    Nenhuma transação ainda.{"\n"}Adicione uma pelo botão + ou faça upload.
                  </Text>
                </View>
              ) : (
                <View style={[styles.txList, { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }]}>
                  {(recentTx as { id: number; description: string; amount: number; type: string; category: string; date: string }[]).map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      description={tx.description}
                      amount={tx.amount}
                      type={tx.type as "income" | "expense"}
                      category={tx.category}
                      date={tx.date}
                    />
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <SpeedDialFab onAdd={openAdd} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  period: { fontSize: 13, fontFamily: "Inter_500Medium", textTransform: "capitalize", paddingBottom: 4 },

  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },

  metricsRow: { flexDirection: "row", gap: 12 },

  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  seeAll: { fontSize: 14, fontFamily: "Inter_500Medium" },

  // Chart
  card: { borderWidth: 1, padding: 16, gap: 14 },
  legendRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  legend: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  tapHint: { fontSize: 11, fontFamily: "Inter_400Regular" },
  barsRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end" },
  barGroup: { alignItems: "center", gap: 6 },
  barsAligned: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  barLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  barDot: { width: 5, height: 5, borderRadius: 3 },

  // Filter badge
  filterBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, marginTop: -6 },
  filterBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // KPI grid
  metricsGrid2: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: { flex: 1, minWidth: "45%", borderWidth: 1, padding: 14, gap: 4 },
  kpiLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kpiLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  kpiValue: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  kpiSub: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // Tooltip
  tooltipOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 32 },
  tooltipBox: { padding: 20, borderWidth: 1, gap: 8, maxWidth: 320 },
  tooltipTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  tooltipBody: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },

  // Horizontal bars
  hBarHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  hBarRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  hBarLabel: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  hBarValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  hBarTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  hBarFill: { height: 8, borderRadius: 4 },

  // Transactions
  txList: { overflow: "hidden" },
  emptyBox: { padding: 32, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
