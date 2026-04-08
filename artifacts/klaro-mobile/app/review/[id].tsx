import { Feather } from "@expo/vector-icons";
import {
  useConfirmParsedRecords,
  useGetUpload,
  useUpdateParsedRecord,
  useDeleteParsedRecord,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
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
import { KlaroButton } from "@/components/KlaroButton";
import { useColors } from "@/hooks/useColors";

const CATEGORIES = [
  "Vendas", "Serviços", "Aluguel", "Marketing",
  "Folha de Pagamento", "Fornecedores", "Utilidades",
  "Impostos", "Equipamentos", "Financeiro", "Outros",
];

interface ParsedRecord {
  id: number;
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string;
}

interface EditState {
  record: ParsedRecord;
  date: string;
  description: string;
  amount: string;
  type: "income" | "expense";
  category: string;
}

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: upload, isLoading, refetch } = useGetUpload(Number(id));
  const confirmMutation = useConfirmParsedRecords();
  const updateMutation = useUpdateParsedRecord();
  const deleteMutation = useDeleteParsedRecord();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  function openEdit(record: ParsedRecord) {
    setEditState({
      record,
      date: record.date,
      description: record.description,
      amount: String(record.amount),
      type: record.type as "income" | "expense",
      category: record.category,
    });
  }

  async function handleSave() {
    if (!editState) return;
    const amount = parseFloat(editState.amount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Valor inválido", "Digite um valor numérico positivo.");
      return;
    }
    setSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: editState.record.id,
        data: {
          date: editState.date,
          description: editState.description,
          amount,
          type: editState.type,
          category: editState.category,
        },
      });
      await refetch();
      setEditState(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Erro", "Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editState) return;
    Alert.alert(
      "Excluir registro",
      "Tem certeza que deseja excluir este registro?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync({ id: editState.record.id });
              await refetch();
              setEditState(null);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch {
              Alert.alert("Erro", "Não foi possível excluir.");
            }
          },
        },
      ]
    );
  }

  async function handleConfirm() {
    if (!id) return;
    setConfirming(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await confirmMutation.mutateAsync({
        data: { rawInputId: Number(id) },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Confirmado!",
        `${result.confirmedCount} transações foram salvas.`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch {
      Alert.alert("Erro", "Não foi possível confirmar. Tente novamente.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setConfirming(false);
    }
  }

  if (isLoading) {
    return (
      <View style={[styles.loadingRoot, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const records = upload?.parsedRecords ?? [];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            paddingHorizontal: 16,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
            {upload?.fileName ?? "Revisão"}
          </Text>
          <Text style={[styles.recordCount, { color: colors.mutedForeground }]}>
            {records.length} registros · toque para editar
          </Text>
        </View>
      </View>

      {records.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="alert-circle" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Nenhum registro foi extraído deste arquivo.
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={records}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => {
              const isIncome = item.type === "income";
              const formattedAmount = new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(item.amount);

              return (
                <Pressable
                  onPress={() => openEdit(item as ParsedRecord)}
                  style={({ pressed }) => [
                    styles.recordRow,
                    {
                      backgroundColor: pressed ? colors.muted : colors.card,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.recordLeft}>
                    <Text style={[styles.recordDate, { color: colors.mutedForeground }]}>
                      {item.date}
                    </Text>
                    <Text style={[styles.recordDesc, { color: colors.foreground }]} numberOfLines={2}>
                      {item.description}
                    </Text>
                    <Text style={[styles.recordCategory, { color: colors.mutedForeground }]}>
                      {item.category}
                    </Text>
                  </View>
                  <View style={styles.recordRight}>
                    <Text
                      style={[
                        styles.recordAmount,
                        { color: isIncome ? colors.income : colors.expense },
                      ]}
                    >
                      {isIncome ? "+" : "-"}{formattedAmount}
                    </Text>
                    <Feather name="edit-2" size={14} color={colors.mutedForeground} style={{ marginTop: 4 }} />
                  </View>
                </Pressable>
              );
            }}
            contentContainerStyle={[
              styles.list,
              { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 120 },
            ]}
          />

          <View
            style={[
              styles.footer,
              {
                paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 16,
                paddingTop: 16,
                paddingHorizontal: 20,
                backgroundColor: colors.background,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
              Revise os dados acima antes de confirmar
            </Text>
            <KlaroButton
              title={`Confirmar ${records.length} transações`}
              onPress={handleConfirm}
              loading={confirming}
              fullWidth
            />
          </View>
        </>
      )}

      {/* Edit Modal */}
      <Modal
        visible={editState !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditState(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditState(null)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalWrapper}
        >
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Editar registro
              </Text>
              <Pressable onPress={() => setEditState(null)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type toggle */}
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Tipo</Text>
              <View style={styles.typeRow}>
                {(["income", "expense"] as const).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setEditState((s) => s ? { ...s, type: t } : s)}
                    style={[
                      styles.typeBtn,
                      {
                        backgroundColor:
                          editState?.type === t
                            ? t === "income" ? colors.income : colors.expense
                            : colors.muted,
                      },
                    ]}
                  >
                    <Text style={[styles.typeBtnText, { color: editState?.type === t ? "#000" : colors.mutedForeground }]}>
                      {t === "income" ? "Receita" : "Despesa"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Description */}
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Descrição</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={editState?.description ?? ""}
                onChangeText={(v) => setEditState((s) => s ? { ...s, description: v } : s)}
                placeholder="Descrição"
                placeholderTextColor={colors.mutedForeground}
              />

              {/* Amount */}
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Valor (R$)</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={editState?.amount ?? ""}
                onChangeText={(v) => setEditState((s) => s ? { ...s, amount: v } : s)}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
              />

              {/* Date */}
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Data (YYYY-MM-DD)</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                value={editState?.date ?? ""}
                onChangeText={(v) => setEditState((s) => s ? { ...s, date: v } : s)}
                placeholder="2024-05-14"
                placeholderTextColor={colors.mutedForeground}
              />

              {/* Category */}
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Categoria</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={styles.categoryRow}>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setEditState((s) => s ? { ...s, category: cat } : s)}
                      style={[
                        styles.categoryChip,
                        {
                          backgroundColor: editState?.category === cat ? colors.primary : colors.muted,
                          borderColor: editState?.category === cat ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.categoryChipText, { color: editState?.category === cat ? "#000" : colors.foreground }]}>
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {/* Actions */}
              <KlaroButton title="Salvar" onPress={handleSave} loading={saving} fullWidth />
              <Pressable onPress={handleDelete} style={styles.deleteBtn}>
                <Feather name="trash-2" size={16} color={colors.destructive} />
                <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>
                  Excluir registro
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  fileName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  recordCount: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  list: { gap: 1 },
  recordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    gap: 12,
  },
  recordLeft: { flex: 1, gap: 3 },
  recordRight: { alignItems: "flex-end", gap: 2 },
  recordDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  recordDesc: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 18 },
  recordCategory: { fontSize: 12, fontFamily: "Inter_400Regular", textTransform: "capitalize" },
  recordAmount: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  footer: { gap: 10 },
  footerNote: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalWrapper: { justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  typeRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  typeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  typeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  categoryRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryChipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
  },
  deleteBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
});
