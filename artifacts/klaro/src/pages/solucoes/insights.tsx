import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight, Sparkles, AlertCircle, TrendingUp, Lightbulb, Calendar,
  Brain, CheckCircle2, Loader2,
} from "lucide-react";
import { LandingShell } from "@/components/LandingShell";

const INSIGHTS_DEMO = [
  {
    Icon: AlertCircle, color: "#f59e0b", colorBg: "rgba(245,158,11,0.10)",
    label: "Atenção",
    title: "Despesa com fornecedor cresceu 12%",
    body: "Em abril: R$ 4.220. Mês passado: R$ 3.770. Maior responsável: Forn. Y, R$ 1.850.",
  },
  {
    Icon: TrendingUp, color: "#10b981", colorBg: "rgba(16,185,129,0.10)",
    label: "Oportunidade",
    title: "Sextas vendem 32% mais",
    body: "Análise dos últimos 60 dias: receita média sexta R$ 2.380, demais dias R$ 1.804. Vale dimensionar estoque pro fim de semana.",
  },
  {
    Icon: Lightbulb, color: "var(--accent)", colorBg: "rgba(106,248,47,0.08)",
    label: "Padrão",
    title: "Margem em mercadorias caiu 4,2%",
    body: "Custo médio por unidade subiu 7% mas o preço final subiu só 2,5%. Renegociar farinha pode liberar R$ 320/mês.",
  },
  {
    Icon: Calendar, color: "#a855f7", colorBg: "rgba(168,85,247,0.10)",
    label: "Sazonal",
    title: "Dia das Mães em 5 dias",
    body: "Na sua categoria, faturamento sobe 25-40% nesse período. Histórico mostra você performando abaixo da média — momento de agir.",
  },
];

// Cycles through the 4 demo insights to give the page life
function CarouselInsight() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((v) => (v + 1) % INSIGHTS_DEMO.length), 3500);
    return () => clearInterval(id);
  }, []);
  const it = INSIGHTS_DEMO[idx];
  return (
    <div className="glass-strong rounded-2xl border border-white/10 p-7 max-w-[520px] mx-auto min-h-[280px]">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: it.colorBg }}>
            <it.Icon size={16} style={{ color: it.color }} />
          </div>
          <span className="text-[10.5px] font-bold uppercase tracking-[0.14em]" style={{ color: it.color }}>{it.label}</span>
        </div>
        <div className="flex items-center gap-1">
          {INSIGHTS_DEMO.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-300" style={{
              width: i === idx ? 16 : 5,
              height: 5,
              background: i === idx ? "var(--accent)" : "rgba(255,255,255,0.2)",
            }} />
          ))}
        </div>
      </div>
      <div key={idx} className="transition-opacity duration-500">
        <h3 className="text-[18px] font-semibold text-white tracking-tight leading-snug mb-3">{it.title}</h3>
        <p className="text-[13px] text-white/60 leading-relaxed">{it.body}</p>
      </div>
    </div>
  );
}

