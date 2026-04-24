const { useState, useEffect, useRef, useMemo } = React;

// ————————————————————————————————————————
// Icon helper: uses lucide's global createIcons by rendering an <i data-lucide>
// Wraps with React keyed span so re-renders refresh icons.
// ————————————————————————————————————————
function Icon({ name, size = 16, className = "", strokeWidth = 2 }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && window.lucide) {
      ref.current.innerHTML = "";
      const el = document.createElement("i");
      el.setAttribute("data-lucide", name);
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.strokeWidth = String(strokeWidth);
      ref.current.appendChild(el);
      window.lucide.createIcons({ attrs: { width: size, height: size, "stroke-width": strokeWidth }, nameAttr: "data-lucide" });
    }
  }, [name, size, strokeWidth]);
  return <span ref={ref} className={"inline-flex items-center justify-center " + className} style={{ width: size, height: size }} />;
}

// ————————————————————————————————————————
// Brand mark — original glyph (not any company's logo)
// ————————————————————————————————————————
function KlaroMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="kg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#a18bff" />
          <stop offset="1" stopColor="#5b8cff" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#kg)" />
      <path d="M10 8 V24 M10 16 L20 8 M10 16 L22 24" stroke="#0c0c0f" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="23" cy="9" r="2" fill="#10b981" stroke="#0c0c0f" strokeWidth="1.2"/>
    </svg>
  );
}

