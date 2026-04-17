import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KlaroButton } from "@/components/KlaroButton";
import { SectionCollapsible } from "@/components/SectionCollapsible";
import { useAuth, type BusinessProfile } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getApiBaseUrl } from "@/constants/api";

const SEGMENTS = [
  { key: "varejo", label: "Varejo / Loja" },
  { key: "alimentacao", label: "Alimentação" },
  { key: "servicos", label: "Serviços" },
  { key: "saude", label: "Saúde / Beleza" },
  { key: "educacao", label: "Educação" },
  { key: "tecnologia", label: "Tecnologia" },
  { key: "construcao", label: "Construção" },
  { key: "transporte", label: "Transporte" },
  { key: "agro", label: "Agronegócio" },
  { key: "outro", label: "Outro" },
];

const SALES_CHANNELS = [
  { key: "presencial", label: "Presencial" },
  { key: "online", label: "Online" },
  { key: "ambos", label: "Presencial + Online" },
  { key: "delivery", label: "Delivery" },
  { key: "whatsapp", label: "WhatsApp" },
];

const ALL_DAYS = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

// Compute profile completeness (0–100)
function computeCompletion(fields: {
  businessName: string;
  segment: string;
  city: string;
  employeeCount: string;
  openDays: string[];
  revenueGoal: string;
  marginGoal: string;
  mainProducts: string;
  salesChannel: string;
  biggestChallenge: string;
}): number {
  const checks = [
    !!fields.businessName.trim(),
    !!fields.segment,
    !!fields.city.trim(),
    !!fields.employeeCount,
    fields.openDays.length > 0,
    !!fields.revenueGoal,
    !!fields.marginGoal,
    !!fields.mainProducts.trim(),
    !!fields.salesChannel,
    !!fields.biggestChallenge.trim(),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, updateUser, logout } = useAuth();
  const bp = user?.businessProfile;

  const [businessName, setBusinessName] = useState(bp?.businessName ?? "");
  const [segment, setSegment] = useState(bp?.segment ?? "");
  const [city, setCity] = useState(bp?.city ?? "");
  const [state, setState] = useState(bp?.state ?? "");
  const [employeeCount, setEmployeeCount] = useState(bp?.employeeCount ? String(bp.employeeCount) : "");
  const [openDays, setOpenDays] = useState<string[]>(bp?.openDays ?? []);
  const [openStart, setOpenStart] = useState(bp?.openHours?.start ?? "");
  const [openEnd, setOpenEnd] = useState(bp?.openHours?.end ?? "");
  const [revenueGoal, setRevenueGoal] = useState(bp?.monthlyRevenueGoal ? String(bp.monthlyRevenueGoal) : "");
  const [marginGoal, setMarginGoal] = useState(bp?.profitMarginGoal ? String(bp.profitMarginGoal) : "");
  const [mainProducts, setMainProducts] = useState(bp?.mainProducts ?? "");
  const [salesChannel, setSalesChannel] = useState(bp?.salesChannel ?? "");
  const [biggestChallenge, setBiggestChallenge] = useState(bp?.biggestChallenge ?? "");

  const [saving, setSaving] = useState(false);

  const baseUrl = getApiBaseUrl();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const completion = computeCompletion({
    businessName, segment, city, employeeCount,
    openDays, revenueGoal, marginGoal,
    mainProducts, salesChannel, biggestChallenge,
  });

  function toggleDay(day: string) {
    setOpenDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const profile: BusinessProfile = {
        businessName: businessName.trim() || undefined,
        segment: segment || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        employeeCount: employeeCount ? Number(employeeCount) : undefined,
        openDays: openDays.length > 0 ? openDays : undefined,
        openHours: openStart && openEnd ? { start: openStart.trim(), end: openEnd.trim() } : undefined,
        monthlyRevenueGoal: revenueGoal ? Number(revenueGoal.replace(",", ".")) : undefined,
        profitMarginGoal: marginGoal ? Number(marginGoal.replace(",", ".")) : undefined,
        mainProducts: mainProducts.trim() || undefined,
        salesChannel: salesChannel || undefined,
        biggestChallenge: biggestChallenge.trim() || undefined,
      };

      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ businessProfile: profile }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Erro", data.error ?? "Não foi possível salvar.");
        return;
      }

      await updateUser(data.user);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Salvo!", "Perfil atualizado com sucesso.");
    } catch {
      Alert.alert("Erro de conexão", "Verifique sua internet e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    Alert.alert("Sair", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/(auth)/login");
        },
      },
    ]);
  }

  const inputStyle = [
    styles.input,
    { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
  ];

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scroll,
        {
          paddingTop: topPad + 16,
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 40,
        },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>Perfil do Negócio</Text>
        <Text style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
          Essas informações melhoram a leitura dos seus arquivos e os insights gerados.
        </Text>
      </View>

      {/* Completion banner */}
      <View style={[styles.completionBanner, { backgroundColor: colors.card, borderColor: completion === 100 ? colors.income : colors.border, borderRadius: colors.radius }]}>
        <View style={styles.completionTop}>
          <View style={styles.completionLeft}>
            <Feather
              name={completion === 100 ? "check-circle" : "alert-circle"}
              size={16}
              color={completion === 100 ? colors.income : colors.primary}
            />
            <Text style={[styles.completionLabel, { color: colors.foreground }]}>
              Perfil {completion}% completo
            </Text>
          </View>
          <Text style={[styles.completionHint, { color: colors.mutedForeground }]}>
            {completion === 100 ? "Tudo certo!" : "Complete para melhores insights"}
          </Text>
        </View>
        <View style={[styles.completionTrack, { backgroundColor: colors.secondary }]}>
          <View
            style={[
              styles.completionFill,
              {
                width: `${completion}%`,
                backgroundColor: completion === 100 ? colors.income : colors.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* Account card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.cardRow}>
          <Feather name="user" size={16} color={colors.mutedForeground} />
          <Text style={[styles.cardText, { color: colors.foreground }]}>{user?.name}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.cardRow}>
          <Feather name="mail" size={16} color={colors.mutedForeground} />
          <Text style={[styles.cardText, { color: colors.mutedForeground }]}>{user?.email}</Text>
        </View>
      </View>

      {/* ── Section 1: Identidade ── */}
      <SectionCollapsible
        title="Identidade do negócio"
        icon="briefcase"
        subtitle={businessName || segment ? [businessName, SEGMENTS.find(s => s.key === segment)?.label].filter(Boolean).join(" · ") : "Nome, segmento, localização"}
        defaultOpen={!businessName}
      >
        <Field label="Nome do negócio">
          <TextInput
            style={inputStyle}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="Ex: Lanchonete da Maria"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
          />
        </Field>

        <Field label="Segmento">
          <View style={styles.chipRow}>
            {SEGMENTS.map((s) => {
              const sel = segment === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => setSegment(sel ? "" : s.key)}
                  style={[styles.chip, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]}
                >
                  <Text style={[styles.chipText, { color: sel ? colors.primaryForeground : colors.foreground }]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Cidade / Estado">
          <View style={styles.row2}>
            <TextInput
              style={[inputStyle, styles.flex2]}
              value={city}
              onChangeText={setCity}
              placeholder="Cidade"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />
            <TextInput
              style={[inputStyle, styles.flex1]}
              value={state}
              onChangeText={setState}
              placeholder="UF"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
        </Field>
      </SectionCollapsible>

      {/* ── Section 2: Operação ── */}
      <SectionCollapsible
        title="Operação"
        icon="settings"
        subtitle="Funcionários, dias e horários, canal de vendas"
        defaultOpen={false}
      >
        <Field label="Funcionários (aprox.)">
          <TextInput
            style={[inputStyle, styles.inputSmall]}
            value={employeeCount}
            onChangeText={setEmployeeCount}
            placeholder="0"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
          />
        </Field>

        <Field label="Dias de funcionamento">
          <View style={styles.chipRow}>
            {ALL_DAYS.map((d) => {
              const sel = openDays.includes(d.key);
              return (
                <Pressable
                  key={d.key}
                  onPress={() => toggleDay(d.key)}
                  style={[styles.chip, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]}
                >
                  <Text style={[styles.chipText, { color: sel ? colors.primaryForeground : colors.foreground }]}>{d.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Horário de funcionamento">
          <View style={styles.row2}>
            <TextInput
              style={[inputStyle, styles.flex1]}
              value={openStart}
              onChangeText={setOpenStart}
              placeholder="08:00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={[styles.timeSep, { color: colors.mutedForeground }]}>até</Text>
            <TextInput
              style={[inputStyle, styles.flex1]}
              value={openEnd}
              onChangeText={setOpenEnd}
              placeholder="18:00"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numbers-and-punctuation"
            />
          </View>
        </Field>

        <Field label="Principais produtos / serviços">
          <TextInput
            style={[inputStyle, styles.inputMulti]}
            value={mainProducts}
            onChangeText={setMainProducts}
            placeholder="Ex: Coxinha, pastel, suco natural"
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Field>

        <Field label="Canal de vendas principal">
          <View style={styles.chipRow}>
            {SALES_CHANNELS.map((c) => {
              const sel = salesChannel === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setSalesChannel(sel ? "" : c.key)}
                  style={[styles.chip, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]}
                >
                  <Text style={[styles.chipText, { color: sel ? colors.primaryForeground : colors.foreground }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>
      </SectionCollapsible>

      {/* ── Section 3: Metas & Desafios ── */}
      <SectionCollapsible
        title="Metas & Desafios"
        icon="target"
        subtitle={revenueGoal ? `Meta receita: R$ ${revenueGoal}` : "Defina suas metas para insights mais precisos"}
        defaultOpen={!revenueGoal}
      >
        <Field label="Meta de receita mensal (R$)">
          <TextInput
            style={[inputStyle, styles.inputSmall]}
            value={revenueGoal}
            onChangeText={setRevenueGoal}
            placeholder="Ex: 20000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
          />
        </Field>

        <Field label="Meta de margem de lucro (%)">
          <TextInput
            style={[inputStyle, styles.inputSmall]}
            value={marginGoal}
            onChangeText={setMarginGoal}
            placeholder="Ex: 20"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
          />
        </Field>

        <Field label="Maior desafio do negócio">
          <TextInput
            style={[inputStyle, styles.inputMulti]}
            value={biggestChallenge}
            onChangeText={setBiggestChallenge}
            placeholder="Ex: Controle de estoque, fluxo de caixa..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Field>
      </SectionCollapsible>

      <KlaroButton title="Salvar perfil" onPress={handleSave} loading={saving} fullWidth />

      {/* ── Conta ── */}
      <View style={styles.accountSection}>
        <Text style={[styles.accountTitle, { color: colors.mutedForeground }]}>Conta</Text>

        <View style={[styles.accountCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.accountRow,
              { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Feather name="log-out" size={18} color={colors.destructive} />
            <Text style={[styles.accountRowText, { color: colors.destructive }]}>Sair da conta</Text>
            <Feather name="chevron-right" size={16} color={colors.destructive} style={{ marginLeft: "auto" }} />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 16 },
  pageHeader: { gap: 6, marginBottom: 4 },
  pageTitle: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  pageSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  completionBanner: { borderWidth: 1, padding: 14, gap: 10 },
  completionTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  completionLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  completionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  completionHint: { fontSize: 12, fontFamily: "Inter_400Regular" },
  completionTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  completionFill: { height: 6, borderRadius: 3 },

  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  cardText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  divider: { height: 1 },

  field: { gap: 8 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  inputSmall: { width: 140 },
  inputMulti: { height: 88, paddingTop: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  row2: { flexDirection: "row", gap: 10, alignItems: "center" },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  timeSep: { fontSize: 13, fontFamily: "Inter_400Regular" },

  accountSection: { gap: 10, marginTop: 8 },
  accountTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.8, marginLeft: 4 },
  accountCard: { borderWidth: 1, overflow: "hidden" },
  accountRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  accountRowText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
