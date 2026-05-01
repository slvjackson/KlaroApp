import { Feather } from "@expo/vector-icons";
import { useListUploads } from "@workspace/api-client-react";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { getApiBaseUrl } from "@/constants/api";
import { useAuth } from "@/contexts/AuthContext";
import { UploadingOverlay } from "@/components/UploadingOverlay";

function UploadItem({
  item,
}: {
  item: {
    id: number;
    fileName: string;
    fileType: string;
    processingStatus: string;
    parsedRecordCount: number;
    createdAt: string;
  };
}) {
  const colors = useColors();
  const isDone = item.processingStatus === "done";
  const isFailed = item.processingStatus === "failed";

  return (
    <Pressable
      onPress={() => {
        if (isDone) router.push(`/review/${item.id}`);
      }}
      style={({ pressed }) => [
        styles.uploadItem,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.fileIcon,
          {
            backgroundColor: `${colors.primary}22`,
            borderRadius: 10,
          },
        ]}
      >
        <Feather name="file-text" size={20} color={colors.primary} />
      </View>
      <View style={styles.fileInfo}>
        <Text
          style={[styles.fileName, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {item.fileName}
        </Text>
        <Text style={[styles.fileMeta, { color: colors.mutedForeground }]}>
          {item.parsedRecordCount} registros ·{" "}
          {new Date(item.createdAt).toLocaleDateString("pt-BR")}
        </Text>
      </View>
      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor: isDone
              ? `${colors.income}22`
              : isFailed
                ? `${colors.expense}22`
                : `${colors.primary}22`,
            borderRadius: 8,
          },
        ]}
      >
        <Text
          style={[
            styles.statusText,
            {
              color: isDone
                ? colors.income
                : isFailed
                  ? colors.expense
                  : colors.primary,
            },
          ]}
        >
          {isDone ? "Pronto" : isFailed ? "Falhou" : "Processando"}
        </Text>
      </View>
    </Pressable>
  );
}

export default function UploadScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState("");
  const [uploadError, setUploadError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const { data: uploads, isLoading, refetch } = useListUploads();

  const baseUrl = getApiBaseUrl();

  async function uploadFile(uri: string, name: string, mimeType: string) {
    setUploading(true);
    setUploadingFileName(name);
    setUploadError("");
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const formData = new FormData();
      formData.append("file", { uri, name, type: mimeType } as unknown as Blob);

      const controller = new AbortController();
      controllerRef.current = controller;
      const timeoutId = setTimeout(() => controller.abort(), 4 * 60 * 1000);
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/api/uploads`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
        controllerRef.current = null;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setUploadError(data.error ?? "Erro ao enviar arquivo.");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      const upload = await res.json();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refetch();
      router.push(`/review/${upload.id}`);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // user-cancelled — no error
      } else {
        setUploadError(`Erro: ${err instanceof Error ? err.message : String(err)}`);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      setUploadError("Permissão de câmera negada.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await uploadFile(asset.uri, `foto_${Date.now()}.jpg`, asset.mimeType ?? "image/jpeg");
  }

  async function handleGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setUploadError("Permissão de galeria negada.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const name = asset.uri.split("/").pop() ?? `imagem_${Date.now()}.jpg`;
    await uploadFile(asset.uri, name, asset.mimeType ?? "image/jpeg");
  }

  async function handleFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const file = result.assets[0];
    await uploadFile(file.uri, file.name, file.mimeType ?? "application/octet-stream");
  }

  function handleChooseSource() {
    setUploadError("");
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancelar", "Câmera", "Galeria de Fotos", "Arquivo"],
          cancelButtonIndex: 0,
        },
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

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Upload CTA */}
      <View
        style={[
          styles.uploadZone,
          {
            marginTop: topPad + 16,
            marginHorizontal: 20,
            backgroundColor: colors.card,
            borderRadius: colors.radius,
            borderWidth: 1,
            borderColor: colors.border,
            borderStyle: "dashed",
          },
        ]}
      >
        {(
          <>
            <View
              style={[
                styles.uploadIconWrap,
                {
                  backgroundColor: `${colors.primary}22`,
                  borderRadius: 20,
                },
              ]}
            >
              <Feather name="upload-cloud" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.uploadTitle, { color: colors.foreground }]}>
              Enviar arquivo
            </Text>
            <Text
              style={[styles.uploadSub, { color: colors.mutedForeground }]}
            >
              CSV, XLSX, PDF, OFX ou imagem
            </Text>
            <Pressable
              onPress={handleChooseSource}
              disabled={uploading}
              style={({ pressed }) => [
                styles.uploadBtn,
                {
                  backgroundColor: colors.primary,
                  borderRadius: colors.radius,
                  opacity: uploading ? 0.5 : pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.uploadBtnText,
                  { color: colors.primaryForeground },
                ]}
              >
                Escolher origem
              </Text>
            </Pressable>
          </>
        )}
        {uploadError ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {uploadError}
          </Text>
        ) : null}
      </View>

      {/* Upload history */}
      <Text
        style={[
          styles.historyTitle,
          { color: colors.foreground, marginHorizontal: 20, marginTop: 24 },
        ]}
      >
        Histórico
      </Text>

      {/* Full-screen upload overlay */}
      {uploading && (
        <UploadingOverlay
          fileName={uploadingFileName}
          onCancel={() => controllerRef.current?.abort()}
        />
      )}

      {/* Android source picker (iOS uses ActionSheetIOS) */}
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
            { icon: "image" as const, label: "Galeria de Fotos", action: () => { setShowSourcePicker(false); handleGallery(); } },
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

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={uploads ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <UploadItem item={item} />}
          scrollEnabled={!!(uploads && uploads.length > 0)}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100,
            },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="folder" size={32} color={colors.mutedForeground} />
              <Text
                style={[styles.emptyText, { color: colors.mutedForeground }]}
              >
                Nenhum upload ainda
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
  uploadZone: {
    padding: 28,
    alignItems: "center",
    gap: 10,
  },
  uploadIconWrap: {
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  uploadSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  uploadBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  uploadBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  historyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  list: {
    gap: 8,
    paddingHorizontal: 20,
  },
  loadingBox: {
    paddingTop: 40,
    alignItems: "center",
  },
  uploadItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  fileIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: {
    flex: 1,
    gap: 3,
  },
  fileName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  fileMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  emptyBox: {
    paddingTop: 40,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sourceSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 4,
  },
  sourceTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  sourceOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  sourceOptionText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
});

