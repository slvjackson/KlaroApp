import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  FileSearch, Sparkles, MessageSquare, Target,
  Linkedin, Instagram, Menu, X, ChevronDown,
} from "lucide-react";
import { KlaroMark } from "@/components/KlaroMark";

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
  { Icon: Sparkles,      label: "Insights Inteligentes",                    desc: "Análises e padrões revelados a partir do seu histórico.", slug: "insights" },
  { Icon: MessageSquare, label: "Chat consultor",                     desc: "Pergunte qualquer coisa do caixa em português.",          slug: "chat" },
  { Icon: Target,        label: "Missões que te fazem crescer",       desc: "Cada missão te faz caminhar para a direção certa rumo ao crescimento.",   slug: "missoes" },
] as const;

// ─── Top nav ─────────────────────────────────────────────────────────────────

export function TopNav() {
  const [, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const goTo = (href: string) => {
    setMobileOpen(false);
    setLocation(href);
  };

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
            <div className="relative group">
              <Link
                href="/solucoes"
                className="inline-flex items-center gap-1 hover:text-white transition-colors py-5"
              >
                Produto
                <ChevronDown size={13} className="opacity-70 group-hover:rotate-180 transition-transform" />
              </Link>
              <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity absolute left-0 top-full -mt-1 w-72 rounded-xl border border-white/10 bg-[#0e0e12] shadow-2xl p-1.5">
                {SOLUTIONS.map(({ Icon, label, desc, slug }) => (
                  <Link
                    key={slug}
                    href={`/solucoes/${slug}`}
                    className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="w-7 h-7 rounded-lg bg-white/5 grid place-items-center shrink-0 mt-0.5">
                      <Icon size={14} className="text-[#90f048]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[12.5px] font-medium text-white">{label}</span>
                      <span className="block text-[11px] text-white/55 leading-snug mt-0.5">{desc}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
            <Link href="/precos" className="hover:text-white transition-colors">Preços</Link>
            <Link href="/empresa" className="hover:text-white transition-colors">Nosso Propósito</Link>
            <Link href="/faq" className="hover:text-white transition-colors">FAQ</Link>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <button onClick={() => setLocation("/login")} className="text-[13px] text-white/65 hover:text-white px-3 py-2 transition-colors">
            Entrar
          </button>
          <button onClick={() => setLocation("/signup")} className="btn-primary text-[13px] px-4 py-2 rounded-lg font-semibold">
            Começar grátis
          </button>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="lg:hidden w-10 h-10 rounded-lg border border-white/10 grid place-items-center text-white/75 hover:text-white hover:bg-white/5 transition-colors"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#09090b]/95 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">
            <div className="grid gap-1 text-[14px] text-white/75">
              <button type="button" onClick={() => goTo("/")} className="text-left py-2 hover:text-white transition-colors">Home</button>
              <button type="button" onClick={() => goTo("/solucoes")} className="text-left py-2 hover:text-white transition-colors">Produto</button>
              <div className="pl-3 grid gap-0.5 border-l border-white/10 ml-1">
                {SOLUTIONS.map(({ Icon, label, slug }) => (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => goTo(`/solucoes/${slug}`)}
                    className="flex items-center gap-2.5 text-left py-2 text-[13px] text-white/65 hover:text-white transition-colors"
                  >
                    <Icon size={14} className="text-[#90f048] shrink-0" />
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => goTo("/precos")} className="text-left py-2 hover:text-white transition-colors">Preços</button>
              <button type="button" onClick={() => goTo("/empresa")} className="text-left py-2 hover:text-white transition-colors">Nosso Propósito</button>
              <button type="button" onClick={() => goTo("/faq")} className="text-left py-2 hover:text-white transition-colors">FAQ</button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
              <button onClick={() => goTo("/login")} className="text-[13px] text-white/70 hover:text-white px-3 py-2 rounded-lg border border-white/10 transition-colors">
                Entrar
              </button>
              <button onClick={() => goTo("/signup")} className="btn-primary text-[13px] px-4 py-2 rounded-lg font-semibold">
                Começar grátis
              </button>
            </div>
          </div>
        </div>
      )}
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
