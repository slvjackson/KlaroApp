// Module-level: survives component remounts within the same JS session
let _generationStartedAt: number | null = null;

import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useArchiveInsight,
  useCheckMilestones,
  useGenerateInsights,
  useListInsights,
} from "@workspace/api-client-react";
import type { GenerateInsightsBodyPeriod, InsightsCoverage } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ReanimatedSwipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GeneratingInsightsOverlay } from "@/components/GeneratingInsightsOverlay";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

// ─── Tone config ──────────────────────────────────────────────────────────────

type Tone = "positive" | "warning" | "critical" | "neutral";

const TONE_CONFIG: Record<Tone, { iconSet: "Feather" | "MCI"; iconName: string; color: string }> = {
  positive: { iconSet: "Feather", iconName: "trending-up", color: "#10b981" },
  warning:  { iconSet: "Feather", iconName: "alert-triangle", color: "#f59e0b" },
  critical: { iconSet: "MCI", iconName: "alert-octagon", color: "#ef4444" },
  neutral:  { iconSet: "MCI", iconName: "lightbulb-outline", color: "" }, // uses colors.primary
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = GenerateInsightsBodyPeriod;

const PERIODS: { key: Period; label: string }[] = [
  { key: "30d", label: "30 dias" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "12m", label: "12 meses" },
];

const ACTION_WIDTH = 72;
const NEW_BADGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function isNewInsight(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_BADGE_TTL_MS;
}

// ─── Archive swipe action ─────────────────────────────────────────────────────

function ArchiveAction({
  prog,
  onArchive,
}: {
  prog: SharedValue<number>;
  onArchive: () => void;
}) {
  const colors = useColors();
  const style = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          prog.value,
          [0, 1],
          [ACTION_WIDTH, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.action, style]}>
      <Pressable
        onPress={onArchive}
        style={[styles.actionBtn, { backgroundColor: colors.mutedForeground }]}
      >
        <Feather name="archive" size={20} color="#fff" />
        <Text style={styles.actionLabel}>Arquivar</Text>
      </Pressable>
    </Animated.View>
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────────

interface InsightCardProps {
  id: number;
  title: string;
  description: string;
  recommendation: string;
  periodLabel: string;
  createdAt: string;
  tone?: string | null;
  onArchive: (id: number) => void;
}

function InsightCard({
  id,
  title,
  description,
  recommendation,
  periodLabel,
  createdAt,
  tone,
  onArchive,
}: InsightCardProps) {
  const colors = useColors();
  const swipeRef = useRef<SwipeableMethods>(null);
  const fresh = isNewInsight(createdAt);

  const VALID_TONES: Tone[] = ["positive", "warning", "critical", "neutral"];
  const validTone: Tone = (tone && VALID_TONES.includes(tone as Tone)) ? (tone as Tone) : "neutral";
  const tc = TONE_CONFIG[validTone];
  const toneColor = tc.color || colors.primary;
  const borderColor = validTone !== "neutral"
    ? `${toneColor}33`
    : colors.border;

  function handleArchive() {
    swipeRef.current?.close();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onArchive(id);
  }

  async function handleShare() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `${title}\n\n${description}\n\nRecomendação: ${recommendation}\n\nPeríodo: ${periodLabel}`,
    });
  }

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      overshootFriction={8}
      rightThreshold={40}
      renderRightActions={(prog) => (
        <ArchiveAction prog={prog} onArchive={handleArchive} />
      )}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderRadius: colors.radius,
            borderWidth: 1,
            borderColor,
          },
        ]}
      >
        {/* Header row: icon + period label + share button */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.iconBox, { backgroundColor: `${toneColor}1a`, borderRadius: 10 }]}>
              {tc.iconSet === "MCI"
                ? <MaterialCommunityIcons name={tc.iconName as any} size={18} color={toneColor} />
                : <Feather name={tc.iconName as any} size={16} color={toneColor} />}
            </View>
            <Text style={[styles.periodLabel, { color: colors.mutedForeground }]}>
              {periodLabel}
            </Text>
          </View>

          <View style={styles.cardHeaderRight}>
            {fresh && (
              <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.newBadgeText, { color: colors.primaryForeground }]}>Novo</Text>
              </View>
            )}
            <Pressable onPress={handleShare} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Feather name="share-2" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
        {recommendation ? (
          <View style={[styles.recommendationBox, { backgroundColor: `${toneColor}0d`, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: toneColor }]}>
            <Text style={[styles.recommendationText, { color: colors.foreground }]}>{recommendation}</Text>
          </View>
        ) : null}
      </View>
    </ReanimatedSwipeable>
  );
}

// ─── Period chip ──────────────────────────────────────────────────────────────

function PeriodChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected
            ? colors.primary
            : `${colors.primary}18`,
          borderRadius: 20,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? colors.primaryForeground : colors.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function InsightsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const anamneseCompleted = !!user?.businessProfile?.anamneseCompleted;
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("3m");
  const [coverage, setCoverage] = useState<InsightsCoverage | null>(null);

  const { data: insights, isLoading, refetch } = useListInsights();
  const generateMutation = useGenerateInsights();
  const archiveMutation = useArchiveInsight();
  const checkMilestonesMutation = useCheckMilestones();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  // Refetch whenever the screen comes into focus (handles navigate-away-and-back)
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // Auto-check milestones on mount (silent)
  useEffect(() => {
    checkMilestonesMutation
      .mutateAsync()
      .then((result: { triggered: boolean }) => {
        if (result.triggered) {
          refetch();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    _generationStartedAt = Date.now();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await generateMutation.mutateAsync({ period: selectedPeriod });
      setCoverage(result.coverage?.hasGap ? result.coverage : null);
      await refetch();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      _generationStartedAt = null;
    }
  }

  async function handleArchive(id: number) {
    await archiveMutation.mutateAsync(id);
    await refetch();
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {generateMutation.isPending && _generationStartedAt !== null && (
        <GeneratingInsightsOverlay startedAt={_generationStartedAt} />
      )}

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            paddingHorizontal: 20,
            paddingBottom: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Insights
          </Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Recomendações baseadas nos seus dados
          </Text>
        </View>
        <Pressable
          onPress={handleGenerate}
          disabled={generateMutation.isPending}
          style={({ pressed }) => [
            styles.generateBtn,
            {
              backgroundColor: colors.primary,
              borderRadius: colors.radius,
              opacity: pressed || generateMutation.isPending ? 0.7 : 1,
            },
          ]}
        >
          {generateMutation.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <MaterialCommunityIcons name="lightbulb-outline" size={20} color={colors.primaryForeground} />
          )}
        </Pressable>
      </View>

      {/* Period selector */}
      <View style={[styles.periodSection, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <Text style={[styles.periodLabel, { color: colors.mutedForeground }]}>
          Qual período a IA deve analisar?
        </Text>
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <PeriodChip key={p.key} label={p.label} selected={selectedPeriod === p.key} onPress={() => setSelectedPeriod(p.key)} />
          ))}
        </View>
        <Text style={[styles.periodHint, { color: colors.mutedForeground }]}>
          A IA vai usar as transações desse período como fonte de dados para gerar seus insights.
        </Text>
      </View>

      {/* Coverage warning */}
      {coverage?.hasGap && (
        <View style={[styles.coverageBanner, { backgroundColor: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)" }]}>
          <Feather name="info" size={14} color="#f59e0b" style={{ marginTop: 1 }} />
          <Text style={[styles.coverageText, { color: "#f59e0b" }]}>
            <Text style={styles.coverageBold}>Dados insuficientes para o período solicitado. </Text>
            Você pediu {PERIODS.find(p => p.key === coverage.requestedPeriod)?.label ?? coverage.requestedPeriod}, mas seus registros cobrem apenas{" "}
            <Text style={styles.coverageBold}>{coverage.actualDays} {coverage.actualDays === 1 ? "dia" : "dias"}</Text>.
            Os insights foram gerados com os dados disponíveis.
          </Text>
        </View>
      )}

      {/* Anamnese CTA */}
      {!anamneseCompleted && (
        <Pressable
          onPress={() => router.push("/anamnese")}
          style={({ pressed }) => [
            styles.anamneseBanner,
            { backgroundColor: `${colors.primary}0d`, borderColor: `${colors.primary}30`, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={[styles.anamneseIcon, { backgroundColor: `${colors.primary}1a` }]}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.anamneseText}>
            <Text style={[styles.anamneseTitle, { color: colors.foreground }]}>Quer insights mais precisos?</Text>
            <Text style={[styles.anamneseSub, { color: colors.mutedForeground }]}>Responda perguntas rápidas sobre seu negócio.</Text>
          </View>
          <Text style={[styles.anamneseCta, { color: colors.primary }]}>Fazer →</Text>
        </Pressable>
      )}

      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={insights ?? []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <InsightCard
              id={item.id}
              title={item.title}
              description={item.description}
              recommendation={item.recommendation}
              periodLabel={item.periodLabel}
              createdAt={item.createdAt}
              tone={item.tone}
              onArchive={handleArchive}
            />
          )}
          scrollEnabled={!!(insights && insights.length > 0)}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom:
                insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100,
              paddingTop: 16,
            },
          ]}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <MaterialCommunityIcons
                name="lightbulb-outline"
                size={44}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Sem insights ainda
              </Text>
              <Text
                style={[styles.emptyText, { color: colors.mutedForeground }]}
              >
                Selecione o período e toque no ⚡ para gerar recomendações
                baseadas nas suas transações.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  generateBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  periodSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  periodLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  periodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  periodHint: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    opacity: 0.7,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    paddingHorizontal: 20,
    gap: 14,
  },
  // card
  card: {
    padding: 18,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  cardHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBox: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  periodLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  newBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  newBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  recommendationBox: {
    padding: 12,
  },
  recommendationText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  // swipe action
  action: {
    width: ACTION_WIDTH,
    justifyContent: "center",
  },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  actionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  // coverage warning
  coverageBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 10,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
  },
  coverageText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  coverageBold: {
    fontFamily: "Inter_600SemiBold",
  },
  // anamnese banner
  anamneseBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  anamneseIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  anamneseText: { flex: 1, gap: 2 },
  anamneseTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  anamneseSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  anamneseCta: { fontSize: 13, fontFamily: "Inter_700Bold" },
  // empty
  emptyBox: {
    paddingTop: 60,
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
