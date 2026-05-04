import { Link } from "wouter";
import { KlaroMark } from "@/components/KlaroMark";
import { ArrowRight, Upload, Sparkles, BarChart3, Lightbulb, CheckCircle2, TrendingUp, Zap } from "lucide-react";

const BARS = [48, 65, 40, 82, 60, 78, 96];
const MONTHS = ["Out", "Nov", "Dez", "Jan", "Fev", "Mar", "Abr"];

const FEATURES = [
  { icon: Upload,    title: "Upload inteligente",        desc: "Envie PDFs, planilhas Excel, CSVs ou fotos de extratos. Nossa IA lê e extrai os dados automaticamente." },
  { icon: Sparkles,  title: "Extração com IA",           desc: "Valores, datas e categorias identificados automaticamente. Você só confirma o que a IA encontrou." },
  { icon: BarChart3, title: "Dashboard em tempo real",   desc: "Saldo, receitas, despesas e tendências num painel limpo. Visualize o mês atual em segundos." },
  { icon: Lightbulb, title: "Insights personalizados",   desc: "Análises geradas por IA com recomendações práticas baseadas no seu histórico financeiro." },
];

const STEPS = [
  { n: "01", title: "Faça o upload",      desc: "Envie seus extratos, planilhas ou fotos — no celular ou no computador." },
  { n: "02", title: "Revise os dados",    desc: "A IA extrai todas as transações. Você revisa rapidamente e confirma o que está correto." },
  { n: "03", title: "Acompanhe e cresça", desc: "Com os dados organizados, o Klaro gera insights automáticos e mantém seu painel atualizado." },
];

const TRUST = ["Sem cartão de crédito", "Configuração em minutos", "Dados criptografados"];

