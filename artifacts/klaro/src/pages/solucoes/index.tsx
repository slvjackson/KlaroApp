import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { LandingShell, SOLUTIONS } from "@/components/LandingShell";

export default function SolucoesIndex() {
  return (
    <LandingShell>
      <section className="relative pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div
            className="inline-flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.16em] uppercase px-3 py-1.5 rounded-full mb-6"
            style={{ color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid rgba(106,248,47,0.3)" }}
          >
            PRODUTO
          </div>
          <h1 className="font-bold tracking-[-0.025em] text-white" style={{ fontSize: "clamp(36px,5vw,68px)", lineHeight: 1.02 }}>
            4 jeitos do App Klaro<br />tirar peso do seu dia a dia.
          </h1>
          <p className="text-[16px] md:text-[18px] text-white/60 mt-6 max-w-2xl mx-auto leading-relaxed">
            Você não precisa virar contador. Cada funcionalidade foi pensada pra resolver uma dor concreta e funciona junto, no mesmo lugar.
          </p>
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-5">
            {SOLUTIONS.map((s) => (
              <Link
                key={s.slug}
                href={`/solucoes/${s.slug}`}
                className="group glass rounded-2xl p-7 border border-white/10 hover:border-[rgba(106,248,47,0.35)] transition-colors flex flex-col gap-4"
              >
                <div className="w-12 h-12 rounded-xl grid place-items-center" style={{ background: "var(--accent-soft)" }}>
                  <s.Icon size={20} style={{ color: "var(--accent)" }} />
                </div>
                <div className="flex-1">
                  <h2 className="text-[18px] font-semibold text-white tracking-tight mb-1.5">{s.label}</h2>
                  <p className="text-[13.5px] text-white/55 leading-relaxed">{s.desc}</p>
                </div>
                <div className="text-[12.5px] font-semibold inline-flex items-center gap-1.5 group-hover:gap-2 transition-all" style={{ color: "var(--accent)" }}>
                  Saber mais <ArrowRight size={13} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </LandingShell>
  );
}
