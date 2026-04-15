import { Feather } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Qual foi meu melhor mês?",
  "Estou no caminho da minha meta?",
  "Onde estou gastando mais?",
  "Como está minha margem de lucro?",
  "Quais são minhas principais receitas?",
];

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({ message, colors }: { message: Message; colors: ReturnType<typeof useColors> }) {
  const isUser = message.role === "user";
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={[styles.avatar, { backgroundColor: `${colors.primary}22` }]}>
          <Feather name="zap" size={14} color={colors.primary} />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
            : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            { color: isUser ? colors.primaryForeground : colors.foreground },
          ]}
        >
          {message.content}
        </Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const sendMutation = useMutation({
    mutationFn: ({ message, history }: { message: string; history: { role: string; content: string }[] }) =>
      customFetch<{ reply: string }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({ message, history }),
      }),
  });

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sendMutation.isPending) return;

    setInput("");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: msg };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);

    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const history = nextMessages.slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const { reply } = await sendMutation.mutateAsync({ message: msg, history: history.slice(0, -1) });

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: reply,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." },
      ]);
    }
  }

  const firstName = user?.name?.split(" ")[0] ?? "você";

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={[styles.headerIcon, { backgroundColor: `${colors.primary}22` }]}>
          <Feather name="zap" size={18} color={colors.primary} />
        </View>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Klaro IA</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
            Consultor financeiro do seu negócio
          </Text>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Bubble message={item} colors={colors} />}
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
              {SUGGESTIONS.map((s) => (
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
      {sendMutation.isPending && (
        <View style={[styles.typingRow, { paddingHorizontal: 20 }]}>
          <View style={[styles.avatar, { backgroundColor: `${colors.primary}22` }]}>
            <Feather name="zap" size={14} color={colors.primary} />
          </View>
          <View style={[styles.bubble, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        </View>
      )}

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
          value={input}
          onChangeText={setInput}
          placeholder="Pergunte algo sobre seu negócio..."
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
        <Pressable
          onPress={() => handleSend()}
          disabled={!input.trim() || sendMutation.isPending}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: input.trim() && !sendMutation.isPending ? colors.primary : colors.secondary,
              borderRadius: colors.radius,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather
            name="send"
            size={18}
            color={input.trim() && !sendMutation.isPending ? colors.primaryForeground : colors.mutedForeground}
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },

  messagesList: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  bubbleRowUser: { flexDirection: "row-reverse" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },

  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8 },

  emptyContainer: { paddingTop: 48, paddingHorizontal: 8, gap: 12, alignItems: "center" },
  emptyGreeting: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  suggestionsGrid: { width: "100%", gap: 8, marginTop: 8 },
  suggestion: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionText: { fontSize: 14, fontFamily: "Inter_400Regular" },

  inputBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 10,
    borderTopWidth: 1,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
