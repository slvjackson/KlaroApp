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
import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCardNumber(v: string) {
  return v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

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

// ─── PIX Result ───────────────────────────────────────────────────────────────

function PixResult({ qrCode, payload, expiresAt, colors }: {
  qrCode: string;
  payload: string;
  expiresAt: string;
  colors: ReturnType<typeof useColors>;
}) {
  const [copied, setCopied] = useState(false);

  const expires = new Date(expiresAt).toLocaleString("pt-BR", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
  });

  const copy = async () => {
    await Clipboard.setStringAsync(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, alignItems: "center" }]}>
      <Text style={[styles.sectionTitle, { color: colors.foreground, marginBottom: 4 }]}>Pague via PIX</Text>
      <Image
        source={{ uri: `data:image/png;base64,${qrCode}` }}
        style={{ width: 192, height: 192, borderRadius: 12, marginVertical: 8 }}
      />
      <Text style={[styles.disclaimer, { color: colors.mutedForeground, marginBottom: 8 }]}>Válido até {expires}</Text>
      <Pressable
        onPress={copy}
        style={({ pressed }) => [styles.copyBtn, { borderColor: colors.border, backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
      >
        <Feather name={copied ? "check" : "copy"} size={14} color={copied ? "#10b981" : colors.foreground} />
        <Text style={[styles.copyBtnText, { color: copied ? "#10b981" : colors.foreground }]}>
          {copied ? "Copiado!" : "Copiar código copia e cola"}
        </Text>
      </Pressable>
      <Text style={[styles.disclaimer, { color: colors.mutedForeground, marginTop: 8, textAlign: "center" }]}>
        Após o pagamento, sua conta será ativada automaticamente.
      </Text>
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
  const [paymentMethod, setPaymentMethod] = useState<"credit_card" | "pix">("credit_card");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [pixData, setPixData] = useState<{ qrCode: string; payload: string; expiresAt: string } | null>(null);

  const handleSubscribe = () => {
    const digits = cpfCnpj.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      Alert.alert("CPF/CNPJ inválido", "Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }

    const creditCard = paymentMethod === "credit_card" ? {
      holderName: cardName.trim(),
      number: cardNumber.replace(/\s/g, ""),
      expiryMonth: cardExpiry.split("/")[0] ?? "",
      expiryYear: `20${cardExpiry.split("/")[1] ?? ""}`,
      ccv: cardCvv,
    } : undefined;

    if (paymentMethod === "credit_card") {
      if (!creditCard!.holderName || creditCard!.number.length < 16 || creditCard!.expiryMonth.length < 2 || !creditCard!.ccv) {
        Alert.alert("Dados incompletos", "Preencha todos os dados do cartão.");
        return;
      }
    }

    subscribeMutation.mutate(
      { data: { billingCycle: selectedCycle, cpfCnpj: digits, paymentMethod, creditCard } },
      {
        onSuccess: (data) => {
          if (paymentMethod === "pix" && data.pixQrCode) {
            setPixData({ qrCode: data.pixQrCode, payload: data.pixPayload!, expiresAt: data.pixExpiresAt! });
          } else {
            queryClient.invalidateQueries({ queryKey: getBillingStatusQueryKey() });
            Alert.alert("Sucesso!", "Sua assinatura foi ativada.");
          }
        },
        onError: () => Alert.alert("Erro", "Não foi possível iniciar a assinatura. Tente novamente."),
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
  const inputStyle = [styles.input, { borderColor: colors.border, backgroundColor: colors.background, color: colors.foreground }];

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
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

      {/* PIX result */}
      {pixData && (
        <PixResult qrCode={pixData.qrCode} payload={pixData.payload} expiresAt={pixData.expiresAt} colors={colors} />
      )}

      {/* Plan selector + payment form */}
      {!isActive && !pixData && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Escolha seu plano</Text>

          {PLANS.map((plan) => {
            const selected = selectedCycle === plan.cycle;
            return (
              <Pressable
                key={plan.cycle}
                onPress={() => setSelectedCycle(plan.cycle)}
                style={[styles.planRow, {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? `${colors.primary}08` : colors.background,
                  borderRadius: colors.radius,
                }]}
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
                      <Text style={[styles.planTotal, { color: colors.mutedForeground }]}>R${plan.total} {plan.period}</Text>
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

          {/* Payment method toggle */}
          <View style={[styles.methodToggle, { borderColor: colors.border }]}>
            {(["credit_card", "pix"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setPaymentMethod(m)}
                style={[styles.methodBtn, { backgroundColor: paymentMethod === m ? colors.primary : "transparent" }]}
              >
                <Feather
                  name={m === "credit_card" ? "credit-card" : "grid"}
                  size={13}
                  color={paymentMethod === m ? "#fff" : colors.mutedForeground}
                />
                <Text style={[styles.methodBtnText, { color: paymentMethod === m ? "#fff" : colors.mutedForeground }]}>
                  {m === "credit_card" ? "Cartão" : "PIX"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* CPF/CNPJ */}
          <View style={styles.fieldWrap}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CPF ou CNPJ</Text>
            <TextInput
              value={cpfCnpj}
              onChangeText={(t) => setCpfCnpj(formatCpfCnpj(t))}
              placeholder="000.000.000-00"
              placeholderTextColor={`${colors.mutedForeground}60`}
              keyboardType="numeric"
              style={inputStyle}
            />
          </View>

          {/* Credit card fields */}
          {paymentMethod === "credit_card" && (
            <>
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Número do cartão</Text>
                <TextInput
                  value={cardNumber}
                  onChangeText={(t) => setCardNumber(formatCardNumber(t))}
                  placeholder="0000 0000 0000 0000"
                  placeholderTextColor={`${colors.mutedForeground}60`}
                  keyboardType="numeric"
                  style={inputStyle}
                />
              </View>
              <View style={styles.fieldWrap}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Nome no cartão</Text>
                <TextInput
                  value={cardName}
                  onChangeText={(t) => setCardName(t.toUpperCase())}
                  placeholder="COMO APARECE NO CARTÃO"
                  placeholderTextColor={`${colors.mutedForeground}60`}
                  autoCapitalize="characters"
                  style={inputStyle}
                />
              </View>
              <View style={styles.row}>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Validade</Text>
                  <TextInput
                    value={cardExpiry}
                    onChangeText={(t) => setCardExpiry(formatExpiry(t))}
                    placeholder="MM/AA"
                    placeholderTextColor={`${colors.mutedForeground}60`}
                    keyboardType="numeric"
                    style={inputStyle}
                  />
                </View>
                <View style={[styles.fieldWrap, { flex: 1 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CVV</Text>
                  <TextInput
                    value={cardCvv}
                    onChangeText={(t) => setCardCvv(t.replace(/\D/g, "").slice(0, 4))}
                    placeholder="123"
                    placeholderTextColor={`${colors.mutedForeground}60`}
                    keyboardType="numeric"
                    secureTextEntry
                    style={inputStyle}
                  />
                </View>
              </View>
            </>
          )}

          <Pressable
            onPress={handleSubscribe}
            disabled={subscribeMutation.isPending}
            style={({ pressed }) => [styles.ctaBtn, { backgroundColor: colors.primary, opacity: pressed || subscribeMutation.isPending ? 0.7 : 1 }]}
          >
            {subscribeMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.ctaBtnText}>
                {paymentMethod === "pix" ? "Gerar QR Code PIX" : "Assinar agora"}
              </Text>
            )}
          </Pressable>

          <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
            {paymentMethod === "pix"
              ? "Após o pagamento via PIX, ativação é automática."
              : "Pagamento seguro. Sem taxas ocultas."}
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
  root:         { flex: 1 },
  content:      { paddingHorizontal: 20, gap: 16 },
  backBtn:      { flexDirection: "row", alignItems: "center", gap: 6 },
  backText:     { fontSize: 13, fontFamily: "Inter_400Regular" },
  header:       { alignItems: "center", gap: 8, marginBottom: 4 },
  iconWrap:     { width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  title:        { fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle:     { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  skeleton:     { height: 64, borderRadius: 14 },
  banner:       { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1 },
  bannerTitle:  { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  bannerSub:    { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, opacity: 0.8 },
  card:         { borderWidth: 1, padding: 18, gap: 14 },
  sectionTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  planRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 2, padding: 14 },
  planLeft:     { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
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
  methodToggle: { flexDirection: "row", borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  methodBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  methodBtnText:{ fontSize: 13, fontFamily: "Inter_500Medium" },
  fieldWrap:    { gap: 6 },
  fieldLabel:   { fontSize: 12, fontFamily: "Inter_500Medium" },
  input:        { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  row:          { flexDirection: "row", gap: 12 },
  ctaBtn:       { paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  ctaBtnText:   { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  disclaimer:   { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  featureRow:   { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  featureText:  { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 19 },
  cancelLink:   { alignItems: "center", paddingVertical: 8 },
  cancelText:   { fontSize: 12, fontFamily: "Inter_400Regular", textDecorationLine: "underline" },
  copyBtn:      { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, width: "100%" },
  copyBtnText:  { fontSize: 13, fontFamily: "Inter_500Medium" },
});
