import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, {
  SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  SharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useColors } from "@/hooks/useColors";

interface SwipeableRowProps {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}

const ACTION_WIDTH = 72;

function RightAction({
  prog,
  onDelete,
}: {
  prog: SharedValue<number>;
  onDelete: () => void;
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
        onPress={onDelete}
        style={[styles.actionBtn, { backgroundColor: colors.destructive }]}
      >
        <Feather name="trash-2" size={20} color="#fff" />
        <Text style={styles.actionLabel}>Excluir</Text>
      </Pressable>
    </Animated.View>
  );
}

function LeftAction({
  prog,
  onEdit,
}: {
  prog: SharedValue<number>;
  onEdit: () => void;
}) {
  const colors = useColors();
  const style = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          prog.value,
          [0, 1],
          [-ACTION_WIDTH, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <Animated.View style={[styles.action, style]}>
      <Pressable
        onPress={onEdit}
        style={[styles.actionBtn, { backgroundColor: colors.primary }]}
      >
        <Feather name="edit-2" size={20} color={colors.primaryForeground} />
        <Text style={[styles.actionLabel, { color: colors.primaryForeground }]}>
          Editar
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function SwipeableRow({ children, onEdit, onDelete }: SwipeableRowProps) {
  const ref = useRef<SwipeableMethods>(null);

  function handleEdit() {
    ref.current?.close();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEdit();
  }

  function handleDelete() {
    ref.current?.close();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onDelete();
  }

  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={2}
      overshootFriction={8}
      rightThreshold={40}
      leftThreshold={40}
      renderRightActions={(prog) => (
        <RightAction prog={prog} onDelete={handleDelete} />
      )}
      renderLeftActions={(prog) => (
        <LeftAction prog={prog} onEdit={handleEdit} />
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
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
});
