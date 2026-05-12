import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ChevronDown, FileSearch, Sparkles, MessageSquare, Target,
  Linkedin, Twitter, Instagram, Youtube,
} from "lucide-react";
import { KlaroMark } from "@/components/KlaroMark";
import { useEffect } from "react";

// Shell wrapping every landing-area page. Provides the top nav, footer, and the
// dark background. Subpages render their own content as children.

export function LandingShell({ children }: { children: React.ReactNode }) {
  return (
    <div id="__top" className="min-h-screen text-white" style={{ background: "#09090b" }}>
      <TopNav />
      {children}
      <RichFooter />
    </div>
  );
}

// ─── Solutions catalogue (single source of truth — used in nav + soluções page) ─

export const SOLUTIONS = [
  { Icon: FileSearch,    label: "Lê qualquer arquivo",                desc: "PDF, foto, planilha, OFX. Klaro entende e organiza.",      slug: "importacao" },
  { Icon: Sparkles,      label: "Insights por IA",                    desc: "Análises e padrões revelados a partir do seu histórico.", slug: "insights" },
  { Icon: MessageSquare, label: "Chat consultor",                     desc: "Pergunte qualquer coisa do caixa em português.",          slug: "chat" },
  { Icon: Target,        label: "Missões que te fazem crescer",       desc: "Cada missão te faz caminhar para a direção certa rumo ao crescimento.",   slug: "missoes" },
] as const;

// ─── Top nav ─────────────────────────────────────────────────────────────────

export function TopNav() {
  const [, setLocation] = useLocation();
  const [solucoesOpen, setSolucoesOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[rgba(9,9,11,0.85)] backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Klaro" className="w-7 h-7 rounded" />
            <KlaroMark size={20} />
          </Link>
          <div className="hidden lg:flex items-center gap-7 text-[13px] text-white/65">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <div className="relative" onMouseEnter={() => setSolucoesOpen(true)} onMouseLeave={() => setSolucoesOpen(false)}>
              <Link href="/solucoes" className="hover:text-white flex items-center gap-1 transition-colors">
                Produto <ChevronDown size={11} />
              </Link>
              {solucoesOpen && (
                <div className="absolute top-full left-0 pt-2 w-[280px]">
                  <div className="glass rounded-xl p-2 border border-white/10">
                    {SOLUTIONS.map((it) => (
                      <Link
                        key={it.slug}
                        href={`/solucoes/${it.slug}`}
                        onClick={() => setSolucoesOpen(false)}
                        className="w-full flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-white/5"
                      >
                        <div className="w-7 h-7 rounded-lg grid place-items-center shrink-0 mt-0.5" style={{ background: "var(--accent-soft)" }}>
                          <it.Icon size={13} style={{ color: "var(--accent)" }} />
                        </div>
                        <div>
                          <div className="text-[12.5px] text-white/85 font-medium leading-tight">{it.label}</div>
                          <div className="text-[10.5px] text-white/45 mt-0.5 leading-snug">{it.desc}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Link href="/precos" className="hover:text-white transition-colors">Preços</Link>
            <Link href="/empresa" className="hover:text-white transition-colors">Nosso Propósito</Link>
            <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLocation("/login")} className="text-[13px] text-white/65 hover:text-white px-3 py-2 transition-colors">
            Entrar
          </button>
          <button onClick={() => setLocation("/signup")} className="btn-primary text-[13px] px-4 py-2 rounded-lg font-semibold">
            Começar grátis
          </button>
        </div>
      </div>
    </nav>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

export function RichFooter() {
  const cols: Array<{ title: string; links: Array<[string, string]> }> = [
    { title: "Home",  links: [["Visão geral", "/"], ["Preços", "/precos"]] },
    { title: "Produto", links: SOLUTIONS.map((s) => [s.label, `/solucoes/${s.slug}`] as [string, string]) },
    { title: "NOSSO PROPÓSITO",  links: [["Sobre", "/empresa"], ["Missão e valores", "/empresa"]] },
    { title: "Legal",    links: [["Termos", "/terms"], ["Privacidade", "/privacy"]] },
  ];
  return (
    <footer className="bg-[#050506] border-t border-white/10 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10 pb-12 border-b border-white/10">
          <div className="col-span-2 max-w-xs">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <img src="/logo.png" alt="Klaro" className="w-7 h-7 rounded" />
              <KlaroMark size={20} />
            </Link>
            <p className="text-[13px] text-white/50 leading-relaxed mb-5">
              Inteligência de negócios na palma de sua mão. Clareza nos números. Resultado no bolso. 
            </p>
            <div className="flex items-center gap-3">
              {[Linkedin, Instagram].map((Ic, i) => (
                <span key={i} className="w-8 h-8 rounded-md border border-white/10 grid place-items-center text-white/50 hover:text-white hover:border-white/30 cursor-pointer transition-colors">
                  <Ic size={13} />
                </span>
              ))}
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/85 mb-4">{c.title}</div>
              <ul className="space-y-2.5">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <Link href={href} className="text-[12.5px] text-white/50 hover:text-white">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[11.5px] text-white/35">© 2026 Klaro. Todos os direitos reservados.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11.5px] text-white/40">
            <Link href="/terms" className="hover:text-white">Termos</Link>
            <Link href="/privacy" className="hover:text-white">Privacidade</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}