// Reused thinking → reveal animation, lighter version for this page
function ThinkingFlow() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % 4), 2200);
    return () => clearInterval(id);
  }, []);
  const steps = ["Lendo seu histórico", "Comparando com benchmark", "Gerando recomendação"];
  return (
    <div className="glass rounded-xl border border-white/10 p-5 max-w-[400px] mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: "var(--accent-soft)" }}>
          <Brain size={13} style={{ color: "var(--accent)" }} />
        </div>
        <span className="text-[11.5px] font-semibold text-white/80 flex items-center gap-1.5">
          Klaro AI
          <Loader2 size={10} className="animate-spin" style={{ color: "var(--accent)" }} />
          <span className="text-[10.5px] text-[var(--accent)] font-medium">pensando…</span>
        </span>
      </div>
      <div className="space-y-2">
        {steps.map((s, i) => {
          const visible = i <= phase % 4 && phase < 3;
          const done = phase === 3 || (visible && i < phase);
          return (
            <div key={i} className="flex items-center gap-2.5 transition-opacity duration-300" style={{ opacity: visible ? 1 : 0.2 }}>
              {done
                ? <CheckCircle2 size={12} style={{ color: "var(--accent)" }} />
                : <div className="w-3 h-3 rounded-full border border-white/20" />}
              <span className="text-[11.5px] text-white/65">{s}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TYPES = [
  { Icon: AlertCircle, color: "#f59e0b", title: "Alerta", desc: "Despesa fora do padrão, queda de receita, caixa apertando." },
  { Icon: TrendingUp,  color: "#10b981", title: "Oportunidade", desc: "Padrão que pode virar mais venda, fornecedor pra renegociar, sazonal pra preparar." },
  { Icon: Lightbulb,   color: "var(--accent)", title: "Padrão escondido", desc: "Tendência de meses que não dá pra ver no caixa do dia." },
  { Icon: Calendar,    color: "#a855f7", title: "Sazonal", desc: "Dia das Mães, Black Friday, fim de ano — preparado a tempo de agir." },
];

export default function SolucoesInsights() {
  const [, setLocation] = useLocation();

  return (
    <LandingShell>
      {/* Hero */}
      <section className="relative pt-20 pb-16" style={{ background: "radial-gradient(900px 500px at 80% 0%, rgba(106,248,47,0.08), transparent 65%), #09090b" }}>
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>
              <Sparkles size={11} className="inline mr-1.5 -mt-0.5" /> Insights Inteligentes
            </p>
            <h1 className="font-bold tracking-[-0.025em] text-white" style={{ fontSize: "clamp(34px,4.4vw,60px)", lineHeight: 1.02 }}>
              <span style={{ color: "var(--accent)" }}>Análise</span> que vem<br />até você.
            </h1>
            <p className="text-[15px] md:text-[17px] text-white/60 mt-6 max-w-lg leading-relaxed">
              Toda manhã o Klaro olha seu histórico e devolve uma análise nova — alerta, oportunidade,
              padrão ou preparação pra evento. Você não precisa abrir relatório. Ele aparece já pronto.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button
                onClick={() => setLocation("/signup")}
                className="btn-primary px-6 py-3.5 rounded-lg text-[14px] font-bold inline-flex items-center justify-center gap-2"
              >
                Quero meus insights <ArrowRight size={15} />
              </button>
            </div>
          </div>
          <div>
            <CarouselInsight />
          </div>
        </div>
      </section>

      {/* How it thinks */}
      <section className="border-t border-white/10 py-20 bg-[#0a0a0b]">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>Como funciona</p>
            <h2 className="font-bold tracking-tight text-white mb-5" style={{ fontSize: "clamp(26px,3.2vw,42px)", lineHeight: 1.06 }}>
              IA que lê seus números antes de você abrir o app.
            </h2>
            <p className="text-[14.5px] text-white/60 leading-relaxed mb-6 max-w-lg">
              A análise é feita em 3 passos: leitura do seu histórico recente, comparação com benchmark do seu segmento
              (quando existe massa de dados suficiente) e geração da recomendação concreta com número justificando.
            </p>
            <ul className="space-y-2.5">
              {[
                "Resumo claro, em 1 ou 2 frases",
                "Sempre com número que você pode verificar",
                "Recomendação concreta — não \"considere reavaliar\"",
                "Dá pra virar missão com 1 clique",
              ].map((t, i) => (
                <li key={i} className="flex items-center gap-2 text-[13.5px] text-white/75">
                  <CheckCircle2 size={14} style={{ color: "var(--accent)" }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <ThinkingFlow />
          </div>
        </div>
      </section>

      {/* Types of insight */}
      <section className="border-t border-white/10 py-20 bg-[#09090b]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10 max-w-2xl">
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>O que pode aparecer</p>
            <h2 className="font-bold tracking-tight text-white" style={{ fontSize: "clamp(26px,3vw,42px)", lineHeight: 1.06 }}>
              4 tipos de insight, gerados conforme seu histórico.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
            {TYPES.map((t, i) => (
              <div key={i} className="bg-[#0a0a0b] hover:bg-[#101012] transition-colors p-6 flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg grid place-items-center" style={{ background: `${t.color === "var(--accent)" ? "rgba(106,248,47,0.10)" : `${t.color}1f`}` }}>
                  <t.Icon size={16} style={{ color: t.color }} />
                </div>
                <div>
                  <h3 className="text-[14.5px] font-semibold text-white tracking-tight mb-1">{t.title}</h3>
                  <p className="text-[12.5px] text-white/55 leading-relaxed">{t.desc}</p>
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
            Quais insights apareceriam no <span style={{ color: "var(--accent)" }}>seu</span> mês?
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
