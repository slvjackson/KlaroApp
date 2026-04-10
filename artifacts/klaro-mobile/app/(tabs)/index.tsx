import { Feather } from "@expo/vector-icons";
import {
  useGetDashboardSummary,
  useGetMonthlyTrend,
  useListTransactions,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
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
import { MetricCard } from "@/components/MetricCard";
import { TransactionRow } from "@/components/TransactionRow";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const { data: summary, isLoading: summaryLoading, refetch: refetchSummary } =
    useGetDashboardSummary();
  const { data: transactions, isLoading: txLoading, refetch: refetchTx } =
    useListTransactions({ limit: 5 });

  const isLoading = summaryLoading || txLoading;

  async function handleRefresh() {
    await Promise.all([refetchSummary(), refetchTx()]);
  }

  async function handleLogout() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
    router.replace("/(auth)/login");
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const btmPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad + 16, paddingBottom: btmPad + 100 },
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
        <Pressable onPress={handleLogout} style={styles.logoutBtn}>
          <Feather name="log-out" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <>
          {/* Metric Cards */}
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Receita"
              value={formatBRL(summary?.totalIncome ?? 0)}
              accent
            />
            <MetricCard
              label="Despesas"
              value={formatBRL(summary?.totalExpenses ?? 0)}
              valueColor={colors.expense}
            />
          </View>
          <View style={styles.metricsGrid}>
            <MetricCard
              label="Saldo"
              value={formatBRL(summary?.netBalance ?? 0)}
              valueColor={
                (summary?.netBalance ?? 0) >= 0 ? colors.income : colors.expense
              }
            />
            <MetricCard
              label="Transações"
              value={String(summary?.transactionCount ?? 0)}
              sublabel="confirmadas"
            />
          </View>

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

            {!Array.isArray(transactions) || transactions.length === 0 ? (
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
                  Nenhuma transação ainda.{"\n"}Faça upload de um extrato!
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
                {transactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    description={tx.description}
                    amount={tx.amount}
                    type={tx.type}
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
    alignItems: "center",
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
  logoutBtn: {
    padding: 8,
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