// ————————————————————————————————————————
// Sidebar
// ————————————————————————————————————————
function Sidebar({ active, onNav, onOpenChat }) {
  const items = [
    { key: "dashboard",    label: "Dashboard",   icon: "layout-dashboard" },
    { key: "transactions", label: "Transações",  icon: "arrow-left-right" },
    { key: "insights",     label: "Insights",    icon: "lightbulb" },
    { key: "chat",         label: "Chat Klaro",  icon: "sparkles", badge: "IA" },
  ];
  const secondary = [
    { key: "uploads", label: "Uploads",  icon: "upload-cloud" },
    { key: "settings", label: "Ajustes", icon: "settings" },
  ];
  return (
    <aside className="hidden md:flex flex-col w-[232px] shrink-0 h-screen sticky top-0 px-4 py-5 border-r border-[var(--border)] bg-[rgba(12,12,15,0.7)] backdrop-blur-xl">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-1.5 mb-7">
        <KlaroMark size={28} />
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-white">Klaro</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">finanças claras</div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex flex-col gap-0.5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]/70 px-2 mb-1.5">Geral</div>
        {items.map((it) => {
          const isActive = active === it.key;
          return (
            <button
              key={it.key}
              onClick={() => {
                if (it.key === "chat") onOpenChat();
                else onNav(it.key);
              }}
              className={`nav-item group flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors
                ${isActive ? "text-white bg-[rgba(124,92,255,0.12)]" : "text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.03)]"} ${isActive ? "active" : ""}`}
            >
              <Icon name={it.icon} size={16} />
              <span className="flex-1 text-left">{it.label}</span>
              {it.badge && (
                <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-gradient-to-br from-[#8a6bff] to-[#5b8cff] text-white">
                  {it.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-6 flex flex-col gap-0.5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]/70 px-2 mb-1.5">Conta</div>
        {secondary.map((it) => (
          <button key={it.key}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--muted)] hover:text-white hover:bg-[rgba(255,255,255,0.03)] transition-colors">
            <Icon name={it.icon} size={16} />
            <span>{it.label}</span>
          </button>
        ))}
      </div>

      {/* Upgrade card */}
      <div className="mt-auto relative overflow-hidden rounded-xl border border-[var(--border-2)] p-3.5 bg-gradient-to-br from-[rgba(124,92,255,0.16)] to-[rgba(91,140,255,0.06)]">
        <div className="absolute -right-8 -top-8 w-24 h-24 rounded-full bg-[rgba(124,92,255,0.3)] blur-2xl"/>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon name="zap" size={13} className="text-[#a18bff]" />
          <span className="text-[10px] uppercase tracking-wider font-bold text-[#a18bff]">Klaro Plus</span>
        </div>
        <div className="text-[12.5px] text-white font-semibold leading-snug">Análises avançadas e metas ilimitadas</div>
        <button className="mt-3 w-full text-[11px] font-semibold py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors">Conhecer</button>
      </div>

      {/* User */}
      <div className="mt-3 flex items-center gap-2.5 px-1 py-1">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c5cff] to-[#5b8cff] grid place-items-center text-[12px] font-bold text-white">LM</div>
        <div className="flex-1 min-w-0 leading-tight">
          <div className="text-[12.5px] font-semibold text-white truncate">Luana Moraes</div>
          <div className="text-[11px] text-[var(--muted)] truncate">luana@acme.co</div>
        </div>
        <button className="text-[var(--muted)] hover:text-white transition-colors"><Icon name="more-horizontal" size={16}/></button>
      </div>
    </aside>
  );
}

// ————————————————————————————————————————
// Top bar (search + quick actions + month)
// ————————————————————————————————————————
function TopBar({ onOpenChat, chatOpen }) {
  return (
    <div className="flex items-center gap-3 px-6 md:px-8 py-4 border-b border-[var(--border)] bg-[rgba(9,9,11,0.5)] backdrop-blur-xl sticky top-0 z-20">
      <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
        <span>Visão geral</span>
        <Icon name="chevron-right" size={13}/>
        <span className="text-white">Dashboard</span>
      </div>
      <div className="flex-1"/>
      {/* Search */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[rgba(255,255,255,0.02)] hover:border-[var(--border-2)] transition-colors w-[280px]">
        <Icon name="search" size={14} className="text-[var(--muted)]"/>
        <input placeholder="Buscar transação, categoria…" className="bg-transparent text-[12.5px] outline-none flex-1 placeholder:text-[var(--muted)] text-white"/>
        <span className="text-[10px] font-mono text-[var(--muted)] border border-[var(--border)] rounded px-1 py-0.5">⌘K</span>
      </div>
      {/* Month */}
      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[12.5px] text-white hover:border-[var(--border-2)] transition-colors">
        <Icon name="calendar" size={13} className="text-[var(--muted)]"/>
        Abril 2026
        <Icon name="chevron-down" size={12} className="text-[var(--muted)]"/>
      </button>
      {/* Notif */}
      <button className="relative w-9 h-9 grid place-items-center rounded-lg border border-[var(--border)] hover:border-[var(--border-2)] transition-colors">
        <Icon name="bell" size={15} className="text-white"/>
        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[var(--income)]"/>
      </button>
      {/* Chat toggle */}
      {!chatOpen && (
        <button onClick={onOpenChat} className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold text-white">
          <Icon name="sparkles" size={13}/>
          Assistente Klaro
        </button>
      )}
    </div>
  );
}

// ————————————————————————————————————————
// Tiny sparkline
// ————————————————————————————————————————
function Sparkline({ points, color = "#10b981", width = 80, height = 28 }) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const d = points.map((p, i) => {
    const x = i * step;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const last = points[points.length - 1];
  const lastX = (points.length - 1) * step;
  const lastY = height - ((last - min) / range) * (height - 4) - 2;
  return (
    <svg className="spark" width={width} height={height} aria-hidden="true">
      <path d={d} stroke={color} strokeWidth="1.5" fill="none"/>
      <circle cx={lastX} cy={lastY} r="2.5" fill={color}/>
    </svg>
  );
}

// ————————————————————————————————————————
// Summary Card
// ————————————————————————————————————————
function SummaryCard({ label, value, delta, icon, tone = "neutral", sparkPoints, sparkColor, sub }) {
  const up = (delta ?? 0) >= 0;
  const deltaGood = (tone === "expense") ? !up : up;
  return (
    <div className="glass rounded-2xl p-4 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[var(--muted)]">{label}</div>
        <div className={`w-8 h-8 rounded-lg grid place-items-center
          ${tone === "income" ? "bg-[var(--income-soft)] text-[var(--income)]" :
            tone === "expense" ? "bg-[var(--expense-soft)] text-[var(--expense)]" :
            tone === "brand" ? "bg-[var(--accent-soft)] text-[#a18bff]" :
            "bg-white/5 text-white/70"}`}>
          <Icon name={icon} size={15}/>
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className={`text-[26px] font-bold tnum tracking-tight leading-none
          ${tone === "income" ? "text-[var(--income)]" : tone === "expense" ? "text-[var(--expense)]" : "text-white"}`}>
          {value}
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        <div className={`flex items-center gap-1 text-[11px] font-semibold
          ${deltaGood ? "text-[var(--income)]" : "text-[var(--expense)]"}`}>
          <Icon name={up ? "trending-up" : "trending-down"} size={12}/>
          <span>{up ? "+" : ""}{delta}%</span>
          <span className="text-[var(--muted)] font-normal ml-1">vs mês anterior</span>
        </div>
        {sparkPoints && <Sparkline points={sparkPoints} color={sparkColor} width={72} height={24}/>}
      </div>
      {sub && <div className="text-[11px] text-[var(--muted)] mt-1">{sub}</div>}
    </div>
  );
}

// ————————————————————————————————————————
// Monthly bar chart — Income vs Expense
// ————————————————————————————————————————
function MonthlyChart() {
  const max = Math.max(...MONTHLY.map(m => Math.max(m.income, m.expense)));
  const [hover, setHover] = useState(null);
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start justify-between mb-1">
        <div>
          <div className="text-[15px] font-semibold text-white">Fluxo Mensal</div>
          <div className="text-[12px] text-[var(--muted)]">Entradas vs. Saídas nos últimos 7 meses</div>
        </div>
        <div className="flex items-center gap-4 text-[11.5px]">
          <div className="flex items-center gap-1.5 text-[var(--muted)]"><span className="w-2 h-2 rounded-full bg-[var(--income)]"/>Entradas</div>
          <div className="flex items-center gap-1.5 text-[var(--muted)]"><span className="w-2 h-2 rounded-full bg-[var(--expense)]"/>Saídas</div>
        </div>
      </div>
      {/* Chart */}
      <div className="mt-5 relative h-[180px] flex items-end gap-3">
        {/* Grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
          {[0,1,2,3].map(i => <div key={i} className="border-t border-dashed border-white/5"/>)}
        </div>
        {MONTHLY.map((m, i) => {
          const ih = (m.income / max) * 100;
          const eh = (m.expense / max) * 100;
          const isHover = hover === i;
          return (
            <div key={m.m} className="flex-1 h-full flex flex-col items-center gap-1.5"
                 onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div className="relative flex-1 w-full flex items-end justify-center gap-1">
                {isHover && (
                  <div className="absolute -top-14 z-10 px-2.5 py-1.5 rounded-md bg-[#1a1a20] border border-[var(--border-2)] text-[11px] whitespace-nowrap shadow-xl">
                    <div className="text-white font-semibold">{m.m}</div>
                    <div className="text-[var(--income)] tnum">+ {BRL0(m.income)}</div>
                    <div className="text-[var(--expense)] tnum">− {BRL0(m.expense)}</div>
                  </div>
                )}
                <div className="bar-income w-[11px] rounded-t-md transition-all" style={{ height: ih + "%" }}/>
                <div className="bar-expense w-[11px] rounded-t-md transition-all" style={{ height: eh + "%" }}/>
              </div>
              <div className={`text-[10.5px] ${isHover ? "text-white" : "text-[var(--muted)]"}`}>{m.m}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ————————————————————————————————————————
// Category donut (simple ring via conic-gradient)
// ————————————————————————————————————————
function CategoryDonut() {
  const total = CATEGORIES.reduce((s,c) => s + c.total, 0);
  let cursor = 0;
  const stops = CATEGORIES.map((c) => {
    const from = (cursor / total) * 360;
    cursor += c.total;
    const to = (cursor / total) * 360;
    return `${c.color} ${from}deg ${to}deg`;
  }).join(", ");
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold text-white">Por Categoria</div>
          <div className="text-[12px] text-[var(--muted)]">Despesas de Abril</div>
        </div>
        <div className="flex gap-1 p-0.5 rounded-md bg-[rgba(255,255,255,0.04)] border border-[var(--border)]">
          <button className="px-2.5 py-1 text-[10.5px] font-semibold rounded-[5px] bg-[var(--accent-soft)] text-white">Saídas</button>
          <button className="px-2.5 py-1 text-[10.5px] font-semibold rounded-[5px] text-[var(--muted)] hover:text-white">Entradas</button>
        </div>
      </div>

      {/* Donut */}
      <div className="relative mx-auto mt-4" style={{ width: 148, height: 148 }}>
        <div
          className="w-full h-full rounded-full"
          style={{
            background: `conic-gradient(${stops})`,
            mask: "radial-gradient(circle, transparent 54px, #000 55px)",
            WebkitMask: "radial-gradient(circle, transparent 54px, #000 55px)",
          }}
        />
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-[9.5px] uppercase tracking-[0.18em] text-[var(--muted)]">Total</div>
            <div className="text-[16px] font-bold text-white tnum leading-tight">{BRL0(total)}</div>
            <div className="text-[10px] text-[var(--muted)] mt-0.5">7 categorias</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 space-y-1.5">
        {CATEGORIES.slice(0,5).map((c) => {
          const pct = Math.round((c.total / total) * 100);
          return (
            <div key={c.name} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }}/>
              <div className="text-[11.5px] text-white/90 flex-1">{c.name}</div>
              <div className="text-[10.5px] text-[var(--muted)] w-8 text-right tnum">{pct}%</div>
              <div className="text-[11.5px] font-medium text-white w-[74px] text-right tnum">{BRL0(c.total)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ————————————————————————————————————————
// Transactions list
// ————————————————————————————————————————
function TransactionsList({ limit = 6 }) {
  const [filter, setFilter] = useState("all");
  const rows = useMemo(() => {
    const base = filter === "all" ? TRANSACTIONS : TRANSACTIONS.filter(t => t.type === filter);
    return base.slice(0, limit);
  }, [filter, limit]);
  const TABS = [
    { k:"all", label:"Todas" },
    { k:"income", label:"Entradas" },
    { k:"expense", label:"Saídas" },
  ];
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[15px] font-semibold text-white">Últimas Transações</div>
          <div className="text-[12px] text-[var(--muted)]">{TRANSACTIONS.length} nos últimos 30 dias</div>
        </div>
        <div className="flex gap-1 p-0.5 rounded-md bg-[rgba(255,255,255,0.04)] border border-[var(--border)]">
          {TABS.map(t => (
            <button key={t.k} onClick={() => setFilter(t.k)}
              className={`px-2.5 py-1 text-[10.5px] font-semibold rounded-[5px] transition-colors
                ${filter === t.k ? "bg-[var(--accent-soft)] text-white" : "text-[var(--muted)] hover:text-white"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 divide-y divide-[var(--border)]">
        {rows.map((t) => {
          const isIn = t.type === "income";
          return (
            <div key={t.id} className="group flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-lg hover:bg-white/[0.025] transition-colors cursor-default">
              <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0
                ${isIn ? "bg-[var(--income-soft)] text-[var(--income)]" : "bg-white/5 text-white/70"}`}>
                <Icon name={t.icon} size={15}/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-white font-medium truncate">{t.desc}</div>
                <div className="text-[11px] text-[var(--muted)] flex items-center gap-1.5">
                  <span>{t.cat}</span>
                  <span>·</span>
                  <span>{t.date}, {t.time}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className={`text-[13.5px] font-semibold tnum ${isIn ? "text-[var(--income)]" : "text-white"}`}>
                  {isIn ? "+ " : "− "}{BRL(Math.abs(t.amount))}
                </div>
                <div className={`w-5 h-5 rounded-full grid place-items-center
                  ${isIn ? "bg-[var(--income-soft)] text-[var(--income)]" : "bg-[var(--expense-soft)] text-[var(--expense)]"}`}>
                  <Icon name={isIn ? "arrow-down" : "arrow-up"} size={11}/>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button className="mt-3 w-full text-[12px] text-[var(--muted)] hover:text-white py-2 rounded-lg border border-[var(--border)] hover:border-[var(--border-2)] transition-colors flex items-center justify-center gap-1.5">
        Ver todas as transações <Icon name="arrow-right" size={12}/>
      </button>
    </div>
  );
}

// ————————————————————————————————————————
// Insights card (compact)
// ————————————————————————————————————————
function InsightsCard() {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon name="lightbulb" size={15} className="text-[#a18bff]"/>
          <div className="text-[15px] font-semibold text-white">Insights Recentes</div>
        </div>
        <button className="text-[11.5px] text-[var(--muted)] hover:text-white flex items-center gap-1">
          Ver todos <Icon name="chevron-right" size={12}/>
        </button>
      </div>
      <div className="space-y-2">
        {INSIGHTS.map(ins => (
          <div key={ins.id} className="p-3 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.015)] hover:border-[var(--border-2)] transition-colors">
            <div className="flex items-start gap-2.5">
              <div className={`w-6 h-6 rounded-md grid place-items-center shrink-0 mt-0.5
                ${ins.tone === "good" ? "bg-[var(--income-soft)] text-[var(--income)]" : "bg-[rgba(245,158,11,0.12)] text-[#f59e0b]"}`}>
                <Icon name={ins.tone === "good" ? "trending-up" : "alert-circle"} size={13}/>
              </div>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-white leading-snug">{ins.title}</div>
                <div className="text-[11.5px] text-[var(--muted)] leading-relaxed mt-0.5">{ins.body}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  Icon, KlaroMark, Sidebar, TopBar, Sparkline,
  SummaryCard, MonthlyChart, CategoryDonut, TransactionsList, InsightsCard,
});
