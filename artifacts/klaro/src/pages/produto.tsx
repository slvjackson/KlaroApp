import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight, Sparkles, TrendingUp, TrendingDown, Lightbulb,
  CheckCircle2, Circle, Loader2, Brain, FileSearch, MessageSquare, Target,
} from "lucide-react";
import { LandingShell } from "@/components/LandingShell";

// ─── Animated dashboard preview ──────────────────────────────────────────────
//
// Bars cycle their heights every few seconds to give the page life. The inset cards
// also rotate the displayed metric. Pure CSS would also work; using state lets us
// sync three blocks (bars + headline + insight) to the same beat.

function useTick(intervalMs: number, max: number): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((v) => (v + 1) % max), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, max]);
  return t;
}

const DASH_FRAMES: Array<{ headline: string; total: string; delta: string; bars: number[] }> = [
  { headline: "Caixa de abril",  total: "R$ 12.430",  delta: "+12,4% vs mar",  bars: [48, 65, 40, 82, 60, 78, 96] },
  { headline: "Caixa de março",  total: "R$ 11.060",  delta: "+4,1% vs fev",   bars: [55, 60, 70, 58, 75, 68, 80] },
  { headline: "Caixa de fevereiro", total: "R$ 10.620", delta: "−1,8% vs jan", bars: [62, 50, 45, 68, 52, 70, 60] },
];

function DashboardPreview() {
  const idx = useTick(3500, DASH_FRAMES.length);
  const f = DASH_FRAMES[idx];
  return (
    <div className="glass-strong rounded-2xl overflow-hidden border border-white/10 max-w-[640px] mx-auto">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
        <div className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60" />
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent)" }} />
        <span className="ml-3 text-[10px] text-white/30 font-mono">klaro — dashboard</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex items-end justify-between">
          <div className="transition-opacity duration-500" key={idx}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-semibold">{f.headline}</div>
            <div className="text-[28px] font-bold tnum mt-1 text-white">{f.total}</div>
          </div>
          <span
            className="text-[11px] font-semibold px-2 py-1 rounded-full transition-colors"
            style={{
              background: f.delta.startsWith("−") ? "rgba(244,63,94,0.12)" : "var(--accent-soft)",
              color: f.delta.startsWith("−") ? "#f43f5e" : "var(--accent)",
            }}
          >
            {f.delta}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { l: "Receitas",   v: "R$ 18.200", d: "+8%", c: "var(--accent)", Icon: TrendingUp },
            { l: "Despesas",   v: "R$ 5.770",  d: "-3%", c: "#f43f5e", Icon: TrendingDown },
            { l: "Transações", v: "47",        d: "+12", c: "#fff", Icon: TrendingUp },
          ].map((m) => (
            <div key={m.l} className="bg-white/5 p-3 border border-white/10 rounded-lg">
              <p className="text-[10px] text-white/40 mb-1">{m.l}</p>
              <p className="text-[15px] font-bold tnum text-white">{m.v}</p>
              <p className="text-[10px] font-semibold mt-0.5 flex items-center gap-1" style={{ color: m.c }}>
                <m.Icon size={10} /> {m.d}
              </p>
            </div>
          ))}
        </div>
        <div className="bg-white/[0.03] p-3 border border-white/10 rounded-lg">
          <div className="flex items-end gap-1.5 h-[72px]">
            {f.bars.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md transition-all duration-700 ease-out"
                style={{ height: `${h}%`, background: i === f.bars.length - 1 ? "var(--accent)" : `rgba(106,248,47,${0.18 + i * 0.07})` }}
              />
            ))}
          </div>
        </div>
        <div className="flex items-start gap-2.5 p-3 border rounded-lg" style={{ borderColor: "rgba(106,248,47,0.25)", background: "var(--accent-soft)" }}>
          <Lightbulb size={13} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
          <div>
            <p className="text-[11px] font-semibold mb-0.5 text-white">Receita acima da meta em 18%</p>
            <p className="text-[10.5px] text-white/55 leading-relaxed">Considere reservar R$ 2.180 para o caixa do próximo mês ou investir em estoque.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── AI thinking → insight reveal ────────────────────────────────────────────
