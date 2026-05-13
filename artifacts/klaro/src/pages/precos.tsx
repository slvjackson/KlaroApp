import { useLocation } from "wouter";
import {
  ArrowRight, Check, Sparkles,
  FileSearch, LayoutDashboard, MessageSquare, Target, Layers, UploadCloud,
} from "lucide-react";
import { LandingShell } from "@/components/LandingShell";

// ─── Pricing data — values come from admin.ts (single source of truth) ───────
//
// Estratégia: todos os planos têm exatamente as mesmas features. O que muda é só o
// preço-mês: comprometimento maior = mês mais barato. Plano anual ancora o "valor real",
// semestral é o meio-termo, mensal é a entrada sem amarra.

const PLANS = [
  {
    id: "monthly",
    label: "Mensal",
    badge: null as string | null,
    monthly: 149,
    total: 149,
    totalNote: "Cobrado mensalmente",
    description: "Sem amarra. Cancele quando quiser.",
  },
  {
    id: "semestral",
    label: "Semestral",
    // Saving: (149 - 129) / 149 ≈ 13%
    badge: "Economiza 13%",
    monthly: 129,
    total: 774,
    totalNote: "R$ 774 cobrado a cada 6 meses",
    description: "Mês mais barato, compromisso de 6 meses.",
  },
  {
    id: "annual",
    label: "Anual",
    // Saving: (149 - 99) / 149 ≈ 33%
    badge: "Economiza 33%",
    monthly: 99,
    total: 1188,
    totalNote: "R$ 1.188 cobrado anualmente",
    description: "O melhor valor. Trava o preço por 12 meses.",
  },
] as const;

const FEATURES_INCLUDED = [
  { Icon: UploadCloud,    title: "Importação universal",      desc: "Excel, PDF, CSV, OFX, foto e até foto de caderno. Tudo lido pela IA." },
  { Icon: LayoutDashboard, title: "Painel em tempo real",     desc: "Saldo, receita, despesa, tendência e categoria. Atualizado conforme você sobe dado." },
  { Icon: Sparkles,       title: "Insights Inteligentes",           desc: "Uma análise nova todo dia, gerada a partir do seu próprio histórico." },
  { Icon: Target,         title: "Missões com passos",        desc: "Vire insight em ação concreta com checklist do que fazer." },
  { Icon: MessageSquare,  title: "Chat Inteligente",            desc: "Pergunte qualquer coisa sobre seu negócio e tenha respostas com seus dados reais." },
  { Icon: Layers,         title: "Categorização contínua",    desc: "Transações categorizadas automaticamente. Aprende seu padrão." },
  { Icon: Check,          title: "Suporte humano",            desc: "Quando bater dúvida, fala com gente que conhece o produto e pode te ajudar." },
];

function PriceCard({ plan, popular }: { plan: typeof PLANS[number]; popular: boolean }) {
  const [, setLocation] = useLocation();
  return (
    <div
      className="relative rounded-2xl p-7 flex flex-col gap-5 border transition-colors"
      style={{
        background: popular ? "linear-gradient(180deg, rgba(106,248,47,0.05), rgba(106,248,47,0.01))" : "rgba(255,255,255,0.02)",
        borderColor: popular ? "rgba(106,248,47,0.35)" : "var(--border)",
      }}
    >
      {plan.badge && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10.5px] font-bold uppercase tracking-[0.14em] px-3 py-1 rounded-full"
          style={{
            background: popular ? "var(--accent)" : "rgba(255,255,255,0.08)",
            color: popular ? "#09090b" : "rgba(255,255,255,0.85)",
          }}
        >
          {plan.badge}
        </div>
      )}

      <div>
        <div className="text-[12px] uppercase tracking-[0.16em] font-bold text-white/60 mb-2">{plan.label}</div>
        <p className="text-[12.5px] text-white/55 leading-relaxed">{plan.description}</p>
      </div>

      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[14px] text-white/45 tnum">R$</span>
          <span className="font-bold tnum text-white" style={{ fontSize: "clamp(40px,5vw,56px)", lineHeight: 1, color: popular ? "var(--accent)" : "#fff" }}>
            {plan.monthly}
          </span>
          <span className="text-[13px] text-white/45">/mês</span>
        </div>
        <div className="text-[11px] text-white/40 mt-1.5">{plan.totalNote}</div>
      </div>

      <button
        onClick={() => setLocation("/signup")}
        className={popular
          ? "btn-primary w-full py-3 rounded-xl text-[13px] font-bold inline-flex items-center justify-center gap-2"
          : "w-full py-3 rounded-xl border border-white/15 hover:border-white/30 text-[13px] font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors"}
      >
        Começar com {plan.label.toLowerCase()} <ArrowRight size={13} />
      </button>
    </div>
  );
}

