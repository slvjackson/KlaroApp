import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useGenerateInsights,
  useListInsights,
  useArchiveInsight,
  useCheckMilestones,
} from "@workspace/api-client-react";
import type { GenerateInsightsBodyPeriod } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
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
import { SkeletonInsightCard } from "@/components/Skeleton";
import { SpeedDialFab } from "@/components/SpeedDialFab";
import { useTransactionForm } from "@/contexts/TransactionFormContext";
import { useColors } from "@/hooks/useColors";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Period = GenerateInsightsBodyPeriod;

const PERIODS: { key: Period; label: string }[] = [
  { key: "30d", label: "30 dias" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "12m", label: "12 meses" },
];

const ARCHIVE_ACTION_W = 72;

function isRecentInsight(createdAt: string | undefined): boolean {
  if (!createdAt) return false;
  return Date.now() - new Date(createdAt).getTime() < 48 * 60 * 60 * 1000;
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
          [ARCHIVE_ACTION_W, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  return (
    <Animated.View style={[styles.archiveAction, style]}>
      <Pressable
        onPress={onArchive}
        style={[styles.archiveBtn, { backgroundColor: colors.mutedForeground }]}
      >
        <Feather name="archive" size={20} color="#fff" />
        <Text style={styles.archiveBtnLabel}>Arquivar</Text>
      </Pressable>
    </Animated.View>
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
        styles.periodChip,
        {
          backgroundColor: selected ? colors.primary : `${colors.primary}18`,
          borderRadius: 20,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.periodChipText,
          { color: selected ? colors.primaryForeground : colors.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────────

function InsightCard({
  id,
  title,
  description,
  recommendation,
  periodLabel,
  isNew,
  onArchive,
}: {
  id: number;
  title: string;
  description: string;
  recommendation: string;
  periodLabel: string;
  isNew?: boolean;
  onArchive: (id: number) => void;
}) {
  const colors = useColors();
  const swipeRef = useRef<SwipeableMethods>(null);

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
          styles.insightCard,
          {
            backgroundColor: colors.card,
            borderRadius: colors.radius,
            borderWidth: 1,
            borderColor: isNew ? `${colors.primary}66` : colors.border,
          },
        ]}
      >
        <View style={styles.insightCardHeader}>
          <View style={styles.insightCardHeaderLeft}>
            <View style={[styles.iconBox, { backgroundColor: `${colors.primary}22`, borderRadius: 10 }]}>
              <MaterialCommunityIcons name="lightbulb-outline" size={18} color={colors.primary} />
            </View>
            {isNew && (
              <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.newBadgeText, { color: colors.primaryForeground }]}>Novo</Text>
              </View>
            )}
          </View>
          <View style={styles.insightCardHeaderRight}>
            <Text style={[styles.periodLabel, { color: colors.mutedForeground }]}>{periodLabel}</Text>
            <Pressable onPress={handleShare} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
              <Feather name="share-2" size={15} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>
        <Text style={[styles.insightTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.insightDescription, { color: colors.mutedForeground }]}>{description}</Text>
        <View style={[styles.recommendationBox, { backgroundColor: `${colors.primary}11`, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: colors.primary }]}>
          <Text style={[styles.recommendationText, { color: colors.foreground }]}>{recommendation}</Text>
        </View>
      </View>
    </ReanimatedSwipeable>
  );
}

// ─── Insights content ─────────────────────────────────────────────────────────

function InsightsContent() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("3m");

  const { data: insights, isLoading, refetch } = useListInsights();
  const generateMutation = useGenerateInsights();
  const archiveMutation = useArchiveInsight();
  const checkMilestonesMutation = useCheckMilestones();

  useEffect(() => {
    checkMilestonesMutation
      .mutateAsync()
      .then((result: { triggered: boolean }) => { if (result.triggered) refetch(); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await generateMutation.mutateAsync({ period: selectedPeriod });
    await refetch();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleArchive(id: number) {
    await archiveMutation.mutateAsync(id);
    await refetch();
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingHorizontal: 20, gap: 14, justifyContent: "flex-start", paddingTop: 20 }]}>
        <SkeletonInsightCard />
        <SkeletonInsightCard />
        <SkeletonInsightCard />
      </View>
    );
  }

  const insightList = Array.isArray(insights) ? insights : [];

  return (
    <FlatList
      data={insightList}
      keyExtractor={(item, index) => item?.id != null ? String(item.id) : `insight-${index}`}
      renderItem={({ item }) => (
        <InsightCard
          id={item.id}
          title={item.title}
          description={item.description}
          recommendation={item.recommendation}
          periodLabel={item.periodLabel}
          isNew={isRecentInsight((item as { createdAt?: string }).createdAt)}
          onArchive={handleArchive}
        />
      )}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
      }
      ListHeaderComponent={
        <View style={[styles.periodRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          {PERIODS.map((p) => (
            <PeriodChip
              key={p.key}
              label={p.label}
              selected={selectedPeriod === p.key}
              onPress={() => setSelectedPeriod(p.key)}
            />
          ))}
        </View>
      }
      contentContainerStyle={[
        styles.insightsList,
        { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 },
      ]}
      ListFooterComponent={
        <Pressable
          onPress={handleGenerate}
          disabled={generateMutation.isPending}
          style={({ pressed }) => [
            styles.generateBtn,
            {
              backgroundColor: pressed || generateMutation.isPending
                ? `${colors.primary}cc`
                : colors.primary,
              borderRadius: colors.radius,
              marginTop: 8,
            },
          ]}
        >
          {generateMutation.isPending ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <>
              <MaterialCommunityIcons name="lightbulb-outline" size={18} color={colors.primaryForeground} />
              <Text style={[styles.generateBtnText, { color: colors.primaryForeground }]}>
                Gerar novos insights
              </Text>
            </>
          )}
        </Pressable>
      }
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="lightbulb-outline" size={44} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sem insights ainda</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Selecione o período e toque em "Gerar novos insights".
          </Text>
        </View>
      }
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function IntelligenceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { openAdd } = useTransactionForm();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 16,
            paddingHorizontal: 20,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Inteligência</Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          Recomendações baseadas nos seus dados
        </Text>
      </View>

      <InsightsContent />
      <SpeedDialFab onAdd={openAdd} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: 4 },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular" },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },

  periodRow: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 10, gap: 8, marginBottom: 16 },
  periodChip: { paddingHorizontal: 14, paddingVertical: 6 },
  periodChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  archiveAction: { width: ARCHIVE_ACTION_W, justifyContent: "center" },
  archiveBtn: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  archiveBtnLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },

  insightsList: { paddingHorizontal: 20, gap: 14 },
  insightCard: { padding: 18, gap: 10 },
  insightCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  insightCardHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  insightCardHeaderRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  newBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  newBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  periodLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  insightTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", lineHeight: 22 },
  insightDescription: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  recommendationBox: { padding: 12 },
  recommendationText: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },

  generateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, marginHorizontal: 20, marginBottom: 16 },
  generateBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },

  emptyBox: { paddingTop: 60, alignItems: "center", gap: 12, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
