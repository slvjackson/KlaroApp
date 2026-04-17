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
import { Fab } from "@/components/Fab";
import { GoalProgress } from "@/components/GoalProgress";
import { MetricCard } from "@/components/MetricCard";
import { TransactionRow } from "@/components/TransactionRow";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactionForm } from "@/contexts/TransactionFormContext";
import { useColors } from "@/hooks/useColors";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function currentMonthKey() {
  // Brasília offset (-3h) approximation from UTC
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonthLabel() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return MONTH_NAMES[d.getUTCMonth()];
}

function todayBrasilia() {
  const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { openAdd } = useTransactionForm();

  const { data: summary, refetch: refetchSummary } = useGetDashboardSummary();
  const { data: trend, isLoading: trendLoading, refetch: refetchTrend } = useGetMonthlyTrend();
  const { data: transactions, isLoading: txLoading, refetch: refetchTx } =
    useListTransactions({ limit: 5 });
  const { data: allIncomeTx, refetch: refetchAllIncomeTx } = useListTransactions({
    type: "income",
    limit: 5000,
  });

  const isLoading = trendLoading || txLoading;
  const monthKey = currentMonthKey();
  const monthLabel = currentMonthLabel();

  // Revenue realized in current month (from income transactions)
  const monthRevenue = useMemo(() => {
    if (!Array.isArray(allIncomeTx)) return 0;
    return allIncomeTx
      .filter((t) => t.date.startsWith(monthKey))
      .reduce((s, t) => s + t.amount, 0);
  }, [allIncomeTx, monthKey]);

  const revenueGoal = user?.businessProfile?.monthlyRevenueGoal ?? 0;

  // Current-month and previous-month data from trend (always reflects the real month)
  const trendData = Array.isArray(trend) ? trend : [];
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

  // Destaque do dia
  const todayISO = todayBrasilia();
  const highlight = useMemo(() => {
    if (!Array.isArray(transactions) || !Array.isArray(allIncomeTx)) return null;
    const todayIncome = allIncomeTx
      .filter((t) => t.date === todayISO)
      .reduce((s, t) => s + t.amount, 0);

    // Use monthly data as denominator
    const thisMonthTx = allIncomeTx.filter((t) => t.date.startsWith(monthKey));
    const uniqueDays = new Set(thisMonthTx.map((t) => t.date));
    const avgDaily = uniqueDays.size > 0 ? monthRevenue / uniqueDays.size : 0;

    if (todayIncome === 0) {
      return {
        tone: "muted" as const,
        icon: "clock" as const,
        text: "Ainda sem vendas registradas hoje.",
      };
    }
    if (avgDaily > 0 && todayIncome >= avgDaily * 1.2) {
      return {
        tone: "good" as const,
        icon: "trending-up" as const,
        text: `Hoje você está ${formatBRL(todayIncome - avgDaily)} acima da média diária.`,
      };
    }
    if (avgDaily > 0 && todayIncome < avgDaily * 0.6) {
      return {
        tone: "warn" as const,
        icon: "trending-down" as const,
        text: `Hoje você está ${formatBRL(avgDaily - todayIncome)} abaixo da média diária.`,
      };
    }
    return {
      tone: "good" as const,
      icon: "check-circle" as const,
      text: `Hoje registrou ${formatBRL(todayIncome)} em receita. Bom ritmo!`,
    };
  }, [transactions, allIncomeTx, monthKey, monthRevenue, todayISO]);

  async function handleRefresh() {
    await Promise.all([refetchSummary(), refetchTx(), refetchTrend(), refetchAllIncomeTx()]);
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const btmPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        style={[styles.root, { backgroundColor: colors.background }]}
        contentContainerStyle={[
          styles.content,
          { paddingTop: topPad + 16, paddingBottom: btmPad + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.mutedForeground }]}>
              Olá,
            </Text>
            <Text style={[styles.name, { color: colors.foreground }]}>
              {user?.name?.split(" ")[0] ?? "Usuário"} 👋
            </Text>
          </View>
          <Text style={[styles.period, { color: colors.mutedForeground }]}>
            {monthLabel}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <>
            {/* Destaque do dia */}
            {highlight ? (
              <View
                style={[
                  styles.highlight,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <View
                  style={[
                    styles.highlightIcon,
                    {
                      backgroundColor:
                        highlight.tone === "good"
                          ? `${colors.income}22`
                          : highlight.tone === "warn"
                            ? `${colors.expense}22`
                            : `${colors.primary}22`,
                    },
                  ]}
                >
                  <Feather
                    name={highlight.icon}
                    size={16}
                    color={
                      highlight.tone === "good"
                        ? colors.income
                        : highlight.tone === "warn"
                          ? colors.expense
                          : colors.primary
                    }
                  />
                </View>
                <Text
                  style={[styles.highlightText, { color: colors.foreground }]}
                >
                  {highlight.text}
                </Text>
              </View>
            ) : null}

            {/* Metric Cards — current month */}
            <View style={styles.metricsGrid}>
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
            <View style={styles.metricsGrid}>
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

            {/* Recent transactions */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                  Recentes
                </Text>
                <Pressable
                  onPress={() => router.push("/(tabs)/transactions")}
                >
                  <Text style={[styles.seeAll, { color: colors.primary }]}>
                    Ver todas
                  </Text>
                </Pressable>
              </View>

              {!transactions || transactions.length === 0 ? (
                <View
                  style={[
                    styles.emptyBox,
                    {
                      backgroundColor: colors.card,
                      borderRadius: colors.radius,
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Feather
                    name="inbox"
                    size={32}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[styles.emptyText, { color: colors.mutedForeground }]}
                  >
                    Nenhuma transação ainda.{"\n"}Adicione uma pelo botão + ou faça upload.
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.txList,
                    {
                      backgroundColor: colors.card,
                      borderRadius: colors.radius,
                      borderWidth: 1,
                      borderColor: colors.border,
                      overflow: "hidden",
                    },
                  ]}
                >
                  {(transactions as { id: number; description: string; amount: number; type: string; category: string; date: string }[]).map((tx) => (
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

      <Fab onPress={openAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  name: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  period: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    textTransform: "capitalize",
    paddingBottom: 4,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  highlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  highlightIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  highlightText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  seeAll: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  txList: {
    overflow: "hidden",
  },
  emptyBox: {
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
