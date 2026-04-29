import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useListInsights } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tone = "positive" | "warning" | "critical" | "neutral";
const VALID_TONES: Tone[] = ["positive", "warning", "critical", "neutral"];
const TONE_CONFIG: Record<Tone, { iconSet: "Feather" | "MCI"; iconName: string; color: string }> = {
  positive: { iconSet: "Feather", iconName: "trending-up",      color: "#10b981" },
  warning:  { iconSet: "Feather", iconName: "alert-triangle",   color: "#f59e0b" },
  critical: { iconSet: "MCI",    iconName: "alert-octagon",     color: "#ef4444" },
  neutral:  { iconSet: "MCI",    iconName: "lightbulb-outline", color: "" },
};

type InsightItem = {
  id: number;
  title: string;
  description: string;
  recommendation: string;
  periodLabel: string;
  tone?: string | null;
  steps?: string[] | null;
  pinnedAt?: string | null;
};

type ProgressMap = Record<number, boolean[]>;

// ─── Mission card ─────────────────────────────────────────────────────────────

function MissionCard({
  insight,
  progress,
  onPress,
}: {
  insight: InsightItem;
  progress: boolean[];
  onPress: () => void;
}) {
  const colors = useColors();
  const validTone: Tone = insight.tone && VALID_TONES.includes(insight.tone as Tone) ? (insight.tone as Tone) : "neutral";
  const tc = TONE_CONFIG[validTone];
  const toneColor = tc.color || colors.primary;
  const steps = insight.steps ?? [];
  const done = progress.filter(Boolean).length;
  const total = steps.length;
  const pct = total > 0 ? done / total : 0;
  const complete = total > 0 && done === total;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.missionCard,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: complete ? `${toneColor}55` : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.missionCardHeader}>
        <View style={[styles.iconBox, { backgroundColor: `${toneColor}18`, borderRadius: 8 }]}>
          {tc.iconSet === "MCI"
            ? <MaterialCommunityIcons name={tc.iconName as any} size={16} color={toneColor} />
            : <Feather name={tc.iconName as any} size={15} color={toneColor} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.missionTitle, { color: colors.foreground }]} numberOfLines={2}>
            {insight.title}
          </Text>
          <Text style={[styles.missionPeriod, { color: colors.mutedForeground }]} numberOfLines={1}>
            {insight.periodLabel}
          </Text>
        </View>
        {complete
          ? <MaterialCommunityIcons name="check-circle" size={18} color="#10b981" />
          : <Feather name="chevron-right" size={15} color={colors.mutedForeground} />}
      </View>

      {/* Progress bar */}
      {total > 0 && (
        <View style={styles.progressSection}>
          <View style={[styles.progressTrack, { backgroundColor: `${colors.mutedForeground}22` }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: complete ? "#10b981" : toneColor,
                  width: `${pct * 100}%` as any,
                },
              ]}
            />
          </View>
          <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
            {done}/{total} {complete ? "· Concluído!" : "passos"}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ─── Mission detail modal ─────────────────────────────────────────────────────

function MissionDetail({
  insight,
  progress,
  onToggle,
  onClose,
}: {
  insight: InsightItem;
  progress: boolean[];
  onToggle: (i: number) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const steps = insight.steps ?? [];
  const done = progress.filter(Boolean).length;
  const total = steps.length;

  function handleToggle(i: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle(i);
  }

  return (
    <View style={styles.detailOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.detailSheet, { backgroundColor: colors.card, borderColor: `${colors.primary}22` }]}>
        <View style={[styles.detailHandle, { backgroundColor: colors.border }]} />

        {/* Trophy badge */}
        <View style={[styles.trophyBadge, { backgroundColor: `${colors.primary}12` }]}>
          <MaterialCommunityIcons name="trophy-outline" size={16} color={colors.primary} />
          <Text style={[styles.trophyBadgeText, { color: colors.primary }]}>Missão salva</Text>
        </View>

        <Text style={[styles.detailTitle, { color: colors.foreground }]}>{insight.title}</Text>

        {insight.description ? (
          <Text style={[styles.detailDesc, { color: colors.mutedForeground }]} numberOfLines={3}>
            {insight.description}
          </Text>
        ) : null}

        {/* Progress bar */}
        {total > 0 && (
          <View style={styles.detailProgressRow}>
            <View style={[styles.progressTrack, { backgroundColor: `${colors.mutedForeground}22`, flex: 1 }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: done === total ? "#10b981" : colors.primary,
                    width: `${(done / total) * 100}%` as any,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>
              {done}/{total}
            </Text>
          </View>
        )}

        <Text style={[styles.stepsLabel, { color: colors.mutedForeground }]}>Passos para concluir:</Text>

        <View style={{ gap: 10 }}>
          {steps.map((step, i) => (
            <Pressable key={i} onPress={() => handleToggle(i)} style={styles.stepRow}>
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: progress[i] ? colors.primary : colors.border,
                    backgroundColor: progress[i] ? `${colors.primary}22` : "transparent",
                  },
                ]}
              >
                {progress[i] && <Feather name="check" size={12} color={colors.primary} />}
              </View>
              <Text
                style={[
                  styles.stepText,
                  { color: progress[i] ? colors.mutedForeground : colors.foreground },
                  progress[i] && { textDecorationLine: "line-through" },
                ]}
              >
                {step}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeBtn,
            { borderColor: colors.border, backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.closeBtnText, { color: colors.foreground }]}>Fechar</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MissionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: insights } = useListInsights({ query: { refetchOnMount: "always" } });
  const [progressMap, setProgressMap] = useState<ProgressMap>({});
  const [selected, setSelected] = useState<InsightItem | null>(null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const pinned: InsightItem[] = ((Array.isArray(insights) ? insights : []) as InsightItem[])
    .filter((i) => !!(i as any).pinnedAt);

  function getProgress(insight: InsightItem): boolean[] {
    const steps = insight.steps ?? [];
    return progressMap[insight.id] ?? steps.map(() => false);
  }

  function handleToggle(insightId: number, stepIdx: number) {
    setProgressMap((prev) => {
      const steps = pinned.find((i) => i.id === insightId)?.steps ?? [];
      const current = prev[insightId] ?? steps.map(() => false);
      const next = current.map((v, i) => (i === stepIdx ? !v : v));
      return { ...prev, [insightId]: next };
    });
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 14,
            paddingHorizontal: 20,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Missões</Text>
          {pinned.length > 0 && (
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {pinned.filter((i) => {
                const prog = getProgress(i);
                return prog.length > 0 && prog.every(Boolean);
              }).length} de {pinned.length} concluídas
            </Text>
          )}
        </View>
      </View>

      {/* List */}
      {pinned.length === 0 ? (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="trophy-outline" size={52} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nenhuma missão ainda</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Deslize para baixo em um insight para salvá-lo como missão e acompanhar seu progresso aqui.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pinned}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <MissionCard
              insight={item}
              progress={getProgress(item)}
              onPress={() => setSelected(item)}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 24 },
          ]}
        />
      )}

      {/* Detail modal */}
      {selected && (
        <MissionDetail
          insight={selected}
          progress={getProgress(selected)}
          onToggle={(i) => handleToggle(selected.id, i)}
          onClose={() => setSelected(null)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },

  list: { padding: 20, gap: 12 },

  missionCard: {
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  missionCardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  missionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  missionPeriod: { fontSize: 11, fontFamily: "Inter_400Regular" },

  progressSection: { gap: 6 },
  detailProgressRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  progressTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },

  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },

  // Detail modal
  detailOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
    zIndex: 100,
  },
  detailSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
    borderWidth: 1,
    maxHeight: "85%",
  },
  detailHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  trophyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  trophyBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  detailTitle: { fontSize: 17, fontFamily: "Inter_700Bold", lineHeight: 22 },
  detailDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  stepsLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 20 },
  closeBtn: { paddingVertical: 12, alignItems: "center", borderRadius: 12, borderWidth: 1, marginTop: 4 },
  closeBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
