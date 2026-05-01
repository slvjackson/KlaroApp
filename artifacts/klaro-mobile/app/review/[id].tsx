import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useConfirmParsedRecords,
  useDeleteParsedRecord,
  useDeleteUpload,
  useGetUpload,
  useUpdateParsedRecord,
} from "@workspace/api-client-react";
import type { ParsedRecord } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoToBR(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function brToISO(br: string): string {
  const parts = br.split("/");
  if (parts.length !== 3) return br;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// ─── Processing view ──────────────────────────────────────────────────────────

function ProcessingView({ fileName }: { fileName?: string }) {
  const colors = useColors();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <View style={[styles.processingRoot, { backgroundColor: colors.background }]}>
      <Animated.View
        style={[
          styles.processingIconWrap,
          {
            backgroundColor: `${colors.primary}18`,
            borderColor: `${colors.primary}33`,
            transform: [{ scale: pulse }],
          },
        ]}
      >
        <MaterialCommunityIcons
          name="file-search-outline"
          size={44}
          color={colors.primary}
        />
      </Animated.View>

      <Text style={[styles.processingTitle, { color: colors.foreground }]}>
        Analisando arquivo…
      </Text>
      {fileName ? (
        <Text
          style={[styles.processingFile, { color: colors.mutedForeground }]}
          numberOfLines={1}
        >
          {fileName}
        </Text>
      ) : null}
      <Text style={[styles.processingSubtitle, { color: colors.mutedForeground }]}>
        A IA está extraindo as transações.{"\n"}Isso pode levar alguns segundos.
      </Text>

      <View style={styles.dotsRow}>
        {[0, 1, 2].map((i) => (
          <BouncingDot key={i} delay={i * 200} color={colors.primary} />
        ))}
      </View>
    </View>
  );
}

function BouncingDot({ delay, color }: { delay: number; color: string }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, { toValue: -6, duration: 350, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 350, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [y, delay]);
  return (
    <Animated.View
      style={[
        styles.dot,
        { backgroundColor: color, transform: [{ translateY: y }] },
      ]}
    />
  );
}

// ─── Single-record edit sheet ─────────────────────────────────────────────────

interface EditSheetProps {
  record: ParsedRecord | null;
  categorySuggestions: string[];
  onClose: () => void;
  onSave: (
    id: number,
    data: {
      date: string;
      description: string;
      amount: number;
      type: "income" | "expense";
      category: string;
    }
  ) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

function EditSheet({
  record,
  categorySuggestions,
  onClose,
  onSave,
  onDelete,
}: EditSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (record) {
      setDate(isoToBR(record.date));
      setDescription(record.description);
      setAmount(String(record.amount));
      setType(record.type as "income" | "expense");
      setCategory(record.category);
    }
  }, [record?.id]);

  async function handleSave() {
    if (!record) return;
    const parsed = parseFloat(amount.replace(",", "."));
    if (!description.trim()) {
      Alert.alert("Atenção", "A descrição não pode estar vazia.");
      return;
    }
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert("Atenção", "Insira um valor válido.");
      return;
    }
    setSaving(true);
    try {
      await onSave(record.id, {
        date: brToISO(date),
        description: description.trim(),
        amount: parsed,
        type,
        category: category.trim() || record.category,
      });
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!record) return;
    Alert.alert(
      "Excluir registro",
      "Tem certeza? Esta ação não pode ser desfeita.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await onDelete(record.id);
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }

  const suggestions = useMemo(
    () => categorySuggestions.filter((c) => c.toLowerCase() !== category.toLowerCase()),
    [categorySuggestions, category]
  );

  const inputStyle = [
    styles.input,
    {
      color: colors.foreground,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
  ];

  return (
    <Modal
      visible={record !== null}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kav}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
              Editar registro
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Type toggle */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Tipo</Text>
              <View style={[styles.typeRow, { backgroundColor: colors.secondary }]}>
                {(["income", "expense"] as const).map((t) => {
                  const active = type === t;
                  const col = t === "income" ? colors.income : colors.expense;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setType(t)}
                      style={[styles.typeBtn, active && { backgroundColor: `${col}20` }]}
                    >
                      <Feather
                        name={t === "income" ? "trending-up" : "trending-down"}
                        size={14}
                        color={active ? col : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.typeBtnLabel,
                          { color: active ? col : colors.mutedForeground },
                          active && { fontFamily: "Inter_600SemiBold" },
                        ]}
                      >
                        {t === "income" ? "Entrada" : "Saída"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Descrição</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                style={inputStyle}
                placeholder="Nome da transação"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="next"
              />
            </View>

            {/* Amount + Date */}
            <View style={styles.rowFields}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Valor (R$)</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  style={inputStyle}
                  placeholder="0,00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Data</Text>
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  style={inputStyle}
                  placeholder="DD/MM/AAAA"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Categoria</Text>
              <TextInput
                value={category}
                onChangeText={setCategory}
                style={inputStyle}
                placeholder="Ex: Alimentação, Fornecedor…"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
              />
              {suggestions.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}
                  style={{ marginTop: 8 }}
                >
                  {suggestions.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setCategory(s)}
                      style={[
                        styles.chip,
                        { backgroundColor: colors.secondary, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: colors.foreground }]}>{s}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Actions */}
            <View style={styles.sheetActions}>
              <KlaroButton title="Salvar alterações" onPress={handleSave} loading={saving} fullWidth />
              <Pressable
                onPress={confirmDelete}
                disabled={deleting}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  { opacity: pressed || deleting ? 0.6 : 1 },
                ]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.expense} />
                ) : (
                  <>
                    <Feather name="trash-2" size={14} color={colors.expense} />
                    <Text style={[styles.deleteBtnText, { color: colors.expense }]}>
                      Excluir registro
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Bulk edit sheet ──────────────────────────────────────────────────────────

interface BulkEditSheetProps {
  visible: boolean;
  count: number;
  categorySuggestions: string[];
  onClose: () => void;
  onApply: (changes: {
    category?: string;
    type?: "income" | "expense";
  }) => Promise<void>;
}

function BulkEditSheet({
  visible,
  count,
  categorySuggestions,
  onClose,
  onApply,
}: BulkEditSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [category, setCategory] = useState("");
  const [typeOverride, setTypeOverride] = useState<"income" | "expense" | null>(null);
  const [applying, setApplying] = useState(false);

  // reset when sheet opens
  useEffect(() => {
    if (visible) {
      setCategory("");
      setTypeOverride(null);
    }
  }, [visible]);

  async function handleApply() {
    const changes: { category?: string; type?: "income" | "expense" } = {};
    if (category.trim()) changes.category = category.trim();
    if (typeOverride) changes.type = typeOverride;
    if (Object.keys(changes).length === 0) {
      Alert.alert("Atenção", "Selecione ao menos um campo para alterar.");
      return;
    }
    setApplying(true);
    try {
      await onApply(changes);
    } finally {
      setApplying(false);
    }
  }

  const suggestions = useMemo(
    () => categorySuggestions.filter((c) => c.toLowerCase() !== category.toLowerCase()),
    [categorySuggestions, category]
  );

  const inputStyle = [
    styles.input,
    {
      color: colors.foreground,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.kav}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                Edição em massa
              </Text>
              <Text style={[styles.sheetSub, { color: colors.mutedForeground }]}>
                {count} {count === 1 ? "registro selecionado" : "registros selecionados"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.bulkNote, { color: colors.mutedForeground }]}>
              Campos em branco não serão alterados.
            </Text>

            {/* Type override */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Tipo</Text>
              <View style={[styles.typeRow, { backgroundColor: colors.secondary }]}>
                {/* Manter */}
                <Pressable
                  onPress={() => setTypeOverride(null)}
                  style={[
                    styles.typeBtn,
                    typeOverride === null && {
                      backgroundColor: `${colors.primary}20`,
                    },
                  ]}
                >
                  <Feather
                    name="minus"
                    size={14}
                    color={typeOverride === null ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.typeBtnLabel,
                      {
                        color:
                          typeOverride === null ? colors.primary : colors.mutedForeground,
                      },
                      typeOverride === null && { fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    Manter
                  </Text>
                </Pressable>

                {(["income", "expense"] as const).map((t) => {
                  const active = typeOverride === t;
                  const col = t === "income" ? colors.income : colors.expense;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => setTypeOverride(t)}
                      style={[styles.typeBtn, active && { backgroundColor: `${col}20` }]}
                    >
                      <Feather
                        name={t === "income" ? "trending-up" : "trending-down"}
                        size={14}
                        color={active ? col : colors.mutedForeground}
                      />
                      <Text
                        style={[
                          styles.typeBtnLabel,
                          { color: active ? col : colors.mutedForeground },
                          active && { fontFamily: "Inter_600SemiBold" },
                        ]}
                      >
                        {t === "income" ? "Entrada" : "Saída"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Categoria</Text>
              <TextInput
                value={category}
                onChangeText={setCategory}
                style={inputStyle}
                placeholder="Deixe em branco para manter"
                placeholderTextColor={colors.mutedForeground}
                returnKeyType="done"
              />
              {suggestions.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chips}
                  style={{ marginTop: 8 }}
                >
                  {suggestions.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setCategory(s)}
                      style={[
                        styles.chip,
                        { backgroundColor: colors.secondary, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.chipText, { color: colors.foreground }]}>{s}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.sheetActions}>
              <KlaroButton
                title={applying ? "Aplicando…" : `Aplicar em ${count} ${count === 1 ? "registro" : "registros"}`}
                onPress={handleApply}
                loading={applying}
                fullWidth
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [confirming, setConfirming] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ParsedRecord | null>(null);
  const [bulkSheetVisible, setBulkSheetVisible] = useState(false);
  const [localRecords, setLocalRecords] = useState<ParsedRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const { data: upload, isLoading } = useGetUpload(Number(id), {
    query: {
      refetchInterval: (query: any) => {
        const status = query?.state?.data?.processingStatus;
        return status === "pending" || status === "processing" ? 2000 : false;
      },
    },
  });

  const confirmMutation = useConfirmParsedRecords();
  const updateMutation = useUpdateParsedRecord();
  const deleteMutation = useDeleteParsedRecord();
  const deleteUploadMutation = useDeleteUpload();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  useEffect(() => {
    if (upload?.parsedRecords) {
      setLocalRecords(upload.parsedRecords);
    }
  }, [upload]);

  const categorySuggestions = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const r of localRecords) {
      if (r.category && !seen.has(r.category)) {
        seen.add(r.category);
        result.push(r.category);
      }
    }
    return result;
  }, [localRecords]);

  // Selection helpers
  const toggleSelect = useCallback((recordId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(localRecords.map((r) => r.id)));
  }, [localRecords]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  const enterSelectionMode = useCallback(() => {
    setSelectionMode(true);
    setSelectedIds(new Set());
  }, []);

  const allSelected = selectedIds.size === localRecords.length && localRecords.length > 0;

  // Save single record
  async function handleSave(
    recordId: number,
    data: {
      date: string;
      description: string;
      amount: number;
      type: "income" | "expense";
      category: string;
    }
  ) {
    await updateMutation.mutateAsync({ id: recordId, data });
    setLocalRecords((prev) =>
      prev.map((r) => (r.id === recordId ? { ...r, ...data } : r))
    );
    setEditingRecord(null);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // Delete single record
  async function handleDelete(recordId: number) {
    await deleteMutation.mutateAsync({ id: recordId });
    setLocalRecords((prev) => prev.filter((r) => r.id !== recordId));
    setEditingRecord(null);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // Bulk apply
  async function handleBulkApply(changes: {
    category?: string;
    type?: "income" | "expense";
  }) {
    const ids = [...selectedIds];
    await Promise.all(ids.map((rid) => updateMutation.mutateAsync({ id: rid, data: changes })));
    setLocalRecords((prev) =>
      prev.map((r) => (selectedIds.has(r.id) ? { ...r, ...changes } : r))
    );
    clearSelection();
    setBulkSheetVisible(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  // Confirm all
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
        `${result.confirmedCount} ${result.confirmedCount === 1 ? "transação foi salva" : "transações foram salvas"}.`,
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch {
      Alert.alert("Erro", "Não foi possível confirmar. Tente novamente.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setConfirming(false);
    }
  }

  function handleDiscardUpload() {
    Alert.alert(
      "Descartar upload?",
      "O arquivo e todos os registros extraídos serão excluídos permanentemente.",
      [
        { text: "Manter", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteUploadMutation.mutateAsync({ id: Number(id) });
              router.replace("/(tabs)/upload");
            } catch {
              Alert.alert("Erro", "Não foi possível descartar o upload.");
            }
          },
        },
      ]
    );
  }

  // ─ Loading
  if (isLoading) {
    return (
      <View style={[styles.loadingRoot, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // ─ Processing state (pending / processing)
  const status = upload?.processingStatus;
  if (status === "pending" || status === "processing") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* minimal header with back */}
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
          <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
            {upload?.fileName ?? "Processando…"}
          </Text>
        </View>
        <ProcessingView fileName={upload?.fileName} />
      </View>
    );
  }

  // ─ Failed state
  if (status === "failed") {
    return (
      <View style={[styles.loadingRoot, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={44} color={colors.expense} />
        <Text style={[styles.processingTitle, { color: colors.foreground, marginTop: 16 }]}>
          Falha no processamento
        </Text>
        <Text style={[styles.processingSubtitle, { color: colors.mutedForeground }]}>
          Não foi possível extrair as transações.{"\n"}Tente fazer o upload novamente.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.deleteBtn, { marginTop: 24 }]}
        >
          <Feather name="arrow-left" size={14} color={colors.primary} />
          <Text style={[styles.deleteBtnText, { color: colors.primary }]}>Voltar</Text>
        </Pressable>
      </View>
    );
  }

  const records = localRecords;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* ─ Header ─ */}
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
        {selectionMode ? (
          <>
            <Pressable onPress={clearSelection} style={styles.backBtn} hitSlop={8}>
              <Feather name="x" size={22} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.fileName, { color: colors.foreground, flex: 1 }]}>
              {selectedIds.size > 0
                ? `${selectedIds.size} selecionado${selectedIds.size !== 1 ? "s" : ""}`
                : "Selecionar registros"}
            </Text>
            <Pressable onPress={allSelected ? clearSelection : selectAll} hitSlop={8}>
              <Text style={[styles.selectAllBtn, { color: colors.primary }]}>
                {allSelected ? "Desmarcar todos" : "Selecionar todos"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color={colors.foreground} />
            </Pressable>
            <View style={styles.headerInfo}>
              <Text
                style={[styles.fileName, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {upload?.fileName ?? "Revisão"}
              </Text>
              <Text style={[styles.recordCount, { color: colors.mutedForeground }]}>
                {records.length}{" "}
                {records.length === 1 ? "registro extraído" : "registros extraídos"}
              </Text>
            </View>
            <Pressable onPress={enterSelectionMode} hitSlop={8}>
              <Text style={[styles.selectAllBtn, { color: colors.primary }]}>
                Selecionar
              </Text>
            </Pressable>
          </>
        )}
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
              const amtColor = isIncome ? colors.income : colors.expense;
              const isSelected = selectedIds.has(item.id);

              return (
                <Pressable
                  onPress={() => {
                    if (selectionMode) {
                      toggleSelect(item.id);
                    } else {
                      setEditingRecord(item);
                    }
                  }}
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setSelectionMode(true);
                    toggleSelect(item.id);
                  }}
                  delayLongPress={300}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: isSelected
                        ? `${colors.primary}10`
                        : colors.card,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  {/* Checkbox (selection mode) */}
                  {selectionMode && (
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? colors.primary : "transparent",
                        },
                      ]}
                    >
                      {isSelected && (
                        <Feather name="check" size={11} color="#fff" />
                      )}
                    </View>
                  )}

                  {/* Left: info */}
                  <View style={styles.rowLeft}>
                    <View style={styles.rowTopLine}>
                      <Text style={[styles.rowDate, { color: colors.mutedForeground }]}>
                        {isoToBR(item.date)}
                      </Text>
                      <View style={[styles.pill, { backgroundColor: `${amtColor}18` }]}>
                        <Text style={[styles.pillText, { color: amtColor }]}>
                          {isIncome ? "Entrada" : "Saída"}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[styles.rowDesc, { color: colors.foreground }]}
                      numberOfLines={1}
                    >
                      {item.description}
                    </Text>
                    <Text
                      style={[styles.rowCategory, { color: colors.mutedForeground }]}
                    >
                      {item.category}
                    </Text>
                  </View>

                  {/* Right: amount + edit icon */}
                  <View style={styles.rowRight}>
                    <Text style={[styles.rowAmount, { color: amtColor }]} numberOfLines={1}>
                      {isIncome ? "+" : "-"}
                      {formatBRL(item.amount)}
                    </Text>
                    {!selectionMode && (
                      <Feather
                        name="edit-2"
                        size={12}
                        color={colors.mutedForeground}
                        style={{ marginTop: 4 }}
                      />
                    )}
                  </View>
                </Pressable>
              );
            }}
            contentContainerStyle={{
              paddingBottom: insets.bottom + (selectionMode ? 100 : 120),
            }}
          />

          {/* ─ Footer ─ */}
          {selectionMode ? (
            /* Bulk action bar */
            <View
              style={[
                styles.footer,
                {
                  paddingBottom: insets.bottom + 16,
                  paddingTop: 12,
                  paddingHorizontal: 20,
                  backgroundColor: colors.card,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  flexDirection: "row",
                  gap: 12,
                },
              ]}
            >
              <Pressable
                onPress={clearSelection}
                style={[
                  styles.bulkCancelBtn,
                  { borderColor: colors.border, borderRadius: colors.radius },
                ]}
              >
                <Text style={[styles.bulkCancelText, { color: colors.foreground }]}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                onPress={() => selectedIds.size > 0 && setBulkSheetVisible(true)}
                style={[
                  styles.bulkEditBtn,
                  {
                    backgroundColor: selectedIds.size > 0 ? colors.primary : colors.secondary,
                    borderRadius: colors.radius,
                    flex: 1,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={16}
                  color={selectedIds.size > 0 ? "#000" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.bulkEditText,
                    { color: selectedIds.size > 0 ? "#000" : colors.mutedForeground },
                  ]}
                >
                  {selectedIds.size > 0
                    ? `Editar ${selectedIds.size} ${selectedIds.size === 1 ? "registro" : "registros"}`
                    : "Selecione registros"}
                </Text>
              </Pressable>
            </View>
          ) : (
            /* Normal confirm footer */
            <View
              style={[
                styles.footer,
                {
                  paddingBottom: insets.bottom + 16,
                  paddingTop: 16,
                  paddingHorizontal: 20,
                  backgroundColor: colors.background,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
                Revise e edite os dados antes de confirmar
              </Text>
              <KlaroButton
                title={`Confirmar ${records.length} ${records.length === 1 ? "transação" : "transações"}`}
                onPress={handleConfirm}
                loading={confirming}
                fullWidth
              />
              <Pressable
                onPress={handleDiscardUpload}
                disabled={deleteUploadMutation.isPending}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, alignItems: "center", paddingVertical: 4 }]}
              >
                <Text style={[styles.discardText, { color: colors.mutedForeground }]}>
                  Descartar upload
                </Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      {/* Single-record edit sheet */}
      <EditSheet
        record={editingRecord}
        categorySuggestions={categorySuggestions}
        onClose={() => setEditingRecord(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      {/* Bulk edit sheet */}
      <BulkEditSheet
        visible={bulkSheetVisible}
        count={selectedIds.size}
        categorySuggestions={categorySuggestions}
        onClose={() => setBulkSheetVisible(false)}
        onApply={handleBulkApply}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 32,
  },

  // header
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { padding: 4 },
  headerInfo: { flex: 1 },
  fileName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  recordCount: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  selectAllBtn: { fontSize: 13, fontFamily: "Inter_500Medium" },

  // processing
  processingRoot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 40,
  },
  processingIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  processingTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  processingFile: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    maxWidth: 260,
  },
  processingSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    alignItems: "center",
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },

  // list rows
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLeft: { flex: 1, gap: 3 },
  rowTopLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20 },
  pillText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  rowDesc: { fontSize: 14, fontFamily: "Inter_500Medium" },
  rowCategory: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textTransform: "capitalize",
  },
  rowRight: { alignItems: "flex-end" },
  rowAmount: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // footers
  footer: { gap: 10 },
  footerNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  bulkCancelBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bulkCancelText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  bulkEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 14,
  },
  bulkEditText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#000",
  },

  // empty
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },

  // sheet shared
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  kav: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
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
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  sheetTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  sheetSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },

  // edit fields
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  rowFields: { flexDirection: "row", gap: 12 },
  typeRow: {
    flexDirection: "row",
    padding: 4,
    gap: 4,
    borderRadius: 10,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  typeBtnLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  chips: { gap: 8, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  bulkNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
    fontStyle: "italic",
  },

  sheetActions: { gap: 12, marginTop: 4, paddingBottom: 8 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  deleteBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  discardText: { fontSize: 13, fontFamily: "Inter_400Regular", textDecorationLine: "underline" },
});
