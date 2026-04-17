import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface FabProps {
  onPress: () => void;
  icon?: keyof typeof Feather.glyphMap;
  bottomOffset?: number;
}

export function Fab({ onPress, icon = "plus", bottomOffset }: FabProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Sit above the tab bar (approx 76 + safe area)
  const bottom = bottomOffset ?? insets.bottom + (Platform.OS === "web" ? 34 : 0) + 84;

  return (
    <Pressable
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: colors.primary,
          bottom,
          transform: [{ scale: pressed ? 0.94 : 1 }],
          shadowColor: colors.primary,
        },
      ]}
    >
      <Feather name={icon} size={24} color={colors.primaryForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 100,
  },
});
