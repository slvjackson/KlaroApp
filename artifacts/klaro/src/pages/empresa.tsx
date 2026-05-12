import { useLocation } from "wouter";
import { ArrowRight, Sparkles } from "lucide-react";
import { LandingShell } from "@/components/LandingShell";

const VALUES = [
  { t: "Clareza acima de tudo",          d: "Se não está claro, não está bom. Cada tela, cada texto, cada feature passa por essa pergunta antes de ir pro ar." },
  { t: "Facilitar para fazer acontecer", d: "Não adianta ser completo se ninguém usa. Preferimos uma feature simples que vira hábito do que dez complexas que ninguém abre." },
  { t: "Decisão baseada em dados",       d: "Achismo não existe no nosso vocabulário — nem internamente nem no produto que entregamos pro empresário." },
  { t: "Bom nunca é suficiente",         d: "Sempre podemos melhorar o que estamos fazendo hoje. Cada release começa olhando o que ficou aquém da semana passada." },
  { t: "Construa algo grande",           d: "Não nos contentamos com pouco. Existe um milhão de PMEs no Brasil sem clareza financeira — esse é o tamanho do problema." },
];

export default function Empresa() {
  const [, setLocation] = useLocation();

  return (
    <LandingShell>
      {/* Hero */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 500px at 80% 20%, rgba(106,248,47,0.08), transparent 65%), radial-gradient(700px 400px at -10% 100%, rgba(91,140,255,0.05), transparent 60%)",
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <div
            className="inline-flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.16em] uppercase px-3 py-1.5 rounded-full mb-6"
            style={{ color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid rgba(106,248,47,0.3)" }}
          >
            <Sparkles size={11} /> A empresa
          </div>
          <h1 className="font-bold tracking-[-0.025em] text-white" style={{ fontSize: "clamp(36px,5vw,68px)", lineHeight: 1.02 }}>
            Por que a Klaro existe.
          </h1>
          <p className="text-[16px] md:text-[18px] text-white/60 mt-6 max-w-2xl mx-auto leading-relaxed">
            Pequeno negócio brasileiro fatura, sangra, sobrevive. A maior parte sem nunca entender por quê.
            Klaro existe pra mudar isso — entregando clareza sem exigir que o empresário vire contador.
          </p>
        </div>
      </section>

      {/* Missão / Visão */}
      <section className="border-t border-white/10 py-20 bg-[#0a0a0b]">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-8 border border-white/10">
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold mb-4" style={{ color: "var(--accent)" }}>Missão</div>
            <p className="text-[18px] text-white/90 leading-relaxed font-medium">
              Ajudar empresários a entender seus números e tomar decisões melhores em seus negócios todos os dias.
            </p>
          </div>
          <div className="glass rounded-2xl p-8 border border-white/10">
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold mb-4" style={{ color: "var(--accent)" }}>Visão</div>
            <p className="text-[18px] text-white/90 leading-relaxed font-medium">
              Ser a empresa que redefine como pequenos negócios crescem no Brasil, impactando milhões de empresas com clareza financeira.
            </p>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="border-t border-white/10 py-20 bg-[#09090b]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="mb-12 text-center">
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>Como agimos</p>
            <h2 className="font-bold tracking-tight text-white" style={{ fontSize: "clamp(28px,3.4vw,44px)", lineHeight: 1.06 }}>
              Os 5 princípios que guiam tudo que a gente faz.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
            {VALUES.map((v, i) => (
              <div key={i} className="bg-[#0a0a0b] hover:bg-[#101012] transition-colors p-7 flex items-start gap-4">
                <div
                  className="w-10 h-10 rounded-xl shrink-0 grid place-items-center font-bold text-[16px] tnum"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-[15.5px] font-semibold text-white tracking-tight mb-1.5">{v.t}</h3>
                  <p className="text-[13px] text-white/55 leading-relaxed">{v.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fundadores */}
<section className="border-t border-white/10 py-20 bg-[#09090b]">
  <div className="max-w-5xl mx-auto px-6">
    <div className="mb-12 text-center">
      <p
        className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3"
        style={{ color: "var(--accent)" }}
      >
        Quem está construindo?
      </p>

      <h2
        className="font-bold tracking-tight text-white"
        style={{
          fontSize: "clamp(28px,3.4vw,44px)",
          lineHeight: 1.06,
        }}
      >
        Criamos o Klaro porque vimos de perto quantas empresas tomam decisões importantes sem clareza financeira.
      </h2>
    </div>

    <div className="grid md:grid-cols-2 gap-6">
      <div className="glass rounded-2xl p-8 border border-white/10">
        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-12 h-12 rounded-xl grid place-items-center text-[18px] font-bold"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            G
          </div>

          <div>
            <h3 className="text-[18px] font-semibold text-white">
              Gabriel Souza
            </h3>

            <p className="text-[13px] text-white/45">
              Dados & Inteligência de Negócios
            </p>
          </div>
        </div>

        <p className="text-[14px] text-white/60 leading-relaxed">
          Especialista em dados e inteligência de negócios, com 10 anos de experiência em grandes empresas e foco em transformar números complexos em decisões simples.
        </p>
      </div>

      <div className="glass rounded-2xl p-8 border border-white/10">
        <div className="flex items-center gap-4 mb-5">
          <div
            className="w-12 h-12 rounded-xl grid place-items-center text-[18px] font-bold"
            style={{
              background: "var(--accent-soft)",
              color: "var(--accent)",
            }}
          >
            J
          </div>

          <div>
            <h3 className="text-[18px] font-semibold text-white">
              Jackson Silva
            </h3>

            <p className="text-[13px] text-white/45">
              Engenharia & Produto
            </p>
          </div>
        </div>

        <p className="text-[14px] text-white/60 leading-relaxed">
          Engenheiro de software focado em produto e tecnologia, construindo experiências simples para resolver problemas reais de pequenos, médios e grandes negócios.
        </p>
      </div>
    </div>
  </div>
</section>

      {/* CTA */}
      <section className="border-t border-white/10 py-24 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(800px 400px at 50% 50%, rgba(106,248,47,0.10), transparent 65%)",
          }}
        />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-bold tracking-tight text-white mb-5" style={{ fontSize: "clamp(28px,3.6vw,48px)", lineHeight: 1.05 }}>
            Quer construir <span style={{ color: "var(--accent)" }}>clareza</span> com a gente?
          </h2>
          <p className="text-[15px] text-white/60 max-w-xl mx-auto mb-8 leading-relaxed">
            O Klaro é grátis pra você experimentar. Importe sua primeira planilha e veja na prática.
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
