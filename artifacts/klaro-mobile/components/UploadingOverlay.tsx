import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Animated, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const UPLOAD_PHASES = [
  { after: 0,  title: "Enviando arquivo…",       sub: "Aguarde enquanto o arquivo é enviado." },
  { after: 4,  title: "Analisando com IA…",      sub: "A IA está lendo e identificando as transações." },
  { after: 15, title: "Extraindo transações…",   sub: "Arquivos grandes podem levar alguns instantes." },
  { after: 35, title: "Quase lá…",               sub: "Finalizando a extração. Obrigado pela paciência!" },
  { after: 60, title: "Ainda processando…",      sub: "Documento extenso. Continue aguardando." },
];

export function UploadingOverlay({
  fileName,
  onCancel,
}: {
  fileName: string;
  onCancel?: () => void;
}) {
  const colors = useColors();
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1800, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [spin, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const phase = UPLOAD_PHASES.reduce(
    (cur, p) => (elapsed >= p.after ? p : cur),
    UPLOAD_PHASES[0]
  );

  return (
    <Modal visible transparent animationType="fade">
      <View style={[styles.root, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Animated.View style={{ transform: [{ scale: pulse }], marginBottom: 16 }}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: `${colors.primary}20`, borderRadius: 40 },
              ]}
            >
              <MaterialCommunityIcons
                name="file-upload-outline"
                size={40}
                color={colors.primary}
              />
            </View>
          </Animated.View>

          <Text style={[styles.title, { color: colors.foreground }]}>
            {phase.title}
          </Text>
          {fileName ? (
            <Text
              style={[styles.fileName, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {fileName}
            </Text>
          ) : null}
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {phase.sub}
          </Text>

          <Animated.View style={{ transform: [{ rotate }], marginTop: 20 }}>
            <Feather name="loader" size={22} color={colors.primary} />
          </Animated.View>

          {elapsed >= 4 && (
            <Text style={[styles.timer, { color: colors.mutedForeground }]}>
              {elapsed}s
            </Text>
          )}

          {onCancel && (
            <Pressable
              onPress={() =>
                Alert.alert(
                  "Cancelar upload?",
                  "O envio será interrompido.",
                  [
                    { text: "Continuar", style: "cancel" },
                    { text: "Cancelar upload", style: "destructive", onPress: onCancel },
                  ]
                )
              }
              style={({ pressed }) => [
                styles.cancelBtn,
                {
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Feather name="x" size={13} color={colors.mutedForeground} />
              <Text style={[styles.cancelBtnText, { color: colors.mutedForeground }]}>
                Cancelar upload
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  card: {
    width: "100%",
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
  },
  iconWrap: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  fileName: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
    maxWidth: 220,
  },
  sub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },
  timer: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 10,
    opacity: 0.5,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
