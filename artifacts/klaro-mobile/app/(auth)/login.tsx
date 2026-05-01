import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
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
import { KlaroInput } from "@/components/KlaroInput";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getApiBaseUrl } from "@/constants/api";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordRef = useRef<TextInput>(null);

  const baseUrl = getApiBaseUrl();

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Preencha todos os campos.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${baseUrl}/api/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao entrar. Tente novamente.");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await login(data.token, data.user);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/");
    } catch {
      setError("Erro de conexão. Verifique sua internet.");
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
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 40),
            paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 24),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View
            style={[
              styles.logoBox,
              { backgroundColor: colors.primary, borderRadius: 18 },
            ]}
          >
            <Text style={[styles.logoText, { color: colors.primaryForeground }]}>
              K
            </Text>
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Klaro
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Gestão financeira para o seu negócio
          </Text>
        </View>

        <View style={styles.form}>
          <KlaroInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <View>
            <KlaroInput
              ref={passwordRef}
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
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

          {error ? (
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              {error}
            </Text>
          ) : null}

          <Pressable
            onPress={() => router.push("/(auth)/forgot-password")}
            style={styles.forgotLink}
          >
            <Text style={[styles.forgotText, { color: colors.mutedForeground }]}>
              Esqueci minha senha
            </Text>
          </Pressable>

          <KlaroButton
            title="Entrar"
            onPress={handleLogin}
            loading={loading}
            fullWidth
          />

          <Pressable
            onPress={() => router.push("/(auth)/signup")}
            style={styles.link}
          >
            <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
              Não tem conta?{" "}
              <Text style={{ color: colors.primary }}>Criar conta</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    gap: 40,
  },
  header: {
    alignItems: "center",
    gap: 12,
  },
  logoBox: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  form: {
    gap: 16,
  },
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
  link: {
    alignItems: "center",
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  forgotLink: {
    alignSelf: "flex-end",
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textDecorationLine: "underline",
  },
});
