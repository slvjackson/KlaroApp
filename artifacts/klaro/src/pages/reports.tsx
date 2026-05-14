import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useRequireAuth } from "@/hooks/use-auth";
import { Layout } from "@/components/layout";
import {
  useGetDashboardSummary,
  useGetMonthlyTrend,
  useListTransactions,
  useGetMe,
} from "@workspace/api-client-react";
import {
  FileText, Download, FileSpreadsheet, Heart, TrendingUp, ListTree, Receipt,
  X, ChevronRight, Calendar, Printer, Sparkles, History, Trash2, Clock,
  RotateCcw, Pencil,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type Tx = {
  id?: number | string;
  amount: number;
  category: string;
  type: "income" | "expense" | string;
  date: string;
  description?: string;
};

interface HealthScore {
  score: number;
  components: Record<string, { value: number; max: number; label: string }>;
}

type Period = {
  kind: "this-month" | "last-month" | "last-3" | "last-6" | "year" | "custom";
  from: string; // YYYY-MM-DD
  to: string;
};

type ReportHistoryEntry = {
  id: string;
  template: string;
  templateLabel: string;
  period: Period;
  generatedAt: string;
  sections: string[];
  format: "pdf" | "csv";
};

// ─── Constants ──────────────────────────────────────────────────────────────

const HISTORY_KEY = "klaro:reports:history";

const TEMPLATES = [
  {
    id: "saude",
    label: "Resumo da Saúde Financeira",
    blurb: "Saldo, receitas, despesas, score de saúde e top categorias do período.",
    icon: Heart,
    available: true,
    primaryFormat: "pdf" as const,
  },
  {
    id: "fluxo",
    label: "Fluxo de Caixa",
    blurb: "Entradas e saídas diárias, evolução acumulada e fechamento por semana.",
    icon: TrendingUp,
    available: true,
    primaryFormat: "pdf" as const,
  },
  {
    id: "categorias",
    label: "Análise por Categoria",
    blurb: "Tendência por categoria, % do total e variação vs período anterior.",
    icon: ListTree,
    available: true,
    primaryFormat: "pdf" as const,
  },
  {
    id: "contabil",
    label: "Listagem Contábil",
    blurb: "Exportação detalhada de transações para enviar ao contador.",
    icon: Receipt,
    available: true,
    primaryFormat: "csv" as const,
  },
] as const;

const SECTIONS = [
  { id: "verdict",       label: "Veredito da saúde (gauge + leitura narrada)" },
  { id: "kpis",          label: "KPIs do período (saldo, entradas, saídas)" },
  { id: "health",        label: "Componentes do score de saúde" },
  { id: "monthly",       label: "Evolução mensal (barras)" },
  { id: "flowSummary",   label: "Resumo do fluxo (abertura → fechamento)" },
  { id: "highlights",    label: "Destaques do período (maior entrada/saída, melhor/pior dia)" },
  { id: "dailyFlow",     label: "Fluxo diário acumulado" },
  { id: "weeklyFlow",    label: "Fechamento semanal" },
  { id: "topMovers",     label: "Maiores variações (top 3 categorias que mais mudaram)" },
  { id: "topExpense",    label: "Top categorias de despesa" },
  { id: "topIncome",     label: "Top categorias de receita" },
  { id: "categoryTrend", label: "Tendência por categoria (top 5 ao longo do tempo)" },
  { id: "categoryDelta", label: "Variação por categoria vs período anterior" },
  { id: "ledgerCover",   label: "Capa contábil (cabeçalho formal)" },
  { id: "ledgerSummary", label: "Resumo contábil (créditos × débitos)" },
  { id: "txs",           label: "Listagem detalhada de transações" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const TEMPLATE_SECTIONS: Record<string, SectionId[]> = {
  // Executivo: veredito + score + categorias. Para banco/sócio.
  saude:      ["verdict", "kpis", "health", "monthly", "topExpense", "topIncome"],
  // Operacional/temporal: resumo de saldo + destaques + curvas diárias e semanais.
  fluxo:      ["flowSummary", "highlights", "dailyFlow", "weeklyFlow"],
  // Analítico/comparativo: o que mais mudou + tendência + delta detalhado.
  categorias: ["topMovers", "categoryTrend", "categoryDelta", "topExpense", "topIncome"],
  // Formal/exaustivo: capa contábil + resumo crédito/débito + listagem completa.
  contabil:   ["ledgerCover", "ledgerSummary", "txs"],
};

const TEMPLATE_AVAILABLE_SECTIONS: Record<string, SectionId[]> = {
  saude:      ["verdict", "kpis", "health", "monthly", "topExpense", "topIncome", "categoryDelta", "txs"],
  fluxo:      ["flowSummary", "highlights", "dailyFlow", "weeklyFlow", "monthly", "kpis", "txs"],
  categorias: ["topMovers", "categoryTrend", "categoryDelta", "topExpense", "topIncome", "monthly", "kpis", "txs"],
  contabil:   ["ledgerCover", "ledgerSummary", "kpis", "txs"],
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function brl0(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}
function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR");
}
function fmtMonth(val: string) {
  const M = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [y, m] = val.split("-");
  return `${M[parseInt(m, 10) - 1] ?? val}/${y}`;
}
function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function periodLabel(p: Period): string {
  switch (p.kind) {
    case "this-month": return "Mês atual";
    case "last-month": return "Último mês";
    case "last-3":     return "Últimos 3 meses";
    case "last-6":     return "Últimos 6 meses";
    case "year":       return "Ano atual";
    case "custom":     return `${fmtDate(p.from)} → ${fmtDate(p.to)}`;
  }
}
function computePeriod(kind: Period["kind"], from?: string, to?: string): Period {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = (date: Date) => { date.setHours(0,0,0,0); return date; };
  switch (kind) {
    case "this-month":
      return { kind, from: toISO(start(new Date(y, m, 1))),     to: toISO(new Date(y, m + 1, 0)) };
    case "last-month":
      return { kind, from: toISO(start(new Date(y, m - 1, 1))), to: toISO(new Date(y, m, 0)) };
    case "last-3":
      return { kind, from: toISO(start(new Date(y, m - 2, 1))), to: toISO(new Date(y, m + 1, 0)) };
    case "last-6":
      return { kind, from: toISO(start(new Date(y, m - 5, 1))), to: toISO(new Date(y, m + 1, 0)) };
    case "year":
      return { kind, from: toISO(start(new Date(y, 0, 1))),     to: toISO(new Date(y, 11, 31)) };
    case "custom":
      return { kind, from: from || toISO(start(new Date(y, m, 1))), to: to || toISO(new Date(y, m + 1, 0)) };
  }
}

async function fetchHealthScore(): Promise<HealthScore> {
  const res = await fetch("/api/dashboard/health-score", { credentials: "include" });
  if (!res.ok) throw new Error("health-score fetch failed");
  return res.json();
}

function loadHistory(): ReportHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveHistory(list: ReportHistoryEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 30))); } catch { /* no-op */ }
}

