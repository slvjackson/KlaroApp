import { useState, useEffect, useRef, memo } from "react";
import { useLocation } from "wouter";
import {
  Zap, ArrowRight, ArrowDown, CheckCircle2, Check,
  UploadCloud, LayoutDashboard, Sparkles, Layers, MessageSquare,
  Lightbulb, TrendingUp, AlertCircle,
  FileSpreadsheet, FileText, Camera, Landmark, NotebookPen, Receipt,
  ShoppingBag, Hammer, Coffee, Briefcase,
} from "lucide-react";
import { LandingShell } from "@/components/LandingShell";

// ─── Math helpers ────────────────────────────────────────────────────────────

function clamp(v: number, a: number, b: number): number { return Math.min(b, Math.max(a, v)); }
function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function smoothstep(a: number, b: number, t: number): number {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}

// Scroll progress within a section: 0 when its top hits the viewport top, 1 when its
// bottom hits the viewport bottom. Drives the hero's file-funnel → dashboard reveal.
//
// Throttled to one update per animation frame via requestAnimationFrame. Without this,
// scroll events can fire 100+ times per second on a fast trackpad — every fire triggers
// a React re-render of the whole hero tree (6 file cards + dashboard), blowing the
// frame budget and making the animation feel choppy.
function useScrollProgress(ref: React.RefObject<HTMLElement | null>): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    let rafId = 0;
    let pending = false;
    function compute() {
      pending = false;
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      const scrolled = -rect.top;
      const pr = total > 0 ? clamp(scrolled / total, 0, 1) : 0;
      setP(pr);
    }
    function onScroll() {
      if (pending) return;
      pending = true;
      rafId = requestAnimationFrame(compute);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    compute();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [ref]);
  return p;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── File card (one of many in the hero funnel) ───────────────────────────────

type FileKind = "xlsx" | "pdf" | "csv" | "ofx" | "photo" | "ocr";

const FILE_KINDS: Record<FileKind, { color: string; label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  xlsx:  { color: "#107c41", label: "XLSX", Icon: FileSpreadsheet },
  csv:   { color: "#2a7d4f", label: "CSV",  Icon: FileText },
  pdf:   { color: "#c4302b", label: "PDF",  Icon: FileText },
  ofx:   { color: "#5b8cff", label: "OFX",  Icon: Landmark },
  photo: { color: "#f59e0b", label: "FOTO", Icon: Camera },
  ocr:   { color: "#a855f7", label: "NOTA", Icon: NotebookPen },
};

