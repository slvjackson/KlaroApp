import { useEffect, useRef, useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { Paperclip, Mic, Send, Loader, ShieldCheck, CornerDownRight, Bookmark, Check, RotateCcw } from "lucide-react";
import { useSaveInsight, useGetMe, getListInsightsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { RichContent } from "@/components/rich-content";
import { AnamneseCta } from "@/components/anamnese-cta";
import { useChatContext, type ChatMessage } from "@/contexts/chat-context";

const SUGGESTIONS = [
  "Qual foi minha receita este mês?",
  "Quais são minhas maiores despesas?",
  "Como está meu fluxo de caixa?",
  "Mostre meu resumo financeiro",
  "Quais categorias gastei mais?",
  "Compare entradas e saídas do último mês",
];

function extractTitle(text: string): string {
  const first = text.replace(/^[#*\-•>\s]+/, "").split(/[.\n]/)[0] ?? "";
  return first.trim().slice(0, 72) || "Insight do chat";
}

// ─── Bubble ───────────────────────────────────────────────────────────────────

function Bubble({ msg, onSave }: { msg: ChatMessage; onSave?: () => void }) {
  const isUser = msg.role === "user";
  return (
    <div className={`fadeUp flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <img src="/logo.png" alt="Klaro" className="w-7 h-7 rounded-[6px] shrink-0 mt-0.5 object-cover" />
      )}
      <div className="flex flex-col gap-1 max-w-[78%]">
        <div
          className={`px-3.5 py-2.5 leading-relaxed ${
            isUser
              ? "text-[12.5px] bg-gradient-to-br from-[#6af82f] to-[#48ba18] text-white bubble-user shadow-[0_8px_24px_-12px_rgba(106,248,47,0.6)]"
              : "text-white/90 bubble-bot bg-[rgba(255,255,255,0.04)] border border-[var(--border)]"
          }`}
        >
          {isUser
            ? <div className="text-[12.5px]">{msg.content}</div>
            : <RichContent text={msg.content} />}
        </div>
        {!isUser && onSave && (
          <div className="flex justify-end">
            <button
              onClick={onSave}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
            >
              <Bookmark size={11} />
              Salvar como insight
            </button>
          </div>
        )}
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
      <img src="/logo.png" alt="Klaro" className="w-7 h-7 rounded-[6px] shrink-0 mt-0.5 object-cover" />
      <div className="px-4 py-3 bg-[rgba(255,255,255,0.04)] border border-[var(--border)] bubble-bot">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  );
}

// ─── Save toast ───────────────────────────────────────────────────────────────

function SaveToast({ visible }: { visible: boolean }) {
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#15151a] border border-[rgba(16,185,129,0.3)] text-[12.5px] text-white shadow-xl transition-all duration-300 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
      <Check size={13} className="text-[#10b981]" />
      Insight salvo com sucesso
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Chat() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();
  const bp = (user as unknown as { businessProfile?: Record<string, unknown> } | undefined)?.businessProfile;
  const anamneseCompleted = !!bp?.anamneseCompleted;
  const saveInsight = useSaveInsight();
  const { messages, savedIndices, loading, error, sendMessage: ctxSend, saveIndex, clearChat } = useChatContext();
  const [showToast, setShowToast] = useState(false);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  if (isAuthLoading) return null;

  const handleSaveInsight = (idx: number, content: string) => {
    if (savedIndices.has(idx)) return;
    saveInsight.mutate(
      {
        title: extractTitle(content),
        description: content.slice(0, 800),
        periodLabel: new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      },
      {
        onSuccess: () => {
          saveIndex(idx);
          queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
          setShowToast(true);
          setTimeout(() => setShowToast(false), 3000);
        },
      }
    );
  };

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    await ctxSend(msg);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const isEmpty = messages.length === 0;

  return (
    <Layout title="Chat Klaro">
      <SaveToast visible={showToast} />
      <div className="max-w-3xl mx-auto h-[calc(100vh-120px)] flex flex-col">
        <div className="glass-strong rounded-2xl flex flex-col overflow-hidden h-full relative">
          {/* Brand glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 w-60 h-60 rounded-full bg-[rgba(106,248,47,0.22)] blur-3xl" />

          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] relative shrink-0">
            <div className="relative">
              <img src="/logo.png" alt="Klaro" className="w-9 h-9 rounded-[8px] object-cover" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--income)] border-2 border-[#15151a]" />
            </div>
            <div className="leading-tight flex-1 min-w-0">
              <div className="text-[13.5px] font-semibold text-white flex items-center gap-1.5">
                Klaro IA
                <span className="text-[9px] font-bold tracking-wider px-1.5 py-[1px] rounded bg-[var(--accent-soft)] text-[#90f048] border border-[rgba(106,248,47,0.3)]">IA</span>
              </div>
              <div className="text-[11px] text-[var(--muted)]">Consultor financeiro do seu negócio</div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                title="Nova conversa"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors"
              >
                <RotateCcw size={12} />
                Nova conversa
              </button>
            )}
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto klaro-scroll px-5 py-5 space-y-3.5 relative">
            {isEmpty ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-5 pb-6">
                <img src="/logo.png" alt="Klaro" className="w-14 h-14 rounded-xl object-cover" />
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
                <div className="w-full max-w-xs">
                  <AnamneseCta completed={anamneseCompleted} />
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => (
                  <Bubble
                    key={i}
                    msg={m}
                    onSave={
                      m.role === "assistant" && !savedIndices.has(i)
                        ? () => handleSaveInsight(i, m.content)
                        : undefined
                    }
                  />
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
                focused ? "border-[var(--accent)] shadow-[0_0_0_3px_rgba(106,248,47,0.15)]" : "border-[var(--border)]"
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
                    ? "btn-primary"
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
