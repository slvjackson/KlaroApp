import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useGenerateInsights,
  useListInsights,
  useArchiveInsight,
  useCheckMilestones,
  usePinInsight,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { getListInsightsQueryKey } from "@workspace/api-client-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SkeletonInsightCard } from "@/components/Skeleton";
import { SpeedDialFab } from "@/components/SpeedDialFab";
import { useTransactionForm } from "@/contexts/TransactionFormContext";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = Math.round(SCREEN_W * 0.62);
const GAP = 10;
const UNIT = CARD_W + GAP;
const CENTER_OFFSET = (SCREEN_W - CARD_W) / 2;
const CARD_H = 280;
const H_THRESHOLD = 48;
const V_UP = -90;
const V_DOWN = 90;
const DIR_LOCK = 8;
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Tone config ──────────────────────────────────────────────────────────────

type Tone = "positive" | "warning" | "critical" | "neutral";
const VALID_TONES: Tone[] = ["positive", "warning", "critical", "neutral"];
const TONE_CONFIG: Record<Tone, { iconSet: "Feather" | "MCI"; iconName: string; color: string }> = {
  positive: { iconSet: "Feather", iconName: "trending-up",      color: "#10b981" },
  warning:  { iconSet: "Feather", iconName: "alert-triangle",   color: "#f59e0b" },
  critical: { iconSet: "MCI",    iconName: "alert-octagon",     color: "#ef4444" },
  neutral:  { iconSet: "MCI",    iconName: "lightbulb-outline", color: "" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type InsightItem = {
  id: number;
  title: string;
  description: string;
  recommendation: string;
  periodLabel: string;
  tone?: string | null;
  steps?: string[] | null;
  createdAt?: string;
  pinnedAt?: string | null;
};

// ─── Mission modal ────────────────────────────────────────────────────────────

function MissionModal({ insight, isPending, onClose }: { insight: InsightItem; isPending: boolean; onClose: () => void }) {
  const colors = useColors();
  const steps = insight.steps ?? [];
  const [checked, setChecked] = useState<boolean[]>([]);

  useEffect(() => {
    setChecked(steps.map(() => false));
  }, [insight.steps]);

  function toggle(i: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: `${colors.primary}33` }]}>
        <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
        <View style={[styles.missionBadge, { backgroundColor: `${colors.primary}1a` }]}>
          <MaterialCommunityIcons name="trophy-outline" size={15} color={colors.primary} />
          <Text style={[styles.missionBadgeText, { color: colors.primary }]}>Missão criada!</Text>
        </View>
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>{insight.title}</Text>

        {isPending ? (
          <View style={{ alignItems: "center", paddingVertical: 20, gap: 10 }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Gerando plano de ação…</Text>
          </View>
        ) : (
          <>
            {steps.length > 0 && (
              <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>Passos para colocar em prática:</Text>
            )}
            <View style={{ gap: 10, marginTop: 4 }}>
              {steps.map((step, i) => (
                <Pressable key={i} onPress={() => toggle(i)} style={styles.stepRow}>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: checked[i] ? colors.primary : colors.border,
                        backgroundColor: checked[i] ? `${colors.primary}22` : "transparent",
                      },
                    ]}
                  >
                    {checked[i] && <Feather name="check" size={12} color={colors.primary} />}
                  </View>
                  <Text
                    style={[
                      styles.stepText,
                      { color: checked[i] ? colors.mutedForeground : colors.foreground },
                      checked[i] && { textDecorationLine: "line-through" },
                    ]}
                  >
                    {step}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Pressable
          onPress={() => { onClose(); router.push("/missions"); }}
          disabled={isPending}
          style={[styles.missionCloseBtn, { backgroundColor: isPending ? colors.border : colors.primary, borderRadius: colors.radius }]}
        >
          <Text style={[styles.missionCloseBtnText, { color: isPending ? colors.mutedForeground : colors.primaryForeground }]}>
            {isPending ? "Aguarde…" : "Ver missão →"}
          </Text>
        </Pressable>
      </View>
      </View>
    </Modal>
  );
}

// ─── Expanded detail modal ────────────────────────────────────────────────────

function ExpandedModal({
  insight,
  onClose,
  onArchive,
  onPin,
}: {
  insight: InsightItem;
  onClose: () => void;
  onArchive: () => void;
  onPin: () => void;
}) {
  const colors = useColors();
  const validTone: Tone = insight.tone && VALID_TONES.includes(insight.tone as Tone) ? (insight.tone as Tone) : "neutral";
  const tc = TONE_CONFIG[validTone];
  const toneColor = tc.color || colors.primary;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.expandedSheet, { backgroundColor: colors.card, borderColor: `${toneColor}33` }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

          {/* Scrollable content */}
          <ScrollView showsVerticalScrollIndicator={false} bounces={false} style={{ flexShrink: 1 }}>
            <View style={styles.expandedHeader}>
              <View style={[styles.iconBox, { backgroundColor: `${toneColor}1a`, borderRadius: 8 }]}>
                {tc.iconSet === "MCI"
                  ? <MaterialCommunityIcons name={tc.iconName as any} size={16} color={toneColor} />
                  : <Feather name={tc.iconName as any} size={15} color={toneColor} />}
              </View>
              <Text style={[styles.expandedPeriod, { color: colors.mutedForeground }]}>{insight.periodLabel}</Text>
              <Pressable onPress={onClose} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <Text style={[styles.expandedTitle, { color: colors.foreground, marginTop: 12 }]}>{insight.title}</Text>
            <Text style={[styles.expandedDesc, { color: colors.mutedForeground, marginTop: 10 }]}>{insight.description}</Text>

            {insight.recommendation ? (
              <View style={[styles.recBox, { backgroundColor: `${toneColor}0d`, borderLeftColor: toneColor, marginTop: 12 }]}>
                <Text style={[styles.recLabel, { color: toneColor }]}>Recomendação</Text>
                <Text style={[styles.recText, { color: colors.foreground }]}>{insight.recommendation}</Text>
              </View>
            ) : null}
            <View style={{ height: 16 }} />
          </ScrollView>

          {/* Action buttons — always visible outside scroll */}
          <View style={styles.expandedActions}>
            <Pressable
              onPress={() => { onClose(); setTimeout(onArchive, 200); }}
              style={({ pressed }) => [
                styles.actionBtn,
                { borderColor: "#ef444440", backgroundColor: pressed ? "#ef444415" : "#ef44440d", flex: 1 },
              ]}
            >
              <Feather name="trash-2" size={15} color="#ef4444" />
              <Text style={[styles.actionBtnText, { color: "#ef4444" }]}>Descartar</Text>
            </Pressable>
            <Pressable
              onPress={() => { onClose(); setTimeout(onPin, 200); }}
              style={({ pressed }) => [
                styles.actionBtn,
                { borderColor: "#10b98140", backgroundColor: pressed ? "#10b98115" : "#10b9810d", flex: 1 },
              ]}
            >
              <MaterialCommunityIcons name="trophy-outline" size={15} color="#10b981" />
              <Text style={[styles.actionBtnText, { color: "#10b981" }]}>Salvar missão</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Coverflow card ───────────────────────────────────────────────────────────

function CoverflowCard({
  item,
  extIdx,
  extIdxSV,
  carX,
  cardY,
  isCurrent,
  onExpand,
  colors,
}: {
  item: InsightItem;
  extIdx: number;
  extIdxSV: SharedValue<number>;
  carX: SharedValue<number>;
  cardY: SharedValue<number>;
  isCurrent: boolean;
  onExpand: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const [truncated, setTruncated] = useState(false);
  const MAX_DESC_LINES = 6;
  const validTone: Tone = item.tone && VALID_TONES.includes(item.tone as Tone) ? (item.tone as Tone) : "neutral";
  const tc = TONE_CONFIG[validTone];
  const toneColor = tc.color || colors.primary;
  const stale = item.createdAt ? Date.now() - new Date(item.createdAt).getTime() > STALE_MS : false;

  const animStyle = useAnimatedStyle(() => {
    const cardLeft = extIdx * UNIT + carX.value;
    const distPx = cardLeft + CARD_W / 2 - SCREEN_W / 2;
    const distSlots = distPx / UNIT;
    const absDist = Math.abs(distSlots);
    const isCenter = extIdx === extIdxSV.value;

    const ry = interpolate(distSlots, [-2, -1, 0, 1, 2], [-40, -40, 0, 40, 40], Extrapolation.CLAMP);
    const sc = interpolate(absDist, [0, 1, 2], [1, 0.90, 0.65], Extrapolation.CLAMP);
    const op = interpolate(absDist, [0, 1, 2], [1, 0.70, 0.20], Extrapolation.CLAMP);

    return {
      transform: [
        { translateX: cardLeft },
        { translateY: isCenter ? cardY.value : 0 },
        { perspective: 900 },
        { rotateY: `${ry}deg` },
        { scale: sc },
      ],
      opacity: op,
      zIndex: Math.round(100 - absDist * 10),
    };
  });

  const discardOverlay = useAnimatedStyle(() => ({
    opacity: extIdx === extIdxSV.value
      ? interpolate(cardY.value, [0, V_UP], [0, 1], Extrapolation.CLAMP)
      : 0,
  }));

  const saveOverlay = useAnimatedStyle(() => ({
    opacity: extIdx === extIdxSV.value
      ? interpolate(cardY.value, [0, V_DOWN], [0, 1], Extrapolation.CLAMP)
      : 0,
  }));

  return (
    <Animated.View
      style={[
        styles.card,
        {
          width: CARD_W,
          height: CARD_H,
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderWidth: 1,
          borderColor: `${toneColor}33`,
          position: "absolute",
          left: 0,
          top: 0,
        },
        animStyle,
      ]}
    >
      {/* Overlays */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlayDiscard, { borderRadius: colors.radius }, discardOverlay]}>
        <Feather name="trash-2" size={26} color="#ef4444" />
        <Text style={[styles.overlayLabel, { color: "#ef4444" }]}>Descartar</Text>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlaySave, { borderRadius: colors.radius }, saveOverlay]}>
        <MaterialCommunityIcons name="trophy-outline" size={26} color="#10b981" />
        <Text style={[styles.overlayLabel, { color: "#10b981" }]}>Salvar missão</Text>
      </Animated.View>

      {/* Scrollable content area */}
      <View style={styles.cardContent}>
        {stale && (
          <View style={[styles.staleBanner, { borderColor: "#f59e0b44", backgroundColor: "#f59e0b10" }]}>
            <Feather name="clock" size={10} color="#f59e0b" />
            <Text style={[styles.staleText, { color: "#f59e0b" }]}>+7 dias sem decisão</Text>
          </View>
        )}

        <View style={styles.cardHeader}>
          <View style={[styles.iconBox, { backgroundColor: `${toneColor}1a`, borderRadius: 8 }]}>
            {tc.iconSet === "MCI"
              ? <MaterialCommunityIcons name={tc.iconName as any} size={15} color={toneColor} />
              : <Feather name={tc.iconName as any} size={14} color={toneColor} />}
          </View>
          <Text style={[styles.periodLabel, { color: colors.mutedForeground }]} numberOfLines={1}>
            {item.periodLabel}
          </Text>
        </View>

        <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
          {item.title}
        </Text>

        {/* Description — limited lines with clean ellipsis, detects real truncation */}
        <Text
          style={[styles.cardDesc, { color: colors.mutedForeground }]}
          numberOfLines={isCurrent ? MAX_DESC_LINES : 3}
          onTextLayout={(e) => {
            if (isCurrent) setTruncated(e.nativeEvent.lines.length >= MAX_DESC_LINES);
          }}
        >
          {item.description}
        </Text>

        {/* "ler mais" — only when text is actually truncated */}
        {isCurrent && truncated && (
          <Pressable onPress={onExpand} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignSelf: "flex-start" })}>
            <Text style={[styles.readMoreInline, { color: colors.primary }]}>ler mais →</Text>
          </Pressable>
        )}
      </View>

      {/* Hints row — regular flex child at bottom */}
      <View style={[styles.hintsRow, { borderTopColor: colors.border }]}>
        <View style={styles.hint}>
          <Feather name="arrow-up" size={9} color={colors.mutedForeground} />
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>Descartar</Text>
        </View>
        <View style={styles.hint}>
          <Feather name="arrow-left" size={9} color={colors.mutedForeground} />
          <Feather name="arrow-right" size={9} color={colors.mutedForeground} />
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>Navegar</Text>
        </View>
        <View style={styles.hint}>
          <Feather name="arrow-down" size={9} color={colors.mutedForeground} />
          <Text style={[styles.hintText, { color: colors.mutedForeground }]}>Missão</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Dots ─────────────────────────────────────────────────────────────────────

