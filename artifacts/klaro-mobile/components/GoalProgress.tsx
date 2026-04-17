import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface GoalProgressProps {
  current: number;
  goal: number;
  label?: string;
  onPress?: () => void;
}

function formatBRLCompact(v: number) {
  if (v >= 1000) return `R$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);
}

export function GoalProgress({ current, goal, label = "Meta do mês", onPress }: GoalProgressProps) {
  const colors = useColors();
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const pctDisplay = Math.round(pct);
  const reached = current >= goal && goal > 0;

  const content = (
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
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, { backgroundColor: `${colors.primary}22` }]}>
            <Feather name="target" size={14} color={colors.primary} />
          </View>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
        </View>
        <Text
          style={[
            styles.pct,
            { color: reached ? colors.income : colors.foreground },
          ]}
        >
          {pctDisplay}%
        </Text>
      </View>

      <View style={styles.amounts}>
        <Text style={[styles.current, { color: colors.foreground }]}>
          {formatBRLCompact(current)}
        </Text>
        <Text style={[styles.goal, { color: colors.mutedForeground }]}>
          de {formatBRLCompact(goal)}
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: colors.secondary }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${pct}%`,
              backgroundColor: reached ? colors.income : colors.primary,
            },
          ]}
        />
      </View>

      {reached ? (
        <Text style={[styles.hint, { color: colors.income }]}>Meta batida este mês!</Text>
      ) : goal > 0 ? (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Faltam {formatBRLCompact(goal - current)} para bater a meta
        </Text>
      ) : (
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Defina uma meta no seu perfil para acompanhar o progresso
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        {content}
      </Pressable>
    );
  }
  return content;
}

const styles = StyleSheet.create({
  card: { padding: 16, borderWidth: 1, gap: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBox: {
    width: 26, height: 26, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
  },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  pct: { fontSize: 20, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  amounts: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  current: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  goal: { fontSize: 13, fontFamily: "Inter_400Regular" },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  hint: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
