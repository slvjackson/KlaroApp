import { Feather } from "@expo/vector-icons";
import { useListTransactions } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TransactionRow } from "@/components/TransactionRow";
import { useColors } from "@/hooks/useColors";

type FilterType = "all" | "income" | "expense";

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: transactions, isLoading, refetch } = useListTransactions({
    type: filter === "all" ? undefined : filter,
    limit: 100,
  });

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "income", label: "Receitas" },
    { key: "expense", label: "Despesas" },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header row: title + upload button */}
      <View
        style={[
          styles.titleRow,
          {
            paddingTop: topPad + 16,
            paddingHorizontal: 20,
            paddingBottom: 12,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text style={[styles.screenTitle, { color: colors.foreground }]}>Transações</Text>
        <Pressable
          onPress={() => router.push("/(tabs)/upload")}
          style={({ pressed }) => [
            styles.uploadBtn,
            {
              backgroundColor: pressed ? `${colors.primary}dd` : colors.primary,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name="upload" size={15} color={colors.primaryForeground} />
          <Text style={[styles.uploadBtnText, { color: colors.primaryForeground }]}>Upload</Text>
        </Pressable>
      </View>

      {/* Filter chips */}
      <View
        style={[
          styles.filterBar,
          {
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <View
              key={f.key}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.secondary,
                  borderRadius: 20,
                },
              ]}
            >
              <Text
                onPress={() => setFilter(f.key)}
                style={[
                  styles.chipText,
                  {
                    color: active
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  },
                ]}
              >
                {f.label}
              </Text>
            </View>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={transactions ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TransactionRow
              description={item.description}
              amount={item.amount}
              type={item.type}
              category={item.category}
              date={item.date}
            />
          )}
          scrollEnabled={!!(transactions && transactions.length > 0)}
          refreshing={isLoading}
          onRefresh={refetch}
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100,
            },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="inbox" size={36} color={colors.mutedForeground} />
              <Text
                style={[styles.emptyText, { color: colors.mutedForeground }]}
              >
                Sem transações{" "}
                {filter !== "all"
                  ? filter === "income"
                    ? "de receita"
                    : "de despesa"
                  : ""}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  screenTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  uploadBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    gap: 1,
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
