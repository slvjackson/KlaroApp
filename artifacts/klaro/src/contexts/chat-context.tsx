import { createContext, useContext, useEffect, useRef, useState } from "react";

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
}

const CHAT_KEY = "klaro_chat_history";
const SAVED_KEY = "klaro_chat_saved";

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

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [savedIndices, setSavedIndices] = useState<Set<number>>(loadSaved);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    sessionStorage.setItem(CHAT_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    sessionStorage.setItem(SAVED_KEY, JSON.stringify([...savedIndices]));
  }, [savedIndices]);

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
    sessionStorage.removeItem(CHAT_KEY);
    sessionStorage.removeItem(SAVED_KEY);
  }

  return (
    <ChatContext.Provider value={{ messages, savedIndices, loading, error, sendMessage, saveIndex, clearChat }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used inside ChatProvider");
  return ctx;
}
