// React hooks available via components.jsx (useState, useEffect, useRef, useMemo)

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#7c5cff",
  "chatOpen": true,
  "density": "comfortable"
}/*EDITMODE-END*/;

const ACCENTS = [
  { key:"#7c5cff", label:"Violeta", soft:"rgba(124,92,255,0.14)" },
  { key:"#5b8cff", label:"Azul",    soft:"rgba(91,140,255,0.14)" },
  { key:"#14b8a6", label:"Turquesa",soft:"rgba(20,184,166,0.14)" },
  { key:"#f59e0b", label:"Âmbar",   soft:"rgba(245,158,11,0.14)" },
];

function applyAccent(hex) {
  const a = ACCENTS.find(x => x.key === hex) || ACCENTS[0];
  document.documentElement.style.setProperty("--accent", a.key);
  document.documentElement.style.setProperty("--accent-soft", a.soft);
}

// ─── Hash Router ──────────────────────────────────────────────────────────────
function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash.slice(1) || "/home");
  useEffect(() => {
    const onHash = () => setHash(window.location.hash.slice(1) || "/home");
    window.addEventListener("hashchange", onHash);
    if (!window.location.hash) window.location.hash = "/home";
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (p) => { window.location.hash = p; };
  return [hash, go];
}

// ─── Wordmark ─────────────────────────────────────────────────────────────────
function Wordmark({ size = 22 }) {
  return (
    <span className="select-none font-bold tracking-tight text-white" style={{ fontSize: size }}>
      klaro<span style={{ color: "var(--accent)" }}>.</span>
    </span>
  );
}

// ─── App Sidebar (for auth'd routes) ──────────────────────────────────────────
function AppSidebar({ path, go }) {
  const items = [
    { href:"/dashboard",    label:"Dashboard",   icon:"layout-dashboard" },
    { href:"/upload",       label:"Upload",      icon:"upload-cloud" },
    { href:"/transactions", label:"Transações",  icon:"arrow-left-right" },
    { href:"/insights",     label:"Insights",    icon:"lightbulb" },
    { href:"/chat",         label:"Chat Klaro",  icon:"sparkles", badge:"IA" },
  ];
  return (
    <aside className="hidden md:flex flex-col w-[232px] shrink-0 h-screen sticky top-0 px-4 py-5 border-r border-[var(--border)] bg-[rgba(12,12,15,0.7)] backdrop-blur-xl">
      <button onClick={() => go("/dashboard")} className="flex items-center gap-2.5 px-1.5 mb-7 text-left">
        <KlaroMark size={28} />
        <div className="leading-tight">
          <Wordmark size={17}/>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">finanças claras</div>
        </div>
      </button>

      <nav className="flex flex-col gap-0.5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]/70 px-2 mb-1.5">Geral</div>
        {items.map((it) => {
          const isActive = path === it.href;
          return (
            <button key={it.href} onClick={() => go(it.href)}
              className={`nav-item group flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors
                ${isActive ? "text-white bg-[rgba(124,92,255,0.12)] active" : "text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.03)]"}`}>
              <Icon name={it.icon} size={16} />
              <span className="flex-1 text-left">{it.label}</span>
              {it.badge && (
                <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-br from-[#8a6bff] to-[#5b8cff] text-white">{it.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 flex flex-col gap-0.5">
        <button onClick={() => go("/profile")}
          className={`nav-item flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors
            ${path === "/profile" ? "text-white bg-[rgba(124,92,255,0.12)] active" : "text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.03)]"}`}>
          <Icon name="user" size={16}/>
          <span>Perfil</span>
        </button>
        <button onClick={() => go("/login")}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.03)]">
          <Icon name="log-out" size={16}/>
          <span>Sair</span>
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2.5 px-1 py-1 border-t border-[var(--border)] pt-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c5cff] to-[#5b8cff] grid place-items-center text-[12px] font-bold text-white">LM</div>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[12.5px] font-semibold text-white truncate">Luana Moraes</div>
          <div className="text-[11px] text-[var(--muted)] truncate">luana@acme.co</div>
        </div>
      </div>
    </aside>
  );
}

function AppShell({ path, go, children, title, subtitle, actions }) {
  return (
    <div className="flex min-h-screen bg-ambient">
      <AppSidebar path={path} go={go}/>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 px-6 md:px-8 py-4 border-b border-[var(--border)] bg-[rgba(9,9,11,0.5)] backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
            <span>Klaro</span><Icon name="chevron-right" size={13}/>
            <span className="text-white">{title}</span>
          </div>
          <div className="flex-1"/>
          {actions}
        </div>
        <main className="flex-1 min-w-0 px-6 md:px-8 py-6 overflow-y-auto klaro-scroll">
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── HOME (public landing) ────────────────────────────────────────────────────
function HomePage({ go }) {
  const BARS = [48,65,40,82,60,78,96];
  const MONTHS = ["Out","Nov","Dez","Jan","Fev","Mar","Abr"];
  const FEATURES = [
    { icon:"upload-cloud", title:"Upload inteligente", desc:"Envie PDFs, planilhas Excel, CSVs ou fotos de extratos. Nossa IA lê e extrai os dados automaticamente." },
    { icon:"sparkles",     title:"Extração com IA",   desc:"Valores, datas e categorias identificados automaticamente. Você só confirma o que a IA encontrou." },
    { icon:"bar-chart-3",  title:"Dashboard em tempo real", desc:"Saldo, receitas, despesas e tendências num painel limpo. Visualize o mês atual em segundos." },
    { icon:"lightbulb",    title:"Insights personalizados", desc:"Análises geradas por IA com recomendações práticas baseadas no seu histórico." },
  ];
  const STEPS = [
    { n:"01", title:"Faça o upload", desc:"Envie seus extratos, planilhas ou fotos — no celular ou no computador." },
    { n:"02", title:"Revise os dados", desc:"A IA extrai todas as transações. Você revisa rapidamente e confirma o que está correto." },
    { n:"03", title:"Acompanhe e cresça", desc:"Com os dados organizados, o Klaro gera insights automáticos e mantém seu painel atualizado." },
  ];
  const TRUST = ["Sem cartão de crédito","Configuração em minutos","Dados criptografados"];
  return (
    <div className="min-h-screen bg-ambient text-white">
      <nav className="sticky top-0 z-50 border-b border-[var(--border)] bg-[rgba(9,9,11,0.7)] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5"><KlaroMark size={26}/><Wordmark size={20}/></div>
          <div className="hidden md:flex items-center gap-8 text-[13px] text-[var(--muted)]">
            <a href="#funcionalidades" className="hover:text-white">Funcionalidades</a>
            <a href="#como-funciona" className="hover:text-white">Como funciona</a>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => go("/login")} className="text-[13px] text-[var(--muted)] hover:text-white px-3 py-2">Entrar</button>
            <button onClick={() => go("/signup")} className="btn-primary text-[13px] px-4 py-2 rounded-lg font-semibold text-white">Criar conta</button>
          </div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div className="fadeUp">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#a18bff] bg-[var(--accent-soft)] border border-[rgba(124,92,255,0.3)] px-3 py-1.5 rounded-full mb-6">
              <Icon name="zap" size={11}/> IA generativa integrada
            </div>
            <h1 className="text-5xl lg:text-[56px] font-bold tracking-tight leading-[1.06] mb-5">
              Seu negócio,{" "}<span style={{color:"var(--accent)"}}>organizado</span>.<br className="hidden lg:block"/>
              Seus números,{" "}<span style={{color:"var(--accent)"}}>claros</span>.
            </h1>
            <p className="text-[17px] text-[var(--muted)] mb-8 leading-relaxed max-w-lg">
              Envie extratos, planilhas ou fotos do caixa. O Klaro extrai os dados, organiza automaticamente e gera insights com IA — para você tomar melhores decisões.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <button onClick={() => go("/signup")} className="btn-primary flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-[14px] font-semibold text-white">
                Começar grátis <Icon name="arrow-right" size={15}/>
              </button>
              <a href="#como-funciona" className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg border border-[var(--border)] text-white hover:border-[var(--border-2)] text-[14px] font-medium">
                Ver como funciona
              </a>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {TRUST.map(t => (
                <div key={t} className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
                  <Icon name="check-circle-2" size={12} className="text-[var(--accent)]"/>{t}
                </div>
              ))}
            </div>
          </div>

          {/* Dashboard mock */}
          <div className="relative w-full max-w-[480px] mx-auto fadeUp">
            <div className="absolute -inset-6 bg-[var(--accent-soft)] blur-3xl pointer-events-none"/>
            <div className="relative glass-strong rounded-2xl overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/8">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]/60"/>
                <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60"/>
                <div className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]/70"/>
                <span className="ml-3 text-[10px] text-white/30 font-mono">klaro — dashboard</span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[{l:"Saldo líquido",v:"R$ 12.430",d:"+12%",up:true},{l:"Receitas",v:"R$ 18.200",d:"+8%",up:true},{l:"Despesas",v:"R$ 5.770",d:"+3%",up:false}].map(m=>(
                    <div key={m.l} className="bg-white/5 p-2.5 border border-white/8 rounded-lg">
                      <p className="text-[9px] text-white/40 mb-1">{m.l}</p>
                      <p className="text-[13px] font-bold tnum mb-1">{m.v}</p>
                      <p className={`text-[9px] font-semibold ${m.up ? "text-[var(--income)]" : "text-[var(--expense)]"}`}>{m.d}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-white/3 p-3 border border-white/8 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[9px] text-white/40">Tendência mensal</p>
                    <span className="text-[9px] text-[var(--accent)] font-medium">últimos 7 meses</span>
                  </div>
                  <div className="flex items-end gap-1 h-[52px]">
                    {BARS.map((h,i)=>(
                      <div key={i} className="flex-1"><div style={{height:h+"%", background: i===BARS.length-1 ? "var(--accent)" : `rgba(124,92,255,${0.12+i*0.06})`, borderRadius:"3px 3px 0 0"}}/></div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-1.5">{MONTHS.map(m=><span key={m} className="text-[8px] text-white/25 flex-1 text-center">{m}</span>)}</div>
                </div>
                <div className="flex items-start gap-2.5 p-3 border border-[rgba(124,92,255,0.25)] bg-[var(--accent-soft)] rounded-lg">
                  <Icon name="lightbulb" size={13} className="text-[var(--accent)] mt-0.5"/>
                  <div>
                    <p className="text-[10px] font-semibold mb-0.5">Oportunidade identificada</p>
                    <p className="text-[9px] text-white/50 leading-relaxed">Despesas com fornecedores subiram 18% em março. Renegociar contratos pode economizar R$ 1.200/mês.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="funcionalidades" className="border-t border-[var(--border)] py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-14">
            <p className="text-[13px] font-semibold text-[var(--accent)] mb-2">Funcionalidades</p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-3">Tudo que você precisa para gerir seu negócio</h2>
            <p className="text-[var(--muted)] max-w-lg text-[15px]">Do upload ao insight em minutos. Sem planilhas manuais, sem perda de tempo.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(f=>(
              <div key={f.title} className="glass rounded-xl p-6 hover:border-[var(--accent)]/40 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-soft)] grid place-items-center mb-4">
                  <Icon name={f.icon} size={18} className="text-[var(--accent)]"/>
                </div>
                <h3 className="font-semibold mb-2 text-[15px]">{f.title}</h3>
                <p className="text-[13.5px] text-[var(--muted)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-14">
            <p className="text-[13px] font-semibold text-[var(--accent)] mb-2">Como funciona</p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">Do extrato ao insight em 3 passos</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-[18px] left-[calc(33.33%+8px)] right-[calc(33.33%+8px)] h-px bg-[var(--border)]"/>
            {STEPS.map(s=>(
              <div key={s.n}>
                <div className="w-9 h-9 rounded-full border-2 border-[var(--accent)] bg-[var(--bg)] grid place-items-center mb-5 relative z-10">
                  <span className="text-[var(--accent)] font-bold text-[12px]">{s.n}</span>
                </div>
                <h3 className="font-semibold mb-2 text-[15px]">{s.title}</h3>
                <p className="text-[13.5px] text-[var(--muted)] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)] py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="glass rounded-2xl border-[rgba(124,92,255,0.25)] bg-[var(--accent-soft)] px-10 py-16 text-center">
            <p className="text-[11px] font-bold text-[var(--accent)] uppercase tracking-widest mb-4">Comece hoje</p>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4">Pronto para ter clareza financeira?</h2>
            <p className="text-[var(--muted)] mb-8 max-w-md mx-auto text-[15px] leading-relaxed">Cadastre-se em menos de 1 minuto e comece a entender os números do seu negócio.</p>
            <button onClick={()=>go("/signup")} className="btn-primary inline-flex items-center gap-2 px-8 py-4 rounded-xl text-[15px] font-bold text-white">
              Criar conta grátis <Icon name="arrow-right" size={17}/>
            </button>
            <p className="text-[12px] text-[var(--muted)] mt-5">Sem cartão de crédito necessário.</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Wordmark size={18}/>
          <p className="text-[13px] text-[var(--muted)]">© 2026 Klaro. Todos os direitos reservados.</p>
          <div className="flex items-center gap-6 text-[13px] text-[var(--muted)]">
            <button onClick={()=>go("/login")} className="hover:text-white">Entrar</button>
            <button onClick={()=>go("/signup")} className="hover:text-white">Criar conta</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Auth (login & signup) ────────────────────────────────────────────────────
function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-ambient flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8"><KlaroMark size={40}/></div>
        <div className="glass-strong rounded-2xl p-8 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-24 -right-24 w-60 h-60 rounded-full bg-[var(--accent-soft)] blur-3xl"/>
          <div className="relative">
            <h1 className="text-[24px] font-bold tracking-tight mb-1 text-white">{title}</h1>
            <p className="text-[13px] text-[var(--muted)] mb-6">{subtitle}</p>
            {children}
          </div>
        </div>
        <div className="text-center mt-6 text-[13px] text-[var(--muted)]">{footer}</div>
      </div>
    </div>
  );
}

function LoginPage({ go }) {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [loading, setLoading] = useState(false);
  function submit(e){ e.preventDefault(); setLoading(true); setTimeout(()=>{setLoading(false); go("/dashboard");}, 700); }
  return (
    <AuthShell title="Entrar" subtitle="Bem-vinda de volta ao Klaro."
      footer={<>Não tem uma conta? <button onClick={()=>go("/signup")} className="text-[var(--accent)] hover:underline font-medium">Criar conta</button></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" className="field"/></Field>
        <Field label="Senha"><input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="••••••••" className="field"/></Field>
        <div className="text-right">
          <button type="button" className="text-[12px] text-[var(--muted)] hover:text-white">Esqueceu sua senha?</button>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl font-semibold text-[14px] text-white flex items-center justify-center gap-2">
          {loading ? <><Icon name="loader" size={14} className="animate-spin"/> Entrando…</> : "Entrar"}
        </button>
      </form>
    </AuthShell>
  );
}

function SignupPage({ go }) {
  const [loading, setLoading] = useState(false);
  function submit(e){ e.preventDefault(); setLoading(true); setTimeout(()=>{setLoading(false); go("/dashboard");}, 700); }
  return (
    <AuthShell title="Criar conta" subtitle="Leva menos de 1 minuto. Sem cartão de crédito."
      footer={<>Já tem uma conta? <button onClick={()=>go("/login")} className="text-[var(--accent)] hover:underline font-medium">Entrar</button></>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome"><input placeholder="Seu nome" className="field"/></Field>
        <Field label="Email"><input type="email" placeholder="seu@email.com" className="field"/></Field>
        <Field label="Senha"><input type="password" placeholder="Mínimo 6 caracteres" className="field"/></Field>
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 rounded-xl font-semibold text-[14px] text-white flex items-center justify-center gap-2">
          {loading ? <><Icon name="loader" size={14} className="animate-spin"/> Criando…</> : "Criar conta grátis"}
        </button>
        <p className="text-[11px] text-[var(--muted)] text-center mt-2">Ao criar a conta você concorda com os Termos e a Política de Privacidade.</p>
      </form>
    </AuthShell>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] font-semibold">{label}</div>
      {children}
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardPage({ go }) {
  const [tweaks] = useState(TWEAK_DEFAULTS);
  const [chatOpen, setChatOpen] = useState(tweaks.chatOpen);
  return (
    <div className="flex min-h-screen bg-ambient">
      <AppSidebar path="/dashboard" go={go}/>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 px-6 md:px-8 py-4 border-b border-[var(--border)] bg-[rgba(9,9,11,0.5)] backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]"><span>Klaro</span><Icon name="chevron-right" size={13}/><span className="text-white">Dashboard</span></div>
          <div className="flex-1"/>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12.5px] text-white hover:border-[var(--border-2)]">
            <Icon name="calendar" size={13} className="text-[var(--muted)]"/>Abril 2026<Icon name="chevron-down" size={12} className="text-[var(--muted)]"/>
          </button>
          {!chatOpen && (
            <button onClick={()=>setChatOpen(true)} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-white">
              <Icon name="sparkles" size={13}/>Assistente
            </button>
          )}
        </div>
        <div className="flex flex-1 min-h-0">
          <main className="flex-1 min-w-0 px-6 md:px-8 py-6 overflow-y-auto klaro-scroll">
            <div className="flex flex-col gap-5">
              <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] font-semibold">Olá, Luana</div>
                  <h1 className="text-[28px] font-bold tracking-tight mt-1">Bom dia. Suas finanças estão <span className="text-[var(--income)]">no verde</span>.</h1>
                </div>
                <div className="flex gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-[12.5px] text-white hover:border-[var(--border-2)]"><Icon name="download" size={13} className="text-[var(--muted)]"/>Exportar</button>
                  <button className="btn-primary flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold text-white"><Icon name="plus" size={13}/>Nova transação</button>
                </div>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
                <SummaryCard label="Saldo líquido" value={BRL(SUMMARY.netBalance)} delta={SUMMARY.deltaBalance} icon="wallet" tone="brand" sparkPoints={MONTHLY.map(m=>m.income-m.expense)} sparkColor="#a18bff" sub="Mês atual · 22 abr"/>
                <SummaryCard label="Entradas" value={BRL(SUMMARY.totalIncome)} delta={SUMMARY.deltaIncome} icon="arrow-down-to-line" tone="income" sparkPoints={MONTHLY.map(m=>m.income)} sparkColor="#10b981"/>
                <SummaryCard label="Saídas" value={BRL(SUMMARY.totalExpenses)} delta={SUMMARY.deltaExpenses} icon="arrow-up-from-line" tone="expense" sparkPoints={MONTHLY.map(m=>m.expense)} sparkColor="#f43f5e"/>
                <SummaryCard label="Transações" value={String(SUMMARY.txCount)} delta={SUMMARY.deltaTx} icon="receipt" tone="neutral" sparkPoints={[28,31,36,30,38,42,47]} sparkColor="#8a8a95"/>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                <div className="xl:col-span-2"><MonthlyChart/></div>
                <CategoryDonut/>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
                <div className="xl:col-span-3"><TransactionsList limit={6}/></div>
                <div className="xl:col-span-2"><InsightsCard/></div>
              </div>
            </div>
          </main>
          {chatOpen && (
            <aside className="hidden lg:flex w-[400px] xl:w-[440px] shrink-0 border-l border-[var(--border)] bg-[rgba(9,9,11,0.4)] backdrop-blur-xl">
              <div className="p-4 w-full"><ChatPanel onClose={()=>setChatOpen(false)} layout="split"/></div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
function TransactionsPage({ go }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TRANSACTIONS.filter(t => (filter === "all" || t.type === filter) && (!q || (t.desc+" "+t.cat).toLowerCase().includes(q)));
  }, [filter, search]);
  const inc = rows.filter(r=>r.type==="income").reduce((s,t)=>s+Math.abs(t.amount),0);
  const exp = rows.filter(r=>r.type==="expense").reduce((s,t)=>s+Math.abs(t.amount),0);
  return (
    <AppShell path="/transactions" go={go} title="Transações"
      actions={<button className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-white"><Icon name="plus" size={13}/>Nova</button>}>
      <div className="space-y-5">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Transações</h1>
          <p className="text-[13px] text-[var(--muted)] mt-1">Todas as suas transações confirmadas.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="glass rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">Total entradas</div>
            <div className="text-[18px] font-bold text-[var(--income)] tnum mt-1">{BRL(inc)}</div>
          </div>
          <div className="glass rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">Total saídas</div>
            <div className="text-[18px] font-bold text-[var(--expense)] tnum mt-1">{BRL(exp)}</div>
          </div>
          <div className="glass rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] font-semibold">Líquido</div>
            <div className="text-[18px] font-bold tnum mt-1">{BRL(inc-exp)}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 p-1 rounded-lg bg-[rgba(255,255,255,0.04)] border border-[var(--border)]">
            {[{k:"all",l:"Todas"},{k:"income",l:"Entradas"},{k:"expense",l:"Saídas"}].map(t=>(
              <button key={t.k} onClick={()=>setFilter(t.k)}
                className={`px-3 py-1.5 text-[11.5px] font-semibold rounded-md transition-colors ${filter===t.k?"bg-[var(--accent-soft)] text-white":"text-[var(--muted)] hover:text-white"}`}>{t.l}</button>
            ))}
          </div>
          <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.02)]">
            <Icon name="search" size={13} className="text-[var(--muted)]"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar descrição ou categoria…" className="bg-transparent outline-none flex-1 text-[12.5px] placeholder:text-[var(--muted)] text-white"/>
          </div>
          <select className="field-sm"><option>Todos os meses</option><option>Abril/26</option><option>Março/26</option></select>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_140px_120px_140px_40px] gap-3 px-4 py-3 text-[10.5px] uppercase tracking-[0.14em] text-[var(--muted)] font-semibold border-b border-[var(--border)]">
            <div>Descrição</div><div>Categoria</div><div>Data</div><div className="text-right">Valor</div><div/>
          </div>
          {rows.map(t => {
            const isIn = t.type === "income";
            return (
              <div key={t.id} className="grid grid-cols-[1fr_140px_120px_140px_40px] gap-3 px-4 py-3 items-center border-b border-[var(--border)] last:border-0 hover:bg-white/[0.025] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${isIn ? "bg-[var(--income-soft)] text-[var(--income)]" : "bg-white/5 text-white/70"}`}>
                    <Icon name={t.icon} size={14}/>
                  </div>
                  <div className="text-[13px] text-white font-medium truncate">{t.desc}</div>
                </div>
                <div className="text-[12px] text-[var(--muted)]">{t.cat}</div>
                <div className="text-[12px] text-[var(--muted)] tnum">{t.date}</div>
                <div className={`text-right text-[13.5px] font-semibold tnum ${isIn ? "text-[var(--income)]" : "text-white"}`}>{isIn ? "+ " : "− "}{BRL(Math.abs(t.amount))}</div>
                <button className="text-[var(--muted)] hover:text-white justify-self-end"><Icon name="pencil" size={13}/></button>
              </div>
            );
          })}
          {rows.length === 0 && (
            <div className="py-12 text-center text-[13px] text-[var(--muted)]">
              <Icon name="inbox" size={22} className="opacity-40 mb-2"/>Nenhuma transação encontrada.
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ─── INSIGHTS ─────────────────────────────────────────────────────────────────
function InsightsPage({ go }) {
  const [gen, setGen] = useState(false);
  const items = [
    { t:"Gasto com Alimentação caiu 14%", p:"Abril · vs Março", d:"Você economizou R$ 210 em comparação a Março. A tendência se mantém desde Fevereiro.", r:"Continue com a mesma rotina de compras. Considere estender o padrão para a categoria Mercado.", tone:"good", ic:"trending-down" },
    { t:"Assinaturas somam R$ 248/mês",   p:"Últimos 30 dias",  d:"3 assinaturas não tiveram uso. Revista+, CloudSync Pro e AudioBooks totalizam R$ 83,80 por mês.", r:"Cancelar as 3 libera R$ 1.006,80 por ano. Posso iniciar os cancelamentos?", tone:"warn", ic:"alert-circle" },
    { t:"Receita acima da média",          p:"Abril · vs últimos 6m", d:"Abril está 6,6% acima do ticket médio. Freelas somaram R$ 4.350, o maior valor do semestre.", r:"Considere direcionar R$ 1.000 extra para investimentos ou reserva.", tone:"good", ic:"trending-up" },
    { t:"Gastos com Transporte em alta",  p:"Abril",            d:"Uber/99 representam 82% do Transporte no mês — R$ 502 em 19 corridas.", r:"Avalie plano mensal ou carona compartilhada em trajetos recorrentes.", tone:"warn", ic:"car" },
  ];
  return (
    <AppShell path="/insights" go={go} title="Insights"
      actions={<button onClick={()=>{ setGen(true); setTimeout(()=>setGen(false), 1500); }} disabled={gen}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12.5px] font-semibold text-white hover:border-[var(--border-2)] disabled:opacity-60">
        <Icon name="refresh-cw" size={13} className={gen ? "animate-spin" : ""}/>{gen ? "Analisando…" : "Gerar novos"}
      </button>}>
      <div className="space-y-5">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Insights</h1>
          <p className="text-[13px] text-[var(--muted)] mt-1">Análises automáticas com IA sobre a saúde do seu negócio.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((it, i) => (
            <div key={i} className="glass rounded-2xl p-5 hover:border-[var(--border-2)] transition-colors">
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${it.tone==="good"?"bg-[var(--income-soft)] text-[var(--income)]":"bg-[rgba(245,158,11,0.12)] text-[#f59e0b]"}`}>
                  <Icon name={it.ic} size={15}/>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-white leading-snug">{it.t}</div>
                  <div className="text-[11px] text-[var(--muted)] mt-0.5">{it.p}</div>
                </div>
              </div>
              <p className="text-[13px] text-[var(--muted)] leading-relaxed mt-4">{it.d}</p>
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] font-semibold mb-1.5">Recomendação</div>
                <p className="text-[13px] text-[var(--accent)]">{it.r}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// ─── CHAT (full page) ─────────────────────────────────────────────────────────
function ChatPage({ go }) {
  return (
    <AppShell path="/chat" go={go} title="Chat Klaro">
      <div className="max-w-3xl mx-auto h-[calc(100vh-128px)]">
        <ChatPanel onClose={()=>go("/dashboard")} layout="split"/>
      </div>
    </AppShell>
  );
}

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
function UploadPage({ go }) {
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState(null);
  function handle(){ setLoading(true); setTimeout(()=>{setLoading(false); go("/transactions");}, 1500); }
  const RECENT = [
    { n:"extrato-abril-2026.pdf", date:"22/04 · 09:42", status:"done" },
    { n:"nubank-março.csv",       date:"04/04 · 11:10", status:"done" },
    { n:"anotacoes-caixa.jpg",    date:"28/03 · 18:05", status:"done" },
    { n:"planilha-vendas.xlsx",   date:"15/03 · 14:33", status:"done" },
  ];
  return (
    <AppShell path="/upload" go={go} title="Upload">
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Upload de dados</h1>
          <p className="text-[13px] text-[var(--muted)] mt-1">Envie extratos bancários, planilhas ou fotos de anotações. O Klaro fará a leitura e organização automaticamente.</p>
        </div>

        <div className="glass rounded-2xl p-2">
          <div
            onDragOver={e=>{e.preventDefault(); setDrag(true);}}
            onDragLeave={()=>setDrag(false)}
            onDrop={e=>{e.preventDefault(); setDrag(false); if(e.dataTransfer.files[0]){ setFileName(e.dataTransfer.files[0].name); handle(); }}}
            className={`rounded-xl border-2 border-dashed p-12 text-center flex flex-col items-center justify-center gap-4 transition-colors
              ${drag ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--border-2)] hover:border-[var(--accent)]/50"}`}>
            {loading ? (
              <>
                <Icon name="loader" size={40} className="text-[var(--accent)] animate-spin"/>
                <div>
                  <div className="text-[16px] font-semibold">Processando {fileName ?? "arquivo"}…</div>
                  <div className="text-[12.5px] text-[var(--muted)] mt-1">A inteligência artificial está extraindo os dados.</div>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-[var(--accent-soft)] grid place-items-center mb-2">
                  <Icon name="upload-cloud" size={26} className="text-[var(--accent)]"/>
                </div>
                <div>
                  <div className="text-[18px] font-semibold">Arraste um arquivo ou clique</div>
                  <div className="text-[12.5px] text-[var(--muted)] mt-1">Suporta CSV, Excel (.xlsx), PDF e Imagens · até 10 MB</div>
                </div>
                <label className="mt-4 cursor-pointer btn-primary px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white inline-flex items-center gap-1.5">
                  <Icon name="upload" size={13}/>Selecionar arquivo
                  <input type="file" className="hidden" onChange={e=>{ if(e.target.files[0]){ setFileName(e.target.files[0].name); handle(); }}}/>
                </label>
                <div className="flex gap-3 mt-2 text-[11px] text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1"><Icon name="file-text" size={11}/>PDF</span>
                  <span className="inline-flex items-center gap-1"><Icon name="file-spreadsheet" size={11}/>CSV/XLSX</span>
                  <span className="inline-flex items-center gap-1"><Icon name="image" size={11}/>Foto</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[15px] font-semibold">Uploads recentes</div>
            <span className="text-[11.5px] text-[var(--muted)]">{RECENT.length} arquivos</span>
          </div>
          <div className="space-y-1.5">
            {RECENT.map((f,i)=>(
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition-colors">
                <div className="w-9 h-9 rounded-md bg-white/5 grid place-items-center text-[var(--muted)]"><Icon name="file-text" size={14}/></div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate">{f.n}</div>
                  <div className="text-[11px] text-[var(--muted)]">{f.date}</div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-[var(--income-soft)] text-[var(--income)]">Processado</span>
                <button className="text-[11.5px] text-[var(--accent)] hover:underline">Revisar</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─── PROFILE ──────────────────────────────────────────────────────────────────
function ProfilePage({ go }) {
  const [businessName, setBusinessName] = useState("Acme Estúdio");
  const [segment, setSegment] = useState("tecnologia");
  const [days, setDays] = useState(["seg","ter","qua","qui","sex"]);
  const [channel, setChannel] = useState("online");
  const [completion] = useState(70);

  const SEGMENTS = [["varejo","Varejo"],["alimentacao","Alimentação"],["servicos","Serviços"],["tecnologia","Tecnologia"],["educacao","Educação"],["saude","Saúde"],["outro","Outro"]];
  const DAYS = [["seg","Seg"],["ter","Ter"],["qua","Qua"],["qui","Qui"],["sex","Sex"],["sab","Sáb"],["dom","Dom"]];
  const CHANNELS = [["presencial","Presencial"],["online","Online"],["ambos","Presencial + Online"],["delivery","Delivery"],["whatsapp","WhatsApp"]];
  function toggleDay(d){ setDays(prev => prev.includes(d) ? prev.filter(x=>x!==d) : [...prev,d]); }

  return (
    <AppShell path="/profile" go={go} title="Perfil">
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Perfil do negócio</h1>
          <p className="text-[13px] text-[var(--muted)] mt-1">Essas informações melhoram a leitura dos seus arquivos e os insights gerados.</p>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon name="check-circle-2" size={14} className="text-[var(--accent)]"/>
              <span className="text-[13.5px] font-semibold text-white">Perfil {completion}% completo</span>
            </div>
            <span className="text-[11.5px] text-[var(--muted)]">Complete para melhores insights</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: completion+"%", background:"linear-gradient(90deg,var(--accent),var(--accent-2))"}}/>
          </div>
        </div>

        <Section title="Dados da conta">
          <Field label="Nome"><input defaultValue="Luana Moraes" className="field"/></Field>
          <Field label="Email"><input disabled defaultValue="luana@acme.co" className="field opacity-60"/></Field>
        </Section>

        <Section title="Identidade do negócio">
          <Field label="Nome do negócio"><input value={businessName} onChange={e=>setBusinessName(e.target.value)} className="field"/></Field>
          <Field label="Segmento">
            <div className="flex flex-wrap gap-2">
              {SEGMENTS.map(([k,l])=>(
                <button key={k} onClick={()=>setSegment(segment===k?"":k)} className={`chip ${segment===k?"chip-on":""}`}>{l}</button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estado"><select className="field"><option>SP — São Paulo</option><option>RJ — Rio de Janeiro</option><option>MG — Minas Gerais</option></select></Field>
            <Field label="Cidade"><select className="field"><option>São Paulo</option><option>Campinas</option><option>Santos</option></select></Field>
          </div>
        </Section>

        <Section title="Operação">
          <Field label="Funcionários (aprox.)"><input type="number" defaultValue="4" className="field w-32"/></Field>
          <Field label="Dias de funcionamento">
            <div className="flex flex-wrap gap-2">
              {DAYS.map(([k,l])=>(
                <button key={k} onClick={()=>toggleDay(k)} className={`chip ${days.includes(k)?"chip-on":""}`}>{l}</button>
              ))}
            </div>
          </Field>
          <Field label="Canal de vendas">
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map(([k,l])=>(
                <button key={k} onClick={()=>setChannel(channel===k?"":k)} className={`chip ${channel===k?"chip-on":""}`}>{l}</button>
              ))}
            </div>
          </Field>
        </Section>

        <Section title="Metas & Desafios">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Meta de receita mensal (R$)"><input defaultValue="20000" className="field"/></Field>
            <Field label="Meta de margem de lucro (%)"><input defaultValue="25" className="field"/></Field>
          </div>
          <Field label="Maior desafio do negócio">
            <textarea rows={3} defaultValue="Controle de fluxo de caixa e previsão de receita." className="field resize-none"/>
          </Field>
        </Section>

        <div className="flex items-center gap-3">
          <button className="btn-primary px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white">Salvar perfil</button>
          <span className="text-[12px] text-[var(--muted)] hidden sm:inline">Salvo automaticamente ao editar</span>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 text-[10.5px] uppercase tracking-[0.14em] text-[var(--muted)] font-semibold border-b border-[var(--border)]">Conta</div>
          <button className="flex w-full items-center gap-3 px-4 py-3 text-[13px] text-white hover:bg-white/[0.03] transition-colors border-b border-[var(--border)]">
            <Icon name="lock" size={14} className="text-[var(--muted)]"/>Alterar senha
          </button>
          <button className="flex w-full items-center gap-3 px-4 py-3 text-[13px] text-[var(--expense)] hover:bg-[var(--expense-soft)] transition-colors">
            <Icon name="trash-2" size={14}/>Excluir conta
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-[13.5px] font-semibold text-white mb-4">{title}</div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ─── NOT FOUND ────────────────────────────────────────────────────────────────
function NotFoundPage({ go }) {
  return (
    <div className="min-h-screen bg-ambient grid place-items-center p-6">
      <div className="text-center max-w-md">
        <div className="text-[72px] font-bold text-[var(--accent)] leading-none tnum">404</div>
        <div className="text-[18px] font-semibold text-white mt-2">Página não encontrada</div>
        <p className="text-[13px] text-[var(--muted)] mt-2">A rota que você procura não existe ou foi movida.</p>
        <button onClick={()=>go("/dashboard")} className="btn-primary mt-6 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-white inline-flex items-center gap-1.5">
          <Icon name="home" size={13}/>Voltar ao dashboard
        </button>
      </div>
    </div>
  );
}

// ─── Route switcher + Route nav + Tweaks ──────────────────────────────────────
function RouteBar({ path, go }) {
  const routes = [
    ["/home","Home"], ["/login","Login"], ["/signup","Signup"],
    ["/dashboard","Dashboard"], ["/transactions","Transações"],
    ["/insights","Insights"], ["/chat","Chat"], ["/upload","Upload"],
    ["/profile","Perfil"], ["/notfound","404"],
  ];
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] flex flex-wrap justify-center gap-1 p-1.5 rounded-full tweak-panel max-w-[90vw]">
      {routes.map(([p,l])=>(
        <button key={p} onClick={()=>go(p)}
          className={`px-2.5 py-1 text-[10.5px] font-semibold rounded-full transition-colors whitespace-nowrap
            ${path===p ? "bg-[var(--accent)] text-white" : "text-[var(--muted)] hover:text-white hover:bg-white/5"}`}>{l}</button>
      ))}
    </div>
  );
}

function TweaksPanel({ tweaks, onChange, onClose }) {
  return (
    <div className="fixed bottom-20 right-5 z-[60] w-[260px] rounded-2xl tweak-panel p-4 fadeUp">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-white text-[13px] font-semibold">
          <Icon name="sliders-horizontal" size={13} className="text-[var(--accent)]"/>Tweaks
        </div>
        <button onClick={onClose} className="text-[var(--muted)] hover:text-white"><Icon name="x" size={13}/></button>
      </div>
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] font-semibold mb-1.5">Cor da marca</div>
        <div className="flex gap-2">
          {ACCENTS.map(a=>(
            <button key={a.key} title={a.label} onClick={()=>onChange("accent", a.key)}
              className={`w-8 h-8 rounded-lg border-2 transition-all ${tweaks.accent===a.key?"border-white scale-105":"border-transparent hover:scale-105"}`}
              style={{ background:a.key }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [path, go] = useHashRoute();
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => { applyAccent(tweaks.accent); }, [tweaks.accent]);
  useEffect(() => {
    function onMsg(e) {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "__activate_edit_mode") setEditMode(true);
      if (e.data.type === "__deactivate_edit_mode") setEditMode(false);
    }
    window.addEventListener("message", onMsg);
    window.parent?.postMessage({ type:"__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);
  function updateTweak(key, val){
    setTweaks(t => ({...t, [key]:val}));
    window.parent?.postMessage({ type:"__edit_mode_set_keys", edits:{[key]:val} }, "*");
  }

  let Page;
  switch(path){
    case "/home":         Page = <HomePage go={go}/>; break;
    case "/login":        Page = <LoginPage go={go}/>; break;
    case "/signup":       Page = <SignupPage go={go}/>; break;
    case "/dashboard":    Page = <DashboardPage go={go}/>; break;
    case "/transactions": Page = <TransactionsPage go={go}/>; break;
    case "/insights":     Page = <InsightsPage go={go}/>; break;
    case "/chat":         Page = <ChatPage go={go}/>; break;
    case "/upload":       Page = <UploadPage go={go}/>; break;
    case "/profile":      Page = <ProfilePage go={go}/>; break;
    default:              Page = <NotFoundPage go={go}/>;
  }

  return (
    <>
      <div key={path} data-screen-label={path}>{Page}</div>
      <RouteBar path={path} go={go}/>
      {editMode && <TweaksPanel tweaks={tweaks} onChange={updateTweak} onClose={()=>setEditMode(false)}/>}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
