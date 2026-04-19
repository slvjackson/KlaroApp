import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Lightbulb,
  Sparkles,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import type { ElementType } from "react";
import { Link } from "wouter";

// ─── Animation variant ────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

// ─── Mock dashboard ───────────────────────────────────────────────────────────

const BARS = [48, 65, 40, 82, 60, 78, 96];
const MONTHS = ["Out", "Nov", "Dez", "Jan", "Fev", "Mar", "Abr"];

function DashboardMock() {
  return (
    <div className="relative w-full max-w-[480px] mx-auto">
      <div className="absolute -inset-6 bg-primary/5 blur-3xl pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.3, ease: "easeOut" }}
        className="relative border border-white/10 bg-[#0a0a0a] shadow-2xl overflow-hidden"
        style={{ borderRadius: "16px" }}
      >
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/8 bg-black/30">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/50" />
          <div className="w-2.5 h-2.5 rounded-full bg-primary/60" />
          <span className="ml-3 text-[10px] text-white/30 font-mono tracking-wide">
            klaro — dashboard
          </span>
        </div>

        <div className="p-4 space-y-3">
          {/* Metric cards */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Saldo líquido", value: "R$ 12.430", delta: "+12%", up: true },
              { label: "Receitas", value: "R$ 18.200", delta: "+8%", up: true },
              { label: "Despesas", value: "R$ 5.770", delta: "+3%", up: false },
            ].map((m) => (
              <div
                key={m.label}
                className="bg-white/5 p-2.5 border border-white/8"
                style={{ borderRadius: "8px" }}
              >
                <p className="text-[9px] text-white/40 mb-1 leading-none">{m.label}</p>
                <p className="text-[13px] font-bold text-white leading-none mb-1">{m.value}</p>
                <p className={`text-[9px] font-semibold ${m.up ? "text-primary" : "text-red-400"}`}>
                  {m.delta}
                </p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div
            className="bg-white/3 p-3 border border-white/8"
            style={{ borderRadius: "8px" }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] text-white/40">Tendência mensal</p>
              <span className="text-[9px] text-primary font-medium">últimos 7 meses</span>
            </div>
            <div className="flex items-end gap-1 h-[52px]">
              {BARS.map((h, i) => (
                <div key={i} className="flex-1">
                  <div
                    style={{
                      height: `${h}%`,
                      backgroundColor:
                        i === BARS.length - 1
                          ? "hsl(110 100% 54%)"
                          : `hsl(110 100% 54% / ${0.12 + i * 0.06})`,
                      borderRadius: "3px 3px 0 0",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1.5">
              {MONTHS.map((m) => (
                <span key={m} className="text-[8px] text-white/25 flex-1 text-center">
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Insight preview */}
          <div
            className="flex items-start gap-2.5 p-3 border border-primary/25 bg-primary/5"
            style={{ borderRadius: "8px" }}
          >
            <Lightbulb size={13} className="text-primary mt-0.5 shrink-0" />
            <div>
              <p className="text-[10px] font-semibold text-white mb-0.5">
                Oportunidade identificada
              </p>
              <p className="text-[9px] text-white/45 leading-relaxed">
                Despesas com fornecedores subiram 18% em março. Renegociar contratos pode
                economizar R$ 1.200/mês.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────

function FeatureCard({
  icon: Icon,
  title,
  description,
  i,
}: {
  icon: ElementType;
  title: string;
  description: string;
  i: number;
}) {
  return (
    <motion.div
      variants={fadeUp}
      custom={i}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="p-6 border border-border bg-card hover:border-primary/40 transition-colors group"
      style={{ borderRadius: "12px" }}
    >
      <div
        className="w-10 h-10 flex items-center justify-center mb-4 bg-primary/10 group-hover:bg-primary/20 transition-colors"
        style={{ borderRadius: "10px" }}
      >
        <Icon size={18} className="text-primary" />
      </div>
      <h3 className="font-semibold text-foreground mb-2 text-[15px]">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Upload,
    title: "Upload inteligente",
    description:
      "Envie PDFs, planilhas Excel, CSVs ou fotos de extratos. Nossa IA lê e extrai os dados automaticamente.",
  },
  {
    icon: Sparkles,
    title: "Extração com IA",
    description:
      "Valores, datas e categorias identificados automaticamente. Você só confirma o que a IA encontrou.",
  },
  {
    icon: BarChart3,
    title: "Dashboard em tempo real",
    description:
      "Saldo, receitas, despesas e tendências num painel limpo. Visualize o mês atual em segundos.",
  },
  {
    icon: Lightbulb,
    title: "Insights personalizados",
    description:
      "Análises geradas por IA com recomendações práticas baseadas no seu histórico financeiro.",
  },
];

const STEPS = [
  {
    n: "01",
    icon: Upload,
    title: "Faça o upload",
    description:
      "Envie seus extratos, planilhas ou fotos diretamente no app — no celular ou no computador.",
  },
  {
    n: "02",
    icon: CheckCircle2,
    title: "Revise os dados",
    description:
      "A IA extrai todas as transações. Você revisa rapidamente e confirma o que está correto.",
  },
  {
    n: "03",
    icon: TrendingUp,
    title: "Acompanhe e cresça",
    description:
      "Com os dados organizados, o Klaro gera insights automáticos e mantém seu painel sempre atualizado.",
  },
];

const TRUST = ["Sem cartão de crédito", "Configuração em minutos", "Dados criptografados"];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight select-none">
            klaro<span className="text-primary">.</span>
          </span>

          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a
              href="#funcionalidades"
              className="hover:text-foreground transition-colors"
            >
              Funcionalidades
            </a>
            <a
              href="#como-funciona"
              className="hover:text-foreground transition-colors"
            >
              Como funciona
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Entrar
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              style={{ borderRadius: "8px" }}
            >
              Criar conta
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-28">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Copy */}
          <div>
            <motion.div
              variants={fadeUp}
              custom={0}
              initial="hidden"
              animate="visible"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full mb-6"
            >
              <Zap size={11} />
              IA generativa integrada
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              initial="hidden"
              animate="visible"
              className="text-5xl lg:text-[56px] font-bold tracking-tight leading-[1.08] mb-5"
            >
              Seu negócio,{" "}
              <span className="text-primary">organizado</span>.{" "}
              <br className="hidden lg:block" />
              Seus números,{" "}
              <span className="text-primary">claros</span>.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="visible"
              className="text-[17px] text-muted-foreground mb-8 leading-relaxed max-w-lg"
            >
              Envie extratos, planilhas ou fotos do caixa. O Klaro extrai os dados,
              organiza automaticamente e gera insights com IA — para você tomar
              melhores decisões.
            </motion.p>

            <motion.div
              variants={fadeUp}
              custom={3}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row gap-3 mb-8"
            >
              <Link
                href="/signup"
                className="flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors text-sm"
                style={{ borderRadius: "8px" }}
              >
                Começar grátis
                <ArrowRight size={15} />
              </Link>
              <a
                href="#como-funciona"
                className="flex items-center justify-center gap-2 px-6 py-3.5 border border-border text-foreground hover:bg-secondary transition-colors text-sm font-medium"
                style={{ borderRadius: "8px" }}
              >
                Ver como funciona
              </a>
            </motion.div>

            <motion.div
              variants={fadeUp}
              custom={4}
              initial="hidden"
              animate="visible"
              className="flex flex-wrap gap-x-6 gap-y-2"
            >
              {TRUST.map((t) => (
                <div key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 size={12} className="text-primary" />
                  {t}
                </div>
              ))}
            </motion.div>
          </div>

          {/* Visual */}
          <DashboardMock />
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="funcionalidades" className="border-t border-border py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-14"
          >
            <p className="text-sm font-semibold text-primary mb-2">Funcionalidades</p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3">
              Tudo que você precisa para gerir seu negócio
            </h2>
            <p className="text-muted-foreground max-w-lg text-[15px]">
              Do upload ao insight em minutos. Sem planilhas manuais, sem perda de tempo.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f, i) => (
              <FeatureCard key={f.title} {...f} i={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section id="como-funciona" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-14"
          >
            <p className="text-sm font-semibold text-primary mb-2">Como funciona</p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
              Do extrato ao insight em 3 passos
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connector */}
            <div className="hidden md:block absolute top-[18px] left-[calc(33.33%+8px)] right-[calc(33.33%+8px)] h-px bg-border" />

            {STEPS.map((s, i) => (
              <motion.div
                key={s.n}
                variants={fadeUp}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
              >
                <div
                  className="w-9 h-9 border-2 border-primary flex items-center justify-center mb-5 bg-background relative z-10"
                  style={{ borderRadius: "50%" }}
                >
                  <span className="text-primary font-bold text-xs">{s.n}</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2 text-[15px]">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {s.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────────────── */}
      <section className="border-t border-border py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="border border-primary/20 bg-primary/5 px-10 py-16 text-center"
            style={{ borderRadius: "20px" }}
          >
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-4">
              Comece hoje
            </p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">
              Pronto para ter clareza financeira?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto text-[15px] leading-relaxed">
              Cadastre-se em menos de 1 minuto e comece a entender os números do seu negócio.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-colors text-[15px]"
              style={{ borderRadius: "10px" }}
            >
              Criar conta grátis
              <ArrowRight size={17} />
            </Link>
            <p className="text-xs text-muted-foreground mt-5">
              Sem cartão de crédito necessário.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-lg font-bold tracking-tight select-none">
            klaro<span className="text-primary">.</span>
          </span>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Klaro. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">
              Entrar
            </Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">
              Criar conta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
