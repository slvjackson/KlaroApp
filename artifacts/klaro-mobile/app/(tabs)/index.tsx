import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useGetDashboardSummary,
  useGetMonthlyTrend,
  useListInsights,
  useListTransactions,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Dimensions,
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
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { GoalProgress } from "@/components/GoalProgress";
import { SkeletonChart, SkeletonGoal } from "@/components/Skeleton";
import { TransactionRow } from "@/components/TransactionRow";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactionForm } from "@/contexts/TransactionFormContext";
import { useColors } from "@/hooks/useColors";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_W = Dimensions.get("window").width;
const INSIGHT_CARD_W = SCREEN_W - 56; // 20 left pad + 24 right peek
const INSIGHT_GAP = 12;

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  const [year, month] = yyyymm.split("-");
  return `${MONTH_SHORT[parseInt(month, 10) - 1] ?? yyyymm}/${year}`;
}

function fMonthFull(yyyymm: string): string {
  const [year, month] = yyyymm.split("-");
  return `${MONTH_NAMES[parseInt(month, 10) - 1]}/${year}`;
}

function currentMonthKey() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
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

// ─── Tone config (for insight cards) ─────────────────────────────────────────

type Tone = "positive" | "warning" | "critical" | "neutral";
const VALID_TONES: Tone[] = ["positive", "warning", "critical", "neutral"];
const TONE_CONFIG: Record<Tone, { iconSet: "Feather" | "MCI"; iconName: string; color: string }> = {
  positive: { iconSet: "Feather", iconName: "trending-up", color: "#10b981" },
  warning:  { iconSet: "Feather", iconName: "alert-triangle", color: "#f59e0b" },
  critical: { iconSet: "MCI", iconName: "alert-octagon", color: "#ef4444" },
  neutral:  { iconSet: "MCI", iconName: "lightbulb-outline", color: "" },
};

// ─── SummaryCard ──────────────────────────────────────────────────────────────

type CardTone = "income" | "expense" | "brand" | "neutral";

interface SummaryCardProps {
  label: string;
  value: string;
  tone: CardTone;
  icon: (color: string) => React.ReactNode;
  delta?: number | null;
  loading?: boolean;
}

