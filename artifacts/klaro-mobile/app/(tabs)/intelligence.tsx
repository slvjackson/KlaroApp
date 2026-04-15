import { Feather } from "@expo/vector-icons";
import {
  useGetDashboardSummary,
  useGetMonthlyTrend,
  useListTransactions,
  useGenerateInsights,
  useListInsights,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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

function fMonthFull(yyyymm: string): string {
  const [year, month] = yyyymm.split("-");
  const names = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${names[parseInt(month, 10) - 1]} ${year}`;
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

// ─── Segmented Control ────────────────────────────────────────────────────────

type Tab = "analytics" | "insights";

function SegmentedControl({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const colors = useColors();
  return (
    <View style={[styles.segControl, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
      {(["analytics", "insights"] as Tab[]).map((tab) => {
        const isActive = tab === active;
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(tab)}
            style={[
              styles.segItem,
              { borderRadius: colors.radius - 2 },
              isActive && { backgroundColor: colors.background },
            ]}
          >
            <Feather
              name={tab === "analytics" ? "bar-chart-2" : "zap"}
              size={14}
              color={isActive ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.segLabel, { color: isActive ? colors.foreground : colors.mutedForeground }]}>
              {tab === "analytics" ? "Análise" : "Insights"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Monthly bar chart (interactive) ─────────────────────────────────────────

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
          // Zero-data months get no minimum height — they appear truly flat
          const ih = hasData ? Math.max((d.income / maxVal) * BAR_MAX_H, 2) : 0;
          const eh = hasData ? Math.max((d.expenses / maxVal) * BAR_MAX_H, 2) : 0;
          const isSelected = selectedMonth === d.month;
          const isDimmed = selectedMonth !== null && !isSelected;

          return (
            <Pressable
              key={d.month}
              onPress={() => {
                if (!hasData) return; // non-interactive for empty months
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelectMonth(isSelected ? null : d.month);
              }}
              style={({ pressed }) => [
                styles.barGroup,
                {
                  opacity: isDimmed ? 0.3 : (!hasData ? 0.4 : pressed ? 0.7 : 1),
                },
              ]}
            >
              <View style={[styles.barsAligned, { height: BAR_MAX_H }]}>
                {ih > 0 && <View style={[
                  { height: ih, width: BAR_W, backgroundColor: colors.income, borderRadius: 3 },
                  isSelected && styles.barSelected,
                ]} />}
                {ih === 0 && <View style={{ width: BAR_W }} />}
                {eh > 0 && <View style={[
                  { height: eh, width: BAR_W, backgroundColor: colors.expense, borderRadius: 3 },
                  isSelected && styles.barSelected,
                ]} />}
                {eh === 0 && <View style={{ width: BAR_W }} />}
              </View>
              <Text style={[
                styles.barLabel,
                { color: isSelected ? colors.primary : colors.mutedForeground },
                isSelected && styles.barLabelSelected,
              ]}>
                {fMonth(d.month)}
              </Text>
              {isSelected && (
                <View style={[styles.barDot, { backgroundColor: colors.primary }]} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Horizontal bar chart ─────────────────────────────────────────────────────

function HorizontalBars({ data, color }: { data: { category: string; total: number }[]; color: string }) {
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

// ─── Quick metrics ────────────────────────────────────────────────────────────

interface Summary { totalIncome?: number; totalExpenses?: number; transactionCount?: number; }

function QuickMetrics({
  summary,
  trend,
  selectedMonth,
}: {
  summary: Summary | undefined;
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
    (summary?.totalIncome ?? 0) > 0
      ? Math.round(((summary?.totalExpenses ?? 0) / (summary?.totalIncome ?? 1)) * 100)
      : null;

  const avgTicket =
    (summary?.transactionCount ?? 0) > 0 && (summary?.totalIncome ?? 0) > 0
      ? (summary!.totalIncome! / summary!.transactionCount!)
      : null;

  const cards = selectedMonth
    ? [
        {
          label: "Receita",
          value: fBRL(summary?.totalIncome ?? 0, true),
          sub: fMonth(selectedMonth),
          valueColor: colors.income,
        },
        {
          label: "Despesas",
          value: fBRL(summary?.totalExpenses ?? 0, true),
          sub: fMonth(selectedMonth),
          valueColor: colors.expense,
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
      ]
    : [
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

// ─── Filter badge ─────────────────────────────────────────────────────────────

function FilterBadge({ month, onClear }: { month: string; onClear: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onClear}
      style={[styles.filterBadge, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}44`, borderRadius: colors.radius }]}
    >
      <Feather name="filter" size={12} color={colors.primary} />
      <Text style={[styles.filterBadgeText, { color: colors.primary }]}>
        {fMonthFull(month)}
      </Text>
      <Feather name="x" size={12} color={colors.primary} />
    </Pressable>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const btmPad = insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100;

  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const { data: summary, isLoading: l1, refetch: r1 } = useGetDashboardSummary();
  const { data: trend, isLoading: l2, refetch: r2 } = useGetMonthlyTrend();
  const { data: incomeTx, isLoading: l3, refetch: r3 } = useListTransactions({ type: "income", limit: 5000 });
  const { data: expenseTx, isLoading: l4, refetch: r4 } = useListTransactions({ type: "expense", limit: 5000 });

  const isLoading = l1 || l2 || l3 || l4;
  const trendData = Array.isArray(trend) ? trend : [];

  // Filter transactions by selected month
  const filteredIncomeTx = useMemo(() => {
    if (!selectedMonth || !Array.isArray(incomeTx)) return incomeTx;
    return incomeTx.filter((t) => t.date.startsWith(selectedMonth));
  }, [selectedMonth, incomeTx]);

  const filteredExpenseTx = useMemo(() => {
    if (!selectedMonth || !Array.isArray(expenseTx)) return expenseTx;
    return expenseTx.filter((t) => t.date.startsWith(selectedMonth));
  }, [selectedMonth, expenseTx]);

  const topExpenses = useMemo(() => groupByCategory(filteredExpenseTx), [filteredExpenseTx]);
  const topIncome = useMemo(() => groupByCategory(filteredIncomeTx), [filteredIncomeTx]);

  // Filtered summary for metrics
  const filteredSummary = useMemo<Summary>(() => {
    if (!selectedMonth) return summary ?? {};
    const inc = Array.isArray(incomeTx) ? incomeTx.filter((t) => t.date.startsWith(selectedMonth)) : [];
    const exp = Array.isArray(expenseTx) ? expenseTx.filter((t) => t.date.startsWith(selectedMonth)) : [];
    return {
      totalIncome: inc.reduce((s, t) => s + t.amount, 0),
      totalExpenses: exp.reduce((s, t) => s + t.amount, 0),
      transactionCount: inc.length + exp.length,
    };
  }, [selectedMonth, incomeTx, expenseTx, summary]);

  // Trend slice for growth comparison (selected + previous month)
  const filteredTrend = useMemo(() => {
    if (!selectedMonth) return trendData;
    const idx = trendData.findIndex((d) => d.month === selectedMonth);
    if (idx === -1) return trendData.filter((d) => d.month === selectedMonth);
    return trendData.slice(Math.max(0, idx - 1), idx + 1);
  }, [selectedMonth, trendData]);

  const hasData = trendData.length > 0 || topExpenses.length > 0 || topIncome.length > 0;

  async function handleRefresh() {
    setSelectedMonth(null);
    await Promise.all([r1(), r2(), r3(), r4()]);
  }

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  if (!hasData) {
    return (
      <View style={styles.centered}>
        <Feather name="bar-chart-2" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
          Nenhum dado para análise ainda.{"\n"}Faça upload de um extrato para começar.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.analyticsContent, { paddingBottom: btmPad }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={colors.primary} />
      }
    >
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

      {/* Active filter badge */}
      {selectedMonth && (
        <FilterBadge month={selectedMonth} onClear={() => setSelectedMonth(null)} />
      )}

      {(filteredSummary.totalIncome !== undefined || filteredSummary.totalExpenses !== undefined) ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Indicadores{selectedMonth ? ` · ${fMonth(selectedMonth)}` : ""}
          </Text>
          <QuickMetrics summary={filteredSummary} trend={filteredTrend} selectedMonth={selectedMonth} />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Principais Despesas{selectedMonth ? ` · ${fMonth(selectedMonth)}` : ""}
        </Text>
        <HorizontalBars data={topExpenses} color={colors.expense} />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          Principais Receitas{selectedMonth ? ` · ${fMonth(selectedMonth)}` : ""}
        </Text>
        <HorizontalBars data={topIncome} color={colors.income} />
      </View>
    </ScrollView>
  );
}

