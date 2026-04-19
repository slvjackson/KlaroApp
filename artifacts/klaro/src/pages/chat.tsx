import { useEffect, useRef, useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Send, Bot, User } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Qual foi minha receita este mês?",
  "Quais são minhas maiores despesas?",
  "Como está meu fluxo de caixa?",
  "Mostre meu resumo financeiro de hoje",
];

export default function Chat() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-32px)] max-w-3xl mx-auto">
        {/* Header */}
        <div className="pb-4 border-b border-border shrink-0">
          <h1 className="text-3xl font-bold tracking-tight text-white">Chat Financeiro</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pergunte sobre suas finanças e obtenha insights em tempo real.
          </p>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Bot className="w-7 h-7 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-white font-semibold">Assistente Financeiro Klaro</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Faça perguntas sobre suas transações, receitas, despesas e insights financeiros.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="px-4 py-3 text-left text-sm text-muted-foreground bg-card border border-border hover:border-primary/50 hover:text-foreground transition-colors"
                    style={{ borderRadius: "10px" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-card border border-border text-foreground"
                    }`}
                    style={{ borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px" }}
                  >
                    {msg.content}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 bg-secondary rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="w-7 h-7 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div
                    className="px-4 py-3 bg-card border border-border"
                    style={{ borderRadius: "14px 14px 14px 4px" }}
                  >
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              {error && (
                <p className="text-center text-sm text-destructive">{error}</p>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input bar */}
        <div className="pt-3 border-t border-border shrink-0">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte algo sobre suas finanças..."
              className="flex-1 bg-card border-border text-white"
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            O assistente tem acesso às suas transações em tempo real.
          </p>
        </div>
      </div>
    </Layout>
  );
}