function downloadFile(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCsv(v: unknown): string {
  const s = v == null ? "" : String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function slugifyForFile(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function reportFileBase(templateLabel: string, period: Period): string {
  return `klaro-${slugifyForFile(templateLabel)}-${period.from}_a_${period.to}`;
}

// ─── Page ───────────────────────────────────────────────────────────────────

type PreviewSpec = {
  template: string;
  period: Period;
  sections: Set<SectionId>;
};

export default function Reports() {
  const { isLoading: authLoading } = useRequireAuth();
  const [configOpen, setConfigOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<string>("saude");
  const [history, setHistory] = useState<ReportHistoryEntry[]>([]);
  const [preview, setPreview] = useState<PreviewSpec | null>(null);
  const [editEntry, setEditEntry] = useState<ReportHistoryEntry | null>(null);

  useEffect(() => { setHistory(loadHistory()); }, []);

  if (authLoading) return null;

  function openTemplate(id: string) {
    setActiveTemplate(id);
    setConfigOpen(true);
  }

  function startPreview(spec: PreviewSpec) {
    // Close any open configurator FIRST so the preview lifts to page level
    // without sitting inside the configurator's React subtree (event bubbling
    // through the configurator's onClose was unmounting the preview on mobile).
    setConfigOpen(false);
    setEditEntry(null);
    setPreview(spec);
  }

  function openHistoryEntry(entry: ReportHistoryEntry) {
    setPreview({
      template: entry.template,
      period: entry.period,
      sections: new Set(entry.sections as SectionId[]),
    });
  }

  function editHistoryEntry(entry: ReportHistoryEntry) {
    setEditEntry(entry);
  }

  function recordReport(entry: ReportHistoryEntry) {
    const next = [entry, ...history].slice(0, 30);
    setHistory(next);
    saveHistory(next);
  }

  function clearHistory() {
    setHistory([]);
    saveHistory([]);
  }

  function removeHistoryEntry(id: string) {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    saveHistory(next);
  }

  return (
    <Layout title="Relatórios">
      <div className="space-y-6 md:space-y-7">

        {/* ── Hero ───────────────────────────────────── */}
        <section className="glass rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-soft)] grid place-items-center shrink-0">
            <FileText size={22} className="text-[var(--accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-semibold text-white">
              Gere relatórios personalizados em segundos
            </div>
            <div className="text-[12.5px] text-[var(--muted)] mt-1 leading-relaxed">
              Escolha um template, ajuste o período e os blocos que quer incluir. Baixe em PDF para
              apresentar a banco/sócio ou em CSV para enviar ao contador.
            </div>
          </div>
          <button
            onClick={() => openTemplate("saude")}
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-[12.5px] font-semibold text-[#09090b] bg-gradient-to-b from-[#6af82f] to-[#4de020] hover:brightness-110 transition"
          >
            Novo relatório
          </button>
        </section>

        {/* ── Templates ─────────────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <div className="text-[13px] font-semibold text-white">Templates</div>
            <div className="text-[11px] text-[var(--muted)]">Pré-configurados para casos comuns</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => openTemplate(t.id)}
                  className="group text-left glass rounded-2xl p-4 transition-all hover:border-[var(--accent)]/40 hover:-translate-y-0.5 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] grid place-items-center mb-3">
                    <Icon size={16} className="text-[var(--accent)]" />
                  </div>
                  <div className="text-[13.5px] font-semibold text-white leading-snug">{t.label}</div>
                  <div className="text-[11.5px] text-[var(--muted)] mt-1.5 leading-relaxed line-clamp-3">
                    {t.blurb}
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent)] group-hover:gap-2 transition-all">
                    Configurar <ChevronRight size={11} />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Histórico ─────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <History size={14} className="text-[var(--muted)]" />
              <div className="text-[13px] font-semibold text-white">Histórico</div>
              <span className="text-[10.5px] text-[var(--muted)]">({history.length})</span>
            </div>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-[11px] text-[var(--muted)] hover:text-white transition-colors inline-flex items-center gap-1"
              >
                <Trash2 size={11} /> Limpar
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center">
              <div className="text-[12.5px] text-[var(--muted)]">
                Nenhum relatório gerado ainda. Comece pelo <span className="text-white">Resumo da Saúde Financeira</span>.
              </div>
            </div>
          ) : (
            <div className="glass rounded-2xl divide-y divide-[var(--border)] overflow-hidden">
              {history.map((h) => (
                <div key={h.id} className="group flex items-center gap-2 hover:bg-white/[0.02] transition-colors">
                  <button
                    type="button"
                    onClick={() => openHistoryEntry(h)}
                    className="flex-1 flex items-center gap-3 px-4 py-3 text-left min-w-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--accent-soft)] grid place-items-center shrink-0">
                      {h.format === "csv"
                        ? <FileSpreadsheet size={14} className="text-[var(--accent)]" />
                        : <FileText size={14} className="text-[var(--accent)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold text-white truncate">{h.templateLabel}</div>
                      <div className="flex items-center gap-2 text-[10.5px] text-[var(--muted)] mt-0.5">
                        <Clock size={10} />
                        <span>{new Date(h.generatedAt).toLocaleString("pt-BR")}</span>
                        <span>·</span>
                        <span>{periodLabel(h.period)}</span>
                        <span>·</span>
                        <span className="uppercase">{h.format}</span>
                      </div>
                    </div>
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity">
                      <RotateCcw size={11} /> Reabrir
                    </span>
                  </button>
                  <div className="flex items-center gap-0.5 pr-2">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); editHistoryEntry(h); }}
                      className="p-1.5 rounded-md text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors"
                      aria-label="Editar configuração"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeHistoryEntry(h.id); }}
                      className="p-1.5 rounded-md text-[var(--muted)] hover:text-white hover:bg-white/5 transition-colors"
                      aria-label="Remover do histórico"
                      title="Remover"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {configOpen && (
        <ReportConfigurator
          template={activeTemplate}
          onClose={() => setConfigOpen(false)}
          onPreview={startPreview}
        />
      )}

      {preview && (() => {
        const tpl = TEMPLATES.find((t) => t.id === preview.template) ?? TEMPLATES[0];
        return (
          <ReportPreview
            template={tpl.id}
            templateLabel={tpl.label}
            primaryFormat={tpl.primaryFormat}
            period={preview.period}
            sections={preview.sections}
            onClose={() => setPreview(null)}
            onGenerated={recordReport}
          />
        );
      })()}

      {editEntry && (
        <ReportConfigurator
          template={editEntry.template}
          initialPeriod={editEntry.period}
          initialSections={new Set(editEntry.sections as SectionId[])}
          onClose={() => setEditEntry(null)}
          onPreview={startPreview}
        />
      )}
    </Layout>
  );
}

// ─── Configurator (dialog) ──────────────────────────────────────────────────

function ReportConfigurator({
  template,
  initialPeriod,
  initialSections,
  onClose,
  onPreview,
}: {
  template: string;
  initialPeriod?: Period;
  initialSections?: Set<SectionId>;
  onClose: () => void;
  onPreview: (spec: { template: string; period: Period; sections: Set<SectionId> }) => void;
}) {
  const tpl = TEMPLATES.find((t) => t.id === template) ?? TEMPLATES[0];
  const availableIds = TEMPLATE_AVAILABLE_SECTIONS[tpl.id] ?? [];
  const availableSections = SECTIONS.filter((s) => availableIds.includes(s.id));

  const [period, setPeriod] = useState<Period>(() => initialPeriod ?? computePeriod("last-month"));
  const [sections, setSections] = useState<Set<SectionId>>(
    () => initialSections ?? new Set<SectionId>(TEMPLATE_SECTIONS[tpl.id] ?? []),
  );

  function toggleSection(id: SectionId) {
    const next = new Set(sections);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSections(next);
  }

  function setKind(kind: Period["kind"]) {
    setPeriod(computePeriod(kind, period.from, period.to));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full max-w-md h-full overflow-y-auto glass-strong border-l border-[var(--border)] p-6 fadeUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[var(--muted)] mb-1">
              Novo relatório
            </div>
            <div className="text-[16px] font-semibold text-white leading-snug">{tpl.label}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5">
            <X size={14} />
          </button>
        </div>

        {/* Período */}
        <div className="mb-5">
          <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[var(--muted)] mb-2">
            <Calendar size={11} className="inline mr-1 -mt-0.5" /> Período
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {([
              ["this-month", "Mês atual"],
              ["last-month", "Último mês"],
              ["last-3",     "3 meses"],
              ["last-6",     "6 meses"],
              ["year",       "Ano"],
              ["custom",     "Custom"],
            ] as const).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={`px-2 py-1.5 rounded-md text-[11px] font-medium border transition-colors ${
                  period.kind === k
                    ? "bg-[var(--accent-soft)] border-[var(--accent)]/40 text-white"
                    : "bg-white/[0.02] border-[var(--border)] text-[var(--muted)] hover:text-white"
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
          {period.kind === "custom" ? (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={period.from}
                onChange={(e) => setPeriod({ ...period, from: e.target.value })}
                className="field flex-1 px-2.5 py-1.5 rounded-md text-[12px] bg-white/[0.03] border border-[var(--border)] text-white"
              />
              <span className="text-[var(--muted)] text-[11px]">até</span>
              <input
                type="date"
                value={period.to}
                onChange={(e) => setPeriod({ ...period, to: e.target.value })}
                className="field flex-1 px-2.5 py-1.5 rounded-md text-[12px] bg-white/[0.03] border border-[var(--border)] text-white"
              />
            </div>
          ) : (
            <div className="text-[11px] text-[var(--muted)]">
              {fmtDate(period.from)} → {fmtDate(period.to)}
            </div>
          )}
        </div>

        {/* Seções */}
        <div className="mb-5">
          <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[var(--muted)] mb-2">
            Blocos do relatório
          </div>
          <div className="space-y-1.5">
            {availableSections.map((s) => {
              const checked = sections.has(s.id);
              return (
                <label
                  key={s.id}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                    checked
                      ? "bg-[var(--accent-soft)]/40 border-[var(--accent)]/30"
                      : "bg-white/[0.02] border-[var(--border)] hover:border-white/20"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSection(s.id)}
                    className="accent-[var(--accent)] w-3.5 h-3.5"
                  />
                  <span className="text-[12px] text-white/90">{s.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => onPreview({ template: tpl.id, period, sections })}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[12.5px] font-semibold text-[#09090b] bg-gradient-to-b from-[#6af82f] to-[#4de020] hover:brightness-110 transition mb-2"
        >
          <FileText size={14} />
          Gerar pré-visualização
        </button>
        <div className="text-[10.5px] text-[var(--muted)] text-center leading-relaxed">
          A pré-visualização abre em tela cheia. De lá você baixa em PDF ou CSV.
        </div>
      </div>
    </div>
  );
}

// ─── Preview + Render ───────────────────────────────────────────────────────

function ReportPreview({
  template,
  templateLabel,
  primaryFormat,
  period,
  sections,
  onClose,
  onGenerated,
}: {
  template: string;
  templateLabel: string;
  primaryFormat: "pdf" | "csv";
  period: Period;
  sections: Set<SectionId>;
  onClose: () => void;
  onGenerated: (entry: ReportHistoryEntry) => void;
}) {
  const { data: me } = useGetMe();
  const { data: summary } = useGetDashboardSummary();
  const { data: monthlyTrend } = useGetMonthlyTrend();
  const { data: allTx } = useListTransactions({ limit: 5000 });
  const { data: health } = useQuery<HealthScore>({
    queryKey: ["/dashboard/health-score"],
    queryFn: fetchHealthScore,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });

  const txList = useMemo<Tx[]>(() => {
    const arr = (allTx ?? []) as Tx[];
    return arr.filter((t) => t.date >= period.from && t.date <= period.to);
  }, [allTx, period]);

  const totals = useMemo(() => {
    let income = 0, expenses = 0;
    for (const t of txList) {
      if (t.type === "income") income += t.amount;
      else if (t.type === "expense") expenses += t.amount;
    }
    return { income, expenses, balance: income - expenses, count: txList.length };
  }, [txList]);

  const monthly = useMemo(() => {
    const arr = (monthlyTrend ?? []) as { month: string; income: number; expenses: number }[];
    return arr.filter((m) => {
      const monthStart = m.month + "-01";
      const monthEnd = m.month + "-31";
      return monthEnd >= period.from && monthStart <= period.to;
    });
  }, [monthlyTrend, period]);

  const topExpense = useMemo(() => groupByCategory(txList, "expense").slice(0, 8), [txList]);
  const topIncome  = useMemo(() => groupByCategory(txList, "income").slice(0, 8),  [txList]);

  // Opening balance: net of all transactions before period.from
  const openingBalance = useMemo(() => {
    const arr = (allTx ?? []) as Tx[];
    let bal = 0;
    for (const t of arr) {
      if (t.date < period.from) {
        if (t.type === "income") bal += t.amount;
        else if (t.type === "expense") bal -= t.amount;
      }
    }
    return bal;
  }, [allTx, period.from]);

  const closingBalance = openingBalance + totals.balance;

  // Daily flow: every day in period, with in/out/net/cumulative
  const dailyFlow = useMemo(() => buildDailyFlow(txList, period, openingBalance), [txList, period, openingBalance]);

  // Weekly buckets
  const weeklyFlow = useMemo(() => bucketByWeek(dailyFlow), [dailyFlow]);

  // Category trend: top 5 expense categories across months in period
  const categoryTrend = useMemo(() => buildCategoryTrend(txList, period), [txList, period]);

  // Delta vs previous period of same length
  const prevPeriodTx = useMemo(() => {
    const arr = (allTx ?? []) as Tx[];
    const days = Math.max(1, Math.round((Date.parse(period.to) - Date.parse(period.from)) / 86400000) + 1);
    const prevTo = shiftISO(period.from, -1);
    const prevFrom = shiftISO(prevTo, -(days - 1));
    return { from: prevFrom, to: prevTo, list: arr.filter((t) => t.date >= prevFrom && t.date <= prevTo) };
  }, [allTx, period]);

  const categoryDelta = useMemo(() => {
    const currExp = mapByCategory(txList, "expense");
    const prevExp = mapByCategory(prevPeriodTx.list, "expense");
    const keys = new Set([...currExp.keys(), ...prevExp.keys()]);
    const rows = [...keys].map((k) => {
      const curr = currExp.get(k) ?? 0;
      const prev = prevExp.get(k) ?? 0;
      const delta = curr - prev;
      const pct = prev > 0 ? (delta / prev) * 100 : (curr > 0 ? 100 : 0);
      return { category: k, curr, prev, delta, pct };
    });
    rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return rows.slice(0, 8);
  }, [txList, prevPeriodTx]);

  // ─── Template-specific computed data ──────────────────────────────────────

  // Saúde: a 1-line verdict drawn from the score + balance behavior of the period.
  const verdict = useMemo(() => buildVerdict(health?.score ?? 0, totals, monthly), [health, totals, monthly]);

  // Fluxo: standout single-events of the period.
  const highlights = useMemo(() => buildHighlights(txList, dailyFlow), [txList, dailyFlow]);

  // Categorias: top movers = first 3 of the delta table where |delta| > 0.
  const topMovers = useMemo(() => categoryDelta.filter((r) => r.delta !== 0).slice(0, 3), [categoryDelta]);

  // Contábil: category-grouped credit/debit summary with transaction counts.
  const ledgerSummary = useMemo(() => buildLedgerSummary(txList), [txList]);

  const businessName = (me as { businessProfile?: { businessName?: string } } | undefined)?.businessProfile?.businessName
    ?? me?.name
    ?? "—";

  function handlePrint() {
    // Browser uses document.title as the default save-as-PDF filename.
    // On mobile (iOS share-sheet flow) the filename is captured *after* the user
    // interacts with the dialog, which can take many seconds. Don't schedule a
    // timeout to restore — let the unmount cleanup (below) put the title back
    // when the preview is closed.
    document.title = reportFileBase(templateLabel, period);
    window.print();
    onGenerated({
      id: crypto.randomUUID(),
      template,
      templateLabel,
      period,
      sections: Array.from(sections),
      generatedAt: new Date().toISOString(),
      format: "pdf",
    });
  }

  function handleCsv() {
    const header = ["Data", "Tipo", "Categoria", "Descrição", "Valor"];
    const rows = txList.map((t) => [
      t.date,
      t.type === "income" ? "Receita" : t.type === "expense" ? "Despesa" : t.type,
      t.category,
      t.description ?? "",
      t.type === "expense" ? -t.amount : t.amount,
    ]);
    const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(";")).join("\n");
    const fname = `${reportFileBase(templateLabel, period)}.csv`;
    downloadFile(fname, "﻿" + csv, "text/csv");
    onGenerated({
      id: crypto.randomUUID(),
      template,
      templateLabel,
      period,
      sections: Array.from(sections),
      generatedAt: new Date().toISOString(),
      format: "csv",
    });
  }

  // Close on Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Capture the original title once when the preview opens; restore on close.
  // This guards against mobile flows where afterprint never fires or the title
  // would otherwise leak to the rest of the app.
  useEffect(() => {
    const originalTitle = document.title;
    return () => { document.title = originalTitle; };
  }, []);

  return createPortal(
    <div className="report-preview-root fixed inset-0 z-[60] flex flex-col bg-[#09090b]">
      {/* Toolbar (hidden in print) */}
      <div className="no-print flex items-center gap-3 px-4 md:px-6 py-3 border-b border-[var(--border)] bg-[rgba(9,9,11,0.96)]">
        <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5">
          <X size={14} />
        </button>
        <div className="text-[12.5px] font-semibold text-white truncate">{templateLabel}</div>
        <div className="text-[11px] text-[var(--muted)] hidden sm:inline">· {periodLabel(period)}</div>
        <div className="flex-1" />
        <button
          onClick={handleCsv}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] transition ${
            primaryFormat === "csv"
              ? "font-semibold text-[#09090b] bg-gradient-to-b from-[#6af82f] to-[#4de020] hover:brightness-110"
              : "font-medium text-white/90 bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--border)]"
          }`}
        >
          <FileSpreadsheet size={13} /> {primaryFormat === "csv" ? "Baixar CSV" : "CSV"}
        </button>
        <button
          onClick={handlePrint}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] transition ${
            primaryFormat === "pdf"
              ? "font-semibold text-[#09090b] bg-gradient-to-b from-[#6af82f] to-[#4de020] hover:brightness-110"
              : "font-medium text-white/90 bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--border)]"
          }`}
        >
          <Printer size={13} /> {primaryFormat === "pdf" ? "Baixar PDF" : "PDF"}
        </button>
      </div>

      {/* Printable area */}
      <div className="flex-1 overflow-y-auto klaro-scroll">
        <div className="report-page mx-auto my-6 max-w-[820px] bg-white text-[#0c0c0f] shadow-2xl">
          <div className="px-8 py-8">
            {/* Header */}
            <div className="flex items-start justify-between pb-5 border-b border-black/10">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#6af82f]">Klaro · Relatório</div>
                <div className="text-[22px] font-bold mt-1">{templateLabel}</div>
                <div className="text-[12px] text-black/60 mt-1">{businessName}</div>
              </div>
              <div className="text-right text-[11px] text-black/60 leading-snug">
                <div><b className="text-black">Período</b></div>
                <div>{fmtDate(period.from)} → {fmtDate(period.to)}</div>
                <div className="mt-2"><b className="text-black">Emitido em</b></div>
                <div>{new Date().toLocaleDateString("pt-BR")}</div>
              </div>
            </div>

            {/* Verdict hero (Saúde) */}
            {sections.has("verdict") && (
              <VerdictHero score={health?.score ?? 0} verdict={verdict} />
            )}

            {/* Ledger cover (Contábil) */}
            {sections.has("ledgerCover") && (
              <LedgerCover businessName={businessName} period={period} txCount={totals.count} />
            )}

            {/* Ledger summary (Contábil) */}
            {sections.has("ledgerSummary") && (
              <div className="mt-5">
                <SectionTitle>Resumo contábil</SectionTitle>
                <LedgerSummary data={ledgerSummary} />
              </div>
            )}

            {/* Top movers (Categorias) */}
            {sections.has("topMovers") && (
              <div className="mt-5">
                <SectionTitle>Maiores variações vs período anterior</SectionTitle>
                <TopMoversBoard rows={topMovers} />
              </div>
            )}

            {/* Highlights (Fluxo) */}
            {sections.has("highlights") && (
              <div className="mt-5">
                <SectionTitle>Destaques do período</SectionTitle>
                <HighlightsBoard data={highlights} />
              </div>
            )}

            {/* KPIs */}
            {sections.has("kpis") && (
              <div className="mt-5">
                <SectionTitle>Visão geral</SectionTitle>
                <div className="grid grid-cols-4 gap-3 mt-3">
                  <Kpi label="Saldo líquido" value={brl(totals.balance)} accent={totals.balance >= 0 ? "pos" : "neg"} />
                  <Kpi label="Entradas" value={brl0(totals.income)} accent="pos" />
                  <Kpi label="Saídas" value={brl0(totals.expenses)} accent="neg" />
                  <Kpi label="Transações" value={String(totals.count)} />
                </div>
                <div className="mt-3 text-[11px] text-black/60">
                  Saldo do período vs total geral: {brl0(summary?.netBalance ?? 0)} acumulado em todas as transações registradas.
                </div>
              </div>
            )}

            {/* Health */}
            {sections.has("health") && (
              <div className="mt-5">
                <SectionTitle>Saúde da gestão</SectionTitle>
                <div className="mt-3 grid grid-cols-[180px_1fr] gap-5 items-center">
                  <PrintGauge score={health?.score ?? 0} />
                  <div className="space-y-1.5">
                    {health
                      ? Object.entries(health.components).map(([k, c]) => (
                          <ComponentBar key={k} label={c.label} value={c.value} max={c.max} />
                        ))
                      : <div className="text-[11px] text-black/50">Carregando componentes do score…</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Flow summary */}
            {sections.has("flowSummary") && (
              <div className="mt-5 break-inside-avoid">
                <SectionTitle>Resumo do fluxo</SectionTitle>
                <div className="grid grid-cols-4 gap-3 mt-3">
                  <Kpi label="Saldo inicial" value={brl0(openingBalance)} accent={openingBalance >= 0 ? "pos" : "neg"} />
                  <Kpi label="Entradas" value={brl0(totals.income)} accent="pos" />
                  <Kpi label="Saídas" value={brl0(totals.expenses)} accent="neg" />
                  <Kpi label="Saldo final" value={brl0(closingBalance)} accent={closingBalance >= 0 ? "pos" : "neg"} />
                </div>
                <div className="mt-3 text-[11px] text-black/60">
                  Resultado do período: <b className={totals.balance >= 0 ? "text-[#0f7a3f]" : "text-[#b3151d]"}>
                    {totals.balance >= 0 ? "+" : ""}{brl0(totals.balance)}
                  </b>
                  {openingBalance !== 0 && (
                    <> · Variação do saldo: {((closingBalance - openingBalance) / Math.abs(openingBalance || 1) * 100).toFixed(1)}%</>
                  )}
                </div>
              </div>
            )}

            {/* Daily flow */}
            {sections.has("dailyFlow") && dailyFlow.length > 0 && (
              <div className="mt-5 break-inside-avoid">
                <SectionTitle>Fluxo diário acumulado</SectionTitle>
                <DailyFlowChart points={dailyFlow} />
              </div>
            )}

            {/* Weekly flow */}
            {sections.has("weeklyFlow") && weeklyFlow.length > 0 && (
              <div className="mt-5 break-inside-avoid">
                <SectionTitle>Fechamento semanal</SectionTitle>
                <WeeklyFlowTable rows={weeklyFlow} />
              </div>
            )}

            {/* Monthly */}
            {sections.has("monthly") && monthly.length > 0 && (
              <div className="mt-5 break-inside-avoid">
                <SectionTitle>Evolução mensal</SectionTitle>
                <MonthlyChartPrint data={monthly} />
              </div>
            )}

            {/* Category trend */}
            {sections.has("categoryTrend") && categoryTrend.months.length > 1 && categoryTrend.series.length > 0 && (
              <div className="mt-5 break-inside-avoid">
                <SectionTitle>Tendência por categoria (top 5 despesas)</SectionTitle>
                <CategoryTrendChart data={categoryTrend} />
              </div>
            )}

            {/* Category delta */}
            {sections.has("categoryDelta") && categoryDelta.length > 0 && (
              <div className="mt-5 break-inside-avoid">
                <SectionTitle>Variação vs período anterior ({fmtDate(prevPeriodTx.from)} → {fmtDate(prevPeriodTx.to)})</SectionTitle>
                <CategoryDeltaTable rows={categoryDelta} />
              </div>
            )}

            {/* Categorias */}
            {(sections.has("topExpense") || sections.has("topIncome")) && (
              <div className="mt-5 grid grid-cols-2 gap-6 break-inside-avoid">
                {sections.has("topExpense") && (
                  <div>
                    <SectionTitle>Top despesas</SectionTitle>
                    <CategoryList rows={topExpense} totalRef={totals.expenses} tone="neg" />
                  </div>
                )}
                {sections.has("topIncome") && (
                  <div>
                    <SectionTitle>Top receitas</SectionTitle>
                    <CategoryList rows={topIncome} totalRef={totals.income} tone="pos" />
                  </div>
                )}
              </div>
            )}

            {/* Transações */}
            {sections.has("txs") && (
              <div className="mt-5">
                <SectionTitle>Transações ({txList.length})</SectionTitle>
                <table className="w-full mt-2 text-[11px] border-collapse">
                  <thead>
                    <tr className="text-left text-black/60">
                      <th className="py-1.5 pr-2 font-semibold border-b border-black/10">Data</th>
                      <th className="py-1.5 pr-2 font-semibold border-b border-black/10">Tipo</th>
                      <th className="py-1.5 pr-2 font-semibold border-b border-black/10">Categoria</th>
                      <th className="py-1.5 pr-2 font-semibold border-b border-black/10">Descrição</th>
                      <th className="py-1.5 pl-2 font-semibold border-b border-black/10 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txList.map((t, i) => (
                      <tr key={t.id ?? i} className="border-b border-black/5">
                        <td className="py-1 pr-2 tnum">{fmtDate(t.date)}</td>
                        <td className="py-1 pr-2">{t.type === "income" ? "Receita" : "Despesa"}</td>
                        <td className="py-1 pr-2">{t.category}</td>
                        <td className="py-1 pr-2 truncate max-w-[260px]">{t.description ?? "—"}</td>
                        <td className={`py-1 pl-2 tnum text-right ${t.type === "expense" ? "text-[#d11919]" : "text-[#138a4a]"}`}>
                          {t.type === "expense" ? "-" : ""}{brl0(t.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="mt-10 pt-4 border-t border-black/10 flex items-center justify-between text-[10px] text-black/50">
              <span>Gerado por Klaro · gestão financeira inteligente</span>
              <span>{new Date().toLocaleString("pt-BR")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── Print subcomponents ────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-black/70 border-b border-black/10 pb-1">
      {children}
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "pos" | "neg" }) {
  const color = accent === "pos" ? "text-[#0f7a3f]" : accent === "neg" ? "text-[#b3151d]" : "text-black";
  return (
    <div className="rounded-lg border border-black/10 p-2.5 min-w-0">
      <div className="text-[9px] uppercase tracking-[0.1em] font-bold text-black/55 mb-1 whitespace-nowrap overflow-hidden text-ellipsis">{label}</div>
      <div className={`text-[15px] font-bold tnum ${color} whitespace-nowrap overflow-hidden text-ellipsis`}>{value}</div>
    </div>
  );
}

function ComponentBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="text-[10.5px] text-black/70 w-44 truncate">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
        <div className="h-full bg-[#6af82f]" style={{ width: pct + "%" }} />
      </div>
      <div className="text-[10.5px] tnum w-12 text-right text-black/70">{value}/{max}</div>
    </div>
  );
}

function PrintGauge({ score }: { score: number }) {
  const R = 60, CX = 80, CY = 80;
  const CIRC = 2 * Math.PI * R;
  const ARC = (270 / 360) * CIRC;
  const GAP = CIRC - ARC;
  const filled = Math.max(0, Math.min(1, score / 100)) * ARC;
  const color = score >= 71 ? "#138a4a" : score >= 41 ? "#7c52e6" : "#d11919";
  const label = score >= 80 ? "Excelente" : score >= 60 ? "Bom" : score >= 40 ? "Regular" : "Atenção";
  return (
    <svg width="160" height="160" viewBox="0 0 160 160">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={12} strokeDasharray={`${ARC} ${GAP}`} strokeLinecap="round" transform={`rotate(-135 ${CX} ${CY})`} />
      {filled > 0 && (
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth={12} strokeDasharray={`${filled} ${CIRC - filled}`} strokeLinecap="round" transform={`rotate(-135 ${CX} ${CY})`} />
      )}
      <text x={CX} y={CY - 4} textAnchor="middle" fill="#0c0c0f" fontSize="32" fontWeight="700">{score}</text>
      <text x={CX} y={CY + 16} textAnchor="middle" fill={color} fontSize="11" fontWeight="700" letterSpacing="1">{label.toUpperCase()}</text>
    </svg>
  );
}

function MonthlyChartPrint({ data }: { data: { month: string; income: number; expenses: number }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expenses]));
  // Shorter chart when there are few months — avoids the giant-bar look on single-month periods.
  const H = data.length <= 2 ? 130 : 180;
  const W = 700, P = 28;
  const slot = (W - P * 2) / Math.max(1, data.length);
  // Cap the bar width so a single month doesn't fill the whole canvas.
  const bw = Math.min(40, slot / 2.4);
  // Center the columns when there are few months.
  const colsWidth = slot * data.length;
  const offsetX = data.length < 4 ? (W - P * 2 - colsWidth) / 2 : 0;
  return (
    <div className="mt-3 overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />
        {data.map((d, i) => {
          const cx = P + offsetX + slot * (i + 0.5);
          const inH = ((d.income / max) * (H - P * 2));
          const exH = ((d.expenses / max) * (H - P * 2));
          return (
            <g key={d.month}>
              <rect x={cx - bw - 1} y={H - P - inH} width={bw} height={inH} fill="#138a4a" rx={2} />
              <rect x={cx + 1}     y={H - P - exH} width={bw} height={exH} fill="#d11919" rx={2} />
              <text x={cx} y={H - P + 12} textAnchor="middle" fontSize="9" fill="rgba(0,0,0,0.55)" fontWeight="600">
                {fmtMonth(d.month)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4 mt-1 text-[10px] text-black/60">
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#138a4a]" /> Receitas</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#d11919]" /> Despesas</span>
      </div>
    </div>
  );
}

function CategoryList({ rows, totalRef, tone }: { rows: { category: string; total: number }[]; totalRef: number; tone: "pos" | "neg" }) {
  const color = tone === "pos" ? "#138a4a" : "#d11919";
  if (rows.length === 0) {
    return <div className="text-[11px] text-black/50 mt-2">Sem dados no período.</div>;
  }
  return (
    <div className="space-y-1.5 mt-2">
      {rows.map((r) => {
        const pct = totalRef > 0 ? Math.round((r.total / totalRef) * 100) : 0;
        return (
          <div key={r.category}>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-black/85 truncate pr-2">{r.category}</span>
              <span className="tnum text-black/85 font-medium">{brl0(r.total)} <span className="text-black/50">({pct}%)</span></span>
            </div>
            <div className="h-1.5 rounded-full bg-black/10 overflow-hidden mt-0.5">
              <div className="h-full" style={{ width: pct + "%", background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function groupByCategory(txs: Tx[], type: "income" | "expense") {
  const map = mapByCategory(txs, type);
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

function mapByCategory(txs: Tx[], type: "income" | "expense"): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type === type) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return map;
}

// ─── Flow helpers ───────────────────────────────────────────────────────────

type DailyPoint = { date: string; in: number; out: number; net: number; cumulative: number };

function shiftISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function buildDailyFlow(txs: Tx[], period: Period, opening: number): DailyPoint[] {
  const byDate = new Map<string, { in: number; out: number }>();
  for (const t of txs) {
    const cell = byDate.get(t.date) ?? { in: 0, out: 0 };
    if (t.type === "income") cell.in += t.amount;
    else if (t.type === "expense") cell.out += t.amount;
    byDate.set(t.date, cell);
  }
  const points: DailyPoint[] = [];
  let cumulative = opening;
  let cursor = period.from;
  const end = period.to;
  let safety = 0;
  while (cursor <= end && safety < 4000) {
    const cell = byDate.get(cursor) ?? { in: 0, out: 0 };
    const net = cell.in - cell.out;
    cumulative += net;
    points.push({ date: cursor, in: cell.in, out: cell.out, net, cumulative });
    cursor = shiftISO(cursor, 1);
    safety++;
  }
  return points;
}

function bucketByWeek(daily: DailyPoint[]): { weekStart: string; weekEnd: string; in: number; out: number; net: number; closing: number }[] {
  if (daily.length === 0) return [];
  const out: { weekStart: string; weekEnd: string; in: number; out: number; net: number; closing: number }[] = [];
  let bucket: typeof out[number] | null = null;
  for (const p of daily) {
    const d = new Date(p.date + "T00:00:00");
    const dow = d.getDay(); // 0 = Sun
    if (!bucket || dow === 1 /* Monday */) {
      if (bucket) out.push(bucket);
      bucket = { weekStart: p.date, weekEnd: p.date, in: 0, out: 0, net: 0, closing: p.cumulative };
    }
    bucket.weekEnd = p.date;
    bucket.in += p.in;
    bucket.out += p.out;
    bucket.net += p.net;
    bucket.closing = p.cumulative;
  }
  if (bucket) out.push(bucket);
  return out;
}

// ─── Category trend ─────────────────────────────────────────────────────────

type CategoryTrend = {
  months: string[]; // YYYY-MM
  series: { category: string; values: number[]; total: number }[];
};

// ─── Verdict builder (Saúde) ────────────────────────────────────────────────

type Verdict = {
  label: string;        // "EXCELENTE" | "BOM" | "REGULAR" | "ATENÇÃO"
  color: string;        // hex
  headline: string;     // 4-6 word punchline
  narrative: string;    // 1-2 sentence reading drawn from data
};

function buildVerdict(
  score: number,
  totals: { income: number; expenses: number; balance: number; count: number },
  monthly: { month: string; income: number; expenses: number }[],
): Verdict {
  const label = score >= 80 ? "EXCELENTE" : score >= 60 ? "BOM" : score >= 40 ? "REGULAR" : "ATENÇÃO";
  const color = score >= 71 ? "#0f7a3f" : score >= 41 ? "#7c52e6" : "#b3151d";
  const marginPct = totals.income > 0 ? Math.round((totals.balance / totals.income) * 100) : 0;
  const positive = totals.balance >= 0;

  let headline: string;
  if (score >= 80 && positive)        headline = "Negócio rodando redondo.";
  else if (score >= 60 && positive)   headline = "Operação saudável, com espaço pra crescer.";
  else if (positive)                  headline = "Resultado positivo, gestão precisa firmar.";
  else if (score >= 60)               headline = "Disciplina boa, mas o caixa fechou negativo.";
  else                                headline = "Período difícil, vale parar e priorizar.";

  // Compare with previous month if we have ≥2 months of trend
  let trendNote = "";
  if (monthly.length >= 2) {
    const prev = monthly[monthly.length - 2];
    const curr = monthly[monthly.length - 1];
    const prevNet = prev.income - prev.expenses;
    const currNet = curr.income - curr.expenses;
    if (prevNet !== 0) {
      const deltaPct = Math.round(((currNet - prevNet) / Math.abs(prevNet)) * 100);
      if (Math.abs(deltaPct) >= 10) {
        trendNote = ` O resultado ${deltaPct > 0 ? "subiu" : "caiu"} ${Math.abs(deltaPct)}% vs o mês anterior.`;
      }
    }
  }

  const narrative = positive
    ? `Saldo de ${brl0(totals.balance)} sobre ${brl0(totals.income)} de receita — margem de ${marginPct}%.${trendNote}`
    : `Despesa superou a receita em ${brl0(-totals.balance)}, pressionando o caixa em ${Math.abs(marginPct)}%.${trendNote}`;

  return { label, color, headline, narrative };
}

// ─── Highlights builder (Fluxo de Caixa) ────────────────────────────────────

type Highlights = {
  biggestIncome: Tx | null;
  biggestExpense: Tx | null;
  bestDay: DailyPoint | null;   // peak cumulative balance
  worstDay: DailyPoint | null;  // valley cumulative balance
};

function buildHighlights(txs: Tx[], daily: DailyPoint[]): Highlights {
  let biggestIncome: Tx | null = null;
  let biggestExpense: Tx | null = null;
  for (const t of txs) {
    if (t.type === "income"  && (!biggestIncome  || t.amount > biggestIncome.amount))  biggestIncome  = t;
    if (t.type === "expense" && (!biggestExpense || t.amount > biggestExpense.amount)) biggestExpense = t;
  }
  let bestDay: DailyPoint | null = null;
  let worstDay: DailyPoint | null = null;
  for (const d of daily) {
    if (!bestDay  || d.cumulative > bestDay.cumulative)  bestDay  = d;
    if (!worstDay || d.cumulative < worstDay.cumulative) worstDay = d;
  }
  return { biggestIncome, biggestExpense, bestDay, worstDay };
}

// ─── Ledger summary builder (Contábil) ──────────────────────────────────────

type LedgerSummaryData = {
  credits: { category: string; total: number; count: number }[];   // receitas
  debits:  { category: string; total: number; count: number }[];   // despesas
  totalCredits: number;
  totalDebits: number;
};

function buildLedgerSummary(txs: Tx[]): LedgerSummaryData {
  const cMap = new Map<string, { total: number; count: number }>();
  const dMap = new Map<string, { total: number; count: number }>();
  let totalCredits = 0, totalDebits = 0;
  for (const t of txs) {
    if (t.type === "income") {
      const cell = cMap.get(t.category) ?? { total: 0, count: 0 };
      cell.total += t.amount; cell.count += 1;
      cMap.set(t.category, cell);
      totalCredits += t.amount;
    } else if (t.type === "expense") {
      const cell = dMap.get(t.category) ?? { total: 0, count: 0 };
      cell.total += t.amount; cell.count += 1;
      dMap.set(t.category, cell);
      totalDebits += t.amount;
    }
  }
  const toRows = (m: Map<string, { total: number; count: number }>) =>
    [...m.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total);
  return { credits: toRows(cMap), debits: toRows(dMap), totalCredits, totalDebits };
}

function buildCategoryTrend(txs: Tx[], period: Period): CategoryTrend {
  // Build month list across period
  const months: string[] = [];
  const start = new Date(period.from + "T00:00:00");
  const end = new Date(period.to + "T00:00:00");
  let y = start.getFullYear(), m = start.getMonth();
  while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
    months.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m++; if (m > 11) { m = 0; y++; }
    if (months.length > 36) break;
  }
  // Top 5 expense categories overall
  const totals = mapByCategory(txs, "expense");
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
  // Per-month per-category sums
  const series = top.map((cat) => {
    const values = months.map((ym) => {
      let sum = 0;
      for (const t of txs) {
        if (t.type === "expense" && t.category === cat && t.date.startsWith(ym)) sum += t.amount;
      }
      return sum;
    });
    return { category: cat, values, total: values.reduce((a, b) => a + b, 0) };
  });
  return { months, series };
}

// ─── New section renderers ──────────────────────────────────────────────────

function DailyFlowChart({ points }: { points: DailyPoint[] }) {
  if (points.length === 0) return null;
  const W = 700, H = 220, P = 32;
  const xs = points.map((_, i) => P + (i / Math.max(1, points.length - 1)) * (W - P * 2));
  const cumValues = points.map((p) => p.cumulative);
  const minY = Math.min(0, ...cumValues);
  const maxY = Math.max(0, ...cumValues);
  const range = Math.max(1, maxY - minY);
  const ys = cumValues.map((v) => H - P - ((v - minY) / range) * (H - P * 2));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
  const zeroY = H - P - ((0 - minY) / range) * (H - P * 2);
  const area = `${path} L ${xs[xs.length - 1].toFixed(1)} ${zeroY.toFixed(1)} L ${xs[0].toFixed(1)} ${zeroY.toFixed(1)} Z`;

  // X axis labels: ~6 evenly spaced
  const labelStep = Math.max(1, Math.floor(points.length / 6));

  return (
    <div className="mt-3 overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {/* zero line */}
        <line x1={P} y1={zeroY} x2={W - P} y2={zeroY} stroke="rgba(0,0,0,0.2)" strokeWidth={1} strokeDasharray="3,3" />
        {/* area */}
        <path d={area} fill="rgba(106,248,47,0.18)" />
        {/* line */}
        <path d={path} fill="none" stroke="#138a4a" strokeWidth={1.8} strokeLinejoin="round" />
        {/* x labels */}
        {points.map((p, i) => {
          if (i % labelStep !== 0 && i !== points.length - 1) return null;
          return (
            <text key={p.date} x={xs[i]} y={H - P + 14} textAnchor="middle" fontSize="9" fill="rgba(0,0,0,0.55)" fontWeight="600">
              {p.date.slice(5)}
            </text>
          );
        })}
        {/* y labels */}
        <text x={P - 4} y={P + 4}             textAnchor="end" fontSize="9" fill="rgba(0,0,0,0.55)">{brl0(maxY)}</text>
        <text x={P - 4} y={zeroY + 3}          textAnchor="end" fontSize="9" fill="rgba(0,0,0,0.55)">{brl0(0)}</text>
        <text x={P - 4} y={H - P + 3}          textAnchor="end" fontSize="9" fill="rgba(0,0,0,0.55)">{brl0(minY)}</text>
      </svg>
      <div className="flex items-center gap-4 mt-1 text-[10px] text-black/60">
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-0.5 bg-[#138a4a]" /> Saldo acumulado</span>
        <span>· {points.length} dias</span>
      </div>
    </div>
  );
}

function WeeklyFlowTable({ rows }: { rows: { weekStart: string; weekEnd: string; in: number; out: number; net: number; closing: number }[] }) {
  return (
    <table className="w-full mt-2 text-[11px] border-collapse">
      <thead>
        <tr className="text-left text-black/60">
          <th className="py-1.5 pr-2 font-semibold border-b border-black/10">Semana</th>
          <th className="py-1.5 pr-2 font-semibold border-b border-black/10 text-right">Entradas</th>
          <th className="py-1.5 pr-2 font-semibold border-b border-black/10 text-right">Saídas</th>
          <th className="py-1.5 pr-2 font-semibold border-b border-black/10 text-right">Resultado</th>
          <th className="py-1.5 pl-2 font-semibold border-b border-black/10 text-right">Saldo final</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.weekStart} className="border-b border-black/5">
            <td className="py-1 pr-2">{fmtDate(r.weekStart)} → {fmtDate(r.weekEnd)}</td>
            <td className="py-1 pr-2 tnum text-right text-[#0f7a3f]">{brl0(r.in)}</td>
            <td className="py-1 pr-2 tnum text-right text-[#b3151d]">{brl0(r.out)}</td>
            <td className={`py-1 pr-2 tnum text-right font-semibold ${r.net >= 0 ? "text-[#0f7a3f]" : "text-[#b3151d]"}`}>
              {r.net >= 0 ? "+" : ""}{brl0(r.net)}
            </td>
            <td className="py-1 pl-2 tnum text-right">{brl0(r.closing)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CategoryTrendChart({ data }: { data: CategoryTrend }) {
  const { months, series } = data;
  const W = 700, H = 220, P = 36;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const xs = months.map((_, i) => P + (i / Math.max(1, months.length - 1)) * (W - P * 2));
  const colors = ["#2A3FC9", "#d11919", "#7c52e6", "#0f7a3f", "#FF9580"];

  function pathFor(values: number[]) {
    return values.map((v, i) => {
      const x = xs[i];
      const y = H - P - (v / max) * (H - P * 2);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  }

  return (
    <div className="mt-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />
        {series.map((s, idx) => (
          <path key={s.category} d={pathFor(s.values)} fill="none" stroke={colors[idx % colors.length]} strokeWidth={1.8} strokeLinejoin="round" />
        ))}
        {months.map((m, i) => (
          <text key={m} x={xs[i]} y={H - P + 14} textAnchor="middle" fontSize="9" fill="rgba(0,0,0,0.55)" fontWeight="600">
            {fmtMonth(m)}
          </text>
        ))}
        <text x={P - 4} y={P + 4}    textAnchor="end" fontSize="9" fill="rgba(0,0,0,0.55)">{brl0(max)}</text>
        <text x={P - 4} y={H - P + 3} textAnchor="end" fontSize="9" fill="rgba(0,0,0,0.55)">0</text>
      </svg>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-black/70">
        {series.map((s, idx) => (
          <span key={s.category} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-0.5" style={{ background: colors[idx % colors.length] }} />
            <span className="font-medium">{s.category}</span>
            <span className="text-black/50">· {brl0(s.total)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── VerdictHero (Saúde) ────────────────────────────────────────────────────
function VerdictHero({ score, verdict }: { score: number; verdict: Verdict }) {
  return (
    <div
      className="mt-5 rounded-2xl p-5 flex items-center gap-5 break-inside-avoid"
      style={{ background: `linear-gradient(135deg, ${verdict.color}10, ${verdict.color}05)`, border: `1px solid ${verdict.color}30` }}
    >
      <div className="shrink-0">
        <PrintGauge score={score} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: verdict.color }}>
          Veredito · {verdict.label}
        </div>
        <div className="text-[18px] font-bold text-black mt-1 leading-snug">{verdict.headline}</div>
        <div className="text-[12px] text-black/70 mt-1.5 leading-relaxed">{verdict.narrative}</div>
      </div>
    </div>
  );
}

// ─── HighlightsBoard (Fluxo) ────────────────────────────────────────────────
function HighlightsBoard({ data }: { data: Highlights }) {
  const cards: { label: string; value: string; sub: string; tone: "pos" | "neg" | "neutral" }[] = [];
  if (data.biggestIncome) {
    cards.push({
      label: "Maior entrada",
      value: brl0(data.biggestIncome.amount),
      sub: `${fmtDate(data.biggestIncome.date)} · ${data.biggestIncome.category}`,
      tone: "pos",
    });
  }
  if (data.biggestExpense) {
    cards.push({
      label: "Maior saída",
      value: brl0(data.biggestExpense.amount),
      sub: `${fmtDate(data.biggestExpense.date)} · ${data.biggestExpense.category}`,
      tone: "neg",
    });
  }
  if (data.bestDay) {
    cards.push({
      label: "Melhor dia",
      value: brl0(data.bestDay.cumulative),
      sub: `${fmtDate(data.bestDay.date)} · pico de saldo`,
      tone: "pos",
    });
  }
  if (data.worstDay) {
    cards.push({
      label: "Pior dia",
      value: brl0(data.worstDay.cumulative),
      sub: `${fmtDate(data.worstDay.date)} · saldo mais baixo`,
      tone: data.worstDay.cumulative < 0 ? "neg" : "neutral",
    });
  }
  if (cards.length === 0) return <div className="text-[11px] text-black/50 mt-2">Sem movimentação no período.</div>;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
      {cards.map((c) => {
        const color = c.tone === "pos" ? "#0f7a3f" : c.tone === "neg" ? "#b3151d" : "#3b3b3f";
        return (
          <div key={c.label} className="rounded-lg border-l-[3px] border border-black/10 px-3 py-2.5" style={{ borderLeftColor: color }}>
            <div className="text-[9px] uppercase tracking-[0.12em] font-bold text-black/55 mb-1">{c.label}</div>
            <div className="text-[14px] font-bold tnum" style={{ color }}>{c.value}</div>
            <div className="text-[10px] text-black/55 mt-0.5 truncate">{c.sub}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TopMoversBoard (Categorias) ────────────────────────────────────────────
function TopMoversBoard({ rows }: { rows: { category: string; curr: number; prev: number; delta: number; pct: number }[] }) {
  if (rows.length === 0) {
    return <div className="text-[11px] text-black/50 mt-2">Nenhuma categoria com variação relevante.</div>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
      {rows.map((r) => {
        const up = r.delta > 0;
        const color = up ? "#b3151d" : "#0f7a3f"; // expense up = bad
        const arrow = up ? "↑" : "↓";
        return (
          <div key={r.category} className="rounded-lg border border-black/10 p-3 break-inside-avoid">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[18px] font-bold leading-none" style={{ color }}>{arrow}</span>
              <span className="text-[12px] font-semibold text-black truncate">{r.category}</span>
            </div>
            <div className="text-[16px] font-bold tnum" style={{ color }}>
              {up ? "+" : ""}{brl0(r.delta)}
            </div>
            <div className="text-[10.5px] text-black/60 mt-0.5">
              <span className="font-semibold" style={{ color }}>{up ? "+" : ""}{r.pct.toFixed(0)}%</span>
              <span> · {brl0(r.prev)} → {brl0(r.curr)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── LedgerCover (Contábil) ─────────────────────────────────────────────────
function LedgerCover({ businessName, period, txCount }: { businessName: string; period: Period; txCount: number }) {
  return (
    <div className="mt-5 rounded-md border-2 border-black/20 break-inside-avoid">
      <div className="grid grid-cols-2 divide-x divide-black/15 border-b-2 border-black/20">
        <div className="px-4 py-3">
          <div className="text-[9px] uppercase tracking-[0.16em] font-bold text-black/55 mb-1">Razão Social</div>
          <div className="text-[13px] font-semibold text-black">{businessName}</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[9px] uppercase tracking-[0.16em] font-bold text-black/55 mb-1">Documento de uso interno</div>
          <div className="text-[11px] text-black/70">Material de apoio ao lançamento contábil — não substitui escrituração oficial.</div>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-black/15">
        <div className="px-4 py-2.5">
          <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-black/55">Início do período</div>
          <div className="text-[12.5px] font-semibold text-black mt-0.5 tnum">{fmtDate(period.from)}</div>
        </div>
        <div className="px-4 py-2.5">
          <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-black/55">Fim do período</div>
          <div className="text-[12.5px] font-semibold text-black mt-0.5 tnum">{fmtDate(period.to)}</div>
        </div>
        <div className="px-4 py-2.5">
          <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-black/55">Movimentações</div>
          <div className="text-[12.5px] font-semibold text-black mt-0.5 tnum">{txCount} lançamentos</div>
        </div>
      </div>
    </div>
  );
}

// ─── LedgerSummary (Contábil) ───────────────────────────────────────────────
function LedgerSummary({ data }: { data: LedgerSummaryData }) {
  const net = data.totalCredits - data.totalDebits;
  return (
    <div className="mt-3 grid grid-cols-2 gap-5 break-inside-avoid">
      <div>
        <div className="text-[10.5px] uppercase tracking-[0.14em] font-bold text-black/70 mb-1">Créditos (receitas)</div>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-left text-black/60">
              <th className="py-1 pr-2 font-semibold border-b border-black/15">Conta</th>
              <th className="py-1 pr-2 font-semibold border-b border-black/15 text-right">Qt</th>
              <th className="py-1 pl-2 font-semibold border-b border-black/15 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.credits.map((r) => (
              <tr key={r.category} className="border-b border-black/5">
                <td className="py-1 pr-2 truncate">{r.category}</td>
                <td className="py-1 pr-2 tnum text-right text-black/60">{r.count}</td>
                <td className="py-1 pl-2 tnum text-right text-[#0f7a3f] font-semibold">{brl0(r.total)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-black/20 font-bold">
              <td className="py-1.5 pr-2 text-black">TOTAL</td>
              <td className="py-1.5 pr-2 tnum text-right text-black/60">{data.credits.reduce((a, b) => a + b.count, 0)}</td>
              <td className="py-1.5 pl-2 tnum text-right text-[#0f7a3f]">{brl0(data.totalCredits)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div>
        <div className="text-[10.5px] uppercase tracking-[0.14em] font-bold text-black/70 mb-1">Débitos (despesas)</div>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="text-left text-black/60">
              <th className="py-1 pr-2 font-semibold border-b border-black/15">Conta</th>
              <th className="py-1 pr-2 font-semibold border-b border-black/15 text-right">Qt</th>
              <th className="py-1 pl-2 font-semibold border-b border-black/15 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.debits.map((r) => (
              <tr key={r.category} className="border-b border-black/5">
                <td className="py-1 pr-2 truncate">{r.category}</td>
                <td className="py-1 pr-2 tnum text-right text-black/60">{r.count}</td>
                <td className="py-1 pl-2 tnum text-right text-[#b3151d] font-semibold">{brl0(r.total)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-black/20 font-bold">
              <td className="py-1.5 pr-2 text-black">TOTAL</td>
              <td className="py-1.5 pr-2 tnum text-right text-black/60">{data.debits.reduce((a, b) => a + b.count, 0)}</td>
              <td className="py-1.5 pl-2 tnum text-right text-[#b3151d]">{brl0(data.totalDebits)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="col-span-2 rounded-md bg-black/[0.04] border border-black/15 px-4 py-2.5 flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.14em] font-bold text-black/70">Saldo do período (créditos − débitos)</div>
        <div className={`text-[15px] font-bold tnum ${net >= 0 ? "text-[#0f7a3f]" : "text-[#b3151d]"}`}>
          {net >= 0 ? "+" : ""}{brl0(net)}
        </div>
      </div>
    </div>
  );
}

function CategoryDeltaTable({ rows }: { rows: { category: string; curr: number; prev: number; delta: number; pct: number }[] }) {
  return (
    <table className="w-full mt-2 text-[11px] border-collapse">
      <thead>
        <tr className="text-left text-black/60">
          <th className="py-1.5 pr-2 font-semibold border-b border-black/10">Categoria</th>
          <th className="py-1.5 pr-2 font-semibold border-b border-black/10 text-right">Período anterior</th>
          <th className="py-1.5 pr-2 font-semibold border-b border-black/10 text-right">Período atual</th>
          <th className="py-1.5 pl-2 font-semibold border-b border-black/10 text-right">Variação</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const up = r.delta > 0;
          const color = up ? "text-[#b3151d]" : "text-[#0f7a3f]"; // expense up = bad
          return (
            <tr key={r.category} className="border-b border-black/5">
              <td className="py-1 pr-2 truncate">{r.category}</td>
              <td className="py-1 pr-2 tnum text-right">{brl0(r.prev)}</td>
              <td className="py-1 pr-2 tnum text-right">{brl0(r.curr)}</td>
              <td className={`py-1 pl-2 tnum text-right font-semibold ${color}`}>
                {up ? "+" : ""}{brl0(r.delta)} <span className="text-black/50 font-normal">({up ? "+" : ""}{r.pct.toFixed(0)}%)</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
