import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { ONBOARDING_KEY } from "./onboarding";

export default function IndexPage() {
  const { user, isLoading } = useAuth();
  const colors = useColors();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    if (!user || isLoading) {
      if (!isLoading) setOnboardingChecked(true);
      return;
    }
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      setOnboardingDone(val === "done");
      setOnboardingChecked(true);
    });
  }, [user, isLoading]);

  if (isLoading || (user && !onboardingChecked)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  if (!onboardingDone) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)/" />;
}
