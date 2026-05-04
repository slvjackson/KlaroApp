import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useGetBillingStatus } from "@workspace/api-client-react";
import { ONBOARDING_KEY } from "./onboarding";
import { TRIAL_WELCOME_KEY } from "./trial-welcome";

const BLOCKED_STATUSES = new Set(["expired", "cancelled", "overdue"]);

function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

export default function IndexPage() {
  const { user, isLoading } = useAuth();
  const colors = useColors();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [welcomeChecked, setWelcomeChecked] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const { data: billing, isLoading: billingLoading } = useGetBillingStatus({
    query: { enabled: !!user && !isLoading, retry: false },
  });

  useEffect(() => {
    if (!user || isLoading) {
      if (!isLoading) { setOnboardingChecked(true); setWelcomeChecked(true); }
      return;
    }
    AsyncStorage.multiGet([ONBOARDING_KEY, TRIAL_WELCOME_KEY]).then(([[, ob], [, wb]]) => {
      setOnboardingDone(ob === "done");
      setOnboardingChecked(true);

      if (!billing) { setWelcomeChecked(true); return; }

      const isLastDay = (billing.trialDaysLeft ?? 1) <= 1;
      const shownToday = wb === todayStr();

      // Show welcome if: in trial AND (never shown today OR it's the last day)
      const should = billing.status === "trial" && (!shownToday || isLastDay);
      setShowWelcome(should);
      setWelcomeChecked(true);

      // Mark shown today
      if (should) AsyncStorage.setItem(TRIAL_WELCOME_KEY, todayStr());
    });
  }, [user, isLoading, billing]);

  const loading = isLoading || (user && !onboardingChecked) || (user && billingLoading) || (user && !welcomeChecked);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;
  if (!onboardingDone) return <Redirect href="/onboarding" />;

  // Subscription gate
  if (billing) {
    const isBlocked =
      BLOCKED_STATUSES.has(billing.status) ||
      (billing.status === "trial" && (billing.trialDaysLeft ?? 1) <= 0);
    if (isBlocked) return <Redirect href="/billing" />;
  }

  if (showWelcome) return <Redirect href="/trial-welcome" />;

  return <Redirect href="/(tabs)/" />;
}
