import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useColors } from "@/hooks/useColors";

// ─── Primitive ────────────────────────────────────────────────────────────────

interface SkeletonBoxProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: object;
}

export function SkeletonBox({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonBoxProps) {
  const colors = useColors();
  const opacity = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.25, duration: 650, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: colors.border, opacity }, style]}
    />
  );
}

// ─── Composites ───────────────────────────────────────────────────────────────

/** Two metric cards side by side (Dashboard) */
export function SkeletonMetricRow() {
  return (
    <View style={sk.metricRow}>
      <SkeletonBox height={90} borderRadius={12} style={sk.flex1} />
      <SkeletonBox height={90} borderRadius={12} style={sk.flex1} />
    </View>
  );
}

/** Horizontal bar chart placeholder (Dashboard) */
export function SkeletonChart() {
  return (
    <View style={sk.chartCard}>
      <SkeletonBox width="40%" height={14} borderRadius={6} />
      <View style={sk.barGroup}>
        {[80, 55, 70, 90, 45, 60, 75].map((pct, i) => (
          <View key={i} style={sk.barWrap}>
            <SkeletonBox width={18} height={`${pct}%` as `${number}%`} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Goal progress bar (Dashboard) */
export function SkeletonGoal() {
  return (
    <View style={sk.goalCard}>
      <View style={sk.row}>
        <SkeletonBox width="50%" height={13} borderRadius={6} />
        <SkeletonBox width="25%" height={13} borderRadius={6} />
      </View>
      <SkeletonBox height={8} borderRadius={4} style={{ marginTop: 10 }} />
    </View>
  );
}

/** Single transaction row (Transactions) */
export function SkeletonTransactionRow() {
  return (
    <View style={sk.txRow}>
      <SkeletonBox width={40} height={40} borderRadius={20} />
      <View style={sk.txLines}>
        <SkeletonBox width="60%" height={13} borderRadius={6} />
        <SkeletonBox width="35%" height={11} borderRadius={5} style={{ marginTop: 6 }} />
      </View>
      <SkeletonBox width={60} height={13} borderRadius={6} />
    </View>
  );
}

/** Date section header (Transactions) */
export function SkeletonSectionHeader() {
  return <SkeletonBox width="30%" height={11} borderRadius={5} style={sk.sectionHeader} />;
}

/** Single insight card (Intelligence) */
export function SkeletonInsightCard() {
  const colors = useColors();
  return (
    <View style={[sk.insightCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
      <View style={sk.row}>
        <SkeletonBox width={34} height={34} borderRadius={10} />
        <SkeletonBox width="30%" height={11} borderRadius={5} />
        <View style={sk.flex1} />
        <SkeletonBox width={24} height={24} borderRadius={12} />
      </View>
      <SkeletonBox width="80%" height={14} borderRadius={6} />
      <SkeletonBox height={12} borderRadius={5} />
      <SkeletonBox width="90%" height={12} borderRadius={5} style={{ marginTop: 2 }} />
      <View style={[sk.recommendationBox, { backgroundColor: `${colors.border}44` }]}>
        <SkeletonBox width="95%" height={12} borderRadius={5} />
        <SkeletonBox width="70%" height={12} borderRadius={5} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sk = StyleSheet.create({
  flex1: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  metricRow: { flexDirection: "row", gap: 12 },
  chartCard: { gap: 12, padding: 16, borderRadius: 12 },
  barGroup: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 80 },
  barWrap: { flex: 1, alignItems: "center", height: "100%" },
  goalCard: { padding: 4, gap: 2 },
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  txLines: { flex: 1, gap: 0 },
  sectionHeader: { marginHorizontal: 20, marginTop: 16, marginBottom: 8 },
  insightCard: { padding: 18, gap: 10, borderWidth: 1 },
  recommendationBox: { padding: 12, borderRadius: 8, gap: 0 },
});
