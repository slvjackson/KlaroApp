import { useLocation } from "wouter";
import {
  ArrowRight, CheckCircle2, Check,
  UploadCloud, LayoutDashboard, Sparkles, Layers, MessageSquare,
  Lightbulb, TrendingUp, AlertCircle,
  FileText,
  ShoppingBag, Hammer, Coffee, Briefcase,
} from "lucide-react";
import { LandingShell } from "@/components/LandingShell";

// ─── Phone mockup (central hero piece) ───────────────────────────────────────

function PhoneMockup() {
  const BARS = [42, 60, 38, 72, 55, 78, 92];
  return (
    <div
      className="relative rounded-[40px] overflow-hidden border border-white/10 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)]"
      style={{
        width: 280,
        height: 560,
        background: "linear-gradient(180deg, #16161a 0%, #0d0d11 100%)",
      }}
    >
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-full z-10" />

      <div className="pt-9 px-5 flex items-center justify-between text-[10px] text-white/40 font-mono">
        <span>9:41</span>
        <span className="tracking-wider">klaro</span>
      </div>

      <div className="px-5 pt-5 space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-semibold">Caixa de abril</div>
          <div className="text-[26px] font-bold tnum mt-1 text-white leading-none">R$ 12.430</div>
          <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            +12,4% vs mar
          </span>
        </div>

        <div className="bg-white/[0.03] p-3 border border-white/10 rounded-xl">
          <div className="flex items-end gap-1.5 h-[56px]">
            {BARS.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md"
                style={{ height: `${h}%`, background: i === BARS.length - 1 ? "var(--accent)" : `rgba(106,248,47,${0.16 + i * 0.06})` }}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-semibold mb-2">Hoje</div>
          <div className="space-y-2">
            {[
              { n: "Venda PIX",      v: "+ R$ 240",   c: "var(--accent)" },
              { n: "Fornecedor",     v: "− R$ 540",   c: "#f43f5e" },
              { n: "iFood",          v: "+ R$ 680",   c: "var(--accent)" },
            ].map((t, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] py-1.5 border-b border-white/5">
                <span className="text-white/70">{t.n}</span>
                <span className="font-semibold tnum" style={{ color: t.c }}>{t.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Ghost source (faded, behind the phone — tells the "chaos → clarity" story) ─

function GhostSource() {
  return (
    <div
      className="rounded-2xl border border-white/10 overflow-hidden"
      style={{
        width: 240,
        background: "linear-gradient(180deg, rgba(40,40,46,0.55), rgba(20,20,24,0.45))",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
        <div className="w-5 h-5 rounded grid place-items-center" style={{ background: "#107c41" }}>
          <FileText size={10} className="text-white" />
        </div>
        <span className="text-[9px] font-semibold text-white/70 truncate">caixa_abril_v3.xlsx</span>
      </div>
      <div className="p-2 grid grid-cols-3 gap-px bg-white/5">
        {[
          "01/04","Venda","2.450",
          "02/04","Aluguel","-1.800",
          "03/04","Frete","-89",
          "04/04","PIX","680",
          "05/04","Forn.","-540",
          "06/04","Venda","1.205",
        ].map((c, i) => (
          <div key={i} className="bg-[#1a1a1f] h-4 px-1.5 flex items-center text-[8px] text-white/40 tnum">{c}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Big stat pill (replaces the third card — different visual register) ──────

function BigStat() {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1" style={{ color: "var(--accent)" }}>
        Oportunidade
      </span>
      <div
        className="text-[34px] font-bold tnum leading-none"
        style={{
          color: "var(--accent)",
          textShadow: "0 0 24px rgba(106,248,47,0.4)",
        }}
      >
        +R$ 1.840
      </div>
      <span className="text-[11px] text-white/55 mt-1">renegociando 2 fornecedores</span>
    </div>
  );
}

function SatelliteMission() {
  return (
    <div
      className="rounded-2xl border border-white/10 p-4 backdrop-blur-md shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)]"
      style={{ width: 220, background: "rgba(22,22,26,0.85)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <CheckCircle2 size={13} className="text-white/55" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/55">Missão</span>
      </div>
      <div className="space-y-1.5">
        {[
          { l: "Renegociar fornecedor X", done: true },
          { l: "Revisar 12 transações",   done: true },
          { l: "Comparar margem",         done: false },
        ].map((m, i) => (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <div
              className="w-3 h-3 rounded-full grid place-items-center shrink-0"
              style={{ background: m.done ? "var(--accent)" : "transparent", border: m.done ? "none" : "1px solid rgba(255,255,255,0.2)" }}
            >
              {m.done && <Check size={8} className="text-black" />}
            </div>
            <span className={m.done ? "text-white/55 line-through" : "text-white/80"}>{m.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SatelliteChat() {
  return (
    <div
      className="rounded-2xl border border-white/10 p-3.5 backdrop-blur-md shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] space-y-1.5"
      style={{ width: 240, background: "rgba(22,22,26,0.85)" }}
    >
      <div className="self-end ml-auto max-w-[80%] text-[11px] px-3 py-1.5 rounded-2xl rounded-br-sm bg-white/10 text-white/80">
        Posso contratar alguém esse mês?
      </div>
      <div
        className="max-w-[85%] text-[11px] px-3 py-1.5 rounded-2xl rounded-bl-sm"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        Sim — sua folga de caixa permite até R$ 4.200/mês.
      </div>
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function HeroSection({ go }: { go: (path: string) => void }) {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "radial-gradient(1100px 600px at 78% -10%, rgba(106,248,47,0.10), transparent 60%), radial-gradient(800px 500px at -5% 110%, rgba(91,140,255,0.05), transparent 60%), #09090b",
      }}
    >
      <div className="relative max-w-6xl mx-auto px-6 pt-8 md:pt-14 pb-20 md:pb-28 text-center">
        <h1
          className="font-bold tracking-[-0.03em] mx-auto max-w-3xl text-white"
          style={{ fontSize: "clamp(30px, 5.4vw, 60px)", lineHeight: 1.04 }}
        >
          Clareza nos números.{" "}
          <span style={{ color: "var(--accent)" }}>Resultado no bolso.</span>
        </h1>
        <p className="text-[15px] md:text-[17px] text-white/55 mt-5 max-w-xl mx-auto leading-relaxed">
          O Klaro organiza seus números automaticamente e mostra onde sua empresa pode economizar, crescer e tomar decisões melhores.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8 max-w-sm sm:max-w-none mx-auto">
          <button
            onClick={() => go("/signup")}
            className="btn-primary px-7 py-3.5 rounded-lg text-[14px] font-bold inline-flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            Começar grátis <ArrowRight size={15} />
          </button>
          <button
            onClick={() => go("/login")}
            className="px-7 py-3.5 rounded-lg border border-white/15 hover:border-white/30 text-[14px] font-semibold text-white w-full sm:w-auto"
          >
            Já tenho conta
          </button>
        </div>

        <div className="relative mt-5 md:mt-6 mx-auto h-[520px] md:h-[580px]" style={{ maxWidth: 980 }}>
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 rounded-full pointer-events-none hero-glow w-[340px] h-[340px] md:w-[520px] md:h-[520px]"
            style={{
              background: "radial-gradient(circle, var(--accent-soft), transparent 65%)",
              filter: "blur(40px)",
            }}
          />

          <div
            className="hidden md:block absolute hero-float"
            style={{
              left: "calc(50% - 200px)",
              top: "calc(50% - 90px)",
              transform: "translate(-50%, -50%) rotate(-9deg)",
              transformOrigin: "center",
              animationDelay: "-3.6s",
              opacity: 0.55,
            }}
          >
            <GhostSource />
          </div>

          <div className="absolute left-1/2 top-1/2 hero-float hero-phone-pos">
            <PhoneMockup />
          </div>

          <div
            className="hidden md:block absolute hero-orbit"
            style={{ left: "2%", top: "18%", animationDelay: "-1.6s" }}
          >
            <BigStat />
          </div>
          <div
            className="hidden md:block absolute hero-orbit"
            style={{ right: "3%", top: "6%", animationDelay: "-4.8s" }}
          >
            <SatelliteMission />
          </div>
          <div
            className="hidden md:block absolute hero-orbit"
            style={{ right: "6%", bottom: "10%", animationDelay: "-2.4s" }}
          >
            <SatelliteChat />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Areas / features ────────────────────────────────────────────────────────

type MiniVizKind = "upload" | "dash" | "insights" | "missions" | "categorization" | "chat";

function MiniViz({ kind }: { kind: MiniVizKind }) {
  if (kind === "upload") return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="w-20 h-24 rounded-md border border-white/15 bg-white/5 grid place-items-center">
        <FileText size={26} className="text-white/40" />
      </div>
      <div className="absolute bottom-3 left-3 right-3 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="h-full w-3/4 rounded-full" style={{ background: "var(--accent)" }} />
      </div>
    </div>
  );
  if (kind === "dash") return (
    <div className="absolute inset-0 p-3 flex items-end gap-1.5">
      {[40, 60, 52, 75, 88, 72, 95].map((h, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, background: i === 6 ? "var(--accent)" : `rgba(106,248,47,${0.15 + i * 0.06})` }} />
      ))}
    </div>
  );
  if (kind === "insights") return (
    <div className="absolute inset-0 grid place-items-center p-4">
      <div className="text-[10px] text-white/70 leading-snug border-l-2 pl-3" style={{ borderColor: "var(--accent)" }}>
        "Sua margem em <b>Mercadorias</b> caiu <b>4,2%</b>. Renegocie 2 fornecedores."
      </div>
    </div>
  );
  if (kind === "missions") return (
    <div className="absolute inset-0 p-4 flex flex-col gap-1.5 justify-center">
      {[
        { label: "Renegociar fornecedor X", done: true },
        { label: "Revisar 12 transações sem categoria", done: true },
        { label: "Comparar margem com mês passado", done: false },
      ].map((m, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px]">
          <div
            className="w-3 h-3 rounded-full grid place-items-center shrink-0"
            style={{ background: m.done ? "var(--accent)" : "transparent", border: m.done ? "none" : "1px solid rgba(255,255,255,0.2)" }}
          >
            {m.done && <Check size={8} className="text-black" />}
          </div>
          <div className="flex-1 truncate text-white/70">{m.label}</div>
        </div>
      ))}
    </div>
  );
  if (kind === "categorization") return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="relative w-24 h-24 rounded-full" style={{ background: "conic-gradient(var(--accent) 0 35%, #5b8cff 35% 60%, #f59e0b 60% 80%, #f43f5e 80% 100%)" }}>
        <div className="absolute inset-3 bg-[#0a0a0b] rounded-full grid place-items-center text-[10px] text-white/60">7 cat.</div>
      </div>
    </div>
  );
  if (kind === "chat") return (
    <div className="absolute inset-0 p-4 flex flex-col justify-center gap-1.5">
      <div className="self-end max-w-[70%] text-[10px] px-3 py-1.5 rounded-2xl rounded-br-sm bg-white/10 text-white/80">
  Consigo contratar alguém esse mês?
</div>

<div
  className="self-start max-w-[70%] text-[10px] px-3 py-1.5 rounded-2xl rounded-bl-sm"
  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
>
  Se mantiver o ritmo atual de caixa, sim. Mas abril fechará com margem apertada.
</div>

<div className="self-end max-w-[70%] text-[10px] px-3 py-1.5 rounded-2xl rounded-br-sm bg-white/10 text-white/80">
  E quanto preciso vender pra bater minha meta?
</div>

<div
  className="self-start max-w-[70%] text-[10px] px-3 py-1.5 rounded-2xl rounded-bl-sm"
  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
>
  Faltam R$8.420 para atingir sua meta de maio.
</div>
    </div>
  );
  return null;
}

function AreasSection() {
  const items: Array<{ title: string; description: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; viz: MiniVizKind }> = [
    { title: "Importação inteligente", description: "PDFs, Excel, CSVs e fotos de extratos. A IA lê, classifica e estrutura tudo — sem você mapear coluna nenhuma.", Icon: UploadCloud,      viz: "upload" },
    { title: "Painel em tempo real",   description: "Saldo, receitas, despesas e tendências. Visualize seu mês em segundos.",                                       Icon: LayoutDashboard, viz: "dash" },
    { title: "Insights Inteligentes",        description: "Análises automáticas com recomendação prática baseada no seu histórico — uma análise nova todo dia.",          Icon: Sparkles,        viz: "insights" },
    { title: "Missões de ação",        description: "Crie automaticamente missões com passos concretos e acompanhe o andamento. Clareza vira progresso.",                   Icon: CheckCircle2,    viz: "missions" },
    { title: "Categorização contínua", description: "O modelo aprende seu padrão e melhora a precisão a cada upload.",                                                Icon: Layers,          viz: "categorization" },
    { title: "Chat Inteligente",        description: "Pergunte sobre finanças, metas, fornecedores ou marketing — e receba respostas claras em segundos.",                            Icon: MessageSquare,   viz: "chat" },
  ];
  return (
    <section id="produto" className="py-16 md:py-24 bg-[#09090b]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-10 md:mb-12">
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>O que tem dentro</p>
            <h2 className="font-bold tracking-tight max-w-3xl text-white" style={{ fontSize: "clamp(28px,3.6vw,48px)", lineHeight: 1.05 }}>
              Tudo que você precisa para entender seu negócio.
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
          {items.map((it, i) => (
            <div key={i} className="bg-[#0a0a0b] hover:bg-[#101012] transition-colors p-7">
              <div className="aspect-[16/10] rounded-lg mb-5 relative overflow-hidden border border-white/5" style={{ background: "linear-gradient(135deg,#101013,#1a1a1d)" }}>
                <MiniViz kind={it.viz} />
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg grid place-items-center shrink-0" style={{ background: "var(--accent-soft)" }}>
                  <it.Icon size={15} style={{ color: "var(--accent)" }} />
                </div>
                <div>
                  <h3 className="font-semibold text-[15px] tracking-tight mb-1.5 text-white">{it.title}</h3>
                  <p className="text-[13px] text-white/55 leading-relaxed">{it.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Alternating sections — "Para quem vende" + "Para quem decide" ────────────

function SellMock() {
  return (
    <div className="absolute inset-0 p-6 flex flex-col gap-2.5 justify-center">
      <div className="text-[10px] uppercase tracking-[0.16em] font-bold mb-2" style={{ color: "var(--accent)" }}>Caixa de hoje</div>
      <div className="text-[42px] font-bold tnum" style={{ color: "var(--accent)" }}>R$ 1.842,30</div>
      <div className="text-[12px] text-white/50">+18% vs ontem · 23 transações</div>
      <div className="mt-4 space-y-2">
        {[
          ["Maria S.", "R$ 145,00", "PIX"],
          ["Carlos M.", "R$ 89,90", "Cartão"],
          ["Ana L.", "R$ 240,00", "Dinheiro"],
        ].map(([n, v, m], i) => (
          <div key={i} className="flex items-center gap-3 text-[12px] py-2 border-b border-white/5">
            <div className="w-7 h-7 rounded-full bg-white/10 grid place-items-center text-[10px] font-semibold text-white">{n[0]}</div>
            <div className="flex-1 truncate text-white/70">{n}</div>
            <span className="text-[10px] text-white/30">{m}</span>
            <span className="font-semibold tnum text-white">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DecideMock() {
  return (
    <div className="absolute inset-0 p-6 grid place-items-center">
      <div className="w-full space-y-3">
        <div className="rounded-xl border p-4" style={{ borderColor: "rgba(106,248,47,0.3)", background: "var(--accent-soft)" }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} style={{ color: "var(--accent)" }} />
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>Oportunidade</span>
          </div>
          <p className="text-[13px] leading-snug text-white">Renegociar com <b>Fornecedor X</b> pode liberar <b>R$ 1.200/mês</b>.</p>
        </div>
        <div className="rounded-xl border border-white/10 p-4 bg-white/[0.03]">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={14} className="text-[#f59e0b]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#f59e0b]">Atenção</span>
          </div>
          <p className="text-[13px] text-white/70 leading-snug">Caixa estimado fica <b>negativo em 12 dias</b> se mantiver ritmo atual.</p>
        </div>
        <div className="rounded-xl border border-white/10 p-4 bg-white/[0.03]">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={14} className="text-white/60" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/60">Padrão</span>
          </div>
          <p className="text-[13px] text-white/70 leading-snug">Suas vendas em <b>sextas</b> são 32% maiores. Estoque pro fim de semana.</p>
        </div>
      </div>
    </div>
  );
}

function AlternatingSection() {
  const blocks = [
    {
      eyebrow: "Para quem vende",
      title: "Mais clareza, menos planilha.",
      description:
        "O Klaro entende entradas, saídas, categorias e movimentações automaticamente — sem planilhas manuais e sem gestão no achismo. Assim, você volta a focar no que realmente importa: fazer seu negócio crescer.",
      mock: "sell" as const,
    },
    {
      eyebrow: "Para quem decide",
      title: "O Klaro encontra oportunidades escondidas no seu negócio.",
      description:
        "O Klaro cruza seus dados automaticamente para revelar custos escondidos, gastos fora do padrão e oportunidades de melhoria que normalmente passam despercebidas.",
      mock: "decide" as const,
    },
  ];
  return (
    <section className="border-t border-white/10 bg-[#09090b]">
      {blocks.map((b, i) => (
        <div
          key={i}
          className={`max-w-7xl mx-auto px-6 py-14 md:py-20 grid lg:grid-cols-2 gap-8 lg:gap-12 items-center ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}
        >
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>{b.eyebrow}</p>
            <h3 className="font-bold tracking-tight mb-4 text-white" style={{ fontSize: "clamp(26px,3vw,40px)", lineHeight: 1.08 }}>{b.title}</h3>
            <p className="text-[15px] text-white/60 leading-relaxed max-w-md mb-6">{b.description}</p>
            
          </div>
          <div className="relative aspect-[5/4] rounded-2xl border border-white/10 overflow-hidden" style={{ background: "linear-gradient(135deg,#101013,#1a1a1d)" }}>
            {b.mock === "sell" ? <SellMock /> : <DecideMock />}
          </div>
        </div>
      ))}
    </section>
  );
}

// ─── Personas (replaces fake testimonials — honest about early stage) ─────────

function PersonasSection() {
  const personas = [
    { Icon: Coffee,      title: "Quem vende no dia a dia",       desc: "PIX, cartão, delivery, dinheiro, fornecedor. O dia acaba e você ainda não sabe quanto realmente lucrou." },
    { Icon: ShoppingBag, title: "Quem vende online", desc: "Venda no Instagram, site, marketplace, PIX ou cartão. O dinheiro entra de vários lados, mas a clareza não acompanha." },
    { Icon: Hammer,      title: "Quem vive na correria da operação",  desc: "Fornecedor, material, frete, recibo, pagamento atrasado. No meio da correria, o financeiro vira bagunça — e o prejuízo passa despercebido." },
    { Icon: Briefcase,   title: "Quem trabalha por conta própria", desc: "O dinheiro entra, mas nunca parece sobrar. Você cuida dos clientes. O Klaro cuida dos números." },
  ];
  return (
    <section id="solucoes" className="border-t border-white/10 py-16 md:py-24 bg-[#0a0a0b]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-10 md:mb-12">
          <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>Para quem é o Klaro</p>
          <h2 className="font-bold tracking-tight max-w-3xl text-white" style={{ fontSize: "clamp(28px,3.4vw,44px)", lineHeight: 1.06 }}>
            Para quem precisa de clareza e crescimento, não de mais planilhas que não servem pra nada.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
          {personas.map((p, i) => (
            <div key={i} className="bg-[#0a0a0b] hover:bg-[#101012] transition-colors p-7 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: "var(--accent-soft)" }}>
                <p.Icon size={18} style={{ color: "var(--accent)" }} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-white tracking-tight mb-1.5">{p.title}</h3>
                <p className="text-[13px] text-white/55 leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ─────────────────────────────────────────────────────────────────────

function CTASection({ go }: { go: (path: string) => void }) {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden">
      <div className="absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 500px at 70% 30%, rgba(106,248,47,0.18), transparent 65%), linear-gradient(180deg,#0a0a0b,#000)",
          }}
        />
      </div>
      <div className="relative max-w-5xl mx-auto px-6 text-center">
        <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-4" style={{ color: "var(--accent)" }}>Comece hoje</p>
        <h2 className="font-bold tracking-tight mb-6 text-white" style={{ fontSize: "clamp(32px,5.5vw,72px)", lineHeight: 1 }}>
          Pronto pra construir <span style={{ color: "var(--accent)" }}>clareza</span> com a gente?
        </h2>
        <p className="text-[15px] md:text-[18px] text-white/60 max-w-2xl mx-auto mb-8 md:mb-10 leading-relaxed">
          Cadastre-se em menos de 1 minuto, importe seus primeiros dados e veja a transformação acontecer.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm sm:max-w-none mx-auto">
          <button
            onClick={() => go("/signup")}
            className="btn-primary px-8 py-4 rounded-lg text-[15px] font-bold inline-flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            Começar grátis <ArrowRight size={16} />
          </button>
          <button
            onClick={() => go("/login")}
            className="px-8 py-4 rounded-lg border border-white/15 hover:border-white/30 text-[15px] font-semibold text-white w-full sm:w-auto"
          >
            Já tenho conta
          </button>
        </div>
        <p className="text-[12px] text-white/35 mt-6">Sem cartão de crédito · Cancelamento livre · Dados criptografados</p>
      </div>
    </section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Home() {
  const [, setLocation] = useLocation();
  const go = (path: string) => setLocation(path);

  return (
    <LandingShell>
      <HeroSection go={go} />
      <AreasSection />
      <AlternatingSection />
      <PersonasSection />
      <CTASection go={go} />
    </LandingShell>
  );
}
