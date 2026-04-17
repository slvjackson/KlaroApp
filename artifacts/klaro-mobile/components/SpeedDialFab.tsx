import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiBaseUrl } from "@/constants/api";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

interface SpeedDialFabProps {
  onAdd: () => void;
}

export function SpeedDialFab({ onAdd }: SpeedDialFabProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [fabOpen, setFabOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const baseUrl = getApiBaseUrl();
  const bottom = insets.bottom + (Platform.OS === "web" ? 34 : 0) + 84;

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
      type: [
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/pdf",
        "image/*",
      ],
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
        },
      );
    } else {
      setShowSourcePicker(true);
    }
  }

  return (
    <>
      {/* Backdrop + secondary actions */}
      {fabOpen && (
        <>
          <Pressable
            style={[StyleSheet.absoluteFill, { zIndex: 98 }]}
            onPress={() => setFabOpen(false)}
          />
          {/* Upload action */}
          <View style={[styles.actionRow, { bottom: bottom + 132 }]}>
            <Text
              style={[
                styles.actionLabel,
                { backgroundColor: colors.card, color: colors.foreground },
              ]}
            >
              {uploading ? "Enviando…" : "Upload"}
            </Text>
            <Pressable
              onPress={() => {
                setFabOpen(false);
                handleChooseSource();
              }}
              disabled={uploading}
              style={[
                styles.secondary,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <Feather name="upload" size={20} color={colors.foreground} />
              )}
            </Pressable>
          </View>
          {/* Add action */}
          <View style={[styles.actionRow, { bottom: bottom + 66 }]}>
            <Text
              style={[
                styles.actionLabel,
                { backgroundColor: colors.card, color: colors.foreground },
              ]}
            >
              Adicionar
            </Text>
            <Pressable
              onPress={() => {
                setFabOpen(false);
                onAdd();
              }}
              style={[
                styles.secondary,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Feather name="edit-2" size={20} color={colors.foreground} />
            </Pressable>
          </View>
        </>
      )}

      {/* Main FAB */}
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
            bottom,
            transform: [{ scale: pressed ? 0.94 : 1 }, { rotate: fabOpen ? "45deg" : "0deg" }],
            shadowColor: colors.primary,
          },
        ]}
      >
        <Feather name="plus" size={24} color={colors.primaryForeground} />
      </Pressable>

      {/* Android source picker */}
      <Modal
        visible={showSourcePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSourcePicker(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowSourcePicker(false)}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
            Escolher origem
          </Text>
          {(
            [
              {
                icon: "camera" as const,
                label: "Câmera",
                action: () => {
                  setShowSourcePicker(false);
                  handleCamera();
                },
              },
              {
                icon: "image" as const,
                label: "Fotos",
                action: () => {
                  setShowSourcePicker(false);
                  handleGallery();
                },
              },
              {
                icon: "file-text" as const,
                label: "Arquivo",
                action: () => {
                  setShowSourcePicker(false);
                  handleFile();
                },
              },
            ] as const
          ).map(({ icon, label, action }) => (
            <Pressable
              key={label}
              onPress={action}
              style={({ pressed }) => [
                styles.sheetOption,
                { backgroundColor: pressed ? colors.secondary : "transparent" },
              ]}
            >
              <Feather name={icon} size={20} color={colors.foreground} />
              <Text style={[styles.sheetOptionText, { color: colors.foreground }]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
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
  actionRow: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 99,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: "hidden",
  },
  secondary: {
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 4,
  },
  sheetTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 8,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 10,
  },
  sheetOptionText: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
});
