import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatContextValue {
  messages: ChatMessage[];
  savedIndices: Set<number>;
  loading: boolean;
  error: string;
  sendMessage: (text: string) => Promise<void>;
  saveIndex: (idx: number) => void;
  clearChat: () => void;
  /** Count of assistant messages added since the user last "saw" the chat. */
  unreadCount: number;
  /** Marks all current messages as seen — call when the chat surface opens. */
  markChatRead: () => void;
}

const CHAT_KEY = "klaro_chat_history";
const SAVED_KEY = "klaro_chat_saved";
const SEEN_KEY = "klaro_chat_seen_length";

function loadMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(CHAT_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function loadSaved(): Set<number> {
  try {
    const raw = sessionStorage.getItem(SAVED_KEY);
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
  } catch {
    return new Set();
  }
}

function loadSeenLength(initialLen: number): number {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (raw == null) return initialLen;
    return Math.max(0, parseInt(raw, 10) || 0);
  } catch {
    return initialLen;
  }
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(loadSaved);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [seenLength, setSeenLength] = useState<number>(() => loadSeenLength(messages.length));
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    sessionStorage.setItem(CHAT_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    sessionStorage.setItem(SAVED_KEY, JSON.stringify([...savedIndices]));
  }, [savedIndices]);

  useEffect(() => {
    sessionStorage.setItem(SEEN_KEY, String(seenLength));
  }, [seenLength]);

  async function sendMessage(text: string) {
    const msg = text.trim();
    if (!msg || loading) return;

    const userMsg: ChatMessage = { role: "user", content: msg };
    const history = messages;
    setMessages((prev) => [...prev, userMsg]);
    setError("");
    setLoading(true);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
        signal: abortRef.current.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao obter resposta.");
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  function saveIndex(idx: number) {
    setSavedIndices((prev) => new Set([...prev, idx]));
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setSavedIndices(new Set());
    setError("");
    setLoading(false);
    setSeenLength(0);
    sessionStorage.removeItem(CHAT_KEY);
    sessionStorage.removeItem(SAVED_KEY);
    sessionStorage.removeItem(SEEN_KEY);
  }

  const markChatRead = useCallback(() => {
    setSeenLength((prev) => (prev === messages.length ? prev : messages.length));
  }, [messages.length]);

  // Unread = assistant messages added since user last marked the chat as read.
  const unreadCount = Math.max(0, messages.filter((m, i) => i >= seenLength && m.role === "assistant").length);

  return (
    <ChatContext.Provider
      value={{ messages, savedIndices, loading, error, sendMessage, saveIndex, clearChat, unreadCount, markChatRead }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside ChatProvider");
  return ctx;
}
