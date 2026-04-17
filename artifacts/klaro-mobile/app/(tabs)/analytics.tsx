import { Feather } from "@expo/vector-icons";
import {
  useGetDashboardSummary,
  useGetMonthlyTrend,
  useListTransactions,
} from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function fMonth(yyyymm: string): string {
  return MONTH_NAMES[parseInt(yyyymm.split("-")[1], 10) - 1] ?? yyyymm;
}

function fBRL(value: number, compact = false): string {
  if (compact && value >= 1000) return `R$${(value / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
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

// ─── Monthly bar chart ────────────────────────────────────────────────────────

function MonthlyBarChart({
  data,
}: {
  data: { month: string; income: number; expenses: number }[];
}) {
  const colors = useColors();
  const last6 = data.slice(-6);
  if (last6.length === 0) return null;

  const maxVal = Math.max(...last6.flatMap((d) => [d.income, d.expenses]), 1);
  const BAR_MAX_H = 90;
  const BAR_W = 14;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={styles.legend}>
        {[{ label: "Receita", color: colors.income }, { label: "Despesa", color: colors.expense }].map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={[styles.legendLabel, { color: colors.mutedForeground }]}>{l.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.barsRow}>
        {last6.map((d) => {
          const ih = Math.max((d.income / maxVal) * BAR_MAX_H, 2);
          const eh = Math.max((d.expenses / maxVal) * BAR_MAX_H, 2);
          return (
            <View key={d.month} style={styles.barGroup}>
              <View style={[styles.barsAligned, { height: BAR_MAX_H }]}>
                <View style={{ height: ih, width: BAR_W, backgroundColor: colors.income, borderRadius: 3 }} />
                <View style={{ height: eh, width: BAR_W, backgroundColor: colors.expense, borderRadius: 3 }} />
              </View>
              <Text style={[styles.barLabel, { color: colors.mutedForeground }]}>{fMonth(d.month)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Horizontal bar chart ─────────────────────────────────────────────────────

function HorizontalBars({
  data,
  color,
}: {
  data: { category: string; total: number }[];
  color: string;
}) {
  const colors = useColors();
  const maxVal = Math.max(...data.map((d) => d.total), 1);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      {data.map((item, i) => (
        <View key={item.category} style={[styles.hBarRow, i > 0 && { marginTop: 14 }]}>
          <View style={styles.hBarHeader}>
            <Text style={[styles.hBarLabel, { color: colors.foreground }]} numberOfLines={1}>{item.category}</Text>
            <Text style={[styles.hBarValue, { color: colors.mutedForeground }]}>{fBRL(item.total, true)}</Text>
          </View>
          <View style={[styles.hBarTrack, { backgroundColor: colors.secondary }]}>
            <View style={[styles.hBarFill, { width: `${(item.total / maxVal) * 100}%`, backgroundColor: color }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Quick indicators ─────────────────────────────────────────────────────────

interface Summary {
  totalIncome?: number;
  totalExpenses?: number;
  transactionCount?: number;
}

function QuickMetrics({
  summary,
  trend,
}: {
  summary: Summary | undefined;
  trend: { month: string; income: number; expenses: number }[];
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
    (summary?.totalIncome ?? 0) > 0
      ? Math.round(((summary?.totalExpenses ?? 0) / (summary?.totalIncome ?? 1)) * 100)
      : null;

  const avgTicket =
    (summary?.transactionCount ?? 0) > 0 && (summary?.totalIncome ?? 0) > 0
      ? (summary!.totalIncome! / summary!.transactionCount!)
      : null;

  const cards = [
    {
      label: "Crescimento",
      value: momGrowth != null ? `${momGrowth >= 0 ? "+" : ""}${momGrowth.toFixed(1)}%` : "—",
      sub: "mês a mês",
      valueColor: momGrowth != null ? (momGrowth >= 0 ? colors.income : colors.expense) : colors.mutedForeground,
    },
    {
      label: "Melhor mês",
      value: bestMonth ? fMonth(bestMonth.month) : "—",
      sub: bestMonth ? fBRL(bestMonth.income, true) : "",
      valueColor: colors.foreground,
    },
    {
      label: "Índice despesa",
      value: expRatio != null ? `${expRatio}%` : "—",
      sub: "sobre receita",
      valueColor: expRatio != null ? (expRatio <= 70 ? colors.income : colors.expense) : colors.mutedForeground,
    },
    {
      label: "Ticket médio",
      value: avgTicket != null ? fBRL(avgTicket, true) : "—",
      sub: "por transação",
      valueColor: colors.foreground,
    },
  ];

  return (
    <View style={styles.metricsGrid}>
      {cards.map((c) => (
        <View key={c.label} style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{c.label}</Text>
          <Text style={[styles.metricValue, { color: c.valueColor }]}>{c.value}</Text>
          {c.sub ? <Text style={[styles.metricSub, { color: colors.mutedForeground }]}>{c.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

// ─── Insights CTA ─────────────────────────────────────────────────────────────

function InsightsCTA() {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => router.push("/(tabs)/insights")}
      style={({ pressed }) => [
        styles.ctaCard,
        {
          backgroundColor: pressed ? colors.secondary : colors.card,
          borderColor: colors.primary,
          borderRadius: colors.radius,
        },
      ]}
    >
      <Feather name="zap" size={20} color={colors.primary} />
      <View style={styles.ctaText}>
        <Text style={[styles.ctaTitle, { color: colors.foreground }]}>
          Quer insights mais aprofundados?
        </Text>
        <Text style={[styles.ctaSub, { color: colors.mutedForeground }]}>
          A IA analisa seu histórico completo e gera recomendações personalizadas para o seu negócio.
        </Text>
      </View>
      <Feather name="arrow-right" size={18} color={colors.primary} />
    </Pressable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const btmPad = insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100;

  const { data: summary, isLoading: l1, refetch: r1 } = useGetDashboardSummary();
  const { data: trend, isLoading: l2, refetch: r2 } = useGetMonthlyTrend();
  const { data: incomeTx, isLoading: l3, refetch: r3 } = useListTransactions({ type: "income", limit: 500 });
  const { data: expenseTx, isLoading: l4, refetch: r4 } = useListTransactions({ type: "expense", limit: 500 });

  const isLoading = l1 || l2 || l3 || l4;

  const trendData = Array.isArray(trend) ? trend : [];
  const topExpenses = useMemo(() => groupByCategory(expenseTx), [expenseTx]);
  const topIncome = useMemo(() => groupByCategory(incomeTx), [incomeTx]);
  const hasData = trendData.length > 0 || topExpenses.length > 0 || topIncome.length > 0;

  async function handleRefresh() {
    await Promise.all([r1(), r2(), r3(), r4()]);
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: btmPad }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
      <Text style={[styles.screenTitle, { color: colors.foreground }]}>Análise</Text>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : !hasData ? (
        <View style={styles.centered}>
          <Feather name="bar-chart-2" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Nenhum dado para análise ainda.{"\n"}Faça upload de um extrato para começar.
          </Text>
        </View>
      ) : (
        <>
          {trendData.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Evolução Mensal</Text>
              <MonthlyBarChart data={trendData} />
            </View>
          )}

          {(summary?.totalIncome || summary?.totalExpenses) ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Indicadores</Text>
              <QuickMetrics summary={summary} trend={trendData} />
            </View>
          ) : null}

          {topExpenses.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Principais Despesas</Text>
              <HorizontalBars data={topExpenses} color={colors.expense} />
            </View>
          )}

          {topIncome.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Principais Receitas</Text>
              <HorizontalBars data={topIncome} color={colors.income} />
            </View>
          )}

          <InsightsCTA />
        </>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 24 },
  screenTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  centered: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },

  card: { borderWidth: 1, padding: 16, gap: 14 },

  legend: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },

  barsRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "flex-end" },
  barGroup: { alignItems: "center", gap: 6 },
  barsAligned: { flexDirection: "row", alignItems: "flex-end", gap: 3 },
  barLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },

  hBarRow: {},
  hBarHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  hBarLabel: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  hBarValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  hBarTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  hBarFill: { height: 8, borderRadius: 4 },

  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { flex: 1, minWidth: "45%", borderWidth: 1, padding: 14, gap: 4 },
  metricLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  metricValue: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  metricSub: { fontSize: 11, fontFamily: "Inter_400Regular" },

  ctaCard: { borderWidth: 1.5, padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  ctaText: { flex: 1, gap: 4 },
  ctaTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  ctaSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