export default function Precos() {
  return (
    <LandingShell>
      {/* Hero */}
      <section className="relative pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <h1 className="font-bold tracking-[-0.025em] text-white" style={{ fontSize: "clamp(36px,5vw,68px)", lineHeight: 1.02 }}>
            Um preço. Todas as features.
          </h1>
          <p className="text-[16px] md:text-[18px] text-white/60 mt-6 max-w-2xl mx-auto leading-relaxed">
            Sem plano premium escondendo o melhor. Você escolhe só o ciclo de cobrança —
            mensal pra testar, anual pra economizar.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-5 pt-6">
            {PLANS.map((plan) => (
              <PriceCard key={plan.id} plan={plan} popular={plan.id === "annual"} />
            ))}
          </div>
          <p className="text-center text-[12px] text-white/40 mt-8">
            Sem cartão de crédito pra começar · Trial de 7 dias · Cancelamento livre
          </p>
        </div>
      </section>

      {/* Features included */}
      <section className="border-t border-white/10 py-20 bg-[#0a0a0b]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12">
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>Tudo incluso, em qualquer plano</p>
            <h2 className="font-bold tracking-tight max-w-3xl text-white" style={{ fontSize: "clamp(28px,3.4vw,44px)", lineHeight: 1.06 }}>
              Você nunca vai esbarrar num "essa feature é só do plano X".
            </h2>
            <p className="text-[14px] text-white/55 mt-4 max-w-2xl leading-relaxed">
              A gente acredita que clareza não é privilégio de quem paga mais. Mensal, semestral ou anual recebem exatamente o mesmo produto.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
            {FEATURES_INCLUDED.map((f, i) => (
              <div key={i} className="bg-[#0a0a0b] p-6 hover:bg-[#101012] transition-colors flex flex-col gap-3">
                <div className="w-9 h-9 rounded-lg grid place-items-center" style={{ background: "var(--accent-soft)" }}>
                  <f.Icon size={15} style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-white tracking-tight mb-1">{f.title}</h3>
                  <p className="text-[12px] text-white/55 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ-ish */}
      <section className="border-t border-white/10 py-20 bg-[#09090b]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="mb-10">
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>Perguntas comuns</p>
            <h2 className="font-bold tracking-tight text-white" style={{ fontSize: "clamp(26px,3vw,40px)", lineHeight: 1.06 }}>
              Antes de começar.
            </h2>
          </div>
          <div className="space-y-4">
            {[
              { q: "Tem trial?", a: "Sim. 7 dias grátis em qualquer plano. Sem cartão de crédito pra começar." },
              { q: "Posso trocar de plano depois?", a: "Pode. Migra de mensal pra semestral ou anual a qualquer hora — o crédito proporcional é considerado." },
              { q: "E se cancelar antes do ciclo terminar?", a: "Cancela quando quiser. No semestral e anual, você usa até o fim do período já pago. Não cobramos taxa de saída." },
              { q: "Tem limite de transações ou de uploads?", a: "Não pra uso normal de PME. Caso a gente identifique uso muito acima do padrão (ex: contador agregando dezenas de empresas), a gente conversa antes de qualquer mudança." },
              { q: "Meus dados são treinamento da IA?", a: "Não. Seus dados nunca treinam nosso modelo sem permissão explícita sua. Detalhes na política de privacidade." },
            ].map((it, i) => (
              <div key={i} className="glass rounded-xl p-5 border border-white/10">
                <div className="text-[14px] font-semibold text-white mb-1.5">{it.q}</div>
                <p className="text-[13px] text-white/60 leading-relaxed">{it.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </LandingShell>
  );
}
