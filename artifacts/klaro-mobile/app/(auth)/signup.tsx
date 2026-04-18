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

export default function SignupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const baseUrl = getApiBaseUrl();

  async function handleSignup() {
    if (!name.trim() || !email.trim() || !password) {
      setError("Preencha todos os campos.");
      return;
    }
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${baseUrl}/api/auth/token/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao criar conta. Tente novamente.");
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return;
      }

      await login(data.token, data.user);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/onboarding");
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
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Criar conta
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Comece a controlar seu negócio
          </Text>
        </View>

        <View style={styles.form}>
          <KlaroInput
            label="Nome"
            value={name}
            onChangeText={setName}
            placeholder="Seu nome"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />

          <KlaroInput
            ref={emailRef}
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
              placeholder="Mín. 6 caracteres"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={handleSignup}
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

          <KlaroButton
            title="Criar conta"
            onPress={handleSignup}
            loading={loading}
            fullWidth
          />

          <Pressable onPress={() => router.back()} style={styles.link}>
            <Text style={[styles.linkText, { color: colors.mutedForeground }]}>
              Já tem conta?{" "}
              <Text style={{ color: colors.primary }}>Entrar</Text>
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
    gap: 8,
  },
  backBtn: {
    alignSelf: "flex-start",
    padding: 4,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    alignSelf: "flex-start",
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    alignSelf: "flex-start",
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
});