export default function Home() {
  return (
    <div className="min-h-screen text-white" style={{
      background: `
        radial-gradient(1200px 600px at 80% -10%, rgba(106,248,47,0.12), transparent 60%),
        radial-gradient(800px 500px at -5% 110%, rgba(106,248,47,0.08), transparent 60%),
        radial-gradient(600px 400px at 50% 50%, rgba(16,185,129,0.04), transparent 70%),
        #09090b
      `,
    }}>
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[rgba(9,9,11,0.7)] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KlaroMark size={24} />
          </div>

          <div className="hidden md:flex items-center gap-8 text-[13px] text-[var(--muted)]">
            <a href="#funcionalidades" className="hover:text-white transition-colors">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-white transition-colors">Como funciona</a>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/login" className="text-[13px] text-[var(--muted)] hover:text-white px-3 py-2 transition-colors">
              Entrar
            </Link>
            <Link href="/signup" className="btn-primary text-[12.5px] sm:text-[13px] px-3.5 sm:px-4 py-2 rounded-lg font-semibold">
              Criar conta
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-24">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* Copy */}
          <div className="fadeUp text-center lg:text-left">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#90f048] bg-[var(--accent-soft)] border border-[rgba(106,248,47,0.3)] px-3 py-1.5 rounded-full mb-5">
              <Zap size={11} /> IA generativa integrada
            </div>

            <h1 className="text-[34px] sm:text-5xl lg:text-[56px] font-bold tracking-tight leading-[1.06] mb-4 sm:mb-5">
              Clareza nos números.<br className="hidden sm:block" />
              <span style={{ color: "var(--accent)" }}>Resultado</span> no bolso.
            </h1>

            <p className="text-[15px] sm:text-[17px] text-[var(--muted)] mb-7 sm:mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0">
              O Klaro organiza seu financeiro e mostra onde você está perdendo dinheiro e como lucrar mais — sem planilhas complicadas.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-6 sm:mb-8">
              <Link href="/signup" className="btn-primary flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-[14px] font-semibold">
                Começar grátis <ArrowRight size={15} />
              </Link>
              <a href="#como-funciona" className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg border border-[var(--border)] text-white hover:border-[var(--border-2)] text-[14px] font-medium transition-colors">
                Ver como funciona
              </a>
            </div>

            <div className="flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2">
              {TRUST.map((t) => (
                <div key={t} className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
                  <CheckCircle2 size={12} className="text-[var(--accent)]" />{t}
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard mock — hidden on very small screens */}
          <div className="relative w-full max-w-[480px] mx-auto fadeUp hidden sm:block">
            <div className="absolute -inset-6 bg-[var(--accent-soft)] blur-3xl pointer-events-none" />
            <div className="relative glass-strong rounded-2xl overflow-hidden">
              {/* Window chrome */}
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/8">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60" />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(106,248,47,0.7)" }} />
                <span className="ml-3 text-[10px] font-mono text-white/30 tracking-wide">klaro — dashboard</span>
              </div>

              <div className="p-4 space-y-3">
                {/* Metric cards */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Saldo líquido", value: "R$ 12.430", up: true },
                    { label: "Receitas",       value: "R$ 18.200", up: true },
                    { label: "Despesas",       value: "R$ 5.770",  up: false },
                  ].map((m) => (
                    <div key={m.label} className="bg-white/5 p-2.5 rounded-lg border border-white/8">
                      <p className="text-[9px] text-white/40 mb-1">{m.label}</p>
                      <p className="text-[13px] font-bold text-white mb-1">{m.value}</p>
                      <p className={`text-[9px] font-semibold ${m.up ? "text-[var(--income)]" : "text-[var(--expense)]"}`}>
                        {m.up ? "+8%" : "+3%"}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Bar chart */}
                <div className="bg-white/3 p-3 rounded-lg border border-white/8">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[9px] text-white/40">Tendência mensal</p>
                    <span className="text-[9px] text-[var(--income)] font-medium">últimos 7 meses</span>
                  </div>
                  <div className="relative flex items-end gap-1 h-[52px]">
                    {BARS.map((h, i) => (
                      <div key={i} className="flex-1">
                        <div
                          style={{
                            height: `${h}%`,
                            background: i === BARS.length - 1 ? "var(--accent)" : `rgba(106,248,47,${0.12 + i * 0.06})`,
                            borderRadius: "3px 3px 0 0",
                          }}
                        />
                      </div>
                    ))}
                    <svg
                      className="absolute inset-0 w-full h-full pointer-events-none"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <linearGradient id="trendGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="rgba(106,248,47,0.2)" />
                          <stop offset="100%" stopColor="rgba(106,248,47,0.9)" />
                        </linearGradient>
                      </defs>
                      <polyline
                        points="7,52 21.5,35 36,60 50.5,18 65,40 79.5,22 94,4"
                        fill="none"
                        stroke="url(#trendGrad)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          strokeDasharray: 300,
                          strokeDashoffset: 300,
                          animation: "drawLine 3.2s ease-in-out forwards 0.6s",
                        }}
                      />
                      <circle
                        cx="94" cy="4" r="2.5"
                        fill="#6af82f"
                        style={{ opacity: 0, animation: "fadeDot 0.4s ease forwards 3.8s" }}
                      />
                    </svg>
                  </div>
                  <div className="flex justify-between mt-1.5">
                    {MONTHS.map((m) => (
                      <span key={m} className="text-[8px] text-white/25 flex-1 text-center">{m}</span>
                    ))}
                  </div>
                </div>

                {/* Insight preview */}
                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-[rgba(106,248,47,0.25)] bg-[var(--accent-soft)]">
                  <Lightbulb size={13} className="text-[#90f048] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-white mb-0.5">Oportunidade identificada</p>
                    <p className="text-[9px] text-white/45 leading-relaxed">
                      Despesas com fornecedores subiram 18% em março. Renegociar contratos pode economizar R$ 1.200/mês.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="funcionalidades" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 border-t border-[var(--border)]">
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#90f048] bg-[var(--accent-soft)] border border-[rgba(106,248,47,0.3)] px-3 py-1.5 rounded-full mb-4">
            Funcionalidades
          </div>
          <h2 className="text-[28px] sm:text-[36px] font-bold tracking-tight">Tudo que você precisa, num só lugar</h2>
          <p className="text-[15px] sm:text-[16px] text-[var(--muted)] mt-3 max-w-xl mx-auto">
            O Klaro organiza seu financeiro e mostra onde você está perdendo dinheiro e como lucrar mais — sem planilhas complicadas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="glass rounded-2xl p-5 hover:border-[var(--border-2)] transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-soft)] grid place-items-center mb-4 group-hover:bg-[rgba(106,248,47,0.22)] transition-colors">
                <Icon size={18} className="text-[#90f048]" />
              </div>
              <h3 className="text-[14px] font-semibold text-white mb-2">{title}</h3>
              <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Steps ── */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 border-t border-[var(--border)]">
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#90f048] bg-[var(--accent-soft)] border border-[rgba(106,248,47,0.3)] px-3 py-1.5 rounded-full mb-4">
            Como funciona
          </div>
          <h2 className="text-[28px] sm:text-[36px] font-bold tracking-tight">Simples assim</h2>
          <p className="text-[15px] sm:text-[16px] text-[var(--muted)] mt-3 max-w-lg mx-auto">
            Em três passos você já tem seu financeiro organizado e com insights automáticos.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          {STEPS.map(({ n, title, desc }) => (
            <div key={n} className="glass rounded-2xl p-5 sm:p-6 relative overflow-hidden">
              <div className="absolute top-4 right-4 text-[42px] font-black text-white/5 leading-none select-none">{n}</div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[rgba(106,248,47,0.3)] to-[rgba(106,248,47,0.15)] border border-[var(--border-2)] grid place-items-center mb-4">
                <span className="text-[13px] font-bold text-[#90f048]">{n}</span>
              </div>
              <h3 className="text-[15px] font-semibold text-white mb-2">{title}</h3>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 border-t border-[var(--border)]">
        <div className="glass-strong rounded-2xl sm:rounded-3xl p-7 sm:p-12 text-center relative overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-[rgba(106,248,47,0.22)] blur-3xl pointer-events-none" />
          <div className="relative">
            <h2 className="text-[28px] sm:text-[36px] font-bold tracking-tight mb-2">
              Clareza nos números.<br />
              <span style={{ color: "var(--accent)" }}>Resultado</span> no bolso.
            </h2>
            <p className="text-[14px] sm:text-[16px] text-[var(--muted)] mb-7 sm:mb-8 max-w-md mx-auto leading-relaxed mt-3">
              Crie sua conta grátis e comece a usar o Klaro em menos de 2 minutos.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup" className="btn-primary flex items-center justify-center gap-2 px-8 py-3.5 rounded-lg text-[14px] font-semibold">
                Começar grátis <ArrowRight size={15} />
              </Link>
              <Link href="/login" className="flex items-center justify-center px-8 py-3.5 rounded-lg border border-[var(--border)] text-white hover:border-[var(--border-2)] text-[14px] transition-colors">
                Já tenho conta
              </Link>
            </div>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-6">
              {TRUST.map((t) => (
                <div key={t} className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
                  <CheckCircle2 size={12} className="text-[var(--accent)]" />{t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[var(--border)] py-6 sm:py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <KlaroMark size={20} />
          <p className="text-[12px] text-[var(--muted)]">
            © {new Date().getFullYear()} Klaro. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
