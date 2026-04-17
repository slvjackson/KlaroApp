import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
  valueColor?: string;
  // Percent change vs previous period — positive goes green up, negative red down
  trendPct?: number | null;
  // Treat a negative trend as good (e.g. expenses decreasing) — flips colors
  trendInverse?: boolean;
}

export function MetricCard({
  label,
  value,
  sublabel,
  accent = false,
  valueColor,
  trendPct,
  trendInverse = false,
}: MetricCardProps) {
  const colors = useColors();

  const hasTrend = trendPct !== undefined && trendPct !== null && isFinite(trendPct);
  const isPositive = hasTrend ? (trendPct as number) >= 0 : false;
  const goodDirection = trendInverse ? !isPositive : isPositive;
  const trendColor = hasTrend
    ? goodDirection
      ? colors.income
      : colors.expense
    : colors.mutedForeground;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: accent ? colors.primary : colors.card,
          borderRadius: colors.radius,
          borderWidth: 1,
          borderColor: accent ? "transparent" : colors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: accent ? colors.primaryForeground : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          {
            color: valueColor
              ? valueColor
              : accent
                ? colors.primaryForeground
                : colors.foreground,
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {hasTrend ? (
        <View style={styles.trendRow}>
          <Feather
            name={isPositive ? "trending-up" : "trending-down"}
            size={11}
            color={trendColor}
          />
          <Text style={[styles.trendText, { color: trendColor }]}>
            {isPositive ? "+" : ""}
            {(trendPct as number).toFixed(1)}%
          </Text>
          {sublabel ? (
            <Text
              style={[
                styles.sublabel,
                { color: accent ? colors.primaryForeground : colors.mutedForeground },
              ]}
            >
              {sublabel}
            </Text>
          ) : null}
        </View>
      ) : sublabel ? (
        <Text
          style={[
            styles.sublabel,
            { color: accent ? colors.primaryForeground : colors.mutedForeground },
          ]}
        >
          {sublabel}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 4,
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  value: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginTop: 2,
  },
  sublabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  trendText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