//
// Loop: 0–3s "pensando" (showing 3 thinking bullets fading in), 3–10s reveals the
// finished insight. Then resets. Communicates "IA está trabalhando" without it
// feeling fake — the bullets are real categories of analysis the engine does.

const THINKING_STEPS = [
  "Lendo 47 transações de abril",
  "Comparando com média dos últimos 3 meses",
  "Cruzando com benchmark de outras padarias",
];

const FINAL_INSIGHT = {
  headline: "Sua margem em mercadorias caiu 4,2%",
  body: "Fornecedor de farinha aumentou 12% em abril e o repasse não chegou no preço final. Renegociar agora pode liberar R$ 320/mês.",
  ctaLabel: "Criar missão",
};

function InsightReveal() {
  // Phase: 0 = thinking, 1 = revealing, 2 = revealed.
  // thinking fills 3s, reveal starts at 3s and finishes at 4s, stays until 10s, then resets.
  const tickMs = 100;
  const periodMs = 10_000;
  const t = useTick(tickMs, periodMs / tickMs); // 0..99
  const elapsed = t * tickMs;

  const thinkingDoneAt = 3000;
  const phase = elapsed < thinkingDoneAt ? 0 : 1;
  const stepsVisible = phase === 0 ? Math.min(3, Math.floor(elapsed / 1000) + 1) : 3;
  const revealOpacity = phase === 1 ? Math.min(1, (elapsed - thinkingDoneAt) / 800) : 0;

  return (
    <div className="glass rounded-2xl border border-white/10 p-7 max-w-[520px] mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: "var(--accent-soft)" }}>
          <Brain size={16} style={{ color: "var(--accent)" }} />
        </div>
        <div className="text-[12px] font-semibold text-white/80 flex items-center gap-2">
          Klaro AI
          {phase === 0 && (
            <span className="flex items-center gap-1 text-[10.5px] text-[var(--accent)] font-medium">
              <Loader2 size={11} className="animate-spin" />
              pensando…
            </span>
          )}
        </div>
      </div>

      {/* Thinking bullets */}
      <div className="space-y-2 mb-5">
        {THINKING_STEPS.map((s, i) => {
          const visible = i < stepsVisible;
          return (
            <div
              key={i}
              className="flex items-center gap-2.5 transition-opacity duration-300"
              style={{ opacity: visible ? 1 : 0.15 }}
            >
              {visible && i < stepsVisible - (phase === 0 ? 1 : 0)
                ? <CheckCircle2 size={13} style={{ color: "var(--accent)" }} />
                : <Circle size={13} className="text-white/30" />}
              <span className="text-[12px] text-white/65">{s}</span>
            </div>
          );
        })}
      </div>

      {/* Final insight reveals */}
      <div
        className="rounded-xl border-l-[3px] pl-4 py-2 transition-all duration-500"
        style={{
          opacity: revealOpacity,
          transform: `translateY(${(1 - revealOpacity) * 8}px)`,
          borderColor: "var(--accent)",
        }}
      >
        <div className="text-[10.5px] uppercase tracking-[0.14em] font-bold mb-1.5" style={{ color: "var(--accent)" }}>Insight gerado</div>
        <h3 className="text-[15px] font-semibold text-white leading-snug mb-2">{FINAL_INSIGHT.headline}</h3>
        <p className="text-[12.5px] text-white/65 leading-relaxed mb-3">{FINAL_INSIGHT.body}</p>
        <div className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
          <Target size={12} /> {FINAL_INSIGHT.ctaLabel}
        </div>
      </div>
    </div>
  );
}

// ─── Feature deep-dive blocks (alternating image/text) ───────────────────────

