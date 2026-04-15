import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";

// ─── Custom center chat button ────────────────────────────────────────────────

function ChatTabButton({ onPress, accessibilityState }: { onPress?: () => void; accessibilityState?: { selected?: boolean } }) {
  const colors = useColors();
  const isSelected = accessibilityState?.selected;

  return (
    <Pressable
      onPress={onPress}
      style={styles.chatBtnWrapper}
      accessibilityRole="button"
    >
      <View
        style={[
          styles.chatBtn,
          { backgroundColor: colors.primary },
        ]}
      >
        <Feather name="message-circle" size={26} color="#fff" />
      </View>
      <Text style={[styles.chatBtnLabel, { color: isSelected ? colors.primary : colors.mutedForeground }]}>
        Klaro IA
      </Text>
    </Pressable>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : 60,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={colorScheme === "dark" ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ) : null,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 11,
        },
      }}
    >
      {/* Visible tabs */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="bar-chart-2" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transações",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="list.bullet" tintColor={color} size={22} />
            ) : (
              <Feather name="list" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Klaro IA",
          tabBarButton: (props) => <ChatTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="intelligence"
        options={{
          title: "Inteligência",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="lightbulb.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="zap" size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.circle.fill" tintColor={color} size={22} />
            ) : (
              <Feather name="user" size={22} color={color} />
            ),
        }}
      />

      {/* Hidden screens — accessible via navigation but not shown in tab bar */}
      <Tabs.Screen name="upload" options={{ href: null }} />
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="insights" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  chatBtnWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 6,
    gap: 3,
  },
  chatBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: -10,
    // Shadow for iOS
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    // Elevation for Android
    elevation: 8,
  },
  chatBtnLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    marginTop: 14,
  },
});