// Inner card content is stable per (kind, title) — memoized so 60+ scroll frames per
// second don't re-build the table/PDF/OFX subtree just because the wrapper transform
// changed. Only the outer transform-bearing div re-renders with each frame update.
const FileCardInner = memo(function FileCardInner({ kind, title }: { kind: FileKind; title: string }) {
  const k = FILE_KINDS[kind];
  return (
    <div
      className="rounded-lg overflow-hidden border bg-[#16161a] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)] w-[180px]"
      style={{ borderColor: "#26262c" }}
    >
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#26262c]" style={{ background: `${k.color}22` }}>
          <div className="w-6 h-6 rounded grid place-items-center shrink-0" style={{ background: k.color }}>
            <k.Icon size={12} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold text-white truncate leading-tight">{title}</div>
            <div className="text-[8.5px] uppercase tracking-[0.14em] font-bold" style={{ color: k.color }}>{k.label}</div>
          </div>
        </div>
        <div className="p-2.5 space-y-1">
          {kind === "xlsx" && (
            <div className="grid grid-cols-3 gap-px bg-[#26262c]">
              {["01/04", "Venda", "2.450", "02/04", "Aluguel", "-1800", "03/04", "Forn.", "-540"].map((cell, i) => (
                <div key={i} className="bg-[#1a1a1f] h-3 px-1 flex items-center text-[7px] text-white/40 tnum">{cell}</div>
              ))}
            </div>
          )}
          {kind === "csv" && (
            <div className="font-mono text-[7.5px] text-white/55 leading-tight space-y-0.5">
              <div>data,desc,valor</div>
              <div className="text-white/40">04/04,iFood,680</div>
              <div className="text-white/40">05/04,Pix,1205</div>
              <div className="text-white/40">06/04,Mkt,-280</div>
            </div>
          )}
          {kind === "pdf" && (
            <div className="space-y-0.5">
              <div className="h-1 rounded-full bg-white/15 w-full" />
              <div className="h-1 rounded-full bg-white/15 w-[70%]" />
              <div className="h-1 rounded-full bg-white/15 w-[85%]" />
              <div className="h-1 rounded-full bg-white/15 w-[55%]" />
              <div className="h-3" />
              <div className="h-1 rounded-full bg-white/10 w-[60%]" />
              <div className="h-1 rounded-full bg-white/10 w-[80%]" />
            </div>
          )}
          {kind === "ofx" && (
            <div className="font-mono text-[6.5px] text-white/55 leading-tight">
              <div>{"<STMTTRN>"}</div>
              <div className="pl-1">{"<TRNTYPE>CREDIT"}</div>
              <div className="pl-1">{"<DTPOSTED>20260404"}</div>
              <div className="pl-1">{"<TRNAMT>2450.00"}</div>
              <div>{"</STMTTRN>"}</div>
            </div>
          )}
          {kind === "photo" && (
            <div className="rounded h-12 grid place-items-center text-white/60" style={{ background: "linear-gradient(135deg, #3a2a1a, #2a1f15)" }}>
              <div className="text-center">
                <Receipt size={14} />
                <div className="text-[7px] mt-0.5">extrato banco.jpg</div>
              </div>
            </div>
          )}
          {kind === "ocr" && (
            <div className="space-y-0.5">
              <div className="text-[7px] text-white/55" style={{ fontFamily: "'Caveat', cursive" }}>caderno do caixa</div>
              <div className="h-px bg-white/15 w-full" />
              <div className="text-[8px] text-white/45" style={{ fontFamily: "'Caveat', cursive" }}>04 — venda 680</div>
              <div className="text-[8px] text-white/45" style={{ fontFamily: "'Caveat', cursive" }}>05 — pix 1205</div>
              <div className="text-[8px] text-white/45" style={{ fontFamily: "'Caveat', cursive" }}>06 — frete -89</div>
            </div>
          )}
        </div>
      </div>
  );
});

// Wrapper that applies the per-frame transform. Cheap to re-render — no DOM subtree
// underneath since FileCardInner is memoized.
function FileCard({
  kind, title, x, y, rot, scale,
}: {
  kind: FileKind; title: string; x: number; y: number; rot: number; scale: number;
}) {
  return (
    <div
      className="absolute"
      style={{
        left: "50%",
        top: "50%",
        transform: `translate3d(-50%,-50%,0) translate3d(${x}px,${y}px,0) rotate(${rot}deg) scale(${scale})`,
        transformOrigin: "center center",
        willChange: "transform",
      }}
    >
      <FileCardInner kind={kind} title={title} />
    </div>
  );
}

const FILE_DECK: Array<{ kind: FileKind; title: string; x: number; y: number; rot: number }> = [
  { kind: "xlsx",  title: "Caixa_Abril.xlsx",  x: -360, y: -60,  rot: -8 },
  { kind: "pdf",   title: "extrato-itau.pdf",  x: -220, y: 110,  rot: 6 },
  { kind: "ofx",   title: "nubank-04.ofx",     x: -80,  y: -130, rot: -4 },
  { kind: "csv",   title: "vendas-loja.csv",   x: 90,   y: 130,  rot: 7 },
  { kind: "photo", title: "recibo-fornec.jpg", x: 240,  y: -90,  rot: -10 },
  { kind: "ocr",   title: "caderno-caixa.jpg", x: 380,  y: 80,   rot: 9 },
];

