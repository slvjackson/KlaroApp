import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { getApiBaseUrl } from "@/constants/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnamneseData {
  tempoMercado: string;
  tipoNegocio: string;
  ticketMedio: string;
  faixaFaturamento: string;
  controleFinanceiro: string;
  sabeLucro: string;
  separaFinancas: string;
  conheceCustos: string;
  comoDecide: string;
  deixouInvestir: string;
  surpresaCaixa: string;
  maiorDificuldade: string;
  querMelhorar: string;
  comMaisClareza: string;
  observacoesAdicionais: string;
}

const SECTIONS = [
  { title: "Visão Geral do Negócio", subtitle: "Vamos entender onde você está no mercado para contextualizar os dados." },
  { title: "Controle Financeiro", subtitle: "Como está sua relação atual com os números do negócio?" },
  { title: "Operação e Decisão", subtitle: "Entender como você toma decisões nos ajuda a gerar alertas mais certeiros." },
  { title: "Dores e Desejos", subtitle: "Isso é ouro. Suas respostas moldam diretamente os insights que vamos gerar." },
  { title: "Contexto Adicional", subtitle: "Informações extras que ajudam a IA a entender seu negócio com mais profundidade. 100% opcional." },
];

const OBS_SUGGESTIONS = [
  { label: "Região / mercado local", snippet: "Minha região tem características específicas: " },
  { label: "Sazonalidade", snippet: "Períodos de alta/baixa no meu negócio: " },
  { label: "Perfil dos clientes", snippet: "Meus clientes são principalmente: " },
  { label: "Concorrência", snippet: "Sobre a concorrência local: " },
  { label: "Empresa familiar", snippet: "É uma empresa familiar. " },
  { label: "Expansão / crescimento", snippet: "Meu plano de crescimento é: " },
  { label: "Fornecedores", snippet: "Dependência de fornecedores: " },
  { label: "Algo que a IA deve saber", snippet: "Informação importante sobre meu negócio: " },
];

// ─── Chip ────────────────────────────────────────────────────────────────────

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? `${colors.primary}22` : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.primary : colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

// ─── ChipsQuestion ────────────────────────────────────────────────────────────

