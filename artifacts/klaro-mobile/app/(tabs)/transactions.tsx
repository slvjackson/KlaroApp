import { Feather } from "@expo/vector-icons";
import { useListTransactions } from "@workspace/api-client-react";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  FlatList,
  Modal,
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
import { getApiBaseUrl } from "@/constants/api";
import { useAuth } from "@/contexts/AuthContext";

type FilterType = "all" | "income" | "expense";

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [filter, setFilter] = useState<FilterType>("all");
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const { data: transactions, isLoading, refetch } = useListTransactions({
    type: filter === "all" ? undefined : filter,
    limit: 100,
  });

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const baseUrl = getApiBaseUrl();

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
        <View style={styles.headerBtns}>
          <Pressable
            onPress={openAdd}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: colors.secondary,
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
            onPress={handleChooseSource}
            disabled={uploading}
            style={({ pressed }) => [
              styles.uploadBtn,
              {
                backgroundColor: pressed ? `${colors.primary}dd` : colors.primary,
                borderRadius: colors.radius,
                opacity: uploading ? 0.6 : 1,
              },
            ]}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                <Feather name="upload" size={15} color={colors.primaryForeground} />
                <Text style={[styles.uploadBtnText, { color: colors.primaryForeground }]}>Upload</Text>
              </>
            )}
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
                  { color: active ? colors.primaryForeground : colors.mutedForeground },
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
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 },
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
  headerBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, minWidth: 88, justifyContent: "center" },
  uploadBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  filterBar: { flexDirection: "row", paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { gap: 1, paddingTop: 8, paddingHorizontal: 16 },
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