function FileFunnel({ progress }: { progress: number }) {
  const conv = clamp(progress, 0, 1);
  return (
    <div className="absolute inset-0 grid place-items-center" style={{ opacity: 1 - clamp((progress - 0.85) / 0.1, 0, 1) }}>
      <div className="relative w-full h-full">
        {FILE_DECK.map((f, i) => {
          const cx = lerp(f.x, 0, smoothstep(0, 1, conv));
          const cy = lerp(f.y, 0, smoothstep(0, 1, conv));
          const cr = lerp(f.rot, 0, conv);
          const cs = lerp(1, 0.45, conv);
          const op = 1 - clamp((conv - 0.75) / 0.15, 0, 1);
          return (
            <div key={i} style={{ opacity: op, willChange: "opacity" }}>
              <FileCard kind={f.kind} title={f.title} x={cx} y={cy} rot={cr} scale={cs} />
            </div>
          );
        })}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            width: `${lerp(40, 240, conv)}px`,
            height: `${lerp(40, 240, conv)}px`,
            background: "radial-gradient(circle, var(--accent-soft) 0%, transparent 70%)",
            opacity: clamp((conv - 0.4) / 0.5, 0, 1),
            filter: "blur(20px)",
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 rounded-2xl grid place-items-center overflow-hidden"
          style={{
            width: `${lerp(20, 88, conv)}px`,
            height: `${lerp(20, 88, conv)}px`,
            transform: "translate3d(-50%,-50%,0)",
            background: "linear-gradient(135deg, var(--accent), #4ad11a)",
            opacity: clamp((conv - 0.55) / 0.3, 0, 1),
            boxShadow: "0 0 60px var(--accent-soft), 0 20px 60px -10px rgba(106,248,47,0.4)",
            willChange: "width, height, opacity",
          }}
        >
          <img
            src="/logo.png"
            alt="Klaro"
            className="select-none"
            draggable={false}
            style={{ width: `${lerp(12, 56, conv)}px`, height: `${lerp(12, 56, conv)}px`, objectFit: "contain" }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Faux dashboard (final state of hero) ─────────────────────────────────────

function FauxDashboard({ opacity = 1 }: { opacity?: number }) {
  const BARS = [48, 65, 40, 82, 60, 78, 96];
  return (
    <div className="absolute inset-0 grid place-items-center" style={{ opacity, backfaceVisibility: "hidden" }}>
      <div className="w-[680px] max-w-[88vw] glass-strong rounded-2xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/10">
          <div className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60" />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--accent)" }} />
          <span className="ml-3 text-[10px] text-white/30 font-mono">klaro — dashboard</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-white/40 font-semibold">Caixa de abril</div>
              <div className="text-[26px] font-bold tnum mt-1 text-white">R$ 12.430,55</div>
            </div>
            <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
              +12,4% vs mar
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: "Receitas",   v: "R$ 18.200", d: "+8%", c: "var(--accent)" },
              { l: "Despesas",   v: "R$ 5.770",  d: "-3%", c: "#f43f5e" },
              { l: "Transações", v: "47",        d: "+12", c: "#fff" },
            ].map((m) => (
              <div key={m.l} className="bg-white/5 p-3 border border-white/10 rounded-lg">
                <p className="text-[10px] text-white/40 mb-1">{m.l}</p>
                <p className="text-[15px] font-bold tnum text-white">{m.v}</p>
                <p className="text-[10px] font-semibold mt-0.5" style={{ color: m.c }}>{m.d}</p>
              </div>
            ))}
          </div>
          <div className="bg-white/[0.03] p-3 border border-white/10 rounded-lg">
            <div className="flex items-end gap-1.5 h-[64px]">
              {BARS.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md"
                  style={{ height: `${h}%`, background: i === BARS.length - 1 ? "var(--accent)" : `rgba(106,248,47,${0.18 + i * 0.07})` }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 border rounded-lg" style={{ borderColor: "rgba(106,248,47,0.25)", background: "var(--accent-soft)" }}>
            <Lightbulb size={13} className="mt-0.5" style={{ color: "var(--accent)" }} />
            <div>
              <p className="text-[10.5px] font-semibold mb-0.5 text-white">Receita acima da meta em 18%</p>
              <p className="text-[10px] text-white/55 leading-relaxed">Considere reservar R$ 2.180 para o caixa de maio ou investir em estoque.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function HeroSection({ go }: { go: (path: string) => void }) {
  const ref = useRef<HTMLElement | null>(null);
  const p = useScrollProgress(ref);

  const funnelP = clamp(p / 0.6, 0, 1);
  const dashOpacity = clamp((p - 0.55) / 0.18, 0, 1);
  const dashScale = lerp(0.85, 1, clamp((p - 0.55) / 0.25, 0, 1));
  const headerOpacity = 1 - clamp((p - 0.02) / 0.12, 0, 1);

  return (
    <section ref={ref} className="relative" style={{ height: "260vh" }}>
      <div
        className="sticky top-0 h-screen overflow-hidden"
        style={{
          background:
            "radial-gradient(1200px 600px at 80% -10%, rgba(106,248,47,0.10), transparent 60%), radial-gradient(800px 500px at -5% 110%, rgba(91,140,255,0.05), transparent 60%), #09090b",
        }}
      >
        <div className="absolute inset-x-0 top-[6vh] z-20 px-6 text-center pointer-events-none" style={{ opacity: headerOpacity }}>
          <div
            className="inline-flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.16em] uppercase px-3 py-1.5 rounded-full mb-5"
            style={{ color: "var(--accent)", background: "var(--accent-soft)", border: "1px solid rgba(106,248,47,0.3)" }}
          >
            <Zap size={11} /> Qualquer formato entra. Clareza sai.
          </div>
          <h1 className="font-bold tracking-[-0.025em] leading-[0.95] mx-auto max-w-5xl text-white" style={{ fontSize: "clamp(36px, 6vw, 80px)" }}>
            Planilha, PDF, OFX,<br />
            até foto do <span style={{ color: "var(--accent)" }}>caderno</span>.
          </h1>
          <p className="text-[16px] md:text-[18px] text-white/60 mt-6 max-w-xl mx-auto leading-relaxed">
            Mande qualquer formato. Klaro lê, normaliza e devolve um dashboard pronto — com insights gerados por IA.
          </p>
          <div className="text-[11px] text-white/30 uppercase tracking-[0.18em] mt-8 flex items-center justify-center gap-2 pointer-events-auto">
            <span>Role para ver a transformação</span>
            <ArrowDown size={12} />
          </div>
        </div>

        <div
          className="absolute inset-x-0 bottom-[10vh] z-20 px-6 text-center"
          style={{ opacity: clamp((p - 0.7) / 0.2, 0, 1), pointerEvents: p > 0.75 ? "auto" : "none" }}
        >
          <h2 className="text-[clamp(28px,4vw,48px)] font-bold tracking-tight mb-5 text-white">
            <span style={{ color: "var(--accent)" }}>Clareza</span> nos detalhes do seu negócio.
          </h2>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => go("/signup")}
              className="btn-primary px-7 py-3.5 rounded-lg text-[14px] font-bold inline-flex items-center justify-center gap-2"
            >
              Começar grátis <ArrowRight size={15} />
            </button>
            <button
              onClick={() => go("/login")}
              className="px-7 py-3.5 rounded-lg border border-white/15 hover:border-white/30 text-[14px] font-semibold text-white"
            >
              Já tenho conta
            </button>
          </div>
        </div>

        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div style={{ position: "relative", width: "100%", height: "44%", marginTop: "46vh", marginBottom: "16vh" }}>
            <FileFunnel progress={funnelP} />
            <div
              style={{
                opacity: dashOpacity,
                transform: `scale3d(${dashScale}, ${dashScale}, 1)`,
                willChange: "transform, opacity",
              }}
            >
              <FauxDashboard opacity={dashOpacity} />
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

// ─── Big numbers — capability metrics, not vanity tração ──────────────────────

function NumbersSection() {
  const stats = [
    { n: "6",       l: "formatos suportados (Excel, PDF, CSV, OFX, foto, OCR)" },
    { n: "<60s",    l: "do upload ao painel pronto" },
    { n: "9 em 10", l: "transações categorizadas pela IA, sem você mexer" },
    { n: "0",       l: "colunas pra mapear na importação" },
    { n: "1",       l: "análise nova todo dia, feita por IA" },
  ];
  return (
    <section id="numeros" className="border-t border-white/10 py-24 bg-[#0a0a0b]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-14">
          <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>O que muda no seu dia</p>
          <h2 className="font-bold tracking-tight max-w-3xl text-white" style={{ fontSize: "clamp(28px,3.6vw,48px)", lineHeight: 1.05 }}>
            Menos planilha, mais decisão.
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-px bg-white/10">
          {stats.map((s, i) => (
            <div key={i} className="bg-[#0a0a0b] p-7 hover:bg-[#101012] transition-colors">
              <div className="font-bold tnum tracking-tight" style={{ fontSize: "clamp(32px,3.8vw,56px)", color: "var(--accent)", lineHeight: 1 }}>{s.n}</div>
              <div className="text-[12.5px] text-white/55 mt-3 leading-snug max-w-[18ch]">{s.l}</div>
            </div>
          ))}
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
      <div className="self-end max-w-[70%] text-[10px] px-3 py-1.5 rounded-2xl rounded-br-sm bg-white/10 text-white/80">Quanto gastei com fornecedores?</div>
      <div className="self-start max-w-[70%] text-[10px] px-3 py-1.5 rounded-2xl rounded-bl-sm" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
        R$ 4.220 em abril (-12% vs março).
      </div>
    </div>
  );
  return null;
}

function AreasSection() {
  const items: Array<{ title: string; description: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; viz: MiniVizKind }> = [
    { title: "Importação inteligente", description: "PDFs, Excel, CSVs e fotos de extratos. A IA lê, classifica e estrutura tudo — sem você mapear coluna nenhuma.", Icon: UploadCloud,      viz: "upload" },
    { title: "Painel em tempo real",   description: "Saldo, receitas, despesas e tendências. Visualize seu mês em segundos.",                                       Icon: LayoutDashboard, viz: "dash" },
    { title: "Insights por IA",        description: "Análises automáticas com recomendação prática baseada no seu histórico — uma análise nova todo dia.",          Icon: Sparkles,        viz: "insights" },
    { title: "Missões de ação",        description: "Vire insight em missão com passos concretos e marque o que já fez. Clareza vira progresso.",                   Icon: CheckCircle2,    viz: "missions" },
    { title: "Categorização contínua", description: "O modelo aprende seu padrão e melhora a precisão a cada upload.",                                                Icon: Layers,          viz: "categorization" },
    { title: "Chat financeiro",        description: "Pergunte qualquer coisa sobre seu caixa em linguagem natural — em português, claro.",                            Icon: MessageSquare,   viz: "chat" },
  ];
  return (
    <section id="produto" className="py-24 bg-[#09090b]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>O que tem dentro</p>
            <h2 className="font-bold tracking-tight max-w-3xl text-white" style={{ fontSize: "clamp(28px,3.6vw,48px)", lineHeight: 1.05 }}>
              Um produto pequeno o suficiente pra você usar todo dia.
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

// ─── AI section ──────────────────────────────────────────────────────────────

function AISection() {
  const inputs = ["PDF / Excel", "Foto de caixa", "Extrato bancário", "Texto livre"];
  const outputs = ["Categorização", "Insights", "Missões", "Resposta no chat"];
  return (
    <section id="ia" className="border-t border-white/10 py-24 bg-[#0a0a0b]">
      <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[1fr_1.2fr] gap-14 items-center">
        <div>
          <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>IA aplicada, sem mistério</p>
          <h2 className="font-bold tracking-tight mb-5 text-white" style={{ fontSize: "clamp(28px,3.4vw,44px)", lineHeight: 1.06 }}>
            Uma IA que fala português e entende seu negócio.
          </h2>
          <p className="text-[15px] text-white/60 leading-relaxed mb-6">
            Combinamos modelos de extração, classificação e raciocínio pra transformar lançamento cru em métrica, padrão e recomendação. Em escala, em português, sem alucinar.
          </p>
          <ul className="space-y-3">
            {[
              "Extração que lê PDF, planilha e foto sem você ajustar nada",
              "Classificação contextual que aprende seu padrão de gastos",
              "Insight diário gerado a partir do seu próprio histórico",
              "Você nunca treina nosso modelo com seus dados sem permissão",
            ].map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[14px] text-white/75">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative bg-[#09090b] border border-white/10 rounded-2xl p-8 aspect-[1.2/1] flex items-center justify-center overflow-hidden">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.05) 1px,transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative grid grid-cols-3 gap-6 items-center w-full">
            <div className="space-y-2">
              {inputs.map((i, idx) => (
                <div key={idx} className="text-[12px] font-medium px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-white/70 text-right">
                  {i}
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center gap-2">
              <div
                className="w-full h-32 rounded-2xl grid place-items-center relative"
                style={{ background: "radial-gradient(circle at 50% 50%, rgba(106,248,47,0.25), transparent 70%)", border: "1px solid rgba(106,248,47,0.3)" }}
              >
                <div className="absolute inset-0 rounded-2xl animate-pulse" style={{ boxShadow: "inset 0 0 60px rgba(106,248,47,0.15)" }} />
                <div className="text-center relative">
                  <div className="text-[10px] uppercase tracking-[0.18em] font-bold mb-1" style={{ color: "var(--accent)" }}>Klaro AI</div>
                  <div className="text-[18px] font-bold text-white leading-tight">Pensa em PT-BR</div>
                  <div className="text-[10px] text-white/40 mt-0.5">Treinada para PMEs</div>
                </div>
              </div>
              <ArrowRight size={14} className="text-white/30 -my-1" />
            </div>
            <div className="space-y-2">
              {outputs.map((o, idx) => (
                <div key={idx} className="text-[12px] font-medium px-3 py-2 rounded-lg border" style={{ borderColor: "rgba(106,248,47,0.25)", background: "var(--accent-soft)", color: "var(--accent)" }}>
                  {o}
                </div>
              ))}
            </div>
          </div>
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
        "Klaro elimina a tarefa repetitiva de organizar lançamento. Você foca em vender; a gente cuida do quanto entrou, saiu e sobrou.",
      cta: "Ver como funciona",
      anchorId: "produto",
      mock: "sell" as const,
    },
    {
      eyebrow: "Para quem decide",
      title: "Decisão baseada no seu próprio dado.",
      description:
        "Insights da IA do Klaro identificam padrão antes invisível. Saiba onde cortar custo, qual fornecedor renegociar e quando o caixa vai apertar — antes do problema acontecer.",
      cta: "Ver insights de exemplo",
      anchorId: "ia",
      mock: "decide" as const,
    },
  ];
  return (
    <section className="border-t border-white/10 bg-[#09090b]">
      {blocks.map((b, i) => (
        <div
          key={i}
          className={`max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-2 gap-12 items-center ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}
        >
          <div>
            <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>{b.eyebrow}</p>
            <h3 className="font-bold tracking-tight mb-4 text-white" style={{ fontSize: "clamp(26px,3vw,40px)", lineHeight: 1.08 }}>{b.title}</h3>
            <p className="text-[15px] text-white/60 leading-relaxed max-w-md mb-6">{b.description}</p>
            <button
              onClick={() => scrollToId(b.anchorId)}
              className="text-[13px] font-semibold inline-flex items-center gap-1.5 hover:gap-2 transition-all"
              style={{ color: "var(--accent)" }}
            >
              {b.cta} <ArrowRight size={13} />
            </button>
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
    { Icon: Coffee,      title: "Comércio e bar",       desc: "Padaria, mercearia, bar, restaurante. Caixa diário virando dashboard sem digitar uma linha." },
    { Icon: ShoppingBag, title: "Loja física e online", desc: "Vendas no balcão, no iFood, no PIX, no cartão. Tudo conciliado, tudo num lugar só." },
    { Icon: Hammer,      title: "Construção e ofício",  desc: "Obra com fornecedor diferente toda semana? Importa nota, foto, recibo — a IA categoriza." },
    { Icon: Briefcase,   title: "Profissional liberal", desc: "Médico, advogado, designer, consultor. Receita previsível com despesa que escapa? Aqui ela aparece." },
  ];
  return (
    <section id="solucoes" className="border-t border-white/10 py-24 bg-[#0a0a0b]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12">
          <p className="text-[12px] font-bold tracking-[0.18em] uppercase mb-3" style={{ color: "var(--accent)" }}>Para quem é o Klaro</p>
          <h2 className="font-bold tracking-tight max-w-3xl text-white" style={{ fontSize: "clamp(28px,3.4vw,44px)", lineHeight: 1.06 }}>
            Pequeno negócio brasileiro que quer entender os próprios números.
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
    <section className="relative py-32 overflow-hidden">
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
        <h2 className="font-bold tracking-tight mb-6 text-white" style={{ fontSize: "clamp(36px,5.5vw,72px)", lineHeight: 0.98 }}>
          Pronto pra construir <span style={{ color: "var(--accent)" }}>clareza</span> com a gente?
        </h2>
        <p className="text-[16px] md:text-[18px] text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
          Cadastro em menos de 1 minuto. Importe sua primeira planilha. Veja a transformação acontecer.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => go("/signup")}
            className="btn-primary px-8 py-4 rounded-lg text-[15px] font-bold inline-flex items-center justify-center gap-2"
          >
            Começar grátis <ArrowRight size={16} />
          </button>
          <button
            onClick={() => go("/login")}
            className="px-8 py-4 rounded-lg border border-white/15 hover:border-white/30 text-[15px] font-semibold text-white"
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
      <NumbersSection />
      <AreasSection />
      <AISection />
      <AlternatingSection />
      <PersonasSection />
      <CTASection go={go} />
    </LandingShell>
  );
}
