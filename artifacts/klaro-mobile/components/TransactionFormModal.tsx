import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { customFetch } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/constants/api";
import { useColors } from "@/hooks/useColors";

const EXPENSE_CATEGORIES = [
  "Alimentação", "Moradia", "Transporte", "Saúde",
  "Lazer", "Educação", "Vestuário", "Serviços", "Outros",
];
const INCOME_CATEGORIES = ["Renda", "Freelance", "Investimentos", "Outros"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function displayDate(iso: string) {
  // YYYY-MM-DD → DD/MM/YYYY
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function parseDisplayDate(display: string): string {
  // DD/MM/YYYY → YYYY-MM-DD; returns original if pattern not matched
  const match = display.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return display;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export interface TransactionData {
  id: number;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
}

interface Props {
  visible: boolean;
  editing: TransactionData | null; // null = add mode
  onClose: () => void;
  onSaved: () => void;
}

export function TransactionFormModal({ visible, editing, onClose, onSaved }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [dateDisplay, setDateDisplay] = useState(displayDate(todayISO()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = editing !== null;
  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Populate form when editing
  useEffect(() => {
    if (editing) {
      setDescription(editing.description);
      setAmount(String(editing.amount));
      setType(editing.type);
      setCategory(editing.category);
      setDateDisplay(displayDate(editing.date));
    } else {
      setDescription("");
      setAmount("");
      setType("expense");
      setCategory("");
      setDateDisplay(displayDate(todayISO()));
    }
    setError("");
  }, [editing, visible]);

  // Reset category when type changes
  useEffect(() => {
    if (!categories.includes(category)) setCategory("");
  }, [type]);

  async function handleSave() {
    const trimDesc = description.trim();
    const parsedAmount = parseFloat(amount.replace(",", "."));
    const isoDate = parseDisplayDate(dateDisplay);

    if (!trimDesc) { setError("Informe uma descrição."); return; }
    if (isNaN(parsedAmount) || parsedAmount <= 0) { setError("Valor inválido."); return; }
    if (!category) { setError("Selecione uma categoria."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) { setError("Data inválida. Use DD/MM/AAAA."); return; }

    setError("");
    setLoading(true);
    try {
      const body = {
        description: trimDesc,
        amount: parsedAmount,
        type,
        category,
        date: isoDate,
      };
      const baseUrl = getApiBaseUrl();
      if (isEdit) {
        await customFetch(`${baseUrl}/api/transactions/${editing!.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await customFetch(`${baseUrl}/api/transactions`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar.";
      setError(msg);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    Alert.alert(
      "Excluir transação",
      "Tem certeza que deseja excluir esta transação?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              const baseUrl = getApiBaseUrl();
              await customFetch(`${baseUrl}/api/transactions/${editing!.id}`, {
                method: "DELETE",
              });
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              onSaved();
              onClose();
            } catch {
              setError("Erro ao excluir.");
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Handle bar */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {isEdit ? "Editar transação" : "Nova transação"}
            </Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.form}
          >
            {/* Type toggle */}
            <View style={[styles.typeRow, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}>
              {(["expense", "income"] as const).map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[
                    styles.typeBtn,
                    {
                      backgroundColor: type === t ? colors.primary : "transparent",
                      borderRadius: colors.radius - 2,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeBtnText,
                      { color: type === t ? colors.primaryForeground : colors.mutedForeground },
                    ]}
                  >
                    {t === "expense" ? "Despesa" : "Receita"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Descrição</Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius },
                ]}
                placeholder="Ex: Supermercado, Salário..."
                placeholderTextColor={colors.mutedForeground}
                value={description}
                onChangeText={setDescription}
                returnKeyType="next"
              />
            </View>

            {/* Amount */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Valor (R$)</Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius },
                ]}
                placeholder="0,00"
                placeholderTextColor={colors.mutedForeground}
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                returnKeyType="next"
              />
            </View>

            {/* Date */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Data</Text>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius },
                ]}
                placeholder="DD/MM/AAAA"
                placeholderTextColor={colors.mutedForeground}
                value={dateDisplay}
                onChangeText={setDateDisplay}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Categoria</Text>
              <View style={styles.catGrid}>
                {categories.map((cat) => {
                  const active = category === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[
                        styles.catChip,
                        {
                          backgroundColor: active ? colors.primary : colors.background,
                          borderColor: active ? colors.primary : colors.border,
                          borderRadius: 20,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          { color: active ? colors.primaryForeground : colors.mutedForeground },
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {error ? (
              <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
            ) : null}

            {/* Actions */}
            <View style={styles.actions}>
              {isEdit && (
                <Pressable
                  onPress={handleDelete}
                  style={[styles.deleteBtn, { borderColor: colors.destructive, borderRadius: colors.radius }]}
                >
                  <Feather name="trash-2" size={16} color={colors.destructive} />
                </Pressable>
              )}
              <Pressable
                onPress={handleSave}
                disabled={loading}
                style={[
                  styles.saveBtn,
                  { backgroundColor: colors.primary, borderRadius: colors.radius, flex: 1 },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
                    {isEdit ? "Salvar alterações" : "Adicionar"}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  form: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 16,
  },
  typeRow: {
    flexDirection: "row",
    padding: 4,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  typeBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  catChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  error: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  saveBtn: {
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  deleteBtn: {
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
});
