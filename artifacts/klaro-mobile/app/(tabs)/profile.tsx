import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, updateUser } = useAuth();
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

      {/* Account info */}
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

      {/* Business name */}
      <Field label="Nome do negócio" colors={colors}>
        <TextInput
          style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          value={businessName}
          onChangeText={setBusinessName}
          placeholder="Ex: Lanchonete da Maria"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="words"
        />
      </Field>

      {/* Segment */}
      <Field label="Segmento" colors={colors}>
        <View style={styles.chipRow}>
          {SEGMENTS.map((s) => {
            const sel = segment === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSegment(sel ? "" : s.key)}
                style={[styles.chip, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]}
              >
                <Text style={[styles.chipText, { color: sel ? "#000" : colors.foreground }]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      {/* Location */}
      <Field label="Cidade / Estado" colors={colors}>
        <View style={styles.row2}>
          <TextInput
            style={[styles.input, styles.flex2, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={city}
            onChangeText={setCity}
            placeholder="Cidade"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="words"
          />
          <TextInput
            style={[styles.input, styles.flex1, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={state}
            onChangeText={setState}
            placeholder="UF"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            maxLength={2}
          />
        </View>
      </Field>

      {/* Employees */}
      <Field label="Funcionários (aprox.)" colors={colors}>
        <TextInput
          style={[styles.input, styles.inputSmall, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          value={employeeCount}
          onChangeText={setEmployeeCount}
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
        />
      </Field>

      {/* Open days */}
      <Field label="Dias de funcionamento" colors={colors}>
        <View style={styles.chipRow}>
          {ALL_DAYS.map((d) => {
            const sel = openDays.includes(d.key);
            return (
              <Pressable
                key={d.key}
                onPress={() => toggleDay(d.key)}
                style={[styles.chip, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]}
              >
                <Text style={[styles.chipText, { color: sel ? "#000" : colors.foreground }]}>{d.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      {/* Open hours */}
      <Field label="Horário de funcionamento" colors={colors}>
        <View style={styles.row2}>
          <TextInput
            style={[styles.input, styles.flex1, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={openStart}
            onChangeText={setOpenStart}
            placeholder="08:00"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numbers-and-punctuation"
          />
          <Text style={[styles.timeSep, { color: colors.mutedForeground }]}>até</Text>
          <TextInput
            style={[styles.input, styles.flex1, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
            value={openEnd}
            onChangeText={setOpenEnd}
            placeholder="18:00"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </Field>

      {/* Revenue goal */}
      <Field label="Meta de receita mensal (R$)" colors={colors}>
        <TextInput
          style={[styles.input, styles.inputSmall, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          value={revenueGoal}
          onChangeText={setRevenueGoal}
          placeholder="Ex: 20000"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
        />
      </Field>

      {/* Margin goal */}
      <Field label="Meta de margem de lucro (%)" colors={colors}>
        <TextInput
          style={[styles.input, styles.inputSmall, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          value={marginGoal}
          onChangeText={setMarginGoal}
          placeholder="Ex: 20"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
        />
      </Field>

      {/* Main products */}
      <Field label="Principais produtos / serviços" colors={colors}>
        <TextInput
          style={[styles.input, styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          value={mainProducts}
          onChangeText={setMainProducts}
          placeholder="Ex: Coxinha, pastel, suco natural"
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </Field>

      {/* Sales channel */}
      <Field label="Canal de vendas principal" colors={colors}>
        <View style={styles.chipRow}>
          {SALES_CHANNELS.map((c) => {
            const sel = salesChannel === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setSalesChannel(sel ? "" : c.key)}
                style={[styles.chip, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]}
              >
                <Text style={[styles.chipText, { color: sel ? "#000" : colors.foreground }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      {/* Biggest challenge */}
      <Field label="Maior desafio do negócio" colors={colors}>
        <TextInput
          style={[styles.input, styles.inputMulti, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
          value={biggestChallenge}
          onChangeText={setBiggestChallenge}
          placeholder="Ex: Controle de estoque, fluxo de caixa..."
          placeholderTextColor={colors.mutedForeground}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </Field>

      <KlaroButton title="Salvar perfil" onPress={handleSave} loading={saving} fullWidth />
    </ScrollView>
  );
}

function Field({
  label,
  colors,
  children,
}: {
  label: string;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 20 },
  pageHeader: { gap: 6, marginBottom: 4 },
  pageTitle: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  pageSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cardText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  divider: { height: 1 },
  field: { gap: 8 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  inputSmall: { width: 140 },
  inputMulti: { height: 88, paddingTop: 12 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  row2: { flexDirection: "row", gap: 10, alignItems: "center" },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  timeSep: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
