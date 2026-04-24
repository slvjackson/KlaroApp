import { useEffect, useRef, useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { Paperclip, Mic, Send, Loader, ShieldCheck, CornerDownRight } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Qual foi minha receita este mês?",
  "Quais são minhas maiores despesas?",
  "Como está meu fluxo de caixa?",
  "Mostre meu resumo financeiro",
  "Quais categorias gastei mais?",
  "Compare entradas e saídas do último mês",
];

// ─── Markdown-lite renderer ───────────────────────────────────────────────────

function renderRich(text: string) {
  const lines = text.split("\n");
  return lines.map((ln, i) => {
    if (!ln.trim()) return <div key={i} className="h-1.5" />;

    const parse = (s: string): (string | JSX.Element)[] => {
      const out: (string | JSX.Element)[] = [];
      let j = 0;
      let buf = "";
      const push = (el: JSX.Element) => { if (buf) { out.push(buf); buf = ""; } out.push(el); };
      while (j < s.length) {
        if (s[j] === "*" && s[j + 1] === "*") {
          const end = s.indexOf("**", j + 2);
          if (end > -1) { push(<strong key={j} className="text-white font-semibold">{s.slice(j + 2, end)}</strong>); j = end + 2; continue; }
        }
        if (s[j] === "_") {
          const end = s.indexOf("_", j + 1);
          if (end > -1) { push(<em key={j} className="text-white/90 italic">{s.slice(j + 1, end)}</em>); j = end + 1; continue; }
        }
        buf += s[j]; j++;
      }
      if (buf) out.push(buf);
      return out;
    };

    if (/^[•\-]\s/.test(ln)) {
      return (
        <div key={i} className="flex gap-2 pl-1">
          <span className="text-[var(--accent)] mt-[2px]">•</span>
          <span>{parse(ln.replace(/^[•\-]\s/, ""))}</span>
        </div>
      );
    }
    if (/^\d+\.\s/.test(ln)) {
      const m = ln.match(/^(\d+)\.\s(.*)$/);
      if (m) {
        return (
          <div key={i} className="flex gap-2 pl-1">
            <span className="text-[var(--muted)] w-4 tnum">{m[1]}.</span>
            <span>{parse(m[2])}</span>
          </div>
        );
      }
    }
    return <div key={i}>{parse(ln)}</div>;
  });
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`fadeUp flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8a6bff] to-[#5b8cff] grid place-items-center shrink-0 mt-0.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          </svg>
        </div>
      )}
      <div
        className={`max-w-[78%] px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
          isUser
            ? "bg-gradient-to-br from-[#7c5cff] to-[#6a4fe8] text-white bubble-user shadow-[0_8px_24px_-12px_rgba(124,92,255,0.6)]"
            : "bg-[rgba(255,255,255,0.04)] border border-[var(--border)] text-white/90 bubble-bot"
        }`}
      >
        <div className="space-y-0.5">{renderRich(msg.content)}</div>
      </div>
      {isUser && (
        <div className="w-7 h-7 rounded-full bg-white/5 border border-[var(--border)] grid place-items-center shrink-0 mt-0.5 text-[var(--muted)]">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      )}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="fadeUp flex gap-2.5 justify-start">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#8a6bff] to-[#5b8cff] grid place-items-center shrink-0 mt-0.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        </svg>
      </div>
      <div className="px-4 py-3 bg-[rgba(255,255,255,0.04)] border border-[var(--border)] bubble-bot">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Chat() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  if (isAuthLoading) return null;

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    const userMsg: ChatMessage = { role: "user", content: msg };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: messages }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao obter resposta.");
        return;
      }
      setMessages([...history, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <Layout title="Chat Klaro">
      <div className="max-w-3xl mx-auto h-[calc(100vh-120px)] flex flex-col">
        <div className="glass-strong rounded-2xl flex flex-col overflow-hidden h-full relative">
          {/* Brand glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 w-60 h-60 rounded-full bg-[rgba(124,92,255,0.22)] blur-3xl" />

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] relative shrink-0">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8a6bff] to-[#5b8cff] grid place-items-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                </svg>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--income)] border-2 border-[#15151a]" />
            </div>
            <div className="leading-tight flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-white flex items-center gap-1.5">
                Assistente Klaro
                <span className="text-[9px] font-bold tracking-wider px-1.5 py-[1px] rounded bg-[var(--accent-soft)] text-[#a18bff] border border-[rgba(124,92,255,0.3)]">IA</span>
              </div>
              <div className="text-[11px] text-[var(--muted)]">Conectado às suas transações em tempo real</div>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto klaro-scroll px-5 py-5 space-y-3.5 relative">
            {isEmpty ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-5 pb-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[rgba(124,92,255,0.3)] to-[rgba(91,140,255,0.15)] border border-[var(--border-2)] grid place-items-center">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a18bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                  </svg>
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-white">Pergunte qualquer coisa</div>
                  <div className="text-[12px] text-[var(--muted)] max-w-[260px] leading-relaxed mt-1">
                    Seu assistente entende suas transações, categorias e tendências.
                  </div>
                </div>
                <div className="w-full space-y-1.5 max-w-xs">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]/70 font-semibold text-left pl-1">Sugestões</div>
                  {SUGGESTIONS.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="pill w-full text-left px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.015)] text-[12.5px] text-[var(--muted)] flex items-center gap-2"
                    >
                      <CornerDownRight size={12} className="text-[var(--accent)] opacity-70 shrink-0" />
                      <span className="flex-1">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <Bubble key={i} msg={m} />
                ))}
                {loading && <TypingBubble />}
                {error && (
                  <p className="text-center text-[12px] text-[var(--expense)]">{error}</p>
                )}
              </>
            )}
          </div>

          {/* Suggestion chips (when not empty) */}
          {!isEmpty && !loading && (
            <div className="px-5 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {SUGGESTIONS.slice(0, 3).map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="pill shrink-0 text-[11px] px-2.5 py-1.5 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.02)] text-[var(--muted)] hover:text-white"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 pt-2 pb-4 border-t border-[var(--border)] shrink-0">
            <form
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
              className={`chat-input flex items-end gap-2 px-3 py-2 rounded-2xl border bg-[rgba(255,255,255,0.02)] transition-all ${
                focused ? "border-[var(--accent)] shadow-[0_0_0_3px_rgba(124,92,255,0.15)]" : "border-[var(--border)]"
              }`}
            >
              <button type="button" className="w-8 h-8 grid place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5 shrink-0">
                <Paperclip size={14} />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                rows={1}
                placeholder="Pergunte algo sobre suas finanças…"
                className="flex-1 bg-transparent outline-none text-[13px] text-white placeholder:text-[var(--muted)] resize-none py-1.5 max-h-32"
                style={{ lineHeight: 1.5 }}
              />
              <button type="button" className="w-8 h-8 grid place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5 shrink-0">
                <Mic size={14} />
              </button>
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className={`w-9 h-9 grid place-items-center rounded-xl transition-all shrink-0 ${
                  input.trim() && !loading
                    ? "btn-primary text-white"
                    : "bg-white/5 text-[var(--muted)] cursor-not-allowed"
                }`}
              >
                {loading ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            </form>
            <div className="text-[10.5px] text-[var(--muted)] text-center mt-2 flex items-center justify-center gap-1.5">
              <ShieldCheck size={10} />
              Suas transações são privadas · respostas podem conter imprecisões
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
