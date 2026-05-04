import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  useGetBillingStatus,
  useSubscribe,
  useCancelSubscription,
  getBillingStatusQueryKey,
} from "@workspace/api-client-react";
import type { BillingCycle } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

// ─── Pricing data ─────────────────────────────────────────────────────────────

type PlanOption = {
  cycle: BillingCycle;
  label: string;
  monthly: number;
  total: number;
  period: string;
  badge?: string;
};

const PLANS: PlanOption[] = [
  { cycle: "monthly",    label: "Mensal",    monthly: 149,  total: 149,   period: "por mês" },
  { cycle: "semiannual", label: "Semestral", monthly: 129,  total: 774,   period: "por semestre", badge: "Economize R$120" },
  { cycle: "annual",     label: "Anual",     monthly: 99,   total: 1188,  period: "por ano",      badge: "Mais popular" },
];

const FEATURES = [
  "Upload ilimitado (CSV, XLSX, imagens, PDF)",
  "Extração automática de transações por IA",
  "Insights financeiros personalizados",
  "Chat com IA sobre seu caixa",
  "Dashboard com tendências e categorias",
  "Suporte por WhatsApp",
];

// ─── Status banner ────────────────────────────────────────────────────────────

function StatusBanner({ status, trialDaysLeft, currentPeriodEnd, billingCycle, colors }: {
  status: string;
  trialDaysLeft?: number | null;
  currentPeriodEnd?: string | null;
  billingCycle?: string | null;
  colors: ReturnType<typeof useColors>;
}) {
  if (status === "active") {
    const until = currentPeriodEnd
      ? new Date(currentPeriodEnd).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
      : null;
    const cycleLabel = billingCycle === "monthly" ? "Mensal" : billingCycle === "semiannual" ? "Semestral" : "Anual";
    return (
      <View style={[styles.banner, { backgroundColor: "rgba(16,185,129,0.08)", borderColor: "rgba(16,185,129,0.3)" }]}>
        <Feather name="check-circle" size={16} color="#10b981" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.bannerTitle, { color: "#10b981" }]}>Assinatura ativa — Plano {cycleLabel}</Text>
          {until && <Text style={[styles.bannerSub, { color: "#10b981" }]}>Próxima renovação: {until}</Text>}
        </View>
      </View>
    );
  }

  if (status === "trial") {
    const days = trialDaysLeft ?? 0;
    return (
      <View style={[styles.banner, { backgroundColor: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.3)" }]}>
        <Feather name="clock" size={16} color="#f59e0b" />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.bannerTitle, { color: "#f59e0b" }]}>Período de teste</Text>
          <Text style={[styles.bannerSub, { color: "#f59e0b" }]}>
            {days > 0 ? `${days} ${days === 1 ? "dia restante" : "dias restantes"}` : "Expira hoje — assine para continuar."}
          </Text>
        </View>
      </View>
    );
  }

  const labels: Record<string, string> = {
    overdue:   "Pagamento pendente — regularize para continuar.",
    cancelled: "Assinatura cancelada.",
    expired:   "Período de teste encerrado.",
  };
  return (
    <View style={[styles.banner, { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)" }]}>
      <Feather name="x-circle" size={16} color="#ef4444" />
      <Text style={[styles.bannerTitle, { color: "#ef4444", marginLeft: 10 }]}>{labels[status] ?? "Assinatura inativa."}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BillingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const { data: billing, isLoading } = useGetBillingStatus();
  const subscribeMutation = useSubscribe();
  const cancelMutation = useCancelSubscription();

  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>("annual");
  const [cpfCnpj, setCpfCnpj] = useState("");

  function formatCpfCnpj(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    if (digits.length <= 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) =>
        d ? `${a}.${b}.${c}-${d}` : c ? `${a}.${b}.${c}` : b ? `${a}.${b}` : a
      );
    }
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, d, e) =>
      e ? `${a}.${b}.${c}/${d}-${e}` : d ? `${a}.${b}.${c}/${d}` : c ? `${a}.${b}.${c}` : b ? `${a}.${b}` : a
    );
  }

  const handleSubscribe = () => {
    const digits = cpfCnpj.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      Alert.alert("CPF/CNPJ inválido", "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }
    subscribeMutation.mutate(
      { data: { billingCycle: selectedCycle, cpfCnpj: digits } },
      {
        onSuccess: ({ paymentUrl }) => {
          if (paymentUrl) {
            Linking.openURL(paymentUrl);
          } else {
            Alert.alert("Erro", "Não foi possível obter o link de pagamento.");
          }
        },
        onError: () => {
          Alert.alert("Erro", "Não foi possível iniciar a assinatura. Tente novamente.");
        },
      },
    );
  };

  const handleCancel = () => {
    Alert.alert(
      "Cancelar assinatura",
      "Após cancelar, você perderá acesso ao Klaro ao fim do período atual. Deseja continuar?",
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Cancelar assinatura",
          style: "destructive",
          onPress: () => {
            cancelMutation.mutate(undefined, {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: getBillingStatusQueryKey() });
                Alert.alert("Cancelado", "Sua assinatura foi cancelada.");
              },
              onError: () => Alert.alert("Erro", "Não foi possível cancelar. Tente novamente."),
            });
          },
        },
      ],
    );
  };

  const isActive = billing?.status === "active";

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Back */}
      <Pressable onPress={() => router.push("/(tabs)")} style={styles.backBtn}>
        <Feather name="arrow-left" size={16} color={colors.mutedForeground} />
        <Text style={[styles.backText, { color: colors.mutedForeground }]}>Voltar ao dashboard</Text>
      </Pressable>

      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${colors.primary}1a` }]}>
          <Feather name="zap" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Assine Klaro</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Controle financeiro com inteligência artificial para o seu negócio.
        </Text>
      </View>

      {/* Status */}
      {isLoading ? (
        <View style={[styles.skeleton, { backgroundColor: colors.muted }]} />
      ) : billing ? (
        <StatusBanner
          status={billing.status}
          trialDaysLeft={billing.trialDaysLeft}
          currentPeriodEnd={billing.currentPeriodEnd}
          billingCycle={billing.billingCycle}
          colors={colors}
        />
      ) : null}

      {/* Plan selector */}
      {!isActive && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Escolha seu plano</Text>

          {PLANS.map((plan) => {
            const selected = selectedCycle === plan.cycle;
            return (
              <Pressable
                key={plan.cycle}
                onPress={() => setSelectedCycle(plan.cycle)}
                style={[
                  styles.planRow,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? `${colors.primary}08` : colors.background,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <View style={styles.planLeft}>
                  <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.mutedForeground }]}>
                    {selected && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
                  </View>
                  <View>
                    <View style={styles.planLabelRow}>
                      <Text style={[styles.planLabel, { color: colors.foreground }]}>{plan.label}</Text>
                      {plan.badge && (
                        <View style={[styles.badge, { backgroundColor: `${colors.primary}15` }]}>
                          <Text style={[styles.badgeText, { color: colors.primary }]}>{plan.badge}</Text>
                        </View>
                      )}
                    </View>
                    {plan.cycle !== "monthly" && (
                      <Text style={[styles.planTotal, { color: colors.mutedForeground }]}>
                        R${plan.total} {plan.period}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.planRight}>
                  <Text style={[styles.planPrice, { color: colors.foreground }]}>R${plan.monthly}</Text>
                  <Text style={[styles.planPer, { color: colors.mutedForeground }]}>/mês</Text>
                </View>
              </Pressable>
            );
          })}

          <View style={styles.cpfWrap}>
            <Text style={[styles.cpfLabel, { color: colors.mutedForeground }]}>CPF ou CNPJ</Text>
            <TextInput
              value={cpfCnpj}
              onChangeText={(t) => setCpfCnpj(formatCpfCnpj(t))}
              placeholder="000.000.000-00"
              placeholderTextColor={`${colors.mutedForeground}60`}
              keyboardType="numeric"
              style={[styles.cpfInput, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }]}
            />
          </View>

          <Pressable
            onPress={handleSubscribe}
            disabled={subscribeMutation.isPending}
            style={({ pressed }) => [
              styles.ctaBtn,
              { backgroundColor: colors.primary, opacity: pressed || subscribeMutation.isPending ? 0.7 : 1 },
            ]}
          >
            {subscribeMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.ctaBtnText}>Assinar agora</Text>
            )}
          </Pressable>

          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            Pagamento seguro via PIX. Ativação automática após confirmação.
          </Text>
        </View>
      )}

      {/* Features */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>O que está incluído</Text>
        {FEATURES.map((f) => (
          <View key={f} style={styles.featureRow}>
            <Feather name="check-circle" size={14} color={colors.primary} style={{ marginTop: 1 }} />
            <Text style={[styles.featureText, { color: colors.mutedForeground }]}>{f}</Text>
          </View>
        ))}
      </View>

      {/* Cancel */}
      {isActive && (
        <Pressable onPress={handleCancel} style={styles.cancelLink}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancelar assinatura</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  header:  { alignItems: "center", gap: 8, marginBottom: 4 },
  iconWrap: { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title:   { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  skeleton: { height: 64, borderRadius: 14 },
  banner:  { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1 },
  bannerTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  bannerSub:   { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, opacity: 0.8 },
  card:    { borderWidth: 1, padding: 18, gap: 14 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  planRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 2, padding: 14 },
  planLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  planLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  planLabel:    { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  planTotal:    { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  planRight:    { flexDirection: "row", alignItems: "baseline", gap: 1 },
  planPrice:    { fontSize: 18, fontFamily: "Inter_700Bold" },
  planPer:      { fontSize: 12, fontFamily: "Inter_400Regular" },
  radio:        { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot:     { width: 8, height: 8, borderRadius: 4 },
  badge:        { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText:    { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  cpfWrap:      { gap: 6 },
  cpfLabel:     { fontSize: 12, fontFamily: "Inter_500Medium" },
  cpfInput:     { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  ctaBtn:       { paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  ctaBtnText:   { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  disclaimer:   { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  featureRow:   { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  featureText:  { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 19 },
  cancelLink:   { alignItems: "center", paddingVertical: 8 },
  cancelText:   { fontSize: 12, fontFamily: "Inter_400Regular", textDecorationLine: "underline" },
  backBtn:      { flexDirection: "row", alignItems: "center", gap: 6 },
  backText:     { fontSize: 13, fontFamily: "Inter_400Regular" },
});
