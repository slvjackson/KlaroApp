import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Target, CheckCircle2, Circle, Sparkles, Trophy } from "lucide-react";
import { LandingShell } from "@/components/LandingShell";

const STEPS = [
  "Listar fornecedores e valores dos últimos 3 meses",
  "Identificar 2 com maior crescimento de custo",
  "Pedir orçamento concorrente para os 2 itens-chave",
  "Renegociar com base na cotação alternativa",
];

// Animation: progressively check off steps, then show a victory state, then reset.
function MissionAnimation() {
  const [idx, setIdx] = useState(0); // 0 = none done, 1-4 = N done
  useEffect(() => {
    const id = setInterval(() => {
      setIdx((v) => (v + 1) % (STEPS.length + 2));
    }, 1500);
    return () => clearInterval(id);
  }, []);

  const done = Math.min(idx, STEPS.length);
  const complete = idx >= STEPS.length;

  return (
    <div className="glass-strong rounded-2xl border border-white/10 p-6 max-w-[480px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg grid place-items-center" style={{ background: "var(--accent-soft)" }}>
          <Target size={15} style={{ color: "var(--accent)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] font-bold" style={{ color: "var(--accent)" }}>Missão criada</div>
          <div className="text-[14px] font-semibold text-white truncate">Renegociar fornecedores top 2</div>
        </div>
        {complete && <Trophy size={18} style={{ color: "var(--accent)" }} />}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${(done / STEPS.length) * 100}%`, background: complete ? "#10b981" : "var(--accent)" }}
          />
        </div>
        <span className="text-[10.5px] tnum text-white/55">{done}/{STEPS.length}</span>
      </div>

      {/* Steps */}
      <div className="space-y-2.5">
        {STEPS.map((s, i) => {
          const isDone = i < done;
          return (
            <div key={i} className="flex items-start gap-3 transition-all" style={{ opacity: isDone ? 0.6 : 1 }}>
              {isDone
                ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: "#10b981" }} />
                : <Circle size={16} className="mt-0.5 shrink-0 text-white/30" />}
              <span className={`text-[12.5px] leading-snug transition-colors ${isDone ? "line-through text-white/45" : "text-white/85"}`}>
                {s}
              </span>
            </div>
          );
        })}
      </div>

      {/* Victory pill */}
      {complete && (
        <div className="mt-5 flex items-center gap-2 px-3 py-2 rounded-lg fadeUp" style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.3)" }}>
          <Trophy size={13} style={{ color: "#10b981" }} />
          <span className="text-[12px] font-semibold text-[#10b981]">Missão concluída</span>
          <span className="text-[11px] text-white/50 ml-auto">Você liberou ~R$ 1.200/mês</span>
        </div>
      )}
    </div>
  );
}

const FLOW = [
  { Icon: Sparkles,   title: "Insight aparece",     desc: "A IA detecta um padrão ou oportunidade no seu histórico." },
  { Icon: Target,     title: "Vira missão",         desc: "Em 1 clique o insight cria uma missão com passos práticos." },
  { Icon: CheckCircle2, title: "Você marca o que fez", desc: "Cada passo é um checkpoint. Você acompanha o progresso visual." },
  { Icon: Trophy,     title: "Resultado aparece",   desc: "Quando concluída, a missão mostra o impacto financeiro real." },
];

export default function SolucoesMissoes() {
  const [, setLocation] = useLocation();

  return (
    <LandingShell>
      {/* Hero */}
      <section className="relative pt-20 pb-16" style={{ background: "radial-gradient(900px 500px at 80% 0%, rgba(106,248,47,0.08), transparent 65%), #09090b" }}>
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>
              <Target size={11} className="inline mr-1.5 -mt-0.5" /> Missões
            </p>
            <h1 className="font-bold tracking-[-0.025em] text-white" style={{ fontSize: "clamp(34px,4.4vw,60px)", lineHeight: 1.02 }}>
              <span style={{ color: "var(--accent)" }}>Insight</span> só serve<br />se virar ação.
            </h1>
            <p className="text-[15px] md:text-[17px] text-white/60 mt-6 max-w-lg leading-relaxed">
              Toda missão tem passos concretos. Você marca o que já fez, vê o progresso visual e — quando termina —
              o Klaro mostra o impacto financeiro real da decisão.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button
                onClick={() => setLocation("/signup")}
                className="btn-primary px-6 py-3.5 rounded-lg text-[14px] font-bold inline-flex items-center justify-center gap-2"
              >
                Criar minha primeira missão <ArrowRight size={15} />
              </button>
            </div>
          </div>
          <div>
            <MissionAnimation />
          </div>
        </div>
      </section>

      {/* Flow */}
      <section className="border-t border-white/10 py-20 bg-[#0a0a0b]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 max-w-2xl">
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>Do insight à conquista</p>
            <h2 className="font-bold tracking-tight text-white" style={{ fontSize: "clamp(26px,3vw,42px)", lineHeight: 1.06 }}>
              4 passos que transformam análise em resultado.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
            {FLOW.map((f, i) => (
              <div key={i} className="bg-[#0a0a0b] hover:bg-[#101012] transition-colors p-6 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-[12px] font-bold tnum" style={{ color: "var(--accent)" }}>{i + 1}.</span>
                  <div className="w-9 h-9 rounded-lg grid place-items-center" style={{ background: "var(--accent-soft)" }}>
                    <f.Icon size={15} style={{ color: "var(--accent)" }} />
                  </div>
                </div>
                <div>
                  <h3 className="text-[14.5px] font-semibold text-white tracking-tight mb-1">{f.title}</h3>
                  <p className="text-[12.5px] text-white/55 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="border-t border-white/10 py-20 bg-[#09090b]">
        <div className="max-w-3xl mx-auto px-6">
          <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>Por quê faz diferença</p>
          <h2 className="font-bold tracking-tight text-white mb-8" style={{ fontSize: "clamp(26px,3vw,42px)", lineHeight: 1.06 }}>
            Sem missão, insight é só conhecimento. Com missão, vira hábito.
          </h2>
          <p className="text-[15px] text-white/65 leading-relaxed mb-6">
            A IA detecta o padrão; o passo a passo te tira do "preciso fazer alguma coisa" pro "fiz isso, isso e isso".
            E quando você fecha a missão, o Klaro mostra o impacto financeiro do que você decidiu fazer.
          </p>
          <p className="text-[15px] text-white/65 leading-relaxed">
            Não é gamificação artificial — é o ciclo natural de quem cuida do próprio negócio: ver, decidir, agir, medir.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 py-20 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-bold tracking-tight text-white mb-5" style={{ fontSize: "clamp(26px,3.2vw,40px)", lineHeight: 1.06 }}>
            Que decisão você adiou esse mês?
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