function ChipsQuestion({
  label, hint, field, options, data, set,
}: {
  label: string; hint?: string; field: keyof AnamneseData;
  options: { value: string; label: string }[];
  data: AnamneseData; set: (f: keyof AnamneseData, v: string) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.question}>
      <Text style={[styles.questionLabel, { color: colors.foreground }]}>{label}</Text>
      {hint && <Text style={[styles.questionHint, { color: colors.mutedForeground }]}>{hint}</Text>}
      <View style={styles.chipRow}>
        {options.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={data[field] === o.value}
            onPress={() => set(field, data[field] === o.value ? "" : o.value)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── AnamneseTextarea ─────────────────────────────────────────────────────────

function AnamneseTextarea({
  label, hint, value, onChange, rows = 4,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; rows?: number;
}) {
  const colors = useColors();
  return (
    <View style={styles.question}>
      <Text style={[styles.questionLabel, { color: colors.foreground }]}>{label}</Text>
      {hint && <Text style={[styles.questionHint, { color: colors.mutedForeground }]}>{hint}</Text>}
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline
        numberOfLines={rows}
        placeholder="Escreva aqui…"
        placeholderTextColor={colors.mutedForeground}
        textAlignVertical="top"
        style={[
          styles.textarea,
          { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background, height: rows * 22 + 24 },
        ]}
      />
    </View>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnamneseScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token, updateUser } = useAuth();
  const bp = user?.businessProfile;
  const baseUrl = getApiBaseUrl();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const [data, setData] = useState<AnamneseData>({
    tempoMercado: bp?.tempoMercado ?? "",
    tipoNegocio: bp?.tipoNegocio ?? "",
    ticketMedio: bp?.ticketMedio ?? "",
    faixaFaturamento: bp?.faixaFaturamento ?? "",
    controleFinanceiro: bp?.controleFinanceiro ?? "",
    sabeLucro: bp?.sabeLucro ?? "",
    separaFinancas: bp?.separaFinancas ?? "",
    conheceCustos: bp?.conheceCustos ?? "",
    comoDecide: bp?.comoDecide ?? "",
    deixouInvestir: bp?.deixouInvestir ?? "",
    surpresaCaixa: bp?.surpresaCaixa ?? "",
    maiorDificuldade: bp?.maiorDificuldade ?? "",
    querMelhorar: bp?.querMelhorar ?? "",
    comMaisClareza: bp?.comMaisClareza ?? "",
    observacoesAdicionais: bp?.observacoesAdicionais ?? "",
  });

  const set = (field: keyof AnamneseData, value: string) =>
    setData((prev) => ({ ...prev, [field]: value }));

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          businessProfile: { ...bp, ...data, anamneseCompleted: true },
        }),
      });
      const json = await res.json();
      if (res.ok && json.user) await updateUser(json.user);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch {
      // silent — success screen still shows
    } finally {
      setSaving(false);
    }
  }

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const progress = ((step + 1) / SECTIONS.length) * 100;

  // ── Success screen ─────────────────────────────────────────────────────────
  if (done) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.doneWrap, { paddingTop: topPad + 40, paddingBottom: insets.bottom + 32 }]}>
          <View style={[styles.doneIcon, { backgroundColor: `${colors.primary}22` }]}>
            <Feather name="check-circle" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.doneTitle, { color: colors.foreground }]}>Diagnóstico concluído!</Text>
          <Text style={[styles.doneSub, { color: colors.mutedForeground }]}>
            Suas respostas foram salvas. A Klaro IA vai usar esse contexto para gerar insights muito mais precisos e relevantes pro seu negócio.
          </Text>
          <View style={styles.doneButtons}>
            <Pressable
              onPress={() => router.replace("/(tabs)/insights")}
              style={({ pressed }) => [styles.btnPrimary, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
            >
              <Text style={[styles.btnPrimaryText, { color: colors.primaryForeground }]}>Ver meus insights</Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace("/(tabs)/profile")}
              style={({ pressed }) => [styles.btnSecondary, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.btnSecondaryText, { color: colors.mutedForeground }]}>Ir para o perfil</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => (step > 0 ? setStep(step - 1) : router.back())} hitSlop={12}>
          <Feather name="chevron-left" size={24} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Diagnóstico do Negócio</Text>
        </View>
        <Pressable onPress={() => router.replace("/(tabs)/insights")} hitSlop={12}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Pular</Text>
        </Pressable>
      </View>

      {/* Progress */}
      <View style={[styles.progressWrap, { borderBottomColor: colors.border }]}>
        <View style={styles.progressInfo}>
          <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>{SECTIONS[step].title}</Text>
          <Text style={[styles.progressCount, { color: colors.mutedForeground }]}>{step + 1} / {SECTIONS.length}</Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { width: `${progress}%` as `${number}%`, backgroundColor: colors.primary }]} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Section title */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{SECTIONS[step].title}</Text>
          <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>{SECTIONS[step].subtitle}</Text>
        </View>

        {/* ── Section 1: Visão Geral ── */}
        {step === 0 && (
          <View style={styles.questions}>
            <ChipsQuestion label="Há quanto tempo está no mercado?" field="tempoMercado" data={data} set={set}
              options={[
                { value: "menos_1_ano", label: "Menos de 1 ano" },
                { value: "1_2_anos", label: "1 a 2 anos" },
                { value: "3_5_anos", label: "3 a 5 anos" },
                { value: "5_10_anos", label: "5 a 10 anos" },
                { value: "mais_10_anos", label: "Mais de 10 anos" },
              ]}
            />
            <ChipsQuestion label="Você vende produto, serviço ou ambos?" field="tipoNegocio" data={data} set={set}
              options={[
                { value: "produto", label: "Produto" },
                { value: "servico", label: "Serviço" },
                { value: "ambos", label: "Produto + Serviço" },
              ]}
            />
            <ChipsQuestion label="Qual é o seu ticket médio por venda?"
              hint="Valor médio que cada cliente paga por pedido ou serviço"
              field="ticketMedio" data={data} set={set}
              options={[
                { value: "ate_100", label: "Até R$100" },
                { value: "100_500", label: "R$100 – R$500" },
                { value: "500_1000", label: "R$500 – R$1.000" },
                { value: "1000_5000", label: "R$1k – R$5k" },
                { value: "acima_5000", label: "Acima de R$5k" },
              ]}
            />
            <ChipsQuestion label="Qual a faixa do seu faturamento mensal?" field="faixaFaturamento" data={data} set={set}
              options={[
                { value: "ate_5k", label: "Até R$5k" },
                { value: "5k_15k", label: "R$5k – R$15k" },
                { value: "15k_30k", label: "R$15k – R$30k" },
                { value: "30k_100k", label: "R$30k – R$100k" },
                { value: "acima_100k", label: "Acima de R$100k" },
              ]}
            />
          </View>
        )}

        {/* ── Section 2: Controle Financeiro ── */}
        {step === 1 && (
          <View style={styles.questions}>
            <ChipsQuestion label="Hoje você controla seu financeiro como?" field="controleFinanceiro" data={data} set={set}
              options={[
                { value: "sistema", label: "Sistema / App" },
                { value: "excel", label: "Excel / Planilha" },
                { value: "caderno", label: "Caderno / Papel" },
                { value: "nao_controlo", label: "Não controlo" },
              ]}
            />
            <ChipsQuestion label="Você sabe seu lucro mensal com precisão?" field="sabeLucro" data={data} set={set}
              options={[
                { value: "sim", label: "Sim, sei com clareza" },
                { value: "mais_ou_menos", label: "Mais ou menos" },
                { value: "nao", label: "Não sei" },
              ]}
            />
            <ChipsQuestion label="Você separa as finanças pessoais das do negócio?" field="separaFinancas" data={data} set={set}
              options={[
                { value: "sempre", label: "Sempre separo" },
                { value: "as_vezes", label: "Às vezes misturo" },
                { value: "nao", label: "Não separo" },
              ]}
            />
            <ChipsQuestion label="Você conhece seus principais custos fixos e variáveis?" field="conheceCustos" data={data} set={set}
              options={[
                { value: "sim", label: "Sim, tenho clareza" },
                { value: "parcialmente", label: "Parcialmente" },
                { value: "nao", label: "Não tenho clareza" },
              ]}
            />
          </View>
        )}

        {/* ── Section 3: Operação e Decisão ── */}
        {step === 2 && (
          <View style={styles.questions}>
            <ChipsQuestion label="Como você toma decisões no negócio hoje?" field="comoDecide" data={data} set={set}
              options={[
                { value: "numeros", label: "Baseado em números" },
                { value: "intuicao", label: "Intuição / Experiência" },
                { value: "misturado", label: "Mistura dos dois" },
              ]}
            />
            <ChipsQuestion
              label="Você já deixou de investir ou crescer por insegurança financeira?"
              hint="Aquela sensação de querer expandir mas não saber se dá"
              field="deixouInvestir" data={data} set={set}
              options={[
                { value: "sim", label: "Sim, já aconteceu" },
                { value: "nao", label: "Não, nunca" },
              ]}
            />
            <ChipsQuestion
              label="Você já teve surpresa negativa no caixa?"
              hint="Achou que tinha dinheiro e não tinha, ou conta chegou inesperadamente"
              field="surpresaCaixa" data={data} set={set}
              options={[
                { value: "frequentemente", label: "Sim, frequentemente" },
                { value: "as_vezes", label: "Às vezes" },
                { value: "nao", label: "Não, raramente" },
              ]}
            />
          </View>
        )}

        {/* ── Section 4: Dores e Desejos ── */}
        {step === 3 && (
          <View style={styles.questions}>
            <AnamneseTextarea
              label="Qual é sua maior dificuldade hoje na gestão financeira do negócio?"
              hint="Seja direto — isso vira insight personalizado"
              value={data.maiorDificuldade}
              onChange={(v) => set("maiorDificuldade", v)}
            />
            <AnamneseTextarea
              label="O que você mais quer melhorar no seu negócio nos próximos 6 meses?"
              value={data.querMelhorar}
              onChange={(v) => set("querMelhorar", v)}
            />
            <AnamneseTextarea
              label="Se tivesse clareza total dos seus números, o que faria diferente?"
              hint="Pode ser uma decisão, um investimento, uma mudança"
              value={data.comMaisClareza}
              onChange={(v) => set("comMaisClareza", v)}
            />
          </View>
        )}

        {/* ── Section 5: Contexto Adicional ── */}
        {step === 4 && (
          <View style={styles.questions}>
            <View style={styles.question}>
              <Text style={[styles.questionLabel, { color: colors.foreground }]}>Contexto livre para a IA</Text>
              <Text style={[styles.questionHint, { color: colors.mutedForeground }]}>
                Escreva qualquer informação que ajude a IA a entender melhor o seu negócio — mercado local, sazonalidade, perfil dos clientes, concorrência, planos de crescimento, peculiaridades da operação.
              </Text>
              <TextInput
                value={data.observacoesAdicionais}
                onChangeText={(v) => set("observacoesAdicionais", v)}
                multiline
                numberOfLines={7}
                placeholder={`Ex: "Minha cidade tem forte sazonalidade no verão. Atendo principalmente mulheres entre 30–50 anos. Tenho 2 sócios. Quero abrir uma segunda unidade em 2026."`}
                placeholderTextColor={colors.mutedForeground}
                textAlignVertical="top"
                style={[
                  styles.textarea,
                  styles.textareaLarge,
                  { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background },
                ]}
              />
            </View>
            <View style={styles.question}>
              <Text style={[styles.suggestionTitle, { color: colors.mutedForeground }]}>Sugestões de tópicos — toque para adicionar:</Text>
              <View style={styles.chipRow}>
                {OBS_SUGGESTIONS.map((s) => (
                  <Pressable
                    key={s.label}
                    onPress={() => set("observacoesAdicionais",
                      (data.observacoesAdicionais ? data.observacoesAdicionais.trimEnd() + "\n" : "") + s.snippet
                    )}
                    style={({ pressed }) => [
                      styles.chip,
                      { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: colors.mutedForeground }]}>+ {s.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Navigation footer */}
      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom + 16, backgroundColor: colors.background }]}>
        {step < SECTIONS.length - 1 ? (
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(step + 1); }}
            style={({ pressed }) => [styles.btnPrimary, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1, flex: 1 }]}
          >
            <Text style={[styles.btnPrimaryText, { color: colors.primaryForeground }]}>Próximo</Text>
            <Feather name="chevron-right" size={18} color={colors.primaryForeground} />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [styles.btnPrimary, { backgroundColor: colors.primary, opacity: pressed || saving ? 0.7 : 1, flex: 1 }]}
          >
            <Feather name="check" size={18} color={colors.primaryForeground} />
            <Text style={[styles.btnPrimaryText, { color: colors.primaryForeground }]}>
              {saving ? "Salvando…" : "Concluir diagnóstico"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  skipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  progressWrap: { paddingHorizontal: 20, paddingVertical: 12, gap: 8, borderBottomWidth: 1 },
  progressInfo: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  progressCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 4, borderRadius: 2 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, gap: 0 },
  sectionHeader: { marginBottom: 24, gap: 6 },
  sectionTitle: { fontSize: 19, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  questions: { gap: 28 },
  question: { gap: 10 },
  questionLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 20 },
  questionHint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: -4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  textarea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  textareaLarge: { height: 160 },
  suggestionTitle: { fontSize: 12, fontFamily: "Inter_500Medium" },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    flexDirection: "row",
    gap: 12,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 14,
  },
  btnPrimaryText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  btnSecondary: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
  },
  btnSecondaryText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  // Done screen
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 16 },
  doneIcon: { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  doneSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 21 },
  doneButtons: { gap: 12, width: "100%", marginTop: 8 },
});
