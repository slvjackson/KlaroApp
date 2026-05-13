import { useEffect, useRef, useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { Paperclip, Mic, Send, Loader, ShieldCheck, CornerDownRight, Check, RotateCcw } from "lucide-react";
import { useSaveInsight, useGetMe, getListInsightsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AnamneseCta } from "@/components/anamnese-cta";
import { useChatContext } from "@/contexts/chat-context";
import { FeatureTutorial, TutorialButton, type TutorialStep } from "@/components/feature-tutorial";
import { ChatBubble, TypingBubble, CHAT_SUGGESTIONS, extractInsightTitle } from "@/components/chat-bubble";

const CHAT_TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "Comece por uma sugestão",
    body: "Os chips abaixo da mensagem inicial mostram perguntas comuns. Clicar dispara a pergunta direto — sem precisar digitar.",
    tip: "Comece simples: 'Qual minha margem este mês?'. Cada resposta abre espaço pra próxima pergunta.",
    target: "#tutorial-chat-suggestions",
  },
  {
    title: "Pergunte do seu jeito",
    body: "Sem prompt técnico. Escreva como se estivesse falando com seu contador. O modelo entende contexto e tem acesso aos seus números reais.",
    tip: "Use perguntas comparativas: 'Onde gastei mais este mês vs. o passado?'.",
    target: "#tutorial-chat-input",
  },
  {
    title: "Transforme resposta em missão",
    body: "Quando uma resposta da IA traz uma ação prática (renegociar, cortar, monitorar), salve como missão direto pelo botão de bookmark — vira uma checklist em Missões.",
    tip: "Toda recomendação que você salvar vai aparecer com passos prontos pra executar.",
    target: "#tutorial-chat-messages",
  },
];

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
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Auto-send when arriving via /chat?prompt=... (used by Today Card CTAs that direct
  // the user to chat with a contextual question already framed). We strip the param
  // from the URL afterwards so a refresh doesn't re-send the same message.
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (isAuthLoading) return;
    const params = new URLSearchParams(window.location.search);
    const prompt = params.get("prompt");
    if (!prompt) return;
    // Defer one tick so the chat context is ready and we don't fight other mount effects.
    const t = setTimeout(() => {
      void ctxSend(prompt);
      setLocation("/chat", { replace: true });
    }, 50);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading]);

  if (isAuthLoading) return null;

  const handleSaveInsight = (idx: number, content: string) => {
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
      <div className="h-[calc(100vh-120px)] md:h-[calc(100vh-128px)] flex flex-col">
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
            <div className="flex items-center gap-2 shrink-0">
              <TutorialButton onClick={() => setTutorialOpen(true)} />
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
          </div>

          {/* Messages */}
          <div id="tutorial-chat-messages" ref={scrollRef} className="flex-1 overflow-y-auto klaro-scroll px-5 py-5 space-y-3.5 relative">
            {isEmpty ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-5 pb-6">
                <img src="/logo.png" alt="Klaro" className="w-14 h-14 rounded-xl object-cover" />
                <div>
                  <div className="text-[15px] font-semibold text-white">Pergunte qualquer coisa</div>
                  <div className="text-[12px] text-[var(--muted)] max-w-[260px] leading-relaxed mt-1">
                    Seu assistente entende suas transações, categorias e tendências.
                  </div>
                </div>
                <div id="tutorial-chat-suggestions" className="w-full space-y-1.5 max-w-xs">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]/70 font-semibold text-left pl-1">Sugestões</div>
                  {CHAT_SUGGESTIONS.slice(0, 4).map((s) => (
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

          {/* Suggestion chips (when not empty) */}
          {!isEmpty && !loading && (
            <div className="px-5 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {CHAT_SUGGESTIONS.slice(0, 3).map((s) => (
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
          <div id="tutorial-chat-input" className="px-4 pt-2 pb-4 border-t border-[var(--border)] shrink-0">
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

      <FeatureTutorial
        open={tutorialOpen}
        steps={CHAT_TUTORIAL_STEPS}
        onClose={() => setTutorialOpen(false)}
      />
    </Layout>
  );
}