// ─── Insights Tab ─────────────────────────────────────────────────────────────

function InsightsTab() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: insights, isLoading, refetch } = useListInsights();
  const generateMutation = useGenerateInsights();

  async function handleGenerate() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await generateMutation.mutateAsync({});
    await refetch();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  if (isLoading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  return (
    <FlatList
      data={Array.isArray(insights) ? insights : []}
      keyExtractor={(item, index) => item?.id != null ? String(item.id) : `insight-${index}`}
      renderItem={({ item }) => (
        <InsightCard
          title={item.title}
          description={item.description}
          recommendation={item.recommendation}
          periodLabel={item.periodLabel}
        />
      )}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
      }
      contentContainerStyle={[
        styles.insightsList,
        { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 },
      ]}
      ListFooterComponent={
        <Pressable
          onPress={handleGenerate}
          disabled={generateMutation.isPending}
          style={({ pressed }) => [
            styles.generateBtn,
            {
              backgroundColor: pressed || generateMutation.isPending ? `${colors.primary}cc` : colors.primary,
              borderRadius: colors.radius,
              marginTop: 8,
            },
          ]}
        >
          {generateMutation.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <>
              <Feather name="zap" size={16} color={colors.primaryForeground} />
              <Text style={[styles.generateBtnText, { color: colors.primaryForeground }]}>
                Gerar novos insights
              </Text>
            </>
          )}
        </Pressable>
      }
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Feather name="zap" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sem insights ainda</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Toque em "Gerar novos insights" para obter recomendações baseadas nas suas transações.
          </Text>
        </View>
      }
    />
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────────

