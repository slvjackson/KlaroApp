import { Feather } from "@expo/vector-icons";
import { useGetBillingStatus } from "@workspace/api-client-react";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export const TRIAL_WELCOME_KEY = "trial_welcome_shown_date";

export default function TrialWelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: billing } = useGetBillingStatus();

  const days = billing?.trialDaysLeft ?? 7;
  const isLastDay = days <= 1;
  const trialEndsAt = billing?.trialEndsAt;

  const expiryTime = trialEndsAt
    ? new Date(trialEndsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : null;

  // Pulse animation for the countdown number
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  const handleSubscribe = () => router.replace("/billing");
  const handleSkip     = () => router.replace("/(tabs)/");

  const accentColor = isLastDay ? "#ef4444" : colors.primary;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>

      {/* Skip (hidden on last day) */}
      {!isLastDay && (
        <Pressable onPress={handleSkip} style={styles.skipBtn} hitSlop={12}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Pular</Text>
        </Pressable>
      )}

      <View style={styles.body}>
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: `${accentColor}18` }]}>
          <Text style={styles.giftEmoji}>{isLastDay ? "⏰" : "🎁"}</Text>
        </View>

        {/* Headline */}
        <Text style={[styles.headline, { color: colors.foreground }]}>
          {isLastDay
            ? "Seu teste termina amanhã"
            : "Presente para você!"}
        </Text>

        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          {isLastDay
            ? `Às ${expiryTime ?? "23:59"} você perde acesso à plataforma. Não deixe seu negócio sem controle.`
            : "Você ganhou acesso completo ao Klaro gratuitamente. Aproveite para conhecer tudo e ver como podemos transformar seu controle financeiro."}
        </Text>

        {/* Countdown */}
        <Animated.View style={[styles.countdownWrap, { borderColor: `${accentColor}30`, backgroundColor: `${accentColor}0c`, transform: [{ scale: pulse }] }]}>
          <Text style={[styles.countdownNumber, { color: accentColor }]}>{days}</Text>
          <Text style={[styles.countdownLabel, { color: accentColor }]}>
            {days === 1 ? "dia restante" : "dias restantes"}
          </Text>
        </Animated.View>

        {isLastDay && (
          <View style={[styles.urgentBanner, { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }]}>
            <Feather name="alert-triangle" size={14} color="#ef4444" />
            <Text style={styles.urgentText}>
              Seu acesso expira amanhã às <Text style={styles.urgentBold}>{expiryTime ?? "23:59"}</Text>
            </Text>
          </View>
        )}

        {/* Features teaser */}
        {!isLastDay && (
          <View style={styles.featureList}>
            {[
              "Insights gerados por IA sobre seu negócio",
              "Upload de extratos com extração automática",
              "Chat financeiro inteligente",
            ].map((f) => (
              <View key={f} style={styles.featureRow}>
                <Feather name="check-circle" size={14} color={colors.primary} style={{ marginTop: 1 }} />
                <Text style={[styles.featureText, { color: colors.mutedForeground }]}>{f}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* CTAs */}
      <View style={styles.ctaWrap}>
        <Pressable
          onPress={handleSubscribe}
          style={({ pressed }) => [
            styles.ctaPrimary,
            { backgroundColor: accentColor, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.ctaPrimaryText}>
            {isLastDay ? "Garantir meu acesso agora" : "Assinar e garantir acesso"}
          </Text>
        </Pressable>

        {isLastDay ? (
          <Pressable onPress={handleSkip} style={styles.ctaSecondary} hitSlop={8}>
            <Text style={[styles.ctaSecondaryText, { color: colors.mutedForeground }]}>
              Continuar por hoje
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleSkip} style={styles.ctaSecondary} hitSlop={8}>
            <Text style={[styles.ctaSecondaryText, { color: colors.mutedForeground }]}>
              Explorar primeiro
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, paddingHorizontal: 24 },
  skipBtn:       { alignSelf: "flex-end" },
  skipText:      { fontSize: 13, fontFamily: "Inter_400Regular" },
  body:          { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  iconWrap:      { width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  giftEmoji:     { fontSize: 42 },
  headline:      { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  sub:           { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22, paddingHorizontal: 8 },
  countdownWrap: { borderWidth: 1.5, borderRadius: 24, paddingHorizontal: 40, paddingVertical: 20, alignItems: "center" },
  countdownNumber: { fontSize: 56, fontFamily: "Inter_700Bold", lineHeight: 64 },
  countdownLabel:  { fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 2 },
  urgentBanner:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  urgentText:    { fontSize: 13, fontFamily: "Inter_400Regular", color: "#ef4444", flex: 1 },
  urgentBold:    { fontFamily: "Inter_600SemiBold" },
  featureList:   { gap: 10, alignSelf: "stretch" },
  featureRow:    { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  featureText:   { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 19 },
  ctaWrap:       { gap: 12 },
  ctaPrimary:    { paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  ctaPrimaryText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#09090b" },
  ctaSecondary:  { alignItems: "center", paddingVertical: 6 },
  ctaSecondaryText: { fontSize: 13, fontFamily: "Inter_400Regular", textDecorationLine: "underline" },
});
