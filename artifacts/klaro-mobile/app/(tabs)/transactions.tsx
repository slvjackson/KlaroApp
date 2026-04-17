import { Feather } from "@expo/vector-icons";
import { useListTransactions } from "@workspace/api-client-react";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Fab } from "@/components/Fab";
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
  const [uploading, setUploading] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

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

  async function uploadFile(uri: string, name: string, mimeType: string) {
    setUploading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const formData = new FormData();
      formData.append("file", { uri, name, type: mimeType } as unknown as Blob);
      const res = await fetch(`${baseUrl}/api/uploads`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) return;
      const upload = await res.json();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push(`/review/${upload.id}`);
    } catch {
      // silently ignore — review screen will show error
    } finally {
      setUploading(false);
    }
  }

  async function handleCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await uploadFile(asset.uri, `foto_${Date.now()}.jpg`, asset.mimeType ?? "image/jpeg");
  }

  async function handleGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const name = asset.uri.split("/").pop() ?? `imagem_${Date.now()}.jpg`;
    await uploadFile(asset.uri, name, asset.mimeType ?? "image/jpeg");
  }

  async function handleFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel", "application/pdf", "image/*"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const file = result.assets[0];
    await uploadFile(file.uri, file.name, file.mimeType ?? "application/octet-stream");
  }

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

  function handleChooseSource() {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancelar", "Câmera", "Fotos", "Arquivo"], cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) handleCamera();
          else if (idx === 2) handleGallery();
          else if (idx === 3) handleFile();
        }
      );
    } else {
      setShowSourcePicker(true);
    }
  }

  const activeMonthLabel = month ? monthOptions.find((m) => m.key === month)?.label : null;
  const filterLabel =
    filter === "income" ? "Receitas" : filter === "expense" ? "Despesas" : "Todas";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
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
      </View>

      {/* Search bar (collapsible) */}
      {searchOpen ? (
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

      {/* Filter chips + month selector */}
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
          <ActivityIndicator color={colors.primary} size="large" />
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

      {/* Speed dial FAB */}
      {fabOpen && (
        <>
          <Pressable
            style={[StyleSheet.absoluteFill, { zIndex: 98 }]}
            onPress={() => setFabOpen(false)}
          />
          {/* Upload action */}
          <View style={[styles.fabActionRow, { bottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 84 + 132 }]}>
            <Text style={[styles.fabActionLabel, { backgroundColor: colors.card, color: colors.foreground }]}>
              {uploading ? "Enviando…" : "Upload"}
            </Text>
            <Pressable
              onPress={() => { setFabOpen(false); handleChooseSource(); }}
              disabled={uploading}
              style={[styles.fabSecondary, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            >
              {uploading
                ? <ActivityIndicator size="small" color={colors.foreground} />
                : <Feather name="upload" size={20} color={colors.foreground} />}
            </Pressable>
          </View>
          {/* Add action */}
          <View style={[styles.fabActionRow, { bottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 84 + 66 }]}>
            <Text style={[styles.fabActionLabel, { backgroundColor: colors.card, color: colors.foreground }]}>
              Adicionar
            </Text>
            <Pressable
              onPress={() => { setFabOpen(false); openAdd(); }}
              style={[styles.fabSecondary, { backgroundColor: colors.secondary, borderColor: colors.border }]}
            >
              <Feather name="edit-2" size={20} color={colors.foreground} />
            </Pressable>
          </View>
        </>
      )}
      <Pressable
        onPress={async () => {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setFabOpen((v) => !v);
        }}
        hitSlop={8}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.primary,
            bottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 84,
            transform: [{ scale: pressed ? 0.94 : 1 }, { rotate: fabOpen ? "45deg" : "0deg" }],
            shadowColor: colors.primary,
          },
        ]}
      >
        <Feather name="plus" size={24} color={colors.primaryForeground} />
      </Pressable>

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

      {/* Android source picker */}
      <Modal
        visible={showSourcePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSourcePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowSourcePicker(false)} />
        <View style={[styles.sourceSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <Text style={[styles.sourceTitle, { color: colors.foreground }]}>Escolher origem</Text>
          {[
            { icon: "camera" as const, label: "Câmera", action: () => { setShowSourcePicker(false); handleCamera(); } },
            { icon: "image" as const, label: "Fotos", action: () => { setShowSourcePicker(false); handleGallery(); } },
            { icon: "file-text" as const, label: "Arquivo", action: () => { setShowSourcePicker(false); handleFile(); } },
          ].map(({ icon, label, action }) => (
            <Pressable
              key={label}
              onPress={action}
              style={({ pressed }) => [
                styles.sourceOption,
                { backgroundColor: pressed ? colors.secondary : "transparent" },
              ]}
            >
              <Feather name={icon} size={20} color={colors.foreground} />
              <Text style={[styles.sourceOptionText, { color: colors.foreground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  screenTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  iconBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
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
  // Speed dial FAB
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 100,
  },
  fabActionRow: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 99,
  },
  fabActionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: "hidden",
  },
  fabSecondary: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
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
