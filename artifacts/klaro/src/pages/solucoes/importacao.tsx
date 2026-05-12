import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight, FileSearch, FileSpreadsheet, FileText, Camera, Landmark, NotebookPen,
  CheckCircle2, Loader2,
} from "lucide-react";
import { LandingShell } from "@/components/LandingShell";

const SOURCES = [
  { Icon: FileSpreadsheet, label: "Excel",    note: "Mesmo bagunçado, com células mescladas e cabeçalho fora do padrão." },
  { Icon: FileText,        label: "PDF",      note: "Extrato bancário, fatura, recibo, comprovante." },
  { Icon: Camera,          label: "Foto",     note: "Foto de extrato, recibo ou caderno de caixa." },
  { Icon: Landmark,        label: "OFX",      note: "Direto do internet banking, sem precisar converter." },
  { Icon: FileText,        label: "CSV",      note: "Exportado de qualquer ERP ou sistema de venda." },
  { Icon: NotebookPen,     label: "Caderno",  note: "Até seu controle no caderninho funciona, nossa IA interpreta e armazena seus dados." },
];

// Animated import flow: file lands → IA processes → categorized rows appear
function ImportAnimation() {
  const [phase, setPhase] = useState(0); // 0: idle, 1: uploading, 2: ai, 3: done
  useEffect(() => {
    const seq = [
      [800, 1],
      [1500, 2],
      [3000, 3],
      [2000, 0],
    ] as const;
    let t = setTimeout(function loop() {
      setPhase((p) => (p + 1) % 4);
      t = setTimeout(loop, seq[(phase + 1) % 4][0]);
    }, seq[phase][0]);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="glass-strong rounded-2xl border border-white/10 p-6 max-w-[480px] mx-auto">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: "var(--accent-soft)" }}>
          <FileSearch size={14} style={{ color: "var(--accent)" }} />
        </div>
        <span className="text-[12px] font-semibold text-white/80">Importação inteligente</span>
      </div>

      {/* Step 1 — file dropped */}
      <div className="flex items-center gap-3 p-3 rounded-lg border border-white/10 mb-3" style={{ background: phase >= 1 ? "rgba(106,248,47,0.04)" : "transparent" }}>
        <FileSpreadsheet size={16} className={phase >= 1 ? "text-[var(--accent)]" : "text-white/40"} />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-medium text-white truncate">caixa-abril.xlsx</div>
          <div className="text-[10px] text-white/40">182 KB · 47 linhas</div>
        </div>
        {phase >= 1 && <CheckCircle2 size={14} style={{ color: "var(--accent)" }} />}
      </div>

      {/* Step 2 — AI processing */}
      <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg" style={{
        background: phase === 2 ? "var(--accent-soft)" : "transparent",
        opacity: phase >= 1 ? 1 : 0.3,
        transition: "background-color 0.4s, opacity 0.4s",
      }}>
        {phase === 2
          ? <Loader2 size={13} className="animate-spin" style={{ color: "var(--accent)" }} />
          : phase >= 3
          ? <CheckCircle2 size={13} style={{ color: "var(--accent)" }} />
          : <div className="w-3 h-3 rounded-full border border-white/20" />}
        <span className="text-[11.5px]" style={{ color: phase === 2 ? "var(--accent)" : "rgba(255,255,255,0.55)" }}>
          {phase === 2 ? "Lendo e categorizando…" : phase >= 3 ? "Categorizado" : "Aguardando IA"}
        </span>
      </div>

      {/* Step 3 — categorized rows */}
      <div className="space-y-1.5 transition-opacity duration-500" style={{ opacity: phase >= 3 ? 1 : 0 }}>
        {[
          { d: "01/04", desc: "iFood",         val: "+R$ 680,00",  cat: "Receita",      catColor: "#10b981" },
          { d: "02/04", desc: "Aluguel",       val: "−R$ 1.800,00", cat: "Moradia",     catColor: "#5b8cff" },
          { d: "03/04", desc: "Forn. Padaria", val: "−R$ 540,00",  cat: "Mercadorias", catColor: "#f59e0b" },
        ].map((r, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 text-[11px] py-1.5"
            style={{
              opacity: phase >= 3 ? 1 : 0,
              transform: `translateY(${phase >= 3 ? 0 : 8}px)`,
              transition: `all 0.4s ${i * 100}ms`,
            }}
          >
            <span className="text-white/40 tnum w-12">{r.d}</span>
            <span className="flex-1 text-white/80 truncate">{r.desc}</span>
            <span className="px-1.5 py-0.5 rounded text-[9.5px] font-semibold tnum" style={{ background: `${r.catColor}1f`, color: r.catColor }}>
              {r.cat}
            </span>
            <span className="font-semibold tnum text-white w-20 text-right">{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SolucoesImportacao() {
  const [, setLocation] = useLocation();

  return (
    <LandingShell>
      {/* Hero */}
      <section
        className="relative pt-20 pb-16"
        style={{ background: "radial-gradient(900px 500px at 80% 0%, rgba(106,248,47,0.08), transparent 65%), #09090b" }}
      >
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>
              <FileSearch size={11} className="inline mr-1.5 -mt-0.5" /> Importação universal
            </p>
            <h1 className="font-bold tracking-[-0.025em] text-white" style={{ fontSize: "clamp(34px,4.4vw,60px)", lineHeight: 1.02 }}>
              Sobe o que <span style={{ color: "var(--accent)" }}>você tem</span>,<br />o Klaro cuida do resto.
            </h1>
            <p className="text-[15px] md:text-[17px] text-white/60 mt-6 max-w-lg leading-relaxed">
              A maior parte dos sistemas de gestão exige planilha no formato deles ou de forma manual. O Klaro vai pelo caminho oposto: aceita o arquivo do jeito que está, interpreta, organiza e devolve seu dashboard pronto cheio de insights.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <button
                onClick={() => setLocation("/signup")}
                className="btn-primary px-6 py-3.5 rounded-lg text-[14px] font-bold inline-flex items-center justify-center gap-2"
              >
                Subir meu primeiro arquivo <ArrowRight size={15} />
              </button>
            </div>
          </div>
          <div>
            <ImportAnimation />
          </div>
        </div>
      </section>

      {/* Sources grid */}
      <section className="border-t border-white/10 py-20 bg-[#0a0a0b]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-12 max-w-2xl">
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>O que entra</p>
            <h2 className="font-bold tracking-tight text-white" style={{ fontSize: "clamp(26px,3vw,42px)", lineHeight: 1.06 }}>
              6 formatos suportados — sem mapeamento, sem template.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
            {SOURCES.map((s, i) => (
              <div key={i} className="bg-[#0a0a0b] hover:bg-[#101012] transition-colors p-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg grid place-items-center shrink-0" style={{ background: "var(--accent-soft)" }}>
                  <s.Icon size={16} style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-white mb-1">{s.label}</h3>
                  <p className="text-[12.5px] text-white/55 leading-relaxed">{s.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why bullets */}
      <section className="border-t border-white/10 py-20 bg-[#09090b]">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>Por quê é diferente</p>
          <h2 className="font-bold tracking-tight text-white mb-10" style={{ fontSize: "clamp(26px,3vw,42px)", lineHeight: 1.06 }}>
            Importação que respeita seu jeito de trabalhar.
          </h2>
          <ul className="space-y-5">
            {[
              { t: "Zero coluna pra mapear", d: "A IA reconhece o que é data, descrição, valor, categoria — mesmo se vier em ordem invertida ou com nome estranho." },
              { t: "Aprende seu padrão", d: "A cada upload, o modelo melhora a categorização baseado nas suas correções anteriores." },
              { t: "Funciona com foto", d: "Caderno do caixa, recibo amassado, extrato impresso. A Inteligência do Klaro lê e estrutura como se fosse digital." },
              { t: "Sem perder nada", d: "Linha duplicada, valor faltando, descrição vazia — Klaro sinaliza, você decide. Nada some sem você ver." },
            ].map((b, i) => (
              <li key={i} className="flex items-start gap-4 pb-5 border-b border-white/5 last:border-0">
                <div className="w-7 h-7 rounded-full shrink-0 grid place-items-center font-bold text-[12px] tnum mt-0.5" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-[16px] font-semibold text-white tracking-tight mb-1.5">{b.t}</h3>
                  <p className="text-[13.5px] text-white/60 leading-relaxed">{b.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-white/10 py-20 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-bold tracking-tight text-white mb-5" style={{ fontSize: "clamp(26px,3.2vw,40px)", lineHeight: 1.06 }}>
            Quer ver com seu próprio arquivo?
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
