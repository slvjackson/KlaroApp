import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getApiBaseUrl } from "@/constants/api";

export function VerifyEmailBanner() {
  const colors = useColors();
  const { user, token, refreshUser } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || user.emailVerifiedAt || dismissed) return null;

  async function handleResend() {
    setSending(true);
    try {
      await fetch(`${getApiBaseUrl()}/api/auth/resend-verification`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setSent(true);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // silently ignore
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.banner, { backgroundColor: `${colors.primary}15`, borderBottomColor: `${colors.primary}30` }]}>
      <Feather name="mail" size={14} color={colors.primary} style={styles.icon} />
      <Text style={[styles.text, { color: colors.mutedForeground }]}>
        Confirme seu e-mail.{" "}
        {sent ? (
          <Text style={{ color: colors.primary }}>Link enviado!</Text>
        ) : (
          <Text
            style={{ color: colors.primary, textDecorationLine: "underline" }}
            onPress={sending ? undefined : handleResend}
          >
            {sending ? "Enviando…" : "Reenviar"}
          </Text>
        )}
      </Text>
      <Pressable onPress={() => setDismissed(true)} hitSlop={8}>
        <Feather name="x" size={14} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  icon: {
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 12.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
});
