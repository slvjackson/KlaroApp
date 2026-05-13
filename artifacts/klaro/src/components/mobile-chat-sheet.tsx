import { useEffect, useRef, useState } from "react";
import { Send, Loader, ShieldCheck, CornerDownRight, RotateCcw, X, Check } from "lucide-react";
import { useChatContext } from "@/contexts/chat-context";
import { useSaveInsight, useGetMe, getListInsightsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AnamneseCta } from "@/components/anamnese-cta";
import { ChatBubble, TypingBubble, CHAT_SUGGESTIONS, extractInsightTitle } from "@/components/chat-bubble";

// Mobile-only chat. Reuses the global ChatContext so messages and unread count are
// shared with the /chat page (desktop) and survive minimizing.
export function MobileChatSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { messages, savedIndices, loading, error, sendMessage, saveIndex, clearChat, markChatRead } = useChatContext();
  const { data: user } = useGetMe();
  const bp = (user as unknown as { businessProfile?: Record<string, unknown> } | undefined)?.businessProfile;
  const anamneseCompleted = !!bp?.anamneseCompleted;
  const saveInsight = useSaveInsight();
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = messages.length === 0;

  useEffect(() => {
    if (!open) return;
    markChatRead();
    // Focus input + scroll to bottom on open.
    const t = setTimeout(() => {
      inputRef.current?.focus();
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    }, 60);
    return () => clearTimeout(t);
  }, [open, markChatRead]);

  // Keep marking as read while open as new assistant messages stream in.
  useEffect(() => {
    if (open) markChatRead();
  }, [open, messages.length, markChatRead]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [open, messages, loading]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg) return;
    void sendMessage(msg);
    setInput("");
  }

  function handleSaveInsight(idx: number, content: string) {
    if (savedIndices.has(idx)) return;
    saveInsight.mutate(
      {
        title: extractInsightTitle(content),
        description: content.slice(0, 800),
        periodLabel: new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      },
      {
        onSuccess: () => {
          saveIndex(idx);
          setShowToast(true);
          setTimeout(() => setShowToast(false), 2200);
          queryClient.invalidateQueries({ queryKey: getListInsightsQueryKey() });
        },
      },
    );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-[#0a0a0b] md:hidden">
      {/* Header */}
      <div className="relative flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[rgba(12,12,15,0.95)] backdrop-blur-xl shrink-0">
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
            aria-label="Nova conversa"
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors"
          >
            <RotateCcw size={14} />
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Minimizar chat"
          className="grid h-9 w-9 place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto klaro-scroll px-4 py-4 space-y-3 relative">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-5 pb-6">
            <img src="/logo.png" alt="Klaro" className="w-12 h-12 rounded-xl object-cover" />
            <div>
              <div className="text-[15px] font-semibold text-white">Pergunte qualquer coisa</div>
              <div className="text-[12px] text-[var(--muted)] max-w-[260px] leading-relaxed mt-1">
                Seu assistente entende suas transações, categorias e tendências.
              </div>
            </div>
            <div className="w-full space-y-1.5 max-w-xs">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]/70 font-semibold text-left pl-1">Sugestões</div>
              {CHAT_SUGGESTIONS.slice(0, 4).map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
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
              <ChatBubble
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

      {/* Suggestion chips (only when there's an active conversation) */}
      {!isEmpty && !loading && (
        <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          {CHAT_SUGGESTIONS.slice(0, 3).map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="pill shrink-0 text-[11px] px-2.5 py-1.5 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.02)] text-[var(--muted)] hover:text-white"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pt-2 pb-3 border-t border-[var(--border)] shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className={`flex items-end gap-2 px-3 py-2 rounded-2xl border bg-[rgba(255,255,255,0.02)] transition-all ${
            focused ? "border-[var(--accent)] shadow-[0_0_0_3px_rgba(106,248,47,0.15)]" : "border-[var(--border)]"
          }`}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Pergunte algo sobre seu negócio..."
            rows={1}
            className="flex-1 bg-transparent outline-none resize-none text-[13px] text-white placeholder:text-[var(--muted)] py-1.5 max-h-[120px]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn-primary w-9 h-9 grid place-items-center rounded-xl shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Enviar"
          >
            {loading ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </form>
        <div className="text-[10.5px] text-[var(--muted)] text-center mt-2 flex items-center justify-center gap-1.5">
          <ShieldCheck size={10} />
          Suas transações são privadas · respostas podem conter imprecisões
        </div>
      </div>

      {/* Save toast */}
      <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#15151a] border border-[rgba(16,185,129,0.3)] text-[12.5px] text-white shadow-xl transition-all duration-300 ${showToast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}>
        <Check size={13} className="text-[#10b981]" />
        Insight salvo com sucesso
      </div>
    </div>
  );
}