function InsightCard({ title, description, recommendation, periodLabel }: {
  title: string; description: string; recommendation: string; periodLabel: string;
}) {
  const colors = useColors();
  return (
    <View style={[styles.insightCard, { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }]}>
      <View style={styles.insightCardHeader}>
        <View style={[styles.iconBox, { backgroundColor: `${colors.primary}22`, borderRadius: 10 }]}>
          <Feather name="zap" size={16} color={colors.primary} />
        </View>
        <Text style={[styles.periodLabel, { color: colors.mutedForeground }]}>{periodLabel}</Text>
      </View>
      <Text style={[styles.insightTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.insightDescription, { color: colors.mutedForeground }]}>{description}</Text>
      <View style={[styles.recommendationBox, { backgroundColor: `${colors.primary}11`, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: colors.primary }]}>
        <Text style={[styles.recommendationText, { color: colors.foreground }]}>{recommendation}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function IntelligenceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const [activeTab, setActiveTab] = useState<Tab>("analytics");

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            paddingHorizontal: 20,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Inteligência</Text>
        <SegmentedControl active={activeTab} onChange={setActiveTab} />
      </View>

      {activeTab === "analytics" ? <AnalyticsTab /> : <InsightsTab />}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: 14 },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },

  segControl: { flexDirection: "row", padding: 3, gap: 2 },
  segItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, gap: 6 },
  segLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },

  analyticsContent: { paddingHorizontal: 20, paddingTop: 20, gap: 24 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },

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
  barSelected: { opacity: 1 },
  barLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  barLabelSelected: { fontFamily: "Inter_600SemiBold" },
  barDot: { width: 5, height: 5, borderRadius: 3 },

  filterBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    marginTop: -12,
  },
  filterBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

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

  insightsList: { paddingHorizontal: 20, paddingTop: 16, gap: 14 },
  insightCard: { padding: 18, gap: 10 },
  insightCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  iconBox: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  periodLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  insightTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", lineHeight: 22 },
  insightDescription: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  recommendationBox: { padding: 12 },
  recommendationText: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },

  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, marginHorizontal: 20, marginBottom: 16 },
  generateBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  emptyBox: { paddingTop: 60, alignItems: "center", gap: 12, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
});
