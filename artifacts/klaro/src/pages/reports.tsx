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

const REPORT_LABEL = "Relatório Financeiro";

// Single report — the user picks exactly which blocks to include.
const SECTIONS = [
  { id: "verdict",        label: "Veredito da saúde (gauge + leitura narrada)" },
  { id: "kpis",           label: "KPIs do período (saldo, entradas, saídas)" },
  { id: "health",         label: "Componentes do score de saúde" },
  { id: "monthly",        label: "Evolução mensal (barras)" },
  { id: "bestWorstMonth", label: "Melhor e pior mês (resultado e faturamento)" },
  { id: "topExpense",     label: "Top categorias de despesa" },
  { id: "topIncome",      label: "Top categorias de receita" },
  { id: "categoryDelta",  label: "Variação por categoria vs período anterior" },
  { id: "txs",            label: "Listagem detalhada de transações" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// Checked by default — the common "saúde + visão geral" report.
const DEFAULT_SECTIONS: SectionId[] = [
  "verdict", "kpis", "health", "monthly", "bestWorstMonth", "topExpense", "topIncome",
];

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
  period: Period;
  sections: Set<SectionId>;
};

export default function Reports() {
  const { isLoading: authLoading } = useRequireAuth();
  const [history, setHistory] = useState<ReportHistoryEntry[]>([]);
  const [preview, setPreview] = useState<PreviewSpec | null>(null);
  // Seed for the inline configurator (set when editing a history entry).
  // The nonce forces the configurator to re-initialize with the new values.
  const [seed, setSeed] = useState<{ period: Period; sections: Set<SectionId>; nonce: number } | null>(null);

  useEffect(() => { setHistory(loadHistory()); }, []);

  if (authLoading) return null;

  function startPreview(spec: PreviewSpec) {
    setPreview(spec);
  }

  function openHistoryEntry(entry: ReportHistoryEntry) {
    setPreview({
      period: entry.period,
      sections: new Set(entry.sections as SectionId[]),
    });
  }

  function editHistoryEntry(entry: ReportHistoryEntry) {
    setSeed({
      period: entry.period,
      sections: new Set(entry.sections as SectionId[]),
      nonce: Date.now(),
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
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
        <section className="glass rounded-2xl p-5 md:p-6 flex items-center gap-4 md:gap-6">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent-soft)] grid place-items-center shrink-0">
            <FileText size={22} className="text-[var(--accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[16px] font-semibold text-white">
              Gere seu relatório financeiro em segundos
            </div>
            <div className="text-[12.5px] text-[var(--muted)] mt-1 leading-relaxed">
              Marque o que você quer ver, ajuste o período e baixe em PDF para apresentar a
              banco/sócio ou em CSV para enviar ao contador.
            </div>
          </div>
        </section>

        {/* ── Configurador inline ───────────────────── */}
        <ReportConfigurator
          key={seed?.nonce ?? "default"}
          initialPeriod={seed?.period}
          initialSections={seed?.sections}
          onPreview={startPreview}
        />

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

      {preview && (
        <ReportPreview
          period={preview.period}
          sections={preview.sections}
          onClose={() => setPreview(null)}
          onGenerated={recordReport}
        />
      )}
    </Layout>
  );
}

// ─── Configurator (dialog) ──────────────────────────────────────────────────

function ReportConfigurator({
  initialPeriod,
  initialSections,
  onPreview,
}: {
  initialPeriod?: Period;
  initialSections?: Set<SectionId>;
  onPreview: (spec: PreviewSpec) => void;
}) {
  const [period, setPeriod] = useState<Period>(() => initialPeriod ?? computePeriod("last-month"));
  const [sections, setSections] = useState<Set<SectionId>>(
    () => initialSections ?? new Set<SectionId>(DEFAULT_SECTIONS),
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
    <section className="glass rounded-2xl p-5 md:p-6">
      <div className="text-[15px] font-semibold text-white mb-1">
        O que gostaria de ver no seu relatório?
      </div>
      <div className="text-[12px] text-[var(--muted)] mb-5">
        Marque os blocos que quer incluir e escolha o período.
      </div>

      {/* Período */}
      <div className="mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[var(--muted)] mb-2">
          <Calendar size={11} className="inline mr-1 -mt-0.5" /> Período
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
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

      {/* Blocos */}
      <div className="mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[var(--muted)] mb-2">
          Blocos do relatório
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {SECTIONS.map((s) => {
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
                  className="accent-[var(--accent)] w-3.5 h-3.5 shrink-0"
                />
                <span className="text-[12px] text-white/90">{s.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => onPreview({ period, sections })}
        disabled={sections.size === 0}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-[12.5px] font-semibold text-[#09090b] bg-gradient-to-b from-[#6af82f] to-[#4de020] hover:brightness-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <FileText size={14} />
        Gerar pré-visualização
      </button>
      <div className="text-[10.5px] text-[var(--muted)] mt-2 leading-relaxed">
        {sections.size === 0
          ? "Selecione ao menos um bloco para gerar o relatório."
          : "A pré-visualização abre em tela cheia. De lá você baixa em PDF ou CSV."}
      </div>
    </section>
  );
}

// ─── Preview + Render ───────────────────────────────────────────────────────

function ReportPreview({
  period,
  sections,
  onClose,
  onGenerated,
}: {
  period: Period;
  sections: Set<SectionId>;
  onClose: () => void;
  onGenerated: (entry: ReportHistoryEntry) => void;
}) {
  const templateLabel = REPORT_LABEL;
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

  // Best / worst month within the period — by net result and by revenue.
  const bestWorstMonth = useMemo(() => buildBestWorstMonth(monthly), [monthly]);

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

  // A 1-line verdict drawn from the score + balance behavior of the period.
  const verdict = useMemo(() => buildVerdict(health?.score ?? 0, totals, monthly), [health, totals, monthly]);

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
      template: "report",
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
      template: "report",
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-medium text-white/90 bg-white/[0.04] hover:bg-white/[0.08] border border-[var(--border)] transition"
        >
          <FileSpreadsheet size={13} /> CSV
        </button>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11.5px] font-semibold text-[#09090b] bg-gradient-to-b from-[#6af82f] to-[#4de020] hover:brightness-110 transition"
        >
          <Printer size={13} /> Baixar PDF
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

            {/* Monthly */}
            {sections.has("monthly") && monthly.length > 0 && (
              <div className="mt-5 break-inside-avoid">
                <SectionTitle>Evolução mensal</SectionTitle>
                <MonthlyChartPrint data={monthly} />
              </div>
            )}

            {/* Best / worst month */}
            {sections.has("bestWorstMonth") && bestWorstMonth && (
              <div className="mt-5 break-inside-avoid">
                <SectionTitle>Melhor e pior mês</SectionTitle>
                <BestWorstMonthBoard data={bestWorstMonth} />
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

// ─── Date helper ────────────────────────────────────────────────────────────

function shiftISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Best / worst month ─────────────────────────────────────────────────────

type MonthStat = { month: string; income: number; expenses: number; net: number };
type BestWorst = {
  byNet: { best: MonthStat; worst: MonthStat } | null;
  byRevenue: { best: MonthStat; worst: MonthStat } | null;
};

function buildBestWorstMonth(
  monthly: { month: string; income: number; expenses: number }[],
): BestWorst | null {
  if (monthly.length < 1) return null;
  const stats: MonthStat[] = monthly.map((m) => ({
    month: m.month,
    income: m.income,
    expenses: m.expenses,
    net: m.income - m.expenses,
  }));
  const byNetSorted = [...stats].sort((a, b) => b.net - a.net);
  const byRevSorted = [...stats].sort((a, b) => b.income - a.income);
  return {
    byNet: { best: byNetSorted[0], worst: byNetSorted[byNetSorted.length - 1] },
    byRevenue: { best: byRevSorted[0], worst: byRevSorted[byRevSorted.length - 1] },
  };
}

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

// ─── BestWorstMonthBoard ────────────────────────────────────────────────────

function MonthStatCard({ tone, title, stat, metric }: {
  tone: "pos" | "neg";
  title: string;
  stat: MonthStat;
  metric: "net" | "income";
}) {
  const color = tone === "pos" ? "#0f7a3f" : "#b3151d";
  const value = metric === "net" ? stat.net : stat.income;
  return (
    <div className="rounded-lg border border-black/10 p-3">
      <div className="text-[9px] uppercase tracking-[0.1em] font-bold text-black/55">{title}</div>
      <div className="text-[14px] font-bold text-black mt-1">{fmtMonth(stat.month)}</div>
      <div className="text-[15px] font-bold tnum mt-0.5" style={{ color }}>
        {value >= 0 ? "" : "-"}{brl0(Math.abs(value))}
      </div>
      <div className="text-[10px] text-black/55 mt-1">
        Entradas {brl0(stat.income)} · Saídas {brl0(stat.expenses)}
      </div>
    </div>
  );
}

function BestWorstMonthBoard({ data }: { data: BestWorst }) {
  return (
    <div className="mt-3 space-y-4">
      {data.byNet && (
        <div>
          <div className="text-[10.5px] font-semibold text-black/70 mb-1.5">Por resultado (entradas − saídas)</div>
          <div className="grid grid-cols-2 gap-3">
            <MonthStatCard tone="pos" title="Melhor mês" stat={data.byNet.best} metric="net" />
            <MonthStatCard tone="neg" title="Pior mês" stat={data.byNet.worst} metric="net" />
          </div>
        </div>
      )}
      {data.byRevenue && (
        <div>
          <div className="text-[10.5px] font-semibold text-black/70 mb-1.5">Por faturamento (entradas)</div>
          <div className="grid grid-cols-2 gap-3">
            <MonthStatCard tone="pos" title="Melhor mês" stat={data.byRevenue.best} metric="income" />
            <MonthStatCard tone="neg" title="Pior mês" stat={data.byRevenue.worst} metric="income" />
          </div>
        </div>
      )}
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
