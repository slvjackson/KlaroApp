import { Feather } from "@expo/vector-icons";
import { useListTransactions } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SpeedDialFab } from "@/components/SpeedDialFab";
import { SkeletonSectionHeader, SkeletonTransactionRow } from "@/components/Skeleton";
import { SwipeableRow } from "@/components/SwipeableRow";
import { TransactionRow } from "@/components/TransactionRow";
import { useColors } from "@/hooks/useColors";
import { getApiBaseUrl } from "@/constants/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTransactionForm } from "@/contexts/TransactionFormContext";

type FilterType = "all" | "income" | "expense";

interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: "income" | "expense" | string;
  category: string;
  date: string;
}

type ListRow =
  | { kind: "header"; id: string; label: string; total: number; count: number }
  | { kind: "item"; id: string; tx: Transaction };

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function brlCompact(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(v);
}

function todayBrasiliaISO() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function yesterdayBrasiliaISO() {
  return new Date(Date.now() - (3 + 24) * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function buildMonthOptions(transactions: Transaction[]): { key: string; label: string }[] {
  const set = new Set<string>();
  for (const t of transactions) set.add(t.date.slice(0, 7));
  const list = [...set].sort().reverse();
  return list.map((key) => {
    const [y, m] = key.split("-");
    return { key, label: `${MONTH_SHORT[parseInt(m, 10) - 1]}/${y.slice(2)}` };
  });
}

function sectionLabel(dateISO: string, today: string, yesterday: string): string {
  if (dateISO === today) return "Hoje";
  if (dateISO === yesterday) return "Ontem";
  const [y, m, d] = dateISO.split("-");
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const sameYear = parseInt(y, 10) === now.getUTCFullYear();
  return sameYear
    ? `${d} de ${MONTH_SHORT[parseInt(m, 10) - 1]}`
    : `${d}/${m}/${y}`;
}

// --- BulkEditSheet ---

interface BulkEditSheetProps {
  visible: boolean;
  count: number;
  categorySuggestions: string[];
  onClose: () => void;
  onApply: (changes: { category?: string; type?: "income" | "expense" }) => Promise<void>;
  colors: ReturnType<typeof useColors>;
  insets: ReturnType<typeof useSafeAreaInsets>;
}

function BulkEditSheet({ visible, count, categorySuggestions, onClose, onApply, colors, insets }: BulkEditSheetProps) {
  const [type, setType] = useState<"keep" | "income" | "expense">("keep");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const typeOptions: { key: "keep" | "income" | "expense"; label: string }[] = [
    { key: "keep", label: "Manter" },
    { key: "income", label: "Entrada" },
    { key: "expense", label: "Saída" },
  ];

  async function handleApply() {
    const changes: { category?: string; type?: "income" | "expense" } = {};
    if (category.trim()) changes.category = category.trim();
    if (type !== "keep") changes.type = type;
    if (Object.keys(changes).length === 0) {
      Alert.alert("Atenção", "Selecione ao menos um campo para alterar.");
      return;
    }
    setSaving(true);
    try {
      await onApply(changes);
      setType("keep");
      setCategory("");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={bulk.overlay} onPress={onClose} />
      <View style={[bulk.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
        <View style={bulk.handle} />
        <Text style={[bulk.title, { color: colors.foreground }]}>
          Editar {count} {count === 1 ? "transação" : "transações"}
        </Text>

        <Text style={[bulk.label, { color: colors.mutedForeground }]}>Tipo</Text>
        <View style={bulk.typeRow}>
          {typeOptions.map((opt) => {
            const active = type === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setType(opt.key)}
                style={[
                  bulk.typeBtn,
                  {
                    backgroundColor: active ? colors.primary : colors.secondary,
                    borderColor: active ? colors.primary : colors.border,
                    borderRadius: colors.radius,
                    flex: 1,
                  },
                ]}
              >
                <Text style={[bulk.typeBtnText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[bulk.label, { color: colors.mutedForeground }]}>Categoria</Text>
        <View
          style={[
            bulk.inputRow,
            {
              backgroundColor: colors.secondary,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <TextInput
            value={category}
            onChangeText={setCategory}
            placeholder="Nova categoria (opcional)"
            placeholderTextColor={colors.mutedForeground}
            style={[bulk.input, { color: colors.foreground }]}
          />
          {category.length > 0 && (
            <Pressable onPress={() => setCategory("")} hitSlop={8}>
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>

        {categorySuggestions.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            <View style={bulk.chipRow}>
              {categorySuggestions.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setCategory(s)}
                  style={[
                    bulk.chip,
                    {
                      backgroundColor: category === s ? `${colors.primary}22` : colors.secondary,
                      borderColor: category === s ? colors.primary : colors.border,
                      borderRadius: 20,
                    },
                  ]}
                >
                  <Text style={[bulk.chipText, { color: category === s ? colors.primary : colors.mutedForeground }]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}

        <Text style={[bulk.hint, { color: colors.mutedForeground }]}>
          Campos em branco não serão alterados.
        </Text>

        <View style={bulk.actions}>
          <Pressable
            onPress={onClose}
            style={[bulk.cancelBtn, { borderColor: colors.border, borderRadius: colors.radius }]}
          >
            <Text style={[bulk.cancelText, { color: colors.mutedForeground }]}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={handleApply}
            disabled={saving}
            style={[
              bulk.applyBtn,
              { backgroundColor: saving ? `${colors.primary}88` : colors.primary, borderRadius: colors.radius, flex: 1 },
            ]}
          >
            <Text style={[bulk.applyText, { color: colors.primaryForeground }]}>
              {saving ? "Salvando…" : "Confirmar"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// --- Main screen ---

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const { openAdd, openEdit } = useTransactionForm();

  const [filter, setFilter] = useState<FilterType>("all");
  const [month, setMonth] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const { data: transactions, isLoading, refetch } = useListTransactions({
    type: filter === "all" ? undefined : filter,
    limit: 500,
  });

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const baseUrl = getApiBaseUrl();

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "income", label: "Receitas" },
    { key: "expense", label: "Despesas" },
  ];

  const monthOptions = useMemo(
    () => (Array.isArray(transactions) ? buildMonthOptions(transactions as Transaction[]) : []),
    [transactions],
  );

  const filtered = useMemo(() => {
    if (!Array.isArray(transactions)) return [] as Transaction[];
    const q = search.trim().toLowerCase();
    return (transactions as Transaction[]).filter((t) => {
      if (month && !t.date.startsWith(month)) return false;
      if (q) {
        const hay = `${t.description} ${t.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transactions, search, month]);

  const total = useMemo(() => filtered.reduce((s, t) => s + t.amount, 0), [filtered]);

  const rows = useMemo<ListRow[]>(() => {
    const today = todayBrasiliaISO();
    const yesterday = yesterdayBrasiliaISO();
    const byDate = new Map<string, Transaction[]>();
    const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date));
    for (const t of sorted) {
      const arr = byDate.get(t.date) ?? [];
      arr.push(t);
      byDate.set(t.date, arr);
    }
    const out: ListRow[] = [];
    for (const [date, items] of byDate.entries()) {
      const sum = items.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
      out.push({
        kind: "header",
        id: `h-${date}`,
        label: sectionLabel(date, today, yesterday),
        total: sum,
        count: items.length,
      });
      for (const t of items) out.push({ kind: "item", id: `t-${t.id}`, tx: t });
    }
    return out;
  }, [filtered]);

  const categorySuggestions = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const t of filtered) {
      if (t.category && !seen.has(t.category)) {
        seen.add(t.category);
        result.push(t.category);
      }
    }
    return result;
  }, [filtered]);

  const itemIds = useMemo(
    () => filtered.map((t) => t.id),
    [filtered],
  );

  // Selection callbacks
  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(itemIds));
  }, [itemIds]);

  const allSelected = itemIds.length > 0 && selectedIds.size === itemIds.length;

  function handleDeleteConfirm(id: number) {
    Alert.alert(
      "Excluir transação",
      "Tem certeza que deseja excluir esta transação?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await fetch(`${baseUrl}/api/transactions/${id}`, {
                method: "DELETE",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              refetch();
            } catch {
              Alert.alert("Erro", "Não foi possível excluir a transação.");
            }
          },
        },
      ],
    );
  }

  async function handleBulkApply(changes: { category?: string; type?: "income" | "expense" }) {
    const ids = [...selectedIds];
    await fetch(`${baseUrl}/api/transactions/bulk-update`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ids, ...changes }),
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    clearSelection();
    refetch();
  }

  const activeMonthLabel = month ? monthOptions.find((m) => m.key === month)?.label : null;
  const filterLabel =
    filter === "income" ? "Receitas" : filter === "expense" ? "Despesas" : "Todas";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      {selectionMode ? (
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
          <Pressable
            onPress={clearSelection}
            style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name="x" size={20} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.selectionCount, { color: colors.foreground }]}>
            {selectedIds.size === 0
              ? "Selecione transações"
              : `${selectedIds.size} selecionada${selectedIds.size !== 1 ? "s" : ""}`}
          </Text>
          <Pressable
            onPress={allSelected ? clearSelection : selectAll}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={[styles.selAllText, { color: colors.primary }]}>
              {allSelected ? "Desmarcar" : "Selecionar tudo"}
            </Text>
          </Pressable>
        </View>
      ) : (
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
          <View style={styles.headerRight}>
            <Pressable
              onPress={() => setSearchOpen((v) => !v)}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: searchOpen ? colors.primary : colors.secondary,
                  borderRadius: colors.radius,
                  borderWidth: 1,
                  borderColor: searchOpen ? colors.primary : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather
                name="search"
                size={17}
                color={searchOpen ? colors.primaryForeground : colors.foreground}
              />
            </Pressable>
            <Pressable
              onPress={enterSelectionMode}
              style={({ pressed }) => [
                styles.selectBtn,
                {
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.selectBtnText, { color: colors.foreground }]}>Selecionar</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Search bar (collapsible, hidden in selection mode) */}
      {searchOpen && !selectionMode ? (
        <View style={{ paddingHorizontal: 20, paddingBottom: 12, backgroundColor: colors.background }}>
          <View
            style={[
              styles.searchRow,
              {
                backgroundColor: colors.secondary,
                borderRadius: colors.radius,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="search" size={14} color={colors.mutedForeground} />
            <TextInput
              autoFocus
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar descrição ou categoria"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              returnKeyType="search"
            />
            {search ? (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Filter chips + month selector (hidden in selection mode) */}
      {!selectionMode && (
        <View
          style={[
            styles.filterBar,
            {
              paddingBottom: 10,
              backgroundColor: colors.background,
            },
          ]}
        >
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.secondary,
                    borderRadius: 20,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: active ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}

          <View style={{ flex: 1 }} />

          <Pressable
            onPress={() => setMonthPickerOpen(true)}
            style={[
              styles.chip,
              styles.monthChip,
              {
                backgroundColor: month ? `${colors.primary}22` : colors.secondary,
                borderColor: month ? colors.primary : colors.border,
                borderWidth: 1,
                borderRadius: 20,
              },
            ]}
          >
            <Feather
              name="calendar"
              size={12}
              color={month ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.chipText,
                { color: month ? colors.primary : colors.mutedForeground },
              ]}
            >
              {activeMonthLabel ?? "Todos meses"}
            </Text>
            <Feather
              name="chevron-down"
              size={12}
              color={month ? colors.primary : colors.mutedForeground}
            />
          </Pressable>
        </View>
      )}

      {/* Filter total summary */}
      <View
        style={[
          styles.totalBar,
          {
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>
          {filterLabel}
          {activeMonthLabel ? ` · ${activeMonthLabel}` : ""}
          {search ? ` · "${search}"` : ""}
        </Text>
        <Text
          style={[
            styles.totalValue,
            {
              color:
                filter === "income"
                  ? colors.income
                  : filter === "expense"
                    ? colors.expense
                    : colors.foreground,
            },
          ]}
        >
          {brlCompact(total)} · {filtered.length}{" "}
          {filtered.length === 1 ? "transação" : "transações"}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingBox}>
          {[0, 1, 2].map((g) => (
            <React.Fragment key={g}>
              <SkeletonSectionHeader />
              <SkeletonTransactionRow />
              <SkeletonTransactionRow />
              <SkeletonTransactionRow />
            </React.Fragment>
          ))}
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            if (item.kind === "header") {
              return (
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionHeaderLabel, { color: colors.mutedForeground }]}>
                    {item.label}
                  </Text>
                </View>
              );
            }
            const t = item.tx;
            const editPayload = {
              id: t.id,
              description: t.description,
              amount: t.amount,
              type: t.type as "income" | "expense",
              category: t.category,
              date: t.date,
            };

            if (selectionMode) {
              const selected = selectedIds.has(t.id);
              return (
                <Pressable
                  onPress={() => toggleSelect(t.id)}
                  style={[
                    styles.selectableRow,
                    {
                      backgroundColor: selected ? `${colors.primary}15` : "transparent",
                      borderColor: selected ? `${colors.primary}40` : "transparent",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary : "transparent",
                      },
                    ]}
                  >
                    {selected && <Feather name="check" size={12} color={colors.primaryForeground} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <TransactionRow
                      description={t.description}
                      amount={t.amount}
                      type={t.type as "income" | "expense"}
                      category={t.category}
                      date={t.date}
                    />
                  </View>
                </Pressable>
              );
            }

            return (
              <SwipeableRow
                onEdit={() => openEdit(editPayload)}
                onDelete={() => handleDeleteConfirm(t.id)}
              >
                <TransactionRow
                  description={t.description}
                  amount={t.amount}
                  type={t.type as "income" | "expense"}
                  category={t.category}
                  date={t.date}
                  onPress={() => openEdit(editPayload)}
                  onLongPress={() => {
                    setSelectionMode(true);
                    setSelectedIds(new Set([t.id]));
                  }}
                />
              </SwipeableRow>
            );
          }}
          refreshing={isLoading}
          onRefresh={refetch}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 120 },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="inbox" size={36} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {search || month
                  ? "Nenhum resultado para esse filtro."
                  : filter !== "all"
                    ? `Sem transações de ${filter === "income" ? "receita" : "despesa"}.`
                    : "Sem transações ainda."}
              </Text>
              <Pressable
                onPress={openAdd}
                style={[
                  styles.emptyAddBtn,
                  { borderColor: colors.border, borderRadius: colors.radius },
                ]}
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

      {/* SpeedDialFab — hidden in selection mode */}
      {!selectionMode && <SpeedDialFab onAdd={openAdd} />}

      {/* Bulk action footer */}
      {selectionMode && (
        <View
          style={[
            styles.bulkFooter,
            {
              paddingBottom: insets.bottom + 16,
              backgroundColor: colors.card,
              borderTopColor: colors.border,
            },
          ]}
        >
          <Pressable
            onPress={clearSelection}
            style={[styles.cancelFooterBtn, { borderColor: colors.border, borderRadius: colors.radius }]}
          >
            <Text style={[styles.cancelFooterText, { color: colors.foreground }]}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={() => selectedIds.size > 0 && setBulkEditOpen(true)}
            style={[
              styles.editFooterBtn,
              {
                backgroundColor: selectedIds.size > 0 ? colors.primary : colors.secondary,
                borderRadius: colors.radius,
                flex: 1,
              },
            ]}
          >
            <Text
              style={[
                styles.editFooterText,
                { color: selectedIds.size > 0 ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {selectedIds.size === 0
                ? "Selecione transações"
                : `Editar ${selectedIds.size} transaç${selectedIds.size !== 1 ? "ões" : "ão"}`}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Month picker */}
      <Modal
        visible={monthPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMonthPickerOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMonthPickerOpen(false)} />
        <View
          style={[
            styles.sourceSheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <Text style={[styles.sourceTitle, { color: colors.foreground }]}>Filtrar por mês</Text>
          <Pressable
            onPress={() => {
              setMonth(null);
              setMonthPickerOpen(false);
            }}
            style={({ pressed }) => [
              styles.sourceOption,
              { backgroundColor: pressed ? colors.secondary : "transparent" },
            ]}
          >
            <Feather
              name={month === null ? "check-circle" : "circle"}
              size={18}
              color={month === null ? colors.primary : colors.mutedForeground}
            />
            <Text style={[styles.sourceOptionText, { color: colors.foreground }]}>
              Todos os meses
            </Text>
          </Pressable>
          {monthOptions.map((m) => {
            const active = month === m.key;
            return (
              <Pressable
                key={m.key}
                onPress={() => {
                  setMonth(m.key);
                  setMonthPickerOpen(false);
                }}
                style={({ pressed }) => [
                  styles.sourceOption,
                  { backgroundColor: pressed ? colors.secondary : "transparent" },
                ]}
              >
                <Feather
                  name={active ? "check-circle" : "circle"}
                  size={18}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                <Text style={[styles.sourceOptionText, { color: colors.foreground }]}>
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Modal>

      {/* Bulk edit sheet */}
      <BulkEditSheet
        visible={bulkEditOpen}
        count={selectedIds.size}
        categorySuggestions={categorySuggestions}
        onClose={() => setBulkEditOpen(false)}
        onApply={handleBulkApply}
        colors={colors}
        insets={insets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  screenTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  selectBtn: {
    height: 38,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  selectBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  selectionCount: { fontSize: 16, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "center" },
  selAllText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  filterBar: { flexDirection: "row", paddingHorizontal: 16, gap: 8, alignItems: "center" },
  chip: { paddingHorizontal: 14, paddingVertical: 8 },
  monthChip: { flexDirection: "row", alignItems: "center", gap: 6 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  totalLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.6 },
  totalValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingTop: 4, paddingHorizontal: 16 },
  sectionHeader: {
    paddingTop: 16,
    paddingBottom: 6,
    paddingHorizontal: 4,
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  selectableRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bulkFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  cancelFooterBtn: {
    height: 50,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  cancelFooterText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  editFooterBtn: { height: 50, alignItems: "center", justifyContent: "center" },
  editFooterText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyAddBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  emptyAddText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sourceSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 4 },
  sourceTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  sourceOption: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 10 },
  sourceOptionText: { fontSize: 16, fontFamily: "Inter_400Regular" },
});

const bulk = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#ccc", alignSelf: "center", marginBottom: 4 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 4 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: -4 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: { height: 42, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  typeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", padding: 0 },
  chipRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  hint: { fontSize: 12, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: { height: 50, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  applyBtn: { height: 50, alignItems: "center", justifyContent: "center" },
  applyText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
