import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
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

export default function ResetPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const baseUrl = getApiBaseUrl();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (password.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (!token) {
      setError("Link inválido. Solicite um novo e-mail.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setError(data.error ?? "Erro ao redefinir senha. Tente novamente.");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      setError("Erro de conexão. Verifique sua internet.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <View style={[styles.root, styles.centered, { backgroundColor: colors.background }]}>
        <View style={[styles.iconBox, { backgroundColor: `${colors.destructive}22` }]}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Link inválido</Text>
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>
          Este link de recuperação é inválido. Solicite um novo e-mail.
        </Text>
        <KlaroButton
          title="Voltar ao login"
          onPress={() => router.replace("/(auth)/login")}
          fullWidth
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.mutedForeground} />
        </Pressable>

        {done ? (
          <View style={styles.successContainer}>
            <View style={[styles.iconBox, { backgroundColor: `${colors.primary}22` }]}>
              <Feather name="check-circle" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Senha redefinida!</Text>
            <Text style={[styles.desc, { color: colors.mutedForeground }]}>
              Sua senha foi alterada com sucesso. Faça login com a nova senha.
            </Text>
            <KlaroButton
              title="Ir para o login"
              onPress={() => router.replace("/(auth)/login")}
              fullWidth
            />
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>Nova senha</Text>
              <Text style={[styles.desc, { color: colors.mutedForeground }]}>
                Escolha uma nova senha para sua conta.
              </Text>
            </View>

            <View>
              <KlaroInput
                label="Nova senha"
                value={password}
                onChangeText={setPassword}
                placeholder="Mín. 6 caracteres"
                secureTextEntry={!showPassword}
                returnKeyType="next"
                autoComplete="new-password"
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                style={styles.eyeBtn}
              >
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>

            <KlaroInput
              label="Confirmar senha"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repita a senha"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              autoComplete="new-password"
            />

            {error ? (
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            ) : null}

            <KlaroButton
              title="Salvar nova senha"
              onPress={handleSubmit}
              loading={loading}
              fullWidth
            />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
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
    textAlign: "center",
  },
  desc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    textAlign: "center",
  },
  form: { gap: 16 },
  eyeBtn: {
    position: "absolute",
    right: 16,
    bottom: 14,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
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