function SummaryCard({ label, value, tone, icon, delta, loading }: SummaryCardProps) {
  const colors = useColors();

  const iconBg =
    tone === "income"  ? `${colors.income}22` :
    tone === "expense" ? `${colors.expense}22` :
    tone === "brand"   ? `${colors.primary}22` :
    `${colors.foreground}10`;

  const iconColor =
    tone === "income"  ? colors.income :
    tone === "expense" ? colors.expense :
    tone === "brand"   ? colors.primary :
    colors.mutedForeground;

  const valueColor =
    tone === "income"  ? colors.income :
    tone === "expense" ? colors.expense :
    tone === "brand"   ? colors.primary :
    colors.foreground;

  const up = (delta ?? 0) >= 0;
  const deltaColor = delta != null ? (up ? colors.income : colors.expense) : colors.mutedForeground;

  return (
    <View style={[
      styles.summaryCard,
      { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
    ]}>
      <View style={styles.summaryCardTop}>
        <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <View style={[styles.summaryIconBox, { backgroundColor: iconBg, borderRadius: 8 }]}>
          {icon(iconColor)}
        </View>
      </View>

      {loading ? (
        <View style={[styles.summaryValueSkeleton, { backgroundColor: `${colors.foreground}10` }]} />
      ) : (
        <Text style={[styles.summaryValue, { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      )}

      {delta != null && (
        <View style={styles.summaryDeltaRow}>
          <Feather
            name={up ? "trending-up" : "trending-down"}
            size={11}
            color={deltaColor}
          />
          <Text style={[styles.summaryDelta, { color: deltaColor }]}>
            {up ? "+" : ""}{delta.toFixed(1)}%
          </Text>
          <Text style={[styles.summaryDeltaSub, { color: colors.mutedForeground }]}>
            vs mês ant.
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Insight carousel ─────────────────────────────────────────────────────────

interface InsightItem {
  id: number;
  title: string;
  description: string;
  tone?: string | null;
}

function InsightCarousel({ insights }: { insights: InsightItem[] }) {
  const colors = useColors();
  if (insights.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, { paddingHorizontal: 20 }]}>
        <View style={styles.sectionTitleRow}>
          <MaterialCommunityIcons name="lightbulb-outline" size={16} color={colors.primary} />
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Insights Recentes</Text>
        </View>
        <Pressable
          onPress={() => router.push("/(tabs)/intelligence")}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text style={[styles.seeAll, { color: colors.primary }]}>Ver todos →</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={INSIGHT_CARD_W + INSIGHT_GAP}
        snapToAlignment="start"
        contentContainerStyle={[styles.carouselContent, { paddingHorizontal: 20, gap: INSIGHT_GAP }]}
      >
        {insights.slice(0, 6).map((ins) => {
          const validTone: Tone = (ins.tone && VALID_TONES.includes(ins.tone as Tone))
            ? (ins.tone as Tone)
            : "neutral";
          const tc = TONE_CONFIG[validTone];
          const toneColor = tc.color || colors.primary;
          const borderColor = validTone !== "neutral" ? `${toneColor}33` : colors.border;

          return (
            <Pressable
              key={ins.id}
              onPress={() => router.push("/(tabs)/intelligence")}
              style={({ pressed }) => [
                styles.insightCard,
                {
                  width: INSIGHT_CARD_W,
                  backgroundColor: colors.card,
                  borderColor,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={[styles.insightIconBox, { backgroundColor: `${toneColor}1a`, borderRadius: 8 }]}>
                {tc.iconSet === "MCI"
                  ? <MaterialCommunityIcons name={tc.iconName as any} size={16} color={toneColor} />
                  : <Feather name={tc.iconName as any} size={14} color={toneColor} />}
              </View>
              <Text style={[styles.insightTitle, { color: colors.foreground }]} numberOfLines={2}>
                {ins.title}
              </Text>
              <Text style={[styles.insightDesc, { color: colors.mutedForeground }]} numberOfLines={3}>
                {ins.description}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
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
          {[{ label: "Entradas", color: colors.income }, { label: "Saídas", color: colors.expense }].map((l) => (
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
                {ih > 0 && <View style={{ height: ih, width: BAR_W, backgroundColor: colors.income, borderRadius: 3 }} />}
                {ih === 0 && <View style={{ width: BAR_W }} />}
                {eh > 0 && <View style={{ height: eh, width: BAR_W, backgroundColor: colors.expense, borderRadius: 3 }} />}
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

// ─── Horizontal bars (categories) ────────────────────────────────────────────

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

// ─── Quick KPI metrics ────────────────────────────────────────────────────────

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
  const { data: insights } = useListInsights();
  const { data: recentTx, isLoading: recentLoading, refetch: refetchRecent } =
    useListTransactions({ limit: 5 });
  const { data: allIncomeTx, refetch: refetchIncome } = useListTransactions({
    type: "income", limit: 5000,
  });
  const { data: allExpenseTx, refetch: refetchExpense } = useListTransactions({
    type: "expense", limit: 5000,
  });

  const isLoading = trendLoading || recentLoading;
  const trendData = Array.isArray(trend) ? trend : [];
  const lastEntry = trendData.length > 0 ? trendData[trendData.length - 1] : null;
  const monthKey = lastEntry?.month ?? currentMonthKey();
  const monthLabel = fMonthFull(monthKey);

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
  const netTrend =
    prevTrend
      ? (prevTrend.income - prevTrend.expenses) !== 0
        ? ((monthNet - (prevTrend.income - prevTrend.expenses)) / Math.abs(prevTrend.income - prevTrend.expenses)) * 100
        : null
      : null;

  const monthRevenue = useMemo(() => {
    if (!Array.isArray(allIncomeTx)) return 0;
    return allIncomeTx
      .filter((t) => t.date.startsWith(monthKey))
      .reduce((s, t) => s + t.amount, 0);
  }, [allIncomeTx, monthKey]);

  const revenueGoal = user?.businessProfile?.monthlyRevenueGoal ?? 0;

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
  const txCount = summary?.transactionCount ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <VerifyEmailBanner />
      <ScrollView
        style={[styles.root, { backgroundColor: colors.background }]}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: btmPad + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: 20 }]}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Olá,</Text>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {user?.name?.split(" ")[0] ?? "Usuário"} 👋
            </Text>
          </View>
          <Text style={[styles.period, { color: colors.mutedForeground }]}>{monthLabel}</Text>
        </View>

        {isLoading ? (
          <View style={[styles.loadingBox, { paddingHorizontal: 20 }]}>
            <View style={[styles.summaryGrid, { opacity: 0.4 }]}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={[styles.summaryCard, styles.summaryCardSkeleton, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]} />
              ))}
            </View>
            <SkeletonGoal />
            <SkeletonChart />
          </View>
        ) : (
          <>
            {/* ─ Summary cards (2×2 grid) ─ */}
            <View style={[styles.summaryGrid, { paddingHorizontal: 20 }]}>
              <SummaryCard
                label="Saldo do mês"
                value={formatBRL(monthNet)}
                tone={monthNet >= 0 ? "brand" : "expense"}
                icon={(color) => <MaterialCommunityIcons name="wallet-outline" size={15} color={color} />}
                delta={netTrend}
              />
              <SummaryCard
                label="Entradas"
                value={formatBRL(monthIncome)}
                tone="income"
                icon={(color) => <Feather name="trending-up" size={15} color={color} />}
                delta={incomeTrend}
              />
              <SummaryCard
                label="Saídas"
                value={formatBRL(monthExpenses)}
                tone="expense"
                icon={(color) => <Feather name="trending-down" size={15} color={color} />}
                delta={expenseTrend}
              />
              <SummaryCard
                label="Transações"
                value={String(txCount)}
                tone="neutral"
                icon={(color) => <MaterialCommunityIcons name="receipt-outline" size={15} color={color} />}
              />
            </View>

            {/* ─ Meta do mês ─ */}
            <View style={{ paddingHorizontal: 20 }}>
              <GoalProgress
                current={monthRevenue}
                goal={revenueGoal}
                label="Meta do mês"
                onPress={revenueGoal === 0 ? () => router.push("/(tabs)/profile") : undefined}
              />
            </View>

            {/* ─ Insights carousel ─ */}
            {Array.isArray(insights) && insights.length > 0 && (
              <InsightCarousel insights={insights as InsightItem[]} />
            )}

            {/* ─ Fluxo mensal ─ */}
            {trendData.length > 0 && (
              <View style={[styles.section, { paddingHorizontal: 20 }]}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Fluxo Mensal</Text>
                <MonthlyBarChart
                  data={trendData}
                  selectedMonth={selectedMonth}
                  onSelectMonth={setSelectedMonth}
                />
              </View>
            )}

            {/* ─ Filter badge ─ */}
            {selectedMonth && (
              <View style={{ paddingHorizontal: 20 }}>
                <FilterBadge month={selectedMonth} onClear={() => setSelectedMonth(null)} />
              </View>
            )}

            {/* ─ Indicadores ─ */}
            <View style={[styles.section, { paddingHorizontal: 20 }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Indicadores{selectedMonth ? ` · ${fMonth(selectedMonth)}` : ""}
              </Text>
              <QuickMetrics
                summary={filteredSummary}
                trend={filteredTrend}
                selectedMonth={selectedMonth}
              />
            </View>

            {/* ─ Principais Despesas ─ */}
            <View style={[styles.section, { paddingHorizontal: 20 }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Principais Despesas{selectedMonth ? ` · ${fMonth(selectedMonth)}` : ""}
              </Text>
              <HorizontalBars
                data={topExpenses}
                color={colors.expense}
                onCategoryPress={() => router.push("/(tabs)/transactions")}
              />
            </View>

            {/* ─ Principais Receitas ─ */}
            <View style={[styles.section, { paddingHorizontal: 20 }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Principais Receitas{selectedMonth ? ` · ${fMonth(selectedMonth)}` : ""}
              </Text>
              <HorizontalBars
                data={topIncome}
                color={colors.income}
                onCategoryPress={() => router.push("/(tabs)/transactions")}
              />
            </View>

            {/* ─ Transações recentes ─ */}
            <View style={[styles.section, { paddingHorizontal: 20 }]}>
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
                    Nenhuma transação ainda.{"\n"}Adicione pelo botão + ou faça upload.
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
  content: { gap: 20 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular" },
  name: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  period: { fontSize: 13, fontFamily: "Inter_500Medium", textTransform: "capitalize", paddingBottom: 4 },

  loadingBox: { gap: 16 },

  // ─ Summary cards ─
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryCard: { flex: 1, minWidth: "44%", borderWidth: 1, padding: 14, gap: 6 },
  summaryCardSkeleton: { height: 100 },
  summaryCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  summaryLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, flex: 1, marginRight: 4 },
  summaryIconBox: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  summaryValueSkeleton: { height: 28, borderRadius: 6, marginVertical: 4 },
  summaryValue: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  summaryDeltaRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  summaryDelta: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  summaryDeltaSub: { fontSize: 10, fontFamily: "Inter_400Regular" },

  // ─ Insight carousel ─
  carouselContent: { flexDirection: "row" },
  insightCard: { borderWidth: 1, padding: 16, gap: 10 },
  insightIconBox: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  insightTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  insightDesc: { fontSize: 12.5, fontFamily: "Inter_400Regular", lineHeight: 18 },

  section: { gap: 10 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  seeAll: { fontSize: 13, fontFamily: "Inter_500Medium" },

  // ─ Monthly chart ─
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

  // ─ Filter badge ─
  filterBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, marginTop: -6 },
  filterBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // ─ KPI grid ─
  metricsGrid2: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCard: { flex: 1, minWidth: "45%", borderWidth: 1, padding: 14, gap: 4 },
  kpiLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  kpiLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  kpiValue: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  kpiSub: { fontSize: 11, fontFamily: "Inter_400Regular" },

  // ─ Tooltip ─
  tooltipOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 32 },
  tooltipBox: { padding: 20, borderWidth: 1, gap: 8, maxWidth: 320 },
  tooltipTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  tooltipBody: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },

  // ─ Horizontal bars ─
  hBarHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  hBarRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  hBarLabel: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  hBarValue: { fontSize: 13, fontFamily: "Inter_500Medium" },
  hBarTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  hBarFill: { height: 8, borderRadius: 4 },

  // ─ Transactions ─
  txList: { overflow: "hidden" },
  emptyBox: { padding: 32, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