const FEATURE_BLOCKS = [
  {
    eyebrow: "1. Importação",
    title: "Sobe o que tiver. A IA lê tudo.",
    body: "Excel mal formatado, PDF do banco, foto do recibo, OFX, CSV — a IA lê, normaliza e categoriza. Você não mapeia coluna nenhuma.",
    Icon: FileSearch,
    visual: "import",
  },
  {
    eyebrow: "2. Painel",
    title: "Seus números, sem você organizar.",
    body: "Saldo, receita, despesa, tendência, top categorias e mix de receita. Atualiza conforme você sobe dado novo.",
    Icon: TrendingUp,
    visual: "dash",
  },
  {
    eyebrow: "3. Insights",
    title: "Uma análise nova todo dia.",
    body: "A IA olha seu histórico e devolve o ângulo que faz diferença hoje. Pode ser celebração, alerta, padrão sazonal ou comparação com benchmark.",
    Icon: Sparkles,
    visual: "insights",
  },
  {
    eyebrow: "4. Chat",
    title: "Pergunte em português, em qualquer hora.",
    body: "\"Quanto gastei com fornecedor em maio?\" \"Compara abril e maio.\" \"Tô preparado pro Dia das Mães?\" Resposta com seus números reais.",
    Icon: MessageSquare,
    visual: "chat",
  },
];

