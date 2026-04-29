import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  customFetch,
  useGetMonthlyTrend,
  useListTransactions,
  useGetDashboardSummary,
} from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const KLARO_LOGO = require("@/assets/images/icon.png");
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MarkdownText } from "@/components/MarkdownText";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { getApiBaseUrl } from "@/constants/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const CHAT_HISTORY_KEY = "klaro_chat_history";
const MAX_PERSISTED = 40;

// ─── Dynamic suggestions ──────────────────────────────────────────────────────

const MONTH_NAMES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function useDynamicSuggestions(): string[] {
  const { data: trend } = useGetMonthlyTrend();
  const { data: summary } = useGetDashboardSummary();
  const { data: expenseTx } = useListTransactions({ type: "expense", limit: 500 });

  return useMemo(() => {
    const suggestions: string[] = [];
    const trendData = Array.isArray(trend) ? trend : [];

    // Previous month name
    const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const prevMonthIdx = now.getUTCMonth() === 0 ? 11 : now.getUTCMonth() - 1;
    const prevMonthName = MONTH_NAMES_PT[prevMonthIdx];

    // Month-over-month growth
    const last2 = trendData.slice(-2);
    if (last2.length === 2 && last2[0].income > 0) {
      const growth = ((last2[1].income - last2[0].income) / last2[0].income) * 100;
      if (Math.abs(growth) >= 5) {
        suggestions.push(
          growth >= 0
            ? `Minha receita cresceu ${growth.toFixed(0)}% este mês. Qual o motivo?`
            : `Por que minha receita caiu ${Math.abs(growth).toFixed(0)}% em relação ao mês passado?`,
        );
      }
    }

    // Previous month question
    if (prevMonthName) {
      suggestions.push(`Como foi ${prevMonthName}?`);
    }

    // Top expense category
    if (Array.isArray(expenseTx) && expenseTx.length > 0) {
      const catMap = new Map<string, number>();
      for (const t of expenseTx) catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount);
      const top = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) suggestions.push(`Por que estou gastando tanto em ${top[0]}?`);
    }

    // Expense ratio
    const totalIncome = summary?.totalIncome ?? 0;
    const totalExpenses = summary?.totalExpenses ?? 0;
    if (totalIncome > 0) {
      const ratio = totalExpenses / totalIncome;
      if (ratio > 0.8) {
        suggestions.push("Como posso reduzir minhas despesas?");
      } else {
        suggestions.push("Como está minha margem de lucro?");
      }
    }

    // Best month
    if (trendData.length > 1) {
      const best = trendData.reduce((b, m) => (m.income > b.income ? m : b), trendData[0]);
      const [, m] = best.month.split("-");
      suggestions.push(`Qual foi meu melhor mês? (Dica: ${MONTH_NAMES_PT[parseInt(m, 10) - 1]})`);
    }

    // Fallbacks to always have 5
    const fallbacks = [
      "Como está minha margem de lucro?",
      "Quais são minhas principais receitas?",
      "Onde estou gastando mais?",
      "Qual foi meu melhor mês?",
      `Como foi ${prevMonthName}?`,
    ];

    const final = [...suggestions];
    for (const fb of fallbacks) {
      if (final.length >= 5) break;
      if (!final.includes(fb)) final.push(fb);
    }

    return final.slice(0, 5);
  }, [trend, summary, expenseTx]);
}

// ─── Voice input hook ─────────────────────────────────────────────────────────

