import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { LandingShell } from "@/components/LandingShell";

const SCRIPT = [
  { role: "user", text: "Quanto gastei com fornecedor em maio?" },
  { role: "ai",   text: "R$ 4.220 em maio. 12% a menos que abril (R$ 4.795). Maior gasto: Forn. Y, R$ 1.850." },
  { role: "user", text: "Compara abril e maio por categoria." },
  { role: "ai",   text: "Mercadorias caiu 14% (R$ 4.795 → R$ 4.220). Aluguel manteve R$ 1.800. Marketing subiu 32% (R$ 280 → R$ 370). Salários estáveis." },
  { role: "user", text: "Tô preparado pro Dia das Mães?" },
  { role: "ai",   text: "Históricamente sua receita sobe 28% no Dia das Mães. Estoque atual de mercadorias está R$ 540 abaixo da média do período. Considere reforçar até quinta." },
] as const;

function ChatAnimation() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= SCRIPT.length) {
      const reset = setTimeout(() => setStep(0), 4000);
      return () => clearTimeout(reset);
    }
    const isUser = SCRIPT[step].role === "user";
    const delay = isUser ? 1100 : 1700;
    const id = setTimeout(() => setStep((s) => s + 1), delay);
    return () => clearTimeout(id);
  }, [step]);

  return (
    <div className="glass-strong rounded-2xl border border-white/10 overflow-hidden max-w-[480px] mx-auto h-[460px] flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 shrink-0">
        <div className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: "var(--accent-soft)" }}>
          <MessageSquare size={13} style={{ color: "var(--accent)" }} />
        </div>
        <span className="text-[12px] font-semibold text-white">Chat consultor</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden p-4 flex flex-col gap-2 justify-end">
        {SCRIPT.slice(0, step).map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div
              key={i}
              className={`flex ${isUser ? "justify-end" : "justify-start"} fadeUp`}
            >
              <div
                className={`max-w-[80%] text-[12px] leading-relaxed px-3 py-2 rounded-2xl ${
                  isUser
                    ? "bg-gradient-to-br from-[#6af82f] to-[#48ba18] text-[#09090b] font-medium rounded-br-sm"
                    : "bg-white/5 text-white/85 border border-white/10 rounded-bl-sm"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input bar (decorative) */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-white/10 shrink-0">
        <div className="flex-1 h-9 rounded-lg border border-white/10 bg-white/[0.02] px-3 flex items-center text-[11.5px] text-white/30">
          Pergunte qualquer coisa…
        </div>
        <div className="w-9 h-9 rounded-lg grid place-items-center" style={{ background: "var(--accent)" }}>
          <Send size={13} className="text-black" />
        </div>
      </div>
    </div>
  );
}

const SAMPLE_QUESTIONS = [
  "Qual minha maior despesa esse mês?",
  "Compara minha receita de abril e maio.",
  "Quanto sobrou de caixa em janeiro?",
  "Qual cliente comprou mais nos últimos 90 dias?",
  "Minhas vendas de sexta são realmente maiores?",
  "Estou gastando mais com Marketing que ano passado?",
];

const BENEFITS = [
  { t: "Fala português coloquial",  d: "Pergunte do jeito que você fala. \"Tô gastando muito com fornecedor?\" funciona." },
  { t: "Resposta com seu número",   d: "Não é resposta genérica de IA. Cada número vem do seu próprio histórico." },
  { t: "Compara automaticamente",   d: "Mês passado, ano passado, mesma semana — comparação contextual sem você pedir." },
  { t: "Disponível 24/7",           d: "Chat aberto a qualquer hora. Bateu uma dúvida no domingo? Pergunta na hora." },
];

export default function SolucoesChat() {
  const [, setLocation] = useLocation();

  return (
    <LandingShell>
      {/* Hero */}
      <section className="relative pt-20 pb-16" style={{ background: "radial-gradient(900px 500px at 80% 0%, rgba(106,248,47,0.08), transparent 65%), #09090b" }}>
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>
              <MessageSquare size={11} className="inline mr-1.5 -mt-0.5" /> Chat consultor
            </p>
            <h1 className="font-bold tracking-[-0.025em] text-white" style={{ fontSize: "clamp(34px,4.4vw,60px)", lineHeight: 1.02 }}>
              Pergunte sobre seu <span style={{ color: "var(--accent)" }}>caixa</span>.<br />Em português.
            </h1>
            <p className="text-[15px] md:text-[17px] text-white/60 mt-6 max-w-lg leading-relaxed">
              Você não precisa montar relatório nem aprender filtro. Pergunta como falaria pro contador
              e a IA responde com seus números reais — comparando, somando, contextualizando.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button
                onClick={() => setLocation("/signup")}
                className="btn-primary px-6 py-3.5 rounded-lg text-[14px] font-bold inline-flex items-center justify-center gap-2"
              >
                Falar com a IA <ArrowRight size={15} />
              </button>
            </div>
          </div>
          <div>
            <ChatAnimation />
          </div>
        </div>
      </section>

      {/* Sample questions */}
      <section className="border-t border-white/10 py-20 bg-[#0a0a0b]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-10 max-w-2xl">
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>Você pode perguntar coisas como</p>
            <h2 className="font-bold tracking-tight text-white" style={{ fontSize: "clamp(26px,3vw,42px)", lineHeight: 1.06 }}>
              Qualquer coisa que faria sentido perguntar pro seu contador.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {SAMPLE_QUESTIONS.map((q, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/[0.02] px-5 py-4 text-[13.5px] text-white/80 leading-relaxed flex items-start gap-3">
                <MessageSquare size={14} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                {q}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t border-white/10 py-20 bg-[#09090b]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-10 max-w-2xl">
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>Por que funciona</p>
            <h2 className="font-bold tracking-tight text-white" style={{ fontSize: "clamp(26px,3vw,42px)", lineHeight: 1.06 }}>
              Não é o ChatGPT genérico. É IA com seu contexto.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
            {BENEFITS.map((b, i) => (
              <div key={i} className="bg-[#0a0a0b] hover:bg-[#101012] transition-colors p-6 flex items-start gap-4">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                <div>
                  <h3 className="text-[15px] font-semibold text-white mb-1.5">{b.t}</h3>
                  <p className="text-[13px] text-white/55 leading-relaxed">{b.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 py-20 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-bold tracking-tight text-white mb-5" style={{ fontSize: "clamp(26px,3.2vw,40px)", lineHeight: 1.06 }}>
            O que você perguntaria pro Klaro hoje?
          </h2>
          <button
            onClick={() => setLocation("/signup")}
            className="btn-primary px-7 py-3.5 rounded-lg text-[14px] font-bold inline-flex items-center justify-center gap-2"
          >
            Começar grátis <ArrowRight size={15} />
          </button>
        </div>
      </section>
    </LandingShell>
  );
}
