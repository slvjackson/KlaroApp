import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, type BusinessProfile } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getApiBaseUrl } from "@/constants/api";

export const ONBOARDING_KEY = "klaro_onboarding_done_v1";

const { width: SCREEN_W } = Dimensions.get("window");

const SEGMENTS = [
  { key: "varejo", label: "Varejo / Loja", icon: "shopping-bag" as const },
  { key: "alimentacao", label: "Alimentação", icon: "coffee" as const },
  { key: "servicos", label: "Serviços", icon: "tool" as const },
  { key: "saude", label: "Saúde / Beleza", icon: "heart" as const },
  { key: "tecnologia", label: "Tecnologia", icon: "cpu" as const },
  { key: "construcao", label: "Construção", icon: "home" as const },
  { key: "transporte", label: "Transporte", icon: "truck" as const },
  { key: "agro", label: "Agronegócio", icon: "sun" as const },
  { key: "educacao", label: "Educação", icon: "book" as const },
  { key: "outro", label: "Outro", icon: "more-horizontal" as const },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, updateUser } = useAuth();
  const baseUrl = getApiBaseUrl();

  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [segment, setSegment] = useState("");
  const [revenueGoal, setRevenueGoal] = useState("");
  const [saving, setSaving] = useState(false);

  const flatRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const TOTAL_STEPS = 4; // welcome, business, goals, done

  function goTo(next: number) {
    Keyboard.dismiss();
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setStep(next);
    flatRef.current?.scrollToIndex({ index: next, animated: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  async function handleFinish() {
    setSaving(true);
    try {
      const profile: BusinessProfile = {
        businessName: businessName.trim() || undefined,
        segment: segment || undefined,
        monthlyRevenueGoal: revenueGoal ? Number(revenueGoal.replace(",", ".")) : undefined,
      };
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ businessProfile: profile }),
      });
      if (res.ok) {
        const data = await res.json();
        await updateUser(data.user);
      }
    } catch {
      // Non-critical — user can fill in profile later
    } finally {
      setSaving(false);
      await AsyncStorage.setItem(ONBOARDING_KEY, "done");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)/");
    }
  }

  // ── Step renderers ─────────────────────────────────────────────────────────

  function renderWelcome() {
    return (
      <View style={[s.page, { width: SCREEN_W }]}>
        <View style={[s.iconCircle, { backgroundColor: `${colors.primary}22` }]}>
          <Feather name="zap" size={40} color={colors.primary} />
        </View>
        <Text style={[s.title, { color: colors.foreground }]}>
          Olá, {user?.name?.split(" ")[0]}! 👋
        </Text>
        <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
          Bem-vindo ao Klaro. Vamos configurar seu negócio em menos de 2 minutos para que os insights sejam certeiros.
        </Text>
        <Pressable
          onPress={() => goTo(1)}
          style={[s.primaryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
        >
          <Text style={[s.primaryBtnText, { color: colors.primaryForeground }]}>Vamos começar</Text>
          <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
        </Pressable>
        <Pressable onPress={handleFinish} style={{ marginTop: 12 }}>
          <Text style={[s.skipText, { color: colors.mutedForeground }]}>Pular por agora</Text>
        </Pressable>
      </View>
    );
  }

  function renderBusiness() {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[s.page, { width: SCREEN_W }]}
      >
        <Text style={[s.stepLabel, { color: colors.primary }]}>Passo 1 de 2</Text>
        <Text style={[s.title, { color: colors.foreground }]}>Seu negócio</Text>
        <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
          Como se chama seu negócio e qual é o seu segmento?
        </Text>

        <View style={s.fieldGroup}>
          <Text style={[s.label, { color: colors.mutedForeground }]}>Nome do negócio</Text>
          <TextInput
            style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Ex: Lanchonete da Maria"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
            returnKeyType="done"
          />
        </View>

        <View style={s.fieldGroup}>
          <Text style={[s.label, { color: colors.mutedForeground }]}>Segmento</Text>
          <View style={s.chipGrid}>
            {SEGMENTS.map((seg) => {
              const sel = segment === seg.key;
              return (
                <Pressable
                  key={seg.key}
                  onPress={() => setSegment(sel ? "" : seg.key)}
                  style={[
                    s.chip,
                    {
                      backgroundColor: sel ? colors.primary : colors.secondary,
                      borderColor: sel ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather name={seg.icon} size={13} color={sel ? colors.primaryForeground : colors.mutedForeground} />
                  <Text style={[s.chipText, { color: sel ? colors.primaryForeground : colors.foreground }]}>
                    {seg.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          onPress={() => goTo(2)}
          style={[s.primaryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
        >
          <Text style={[s.primaryBtnText, { color: colors.primaryForeground }]}>Continuar</Text>
          <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
        </Pressable>
      </KeyboardAvoidingView>
    );
  }

  function renderGoals() {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[s.page, { width: SCREEN_W }]}
      >
        <Text style={[s.stepLabel, { color: colors.primary }]}>Passo 2 de 2</Text>
        <Text style={[s.title, { color: colors.foreground }]}>Sua meta</Text>
        <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
          Qual é a meta de receita mensal do seu negócio? Isso calibra os insights de forma personalizada.
        </Text>

        <View style={s.fieldGroup}>
          <Text style={[s.label, { color: colors.mutedForeground }]}>Meta de receita mensal (R$)</Text>
          <TextInput
            style={[s.input, s.inputLarge, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={revenueGoal}
            onChangeText={setRevenueGoal}
            placeholder="Ex: 20.000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
          />
          <Text style={[s.inputHint, { color: colors.mutedForeground }]}>
            Você pode ajustar essa meta a qualquer momento no perfil.
          </Text>
        </View>

        <Pressable
          onPress={() => goTo(3)}
          style={[s.primaryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
        >
          <Text style={[s.primaryBtnText, { color: colors.primaryForeground }]}>Continuar</Text>
          <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
        </Pressable>
        <Pressable onPress={() => goTo(3)} style={{ marginTop: 12 }}>
          <Text style={[s.skipText, { color: colors.mutedForeground }]}>Definir depois</Text>
        </Pressable>
      </KeyboardAvoidingView>
    );
  }

  function renderDone() {
    return (
      <View style={[s.page, { width: SCREEN_W }]}>
        <View style={[s.iconCircle, { backgroundColor: `${colors.income}22` }]}>
          <Feather name="check-circle" size={40} color={colors.income} />
        </View>
        <Text style={[s.title, { color: colors.foreground }]}>Tudo pronto!</Text>
        <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
          Seu perfil está configurado. Agora é hora de registrar suas primeiras transações e deixar o Klaro trabalhar por você.
        </Text>
        <View style={[s.tipCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Feather name="zap" size={16} color={colors.primary} />
          <Text style={[s.tipText, { color: colors.mutedForeground }]}>
            Dica: adicione transações tocando no{" "}
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>+</Text>
            {" "}em qualquer tela.
          </Text>
        </View>
        <Pressable
          onPress={handleFinish}
          disabled={saving}
          style={[s.primaryBtn, { backgroundColor: colors.primary, borderRadius: colors.radius, opacity: saving ? 0.7 : 1 }]}
        >
          <Text style={[s.primaryBtnText, { color: colors.primaryForeground }]}>
            {saving ? "Carregando..." : "Ir para o Dashboard"}
          </Text>
          {!saving && <Feather name="arrow-right" size={18} color={colors.primaryForeground} />}
        </Pressable>
      </View>
    );
  }

  const steps = [renderWelcome, renderBusiness, renderGoals, renderDone];

  return (
    <View style={[s.root, { backgroundColor: colors.background, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
      {/* Progress dots */}
      {step > 0 && step < 3 && (
        <View style={s.dots}>
          {[1, 2].map((i) => (
            <View
              key={i}
              style={[s.dot, { backgroundColor: step >= i ? colors.primary : colors.border }]}
            />
          ))}
        </View>
      )}

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          ref={flatRef}
          data={steps}
          renderItem={({ item: render }) => render()}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  page: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "center",
    gap: 0,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
    alignSelf: "center",
  },
  stepLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5, lineHeight: 36, marginBottom: 12 },
  subtitle: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 23, marginBottom: 28 },
  fieldGroup: { gap: 8, marginBottom: 20 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  inputLarge: { fontSize: 22, fontFamily: "Inter_600SemiBold", textAlign: "center", paddingVertical: 18 },
  inputHint: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    marginTop: 8,
  },
  primaryBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  skipText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  tipCard: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderWidth: 1, marginBottom: 24 },
  tipText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