function Dots({ count, current, colors }: { count: number; current: number; colors: ReturnType<typeof useColors> }) {
  if (count <= 1) return null;
  return (
    <View style={styles.dotsRow}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i === current ? colors.primary : `${colors.mutedForeground}55`,
              width: i === current ? 14 : 5,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Coverflow carousel ───────────────────────────────────────────────────────

function InsightCarousel({
  queue,
  onArchive,
  onPin,
  pinnedCount,
}: {
  queue: InsightItem[];
  onArchive: (id: number) => void;
  onPin: (item: InsightItem) => void;
  pinnedCount: number;
}) {
  const colors = useColors();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [expandedItem, setExpandedItem] = useState<InsightItem | null>(null);

  // Extended array: [last_clone, ...queue, first_clone] for infinite loop
  const extended = useMemo(() => {
    if (queue.length <= 1) return queue;
    return [...queue.slice(-1), ...queue, ...queue.slice(0, 1)];
  }, [queue]);

  const startEI = queue.length > 1 ? 1 : 0;

  // Shared values
  const extIdxSV = useSharedValue(startEI);
  const extLenSV = useSharedValue(extended.length);
  const carX = useSharedValue(CENTER_OFFSET - startEI * UNIT);
  const startCarX = useSharedValue(0);
  const cardY = useSharedValue(0);
  const dir = useSharedValue<0 | 1 | 2>(0);

  // Refs for JS thread access in gesture callbacks
  const queueRef = useRef<InsightItem[]>(queue);
  const idxRef = useRef(0);
  const prevLenRef = useRef(queue.length);

  useEffect(() => {
    queueRef.current = queue;
    extLenSV.value = extended.length;

    if (prevLenRef.current !== queue.length) {
      prevLenRef.current = queue.length;
      // Stay at the same relative position instead of resetting to card 0
      const clampedIdx = queue.length > 0 ? Math.min(idxRef.current, queue.length - 1) : 0;
      const newEI = queue.length > 1 ? clampedIdx + 1 : 0;
      extIdxSV.value = newEI;
      carX.value = CENTER_OFFSET - newEI * UNIT; // instant snap, no spring
      cardY.value = 0; // reset so new center card starts at y=0
      if (clampedIdx !== idxRef.current) setCurrentIdx(clampedIdx);
    }
  }, [queue]);

  useEffect(() => { idxRef.current = currentIdx; }, [currentIdx]);

  // Accept index explicitly so worklet can capture it before any state changes
  const triggerArchiveWithIdx = useCallback((idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const item = queueRef.current[idx];
    if (item) setTimeout(() => onArchive(item.id), 200);
  }, [onArchive]);

  const triggerPinWithIdx = useCallback((idx: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const item = queueRef.current[idx];
    if (item) setTimeout(() => onPin(item), 200);
  }, [onPin]);

  const gesture = Gesture.Pan()
    .minDistance(4)
    .onStart(() => {
      dir.value = 0;
      startCarX.value = carX.value;
    })
    .onUpdate((e) => {
      if (dir.value === 0) {
        const ax = Math.abs(e.translationX);
        const ay = Math.abs(e.translationY);
        if (ax > DIR_LOCK || ay > DIR_LOCK) dir.value = ax >= ay ? 1 : 2;
      }
      if (dir.value === 1) {
        carX.value = startCarX.value + e.translationX;
      } else if (dir.value === 2) {
        cardY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      if (dir.value === 1) {
        const vel = e.velocityX;
        const delta = e.translationX;
        let targetEI = extIdxSV.value;
        if (delta < -H_THRESHOLD || vel < -300) targetEI = Math.min(extIdxSV.value + 1, extLenSV.value - 1);
        else if (delta > H_THRESHOLD || vel > 300) targetEI = Math.max(extIdxSV.value - 1, 0);

        extIdxSV.value = targetEI;

        // Update counter/dots/isCurrent immediately — no waiting for animation end
        let immediateReal: number;
        if (extLenSV.value <= 1) immediateReal = 0;
        else if (targetEI === 0) immediateReal = extLenSV.value - 3; // clone of last → last real
        else if (targetEI === extLenSV.value - 1) immediateReal = 0; // clone of first → first real
        else immediateReal = targetEI - 1;
        scheduleOnRN(setCurrentIdx, immediateReal);

        const isWrap = targetEI === 0 || targetEI === extLenSV.value - 1;
        const onAnimDone = (finished: boolean | undefined) => {
          "worklet";
          if (!finished) return;
          let finalEI = extIdxSV.value;
          let jumped = false;
          if (extLenSV.value > 2) {
            if (finalEI === 0) { finalEI = extLenSV.value - 2; jumped = true; }
            else if (finalEI === extLenSV.value - 1) { finalEI = 1; jumped = true; }
          }
          if (jumped) {
            extIdxSV.value = finalEI;
            carX.value = CENTER_OFFSET - finalEI * UNIT;
            const corrected = extLenSV.value > 1 ? finalEI - 1 : 0;
            scheduleOnRN(setCurrentIdx, corrected);
          }
        };
        carX.value = isWrap
          ? withTiming(CENTER_OFFSET - targetEI * UNIT, { duration: 160 }, onAnimDone)
          : withSpring(CENTER_OFFSET - targetEI * UNIT, { damping: 25, stiffness: 420 }, onAnimDone);
      } else if (dir.value === 2) {
        // Capture the real queue index before any state changes
        const origRealIdx = extLenSV.value > 1 ? extIdxSV.value - 1 : 0;
        if (e.translationY < V_UP) {
          cardY.value = withTiming(-900, { duration: 260 });
          scheduleOnRN(triggerArchiveWithIdx, origRealIdx);
        } else if (e.translationY > V_DOWN) {
          cardY.value = withTiming(900, { duration: 260 });
          scheduleOnRN(triggerPinWithIdx, origRealIdx);
        } else {
          cardY.value = withSpring(0, { damping: 18, stiffness: 260 });
        }
      }
      dir.value = 0;
    });

  useEffect(() => {
    cardY.value = withSpring(0, { damping: 20, stiffness: 300 });
  }, [currentIdx]);

  return (
    <View style={styles.carouselSection}>
      {/* Counter */}
      <Text style={[styles.counter, { color: colors.mutedForeground }]}>
        {currentIdx + 1} / {queue.length}
      </Text>

      {/* Track */}
      <GestureDetector gesture={gesture}>
        <View style={styles.track}>
          {extended.map((item, ei) => {
            const isCurrent = queue.length > 1 ? ei === currentIdx + 1 : ei === currentIdx;
            return (
              <CoverflowCard
                key={`${item.id}-${ei}`}
                item={item}
                extIdx={ei}
                extIdxSV={extIdxSV}
                carX={carX}
                cardY={cardY}
                isCurrent={isCurrent}
                onExpand={() => setExpandedItem(item)}
                colors={colors}
              />
            );
          })}
        </View>
      </GestureDetector>

      {/* Dots */}
      <Dots count={queue.length} current={currentIdx} colors={colors} />

      {/* Missions CTA */}
      <Pressable
        onPress={() => router.push("/missions")}
        style={({ pressed }) => [
          styles.missionsBtn,
          {
            borderColor: colors.border,
            backgroundColor: colors.card,
            marginHorizontal: (SCREEN_W - CARD_W) / 2,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <MaterialCommunityIcons name="trophy-outline" size={14} color={colors.primary} />
        <Text style={[styles.missionsBtnText, { color: colors.foreground }]}>
          Ver missões{pinnedCount > 0 ? ` (${pinnedCount})` : ""}
        </Text>
        <Feather name="chevron-right" size={13} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
      </Pressable>

      {/* Expanded detail modal */}
      {expandedItem && (
        <ExpandedModal
          insight={expandedItem}
          onClose={() => setExpandedItem(null)}
          onArchive={() => {
            const item = expandedItem;
            setExpandedItem(null);
            setTimeout(() => onArchive(item.id), 220);
          }}
          onPin={() => {
            const item = expandedItem;
            setExpandedItem(null);
            setTimeout(() => onPin(item), 220);
          }}
        />
      )}
    </View>
  );
}

// ─── Insights content ─────────────────────────────────────────────────────────

function InsightsContent() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const anamneseCompleted = !!user?.businessProfile?.anamneseCompleted;
  const queryClient = useQueryClient();

  const { data: insights, isLoading, refetch } = useListInsights();
  const generateMutation = useGenerateInsights();
  const archiveMutation = useArchiveInsight();
  const pinMutation = usePinInsight();
  const checkMilestonesMutation = useCheckMilestones();

  const [queue, setQueue] = useState<InsightItem[]>([]);
  const [mission, setMission] = useState<InsightItem | null>(null);

  // Auto-check milestones on mount
  useEffect(() => {
    checkMilestonesMutation
      .mutateAsync()
      .then((result: { triggered: boolean }) => { if (result.triggered) refetch(); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync queue from API — exclude already-pinned insights from decision carousel
  useEffect(() => {
    if (!isLoading && insights) {
      const all = (Array.isArray(insights) ? insights : []) as InsightItem[];
      setQueue(all.filter((i) => !(i as any).pinnedAt));
    }
  }, [insights, isLoading]);

  const pinnedCount = useMemo(() => {
    return ((Array.isArray(insights) ? insights : []) as InsightItem[]).filter(
      (i) => !!(i as any).pinnedAt
    ).length;
  }, [insights]);

  async function handleGenerate() {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await generateMutation.mutateAsync({ period: "3m" });
    const fresh = await refetch();
    const all = (Array.isArray(fresh.data) ? fresh.data : []) as InsightItem[];
    setQueue(all.filter((i) => !(i as any).pinnedAt));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function handleArchive(id: number) {
    archiveMutation.mutate(id);
    setQueue((prev) => prev.filter((i) => i.id !== id));
  }

  function handlePin(item: InsightItem) {
    pinMutation.mutate(item.id, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
        if (data) setMission(data as InsightItem);
      },
    });
    setQueue((prev) => prev.filter((i) => i.id !== item.id));
    setMission(item);
  }

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingHorizontal: 20 }]}>
        <SkeletonInsightCard />
        <SkeletonInsightCard />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 }}>
      {/* Top row: anamnese CTA + generate button */}
      <View style={[styles.topRow, { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 }]}>
        {!anamneseCompleted && (
          <Pressable
            onPress={() => router.push("/anamnese")}
            style={({ pressed }) => [
              styles.anamneseBanner,
              { backgroundColor: `${colors.primary}0d`, borderColor: `${colors.primary}30`, opacity: pressed ? 0.8 : 1, flex: 1 },
            ]}
          >
            <MaterialCommunityIcons name="lightbulb-on-outline" size={14} color={colors.primary} />
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={[styles.anamneseTitle, { color: colors.foreground }]}>Insights mais precisos</Text>
              <Text style={[styles.anamneseSub, { color: colors.mutedForeground }]}>Responda o diagnóstico →</Text>
            </View>
          </Pressable>
        )}
        <Pressable
          onPress={handleGenerate}
          disabled={generateMutation.isPending}
          style={({ pressed }) => [
            styles.generateBtn,
            {
              backgroundColor: pressed || generateMutation.isPending ? `${colors.primary}cc` : colors.primary,
              borderRadius: colors.radius,
            },
          ]}
        >
          {generateMutation.isPending
            ? <ActivityIndicator color={colors.primaryForeground} size="small" />
            : <MaterialCommunityIcons name="refresh" size={18} color={colors.primaryForeground} />}
        </Pressable>
      </View>

      {/* Carousel or empty state */}
      {queue.length === 0 ? (
        <View style={styles.emptyBox}>
          <MaterialCommunityIcons name="check-circle-outline" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Tudo revisado!</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Toque em atualizar para gerar novos insights ou aguarde o próximo ciclo.
          </Text>
          {pinnedCount > 0 && (
            <Pressable
              onPress={() => router.push("/missions")}
              style={({ pressed }) => [
                styles.missionsEmptyBtn,
                { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30`, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <MaterialCommunityIcons name="trophy-outline" size={16} color={colors.primary} />
              <Text style={[styles.missionsBtnText, { color: colors.primary }]}>
                Ver missões ({pinnedCount})
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <InsightCarousel
          queue={queue}
          onArchive={handleArchive}
          onPin={handlePin}
          pinnedCount={pinnedCount}
        />
      )}

      {/* Mission modal */}
      {mission && <MissionModal insight={mission} isPending={pinMutation.isPending} onClose={() => setMission(null)} />}
    </View>
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
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Insights</Text>
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
  header: { gap: 3 },
  headerTitle: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  centered: { flex: 1, gap: 14, justifyContent: "flex-start", paddingTop: 20 },

  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  anamneseBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, borderWidth: 1 },
  anamneseTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  anamneseSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  generateBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },

  // Carousel section
  carouselSection: { flex: 1, gap: 0 },
  counter: { textAlign: "center", fontSize: 11, fontFamily: "Inter_500Medium", paddingTop: 8, paddingBottom: 10 },
  track: { height: CARD_H, overflow: "visible" },

  // Card
  card: { overflow: "hidden", flexDirection: "column" },
  cardContent: { flex: 1, padding: 16, gap: 8, overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBox: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  periodLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5, flex: 1 },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", lineHeight: 22, letterSpacing: -0.3 },
  cardDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  readMoreInline: { fontSize: 11, fontFamily: "Inter_500Medium" },
  recBoxCard: { padding: 10, borderRadius: 8, borderLeftWidth: 3 },

  staleBanner: { flexDirection: "row", alignItems: "center", gap: 5, padding: 7, borderRadius: 6, borderWidth: 1 },
  staleText: { fontSize: 10.5, fontFamily: "Inter_500Medium", flex: 1 },

  overlayDiscard: { alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(239,68,68,0.12)" },
  overlaySave:   { alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "rgba(16,185,129,0.12)" },
  overlayLabel:  { fontSize: 15, fontFamily: "Inter_700Bold" },

  hintsRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  hint: { flexDirection: "row", alignItems: "center", gap: 3 },
  hintText: { fontSize: 9.5, fontFamily: "Inter_400Regular" },

  dotsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 5, paddingVertical: 10 },
  dot: { height: 5, borderRadius: 3 },

  missionsBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  missionsEmptyBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, marginTop: 8 },
  missionsBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },

  // Read more button
  readMoreBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1 },
  readMoreText: { fontSize: 12, fontFamily: "Inter_500Medium" },

  // Expanded sheet
  expandedSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14, borderWidth: 1, maxHeight: "85%" },
  expandedHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  expandedPeriod: { flex: 1, fontSize: 11, fontFamily: "Inter_500Medium", textTransform: "uppercase", letterSpacing: 0.5 },
  expandedTitle: { fontSize: 19, fontFamily: "Inter_700Bold", lineHeight: 26, letterSpacing: -0.4 },
  expandedDesc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  recBox: { padding: 14, borderRadius: 10, borderLeftWidth: 3, gap: 4 },
  recLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 },
  recText: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },
  expandedActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Mission modal
  modalOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)", zIndex: 100 },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14, borderWidth: 1 },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  missionBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  missionBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold", lineHeight: 22 },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stepText: { fontSize: 14, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 20 },
  missionCloseBtn: { paddingVertical: 13, alignItems: "center", marginTop: 4 },
  missionCloseBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
