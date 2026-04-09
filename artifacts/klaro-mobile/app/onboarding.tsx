import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
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
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getApiBaseUrl } from "@/constants/api";

const SEGMENTS = [
  { key: "varejo", label: "Varejo / Loja" },
  { key: "alimentacao", label: "Alimentação" },
  { key: "servicos", label: "Serviços" },
  { key: "saude", label: "Saúde / Beleza" },
  { key: "educacao", label: "Educação" },
  { key: "tecnologia", label: "Tecnologia" },
  { key: "construcao", label: "Construção" },
  { key: "transporte", label: "Transporte" },
  { key: "agro", label: "Agronegócio" },
  { key: "outro", label: "Outro" },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, updateUser } = useAuth();

  const [businessName, setBusinessName] = useState(user?.businessProfile?.businessName ?? "");
  const [segment, setSegment] = useState(user?.businessProfile?.segment ?? "");
  const [loading, setLoading] = useState(false);

  const baseUrl = getApiBaseUrl();

  async function handleContinue() {
    if (!segment) {
      Alert.alert("Selecione um segmento", "Escolha o tipo do seu negócio para continuar.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          businessProfile: {
            ...(user?.businessProfile ?? {}),
            businessName: businessName.trim() || undefined,
            segment,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Erro", data.error ?? "Não foi possível salvar.");
        return;
      }

      await updateUser(data.user);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/");
    } catch {
      Alert.alert("Erro de conexão", "Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function handleSkip() {
    router.replace("/(tabs)/");
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 40),
          paddingBottom: insets.bottom + 40,
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.emoji]}>👋</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Bem-vindo ao Klaro!
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Conte um pouco sobre seu negócio para personalizarmos sua experiência.
        </Text>
      </View>

      {/* Business name */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Nome do negócio{" "}
          <Text style={{ color: colors.primary, fontSize: 11 }}>(opcional)</Text>
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.card,
            },
          ]}
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Ex: Lanchonete da Maria"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
          returnKeyType="done"
        />
      </View>

      {/* Segment picker */}
      <View style={styles.section}>
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Qual o segmento do seu negócio?{" "}
          <Text style={{ color: colors.destructive }}>*</Text>
        </Text>
        <View style={styles.chipGrid}>
          {SEGMENTS.map((s) => {
            const selected = segment === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSegment(s.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.card,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? "#000" : colors.foreground },
                  ]}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <KlaroButton
        title="Continuar"
        onPress={handleContinue}
        loading={loading}
        fullWidth
      />

      <Pressable onPress={handleSkip} style={styles.skipBtn}>
        <Text style={[styles.skipText, { color: colors.mutedForeground }]}>
          Pular por enquanto
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    gap: 28,
  },
  header: { alignItems: "center", gap: 10 },
  emoji: { fontSize: 40 },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  section: { gap: 10 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