function FeatureVisual({ kind }: { kind: string }) {
  if (kind === "import") {
    return (
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="grid grid-cols-3 gap-2 w-full">
          {["Excel", "PDF", "Foto", "OFX", "CSV", "Caderno"].map((label, i) => (
            <div
              key={label}
              className="aspect-square rounded-lg border border-white/10 flex items-center justify-center text-[10px] font-semibold text-white/70"
              style={{
                background: "rgba(255,255,255,0.03)",
                animation: `pulse-${i % 3} 2.5s ease-in-out infinite`,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (kind === "dash") {
    return (
      <div className="absolute inset-0 p-5 flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/40 font-bold">Caixa</div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>+12%</span>
        </div>
        <div className="text-[26px] font-bold tnum text-white">R$ 12.430</div>
        <div className="flex items-end gap-1.5 h-[80px] mt-auto">
          {[40, 60, 52, 75, 88, 72, 95].map((h, i) => (
            <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 6 ? "var(--accent)" : `rgba(106,248,47,${0.15 + i * 0.06})` }} />
          ))}
        </div>
      </div>
    );
  }
  if (kind === "insights") {
    return (
      <div className="absolute inset-0 p-5 flex flex-col justify-center gap-3">
        {[
          { tone: "warning", label: "Atenção", text: "Despesa com fornecedor cresceu 12%", color: "#f59e0b" },
          { tone: "success", label: "Oportunidade", text: "Sextas vendem 32% mais — estoque", color: "#10b981" },
          { tone: "info", label: "Padrão", text: "Margem caiu 4,2% em mercadorias", color: "var(--accent)" },
        ].map((it, i) => (
          <div key={i} className="rounded-lg border-l-2 pl-3 py-1.5" style={{ borderColor: it.color }}>
            <div className="text-[9px] uppercase tracking-wider font-bold mb-0.5" style={{ color: it.color }}>{it.label}</div>
            <p className="text-[11px] text-white/75 leading-snug">{it.text}</p>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "chat") {
    return (
      <div className="absolute inset-0 p-5 flex flex-col justify-end gap-2">
        <div className="self-end max-w-[80%] text-[11px] px-3 py-2 rounded-2xl rounded-br-sm bg-white/10 text-white/90">
          Quanto gastei com fornecedor em maio?
        </div>
        <div
          className="self-start max-w-[80%] text-[11px] px-3 py-2 rounded-2xl rounded-bl-sm font-medium leading-relaxed"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          R$ 4.220 (12% a menos que abril). Maior gasto: Forn. Y, R$ 1.850.
        </div>
        <div className="self-end max-w-[80%] text-[11px] px-3 py-2 rounded-2xl rounded-br-sm bg-white/10 text-white/90">
          E como tá vs minha média?
        </div>
      </div>
    );
  }
  return null;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Produto() {
  const [, setLocation] = useLocation();

  return (
    <LandingShell>
      {/* Hero with live dashboard */}
      <section
        className="relative pt-20 pb-20"
        style={{
          background:
            "radial-gradient(1000px 500px at 80% 0%, rgba(106,248,47,0.08), transparent 65%), #09090b",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div
              className="inline-flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.16em] uppercase px-3 py-1.5 rounded-full mb-6"
              style={{ color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid rgba(106,248,47,0.3)" }}
            >
              O produto
            </div>
            <h1 className="font-bold tracking-[-0.025em] text-white" style={{ fontSize: "clamp(36px,4.6vw,64px)", lineHeight: 1.02 }}>
              Da bagunça ao <span style={{ color: "var(--accent)" }}>painel</span>, em minutos.
            </h1>
            <p className="text-[16px] md:text-[18px] text-white/60 mt-6 max-w-lg leading-relaxed">
              Klaro é o painel financeiro do empresário que quer entender o próprio negócio sem virar contador.
              Subiu o dado — IA categoriza, monta o painel, gera insight e sugere o próximo passo.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button
                onClick={() => setLocation("/signup")}
                className="btn-primary px-6 py-3.5 rounded-lg text-[14px] font-bold inline-flex items-center justify-center gap-2"
              >
                Começar grátis <ArrowRight size={15} />
              </button>
              <button
                onClick={() => setLocation("/precos")}
                className="px-6 py-3.5 rounded-lg border border-white/15 hover:border-white/30 text-[14px] font-semibold text-white"
              >
                Ver preços
              </button>
            </div>
          </div>
          <div>
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* Insight live demo */}
      <section className="border-t border-white/10 py-20 bg-[#0a0a0b]">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>Insights por IA</p>
            <h2 className="font-bold tracking-tight text-white mb-5" style={{ fontSize: "clamp(28px,3.6vw,48px)", lineHeight: 1.05 }}>
              A IA faz as perguntas que você não tinha tempo de fazer.
            </h2>
            <p className="text-[15px] text-white/60 leading-relaxed mb-6 max-w-lg">
              Toda manhã o Klaro olha seu histórico e devolve um ângulo novo:
              um padrão escondido, um alerta de caixa, uma comparação com mês passado, uma oportunidade de evento sazonal.
              Você decide o que vira ação.
            </p>
            <ul className="space-y-3 mb-2">
              {[
                "Resumo diário do que mudou no seu caixa",
                "Padrão sazonal antes do evento (Dia das Mães, Black Friday, fim de mês)",
                "Alerta de despesa fora da curva, com recomendação concreta",
                "Comparação com benchmark do seu segmento, quando disponível",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[14px] text-white/75">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <InsightReveal />
          </div>
        </div>
      </section>

      {/* Feature blocks alternating */}
      <section className="border-t border-white/10 bg-[#09090b]">
        {FEATURE_BLOCKS.map((b, i) => (
          <div
            key={i}
            className={`max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center border-t border-white/5 first:border-0 ${
              i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
            }`}
          >
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg grid place-items-center" style={{ background: "var(--accent-soft)" }}>
                  <b.Icon size={16} style={{ color: "var(--accent)" }} />
                </div>
                <p className="text-[12px] font-bold tracking-[0.18em] uppercase" style={{ color: "var(--accent)" }}>{b.eyebrow}</p>
              </div>
              <h3 className="font-bold tracking-tight mb-4 text-white" style={{ fontSize: "clamp(26px,3vw,40px)", lineHeight: 1.08 }}>
                {b.title}
              </h3>
              <p className="text-[15px] text-white/60 leading-relaxed max-w-md">{b.body}</p>
            </div>
            <div className="relative aspect-[5/4] rounded-2xl border border-white/10 overflow-hidden" style={{ background: "linear-gradient(135deg,#101013,#1a1a1d)" }}>
              <FeatureVisual kind={b.visual} />
            </div>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 py-24 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(800px 400px at 50% 50%, rgba(106,248,47,0.10), transparent 65%)" }}
        />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-bold tracking-tight text-white mb-5" style={{ fontSize: "clamp(28px,3.6vw,48px)", lineHeight: 1.05 }}>
            Quer ver com seus próprios dados?
          </h2>
          <p className="text-[15px] text-white/60 max-w-xl mx-auto mb-8 leading-relaxed">
            14 dias grátis em qualquer plano. Sem cartão pra começar.
          </p>
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
