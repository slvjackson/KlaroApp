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
import { TransactionFormModal, type TransactionData } from "@/components/TransactionFormModal";
import { useColors } from "@/hooks/useColors";

type FilterType = "all" | "income" | "expense";

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterType>("all");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionData | null>(null);

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

  function openAdd() {
    setEditingTransaction(null);
    setModalVisible(true);
  }

  function openEdit(item: TransactionData) {
    setEditingTransaction(item);
    setModalVisible(true);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header row: title + add + upload buttons */}
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
        <View style={styles.headerBtns}>
          <Pressable
            onPress={openAdd}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: pressed ? colors.secondary : colors.secondary,
                borderRadius: colors.radius,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="plus" size={17} color={colors.foreground} />
          </Pressable>
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
                    color: active ? colors.primaryForeground : colors.mutedForeground,
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
              type={item.type as "income" | "expense"}
              category={item.category}
              date={item.date}
              onPress={() => openEdit({
                id: item.id,
                description: item.description,
                amount: item.amount,
                type: item.type as "income" | "expense",
                category: item.category,
                date: item.date,
              })}
            />
          )}
          scrollEnabled={!!(transactions && transactions.length > 0)}
          refreshing={isLoading}
          onRefresh={refetch}
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100,
            },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="inbox" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Sem transações{" "}
                {filter !== "all" ? (filter === "income" ? "de receita" : "de despesa") : ""}
              </Text>
              <Pressable
                onPress={openAdd}
                style={[styles.emptyAddBtn, { borderColor: colors.border, borderRadius: colors.radius }]}
              >
                <Feather name="plus" size={14} color={colors.mutedForeground} />
                <Text style={[styles.emptyAddText, { color: colors.mutedForeground }]}>
                  Adicionar manualmente
                </Text>
              </Pressable>
            </View>
          }
        />
      )}

      <TransactionFormModal
        visible={modalVisible}
        editing={editingTransaction}
        onClose={() => setModalVisible(false)}
        onSaved={refetch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  headerBtns: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
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
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },
  emptyAddText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
