import { Bookmark } from "lucide-react";
import { RichContent } from "@/components/rich-content";
import type { ChatMessage } from "@/contexts/chat-context";

export const CHAT_SUGGESTIONS = [
  "Qual foi minha receita este mês?",
  "Quais são minhas maiores despesas?",
  "Como está meu fluxo de caixa?",
  "Mostre meu resumo financeiro",
  "Quais categorias gastei mais?",
  "Compare entradas e saídas do último mês",
];

// Reject bolds that are pure values/labels rather than a real headline.
// Examples we want to skip: "R$ 2.350", "Hoje (06/05):", "Últimos meses:", "1.240,00".
function isWeakBold(s: string): boolean {
  if (/^[\sR$\d.,\-/():%]+$/i.test(s)) return true;
  if (/:\s*$/.test(s)) return true;
  if (/^(hoje|ontem|amanhã|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)/i.test(s) && s.length <= 24) return true;
  if ((s.match(/[a-záéíóúãõçâêô]/gi) ?? []).length < 4) return true;
  return false;
}

export function extractInsightTitle(text: string): string {
  // Prefer the first **bold** phrase that actually reads like a headline. We scan all
  // bolds and skip pure values/labels (numbers, dates, "Hoje:", etc.) which the chat
  // model uses for emphasis but aren't useful as titles.
  const boldMatches = [...text.matchAll(/\*\*(.+?)\*\*/g)];
  for (const m of boldMatches) {
    const bold = m[1].trim().replace(/\s+/g, " ").replace(/[.!?…]+$/, "");
    if (bold.length >= 10 && bold.length <= 80 && !isWeakBold(bold)) {
      return bold[0].toUpperCase() + bold.slice(1);
    }
  }
  const stripped = text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/^[#*\-•>\s]+/, "");
  const first = stripped.split(/[.!?]\s+|\n/)[0]?.trim() ?? "";
  if (!first) return "Insight do chat";
  if (first.length <= 72) return first;
  const truncated = first.slice(0, 72);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) + "…";
}

export function ChatBubble({ msg, onSave }: { msg: ChatMessage; onSave?: () => void }) {
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
              ? "text-[12.5px] bg-gradient-to-br from-[#6af82f] to-[#48ba18] text-[#09090b] font-medium bubble-user shadow-[0_8px_24px_-12px_rgba(106,248,47,0.6)]"
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

export function TypingBubble() {
  return (
    <div className="fadeUp flex gap-2.5 justify-start">
      <img src="/logo.png" alt="Klaro" className="w-7 h-7 rounded-[6px] shrink-0 mt-0.5 object-cover" />
      <div className="px-4 py-3 bg-[rgba(255,255,255,0.04)] border border-[var(--border)] bubble-bot">
        <span className="dot" /><span className="dot" /><span className="dot" />
      </div>
    </div>
  );
}