function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);

  // Only functional on web via the Web Speech API
  function start() {
    if (Platform.OS !== "web") return;

    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ??
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      Alert.alert("Não disponível", "Seu navegador não suporta reconhecimento de voz.");
      return;
    }

    const recognition = new (SpeechRecognition as new () => {
      lang: string;
      interimResults: boolean;
      onresult: (e: { results: { [key: number]: { [key: number]: { transcript: string } } } }) => void;
      onerror: () => void;
      onend: () => void;
      start: () => void;
    })();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  return { listening, start };
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({
  message,
  colors,
  onSave,
}: {
  message: Message;
  colors: ReturnType<typeof useColors>;
  onSave?: (content: string) => void;
}) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <Image source={KLARO_LOGO} style={styles.avatar} />
      )}
      <View style={isUser ? styles.bubbleUserWrap : styles.bubbleAssistantWrap}>
        <View
          style={[
            styles.bubble,
            isUser
              ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
              : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
          ]}
        >
          {isUser ? (
            <Text style={[styles.bubbleText, { color: colors.primaryForeground }]}>
              {message.content}
            </Text>
          ) : (
            <MarkdownText
              text={message.content}
              color={colors.foreground}
              mutedColor={colors.mutedForeground}
              cardColor={colors.card}
              borderColor={colors.border}
              style={styles.bubbleText}
            />
          )}
        </View>
        {!isUser && onSave && (
          <Pressable
            onPress={() => onSave(message.content)}
            hitSlop={8}
            style={({ pressed }) => [styles.saveBtn, { opacity: pressed ? 0.5 : 1 }]}
          >
            <Feather name="bookmark" size={13} color={colors.mutedForeground} />
            <Text style={[styles.saveBtnText, { color: colors.mutedForeground }]}>
              Salvar como insight
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ hint, colors }: { hint: string | null; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.typingRow, { paddingHorizontal: 20 }]}>
      <Image source={KLARO_LOGO} style={styles.avatar} />
      <View
        style={[
          styles.bubble,
          styles.typingBubble,
          { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary} />
        {hint ? (
          <Text style={[styles.typingHint, { color: colors.mutedForeground }]}>{hint}</Text>
        ) : null}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [toolHint, setToolHint] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const baseUrl = getApiBaseUrl();

  const suggestions = useDynamicSuggestions();

  const { listening, start: startVoice } = useVoiceInput((transcript) => {
    setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
  });

  // Load persisted history
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CHAT_HISTORY_KEY);
        if (raw) {
          const parsed: Message[] = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
        }
      } catch {
        // ignore
      } finally {
        setHistoryLoaded(true);
      }
    })();
  }, []);

  // Persist history
  useEffect(() => {
    if (!historyLoaded) return;
    AsyncStorage.setItem(
      CHAT_HISTORY_KEY,
      JSON.stringify(messages.slice(-MAX_PERSISTED)),
    ).catch(() => {});
  }, [messages, historyLoaded]);

  const sendMutation = useMutation({
    mutationFn: ({
      message,
      history,
    }: {
      message: string;
      history: { role: string; content: string }[];
    }) =>
      customFetch<{ reply: string }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message, history }),
      }),
  });

  const saveInsightMutation = useMutation({
    mutationFn: (body: { title: string; description: string; recommendation: string; periodLabel: string }) =>
      customFetch<{ id: number }>(`${baseUrl}/api/insights`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  });

  function inferHint(msg: string): string {
    const l = msg.toLowerCase();
    if (/hoje|agora|vendas de hoje/.test(l)) return "Consultando transações de hoje…";
    if (/categor|gastando|despesa/.test(l)) return "Analisando categorias…";
    if (/mês|mes|mensal|janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro/.test(l))
      return "Analisando o mês…";
    if (/resumo|visão|geral|histórico/.test(l)) return "Buscando resumo mensal…";
    return "Consultando dados…";
  }

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sendMutation.isPending) return;

    setInput("");
    setToolHint(inferHint(msg));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: msg };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const history = nextMessages.slice(-12).map((m) => ({ role: m.role, content: m.content }));
      const result = await sendMutation.mutateAsync({
        message: msg,
        history: history.slice(0, -1),
      });
      const { reply } = result as { reply: string };

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: reply },
      ]);
      setToolHint(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: unknown) {
      setToolHint(null);
      const apiMsg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Desculpe, ocorreu um erro. Tente novamente.";
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: apiMsg },
      ]);
    }
  }

  async function handleSaveInsight(content: string) {
    try {
      // Extract a short title from the first sentence/line
      const firstLine = content.split("\n").find((l) => l.trim()) ?? content;
      const title = firstLine.replace(/[*#`]/g, "").trim().slice(0, 80);
      const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const periodLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

      await saveInsightMutation.mutateAsync({
        title,
        description: content,
        recommendation: "",
        periodLabel,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Salvo!", "Insight salvo na aba Insights.");
    } catch {
      Alert.alert("Erro", "Não foi possível salvar o insight.");
    }
  }

  async function handleClear() {
    setMessages([]);
    await AsyncStorage.removeItem(CHAT_HISTORY_KEY);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  const firstName = user?.name?.split(" ")[0] ?? "você";

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Image source={KLARO_LOGO} style={styles.headerIcon} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Klaro IA</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Consultor financeiro do seu negócio
          </Text>
        </View>
        {messages.length > 0 && (
          <Pressable
            onPress={handleClear}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            <Feather name="rotate-ccw" size={18} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Bubble
            message={item}
            colors={colors}
            onSave={item.role === "assistant" ? handleSaveInsight : undefined}
          />
        )}
        contentContainerStyle={[
          styles.messagesList,
          { paddingBottom: insets.bottom + 76 + 90 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyGreeting, { color: colors.foreground }]}>
              Olá, {firstName}! 👋
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Pergunte qualquer coisa sobre as finanças do seu negócio.
            </Text>
            <View style={styles.suggestionsGrid}>
              {suggestions.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => handleSend(s)}
                  style={({ pressed }) => [
                    styles.suggestion,
                    {
                      backgroundColor: pressed ? colors.secondary : colors.card,
                      borderColor: colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <Text style={[styles.suggestionText, { color: colors.foreground }]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
      />

      {/* Typing indicator */}
      {sendMutation.isPending && <TypingIndicator hint={toolHint} colors={colors} />}

      {/* Input */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: 76 + insets.bottom + (Platform.OS === "ios" ? 8 : 12),
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          value={input}
          onChangeText={setInput}
          placeholder="Pergunte algo sobre seu negócio…"
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              backgroundColor: colors.secondary,
              color: colors.foreground,
              borderRadius: colors.radius,
            },
          ]}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => handleSend()}
          blurOnSubmit={false}
        />

        {/* Mic button — web only (Web Speech API) */}
        {Platform.OS === "web" && (
          <Pressable
            onPress={startVoice}
            style={({ pressed }) => [
              styles.iconBtn,
              {
                backgroundColor: listening ? `${colors.primary}33` : colors.secondary,
                borderRadius: colors.radius,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather
              name="mic"
              size={18}
              color={listening ? colors.primary : colors.mutedForeground}
            />
          </Pressable>
        )}

        {/* Send button */}
        <Pressable
          onPress={() => handleSend()}
          disabled={!input.trim() || sendMutation.isPending}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor:
                input.trim() && !sendMutation.isPending ? colors.primary : colors.secondary,
              borderRadius: colors.radius,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather
            name="send"
            size={18}
            color={
              input.trim() && !sendMutation.isPending
                ? colors.primaryForeground
                : colors.mutedForeground
            }
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerIcon: { width: 40, height: 40, borderRadius: 10 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },

  messagesList: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleRowUser: { flexDirection: "row-reverse" },
  bubbleUserWrap: { maxWidth: "78%" },
  bubbleAssistantWrap: { maxWidth: "78%", gap: 4 },
  avatar: { width: 28, height: 28, borderRadius: 7, flexShrink: 0 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },

  saveBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 4 },
  saveBtnText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8 },
  typingBubble: { flexDirection: "row", alignItems: "center", gap: 8 },
  typingHint: { fontSize: 12, fontFamily: "Inter_400Regular" },

  emptyContainer: { paddingTop: 48, paddingHorizontal: 8, gap: 12, alignItems: "center" },
  emptyGreeting: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  suggestionsGrid: { width: "100%", gap: 8, marginTop: 8 },
  suggestion: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  suggestionText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  inputBar: {
    flexDirection: "row", paddingHorizontal: 16, paddingTop: 10,
    gap: 8, borderTopWidth: 1, alignItems: "flex-end",
  },
  input: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, fontFamily: "Inter_400Regular", maxHeight: 100,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sendBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
