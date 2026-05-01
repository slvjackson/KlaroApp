import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KlaroButton } from "@/components/KlaroButton";
import { KlaroInput } from "@/components/KlaroInput";
import { useColors } from "@/hooks/useColors";
import { getApiBaseUrl } from "@/constants/api";

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const baseUrl = getApiBaseUrl();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!email.trim()) {
      setError("Informe seu e-mail.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.ok) {
        setSent(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const data = await res.json();
        setError(data.error ?? "Erro ao enviar. Tente novamente.");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setError("Erro de conexão. Verifique sua internet.");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
        </Pressable>

        {sent ? (
          <View style={styles.successContainer}>
            <View style={[styles.iconBox, { backgroundColor: `${colors.primary}22` }]}>
              <Feather name="check-circle" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>E-mail enviado!</Text>
            <Text style={[styles.desc, { color: colors.mutedForeground }]}>
              Se o e-mail estiver cadastrado, você receberá um link para redefinir sua senha em breve.{"\n\n"}
              Verifique também sua caixa de spam.
            </Text>
            <KlaroButton
              title="Voltar ao login"
              onPress={() => router.replace("/(auth)/login")}
              fullWidth
            />
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>Recuperar senha</Text>
              <Text style={[styles.desc, { color: colors.mutedForeground }]}>
                Informe seu e-mail e enviaremos um link para criar uma nova senha.
              </Text>
            </View>

            <KlaroInput
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
            />

            {error ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            ) : null}

            <KlaroButton
              title="Enviar link"
              onPress={handleSubmit}
              loading={loading}
              fullWidth
            />

            <Pressable onPress={() => router.back()} style={styles.link}>
              <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
                Lembrou a senha?{" "}
                <Text style={{ color: colors.primary }}>Entrar</Text>
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  backBtn: {
    alignSelf: "flex-start",
    padding: 4,
    marginBottom: 32,
  },
  header: { gap: 8, marginBottom: 8 },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  desc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  form: { gap: 16 },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  link: { alignItems: "center", paddingVertical: 8 },
  linkText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingTop: 40,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
