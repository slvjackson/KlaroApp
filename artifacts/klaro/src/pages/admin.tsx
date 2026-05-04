import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  Users, BarChart3, DollarSign, TrendingUp, TrendingDown,
  Shield, Trash2, Mail, Ban, CheckCircle, ChevronDown, Plus,
  Edit2, X, ArrowLeft, AlertTriangle, RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
  status: "active" | "inactive" | "blocked";
  createdAt: string;
  emailVerifiedAt: string | null;
  subStatus: string | null;
  billingCycle: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  asaasSubscriptionId: string | null;
  tokenInputTotal: number;
  tokenOutputTotal: number;
  tokenCallCount: number;
  tokenCostUSD: number;
  operationalCostShare: number;
}

interface Metrics {
  mrr: number;
  arr: number;
  arpu: number;
  activeSubscribers: number;
  trialUsers: number;
  totalUsers: number;
  newUsersLast30: number;
  monthlyChurnRate: number;
  annualChurnRate: number;
  ltv: number | null;
  nrr: number | null;
  newMrr: number;
  churnedMrr: number;
  totalMonthlyCosts: number;
  costPerUser: number | null;
  trialConversionRate: number | null;
  grossMarginEstimate: number | null;
  paybackMonths: number | null;
}

interface OperationalCost {
  id: number;
  category: string;
  name: string;
  amountMonthly: string;
  notes: string | null;
  createdAt: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function adminFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function pct(v: number | null | undefined) {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmt2(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toFixed(2);
}

function dateStr(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR");
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { label: string; color: string }> = {
    active:    { label: "Ativo",      color: "text-[var(--income)] bg-[rgba(106,248,47,0.1)]" },
    trial:     { label: "Trial",      color: "text-[#60a5fa] bg-[rgba(96,165,250,0.1)]" },
    overdue:   { label: "Atrasado",   color: "text-[#f59e0b] bg-[rgba(245,158,11,0.1)]" },
    cancelled: { label: "Cancelado",  color: "text-[var(--muted)] bg-[rgba(255,255,255,0.05)]" },
    expired:   { label: "Expirado",   color: "text-[var(--expense)] bg-[rgba(244,63,94,0.1)]" },
    inactive:  { label: "Inativo",    color: "text-[var(--muted)] bg-[rgba(255,255,255,0.05)]" },
    blocked:   { label: "Bloqueado",  color: "text-[var(--expense)] bg-[rgba(244,63,94,0.1)]" },
  };
  const s = map[status ?? ""] ?? { label: status ?? "—", color: "text-[var(--muted)]" };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${s.color}`}>
      {s.label}
    </span>
  );
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-1">
      <div className="text-[11px] text-[var(--muted)] uppercase tracking-wider">{label}</div>
      <div className={`text-[22px] font-bold ${highlight ? "text-[var(--accent)]" : "text-white"}`}>{value}</div>
      {sub && <div className="text-[11px] text-[var(--muted)]">{sub}</div>}
    </div>
  );
}

// ─── Cost form ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  api: "API / Serviços",
  server: "Servidor / Infra",
  salary: "Pessoal",
  marketing: "Marketing",
  other: "Outros",
};

function CostForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<OperationalCost>;
  onSave: (data: { category: string; name: string; amountMonthly: number; notes: string }) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState(initial?.category ?? "api");
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial?.amountMonthly ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  return (
    <div className="glass rounded-xl p-4 space-y-3 border border-[rgba(106,248,47,0.15)]">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-[var(--muted)] mb-1">Categoria</label>
          <select
            className="field text-[13px]"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-[var(--muted)] mb-1">Valor Mensal (R$)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="field text-[13px]"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="block text-[11px] text-[var(--muted)] mb-1">Nome</label>
        <input
          type="text"
          className="field text-[13px]"
          placeholder="Ex: OpenAI API"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="block text-[11px] text-[var(--muted)] mb-1">Notas (opcional)</label>
        <input
          type="text"
          className="field text-[13px]"
          placeholder="Detalhes adicionais"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-[12px] text-[var(--muted)] hover:text-white px-3 py-1.5 rounded-lg">
          Cancelar
        </button>
        <button
          onClick={() => onSave({ category, name, amountMonthly: Number(amount), notes })}
          disabled={!name.trim() || !amount}
          className="btn-primary text-[12px] px-4 py-1.5 rounded-lg disabled:opacity-50"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data, isLoading, refetch } = useQuery<Metrics>({
    queryKey: ["/admin/metrics"],
    queryFn: () => adminFetch("/admin/metrics"),
  });

  if (isLoading) return <div className="text-[var(--muted)] text-[13px] py-8 text-center">Carregando métricas…</div>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-white">Métricas SaaS</h2>
        <button onClick={() => refetch()} className="text-[var(--muted)] hover:text-white transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Revenue */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-2">Receita</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="MRR" value={brl(data.mrr)} highlight />
          <MetricCard label="ARR" value={brl(data.arr)} />
          <MetricCard label="ARPU" value={brl(data.arpu)} sub="por assinante ativo" />
          <MetricCard label="Novo MRR (30d)" value={brl(data.newMrr)} />
        </div>
      </div>

      {/* Users */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-2">Usuários</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Assinantes Ativos" value={String(data.activeSubscribers)} />
          <MetricCard label="Em Trial" value={String(data.trialUsers)} />
          <MetricCard label="Total de Usuários" value={String(data.totalUsers)} />
          <MetricCard label="Novos (30d)" value={String(data.newUsersLast30)} />
        </div>
      </div>

      {/* Retention & Health */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-2">Retenção & Saúde</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard label="Churn Mensal" value={pct(data.monthlyChurnRate)} sub="últimos 30 dias" />
          <MetricCard label="Churn Anual" value={pct(data.annualChurnRate)} />
          <MetricCard
            label="NRR"
            value={data.nrr != null ? pct(data.nrr) : "—"}
            sub="Net Revenue Retention"
          />
          <MetricCard
            label="Conv. Trial → Pago"
            value={data.trialConversionRate != null ? pct(data.trialConversionRate) : "—"}
          />
        </div>
      </div>

      {/* Unit Economics */}
      <div>
        <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-2">Economia Unitária</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="LTV"
            value={data.ltv != null ? brl(data.ltv) : "—"}
            sub="Lifetime Value estimado"
          />
          <MetricCard
            label="Custo/Usuário"
            value={data.costPerUser != null ? brl(data.costPerUser) : "—"}
            sub="custo fixo por ativo"
          />
          <MetricCard
            label="Margem Bruta"
            value={data.grossMarginEstimate != null ? pct(data.grossMarginEstimate) : "—"}
          />
          <MetricCard
            label="Payback"
            value={data.paybackMonths != null ? `${fmt2(data.paybackMonths)} meses` : "—"}
          />
        </div>
      </div>

      {/* Costs summary */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[var(--muted)]">Custos Operacionais Mensais</span>
          <span className="text-[15px] font-semibold text-white">{brl(data.totalMonthlyCosts)}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[13px] text-[var(--muted)]">MRR vs Custos</span>
          <span className={`text-[14px] font-semibold ${data.mrr >= data.totalMonthlyCosts ? "text-[var(--income)]" : "text-[var(--expense)]"}`}>
            {brl(data.mrr - data.totalMonthlyCosts)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Users ───────────────────────────────────────────────────────────────

function UsersTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ users: AdminUser[] }>({
    queryKey: ["/admin/users"],
    queryFn: () => adminFetch("/admin/users"),
  });

  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      adminFetch(`/admin/users/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/admin/users"] }),
  });

  const resetPw = useMutation({
    mutationFn: (id: number) => adminFetch(`/admin/users/${id}/reset-password`, { method: "POST" }),
  });

  const patchSub = useMutation({
    mutationFn: ({ id, status, billingCycle }: { id: number; status?: string; billingCycle?: string | null }) =>
      adminFetch(`/admin/users/${id}/subscription`, { method: "PATCH", body: JSON.stringify({ status, billingCycle }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/admin/users"] }),
  });

  const cancelSub = useMutation({
    mutationFn: (id: number) => adminFetch(`/admin/users/${id}/subscription`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/admin/users"] }),
  });

  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [resetSent, setResetSent] = useState<number | null>(null);

  if (isLoading) return <div className="text-[var(--muted)] text-[13px] py-8 text-center">Carregando usuários…</div>;

  const users = data?.users ?? [];

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-[var(--muted)]">{users.length} usuários cadastrados</div>

      {users.map((u) => (
        <div key={u.id} className="glass rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center gap-3 p-4 text-left hover:bg-[rgba(255,255,255,0.02)] transition-colors"
            onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
          >
            <div className="w-8 h-8 rounded-full bg-[rgba(106,248,47,0.1)] flex items-center justify-center text-[var(--accent)] text-[12px] font-bold shrink-0">
              {u.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-white truncate">{u.name}</span>
                {u.isAdmin && <Shield size={11} className="text-[var(--accent)] shrink-0" />}
              </div>
              <div className="text-[11px] text-[var(--muted)] truncate">{u.email}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={u.subStatus} />
              <StatusBadge status={u.status} />
              <ChevronDown
                size={14}
                className={`text-[var(--muted)] transition-transform ${expandedUser === u.id ? "rotate-180" : ""}`}
              />
            </div>
          </button>

          {expandedUser === u.id && (
            <div className="border-t border-[rgba(255,255,255,0.06)] p-4 space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
                <div>
                  <div className="text-[var(--muted)] mb-0.5">Cadastro</div>
                  <div className="text-white">{dateStr(u.createdAt)}</div>
                </div>
                <div>
                  <div className="text-[var(--muted)] mb-0.5">E-mail verificado</div>
                  <div className="text-white">{u.emailVerifiedAt ? "Sim" : "Não"}</div>
                </div>
                <div>
                  <div className="text-[var(--muted)] mb-0.5">Plano</div>
                  <div className="text-white capitalize">{u.billingCycle ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[var(--muted)] mb-0.5">Próx. renovação</div>
                  <div className="text-white">{dateStr(u.currentPeriodEnd)}</div>
                </div>
              </div>

              {/* Token & cost stats */}
              <div className="glass rounded-xl p-3">
                <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-2">Consumo & Custo</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-[12px]">
                  <div>
                    <div className="text-[var(--muted)] mb-0.5">Tokens entrada</div>
                    <div className="text-white font-medium">{u.tokenInputTotal.toLocaleString("pt-BR")}</div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)] mb-0.5">Tokens saída</div>
                    <div className="text-white font-medium">{u.tokenOutputTotal.toLocaleString("pt-BR")}</div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)] mb-0.5">Total tokens</div>
                    <div className="text-white font-medium">{(u.tokenInputTotal + u.tokenOutputTotal).toLocaleString("pt-BR")}</div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)] mb-0.5">Custo IA (USD)</div>
                    <div className={`font-medium ${u.tokenCostUSD > 1 ? "text-[var(--expense)]" : "text-white"}`}>
                      ${u.tokenCostUSD.toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--muted)] mb-0.5">Custo fixo rateado</div>
                    <div className="text-white font-medium">
                      {u.operationalCostShare > 0
                        ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(u.operationalCostShare)
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Account status controls */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-2">Status da Conta</div>
                <div className="flex gap-2 flex-wrap">
                  {(["active", "inactive", "blocked"] as const).map((s) => (
                    <button
                      key={s}
                      disabled={u.status === s || patchStatus.isPending}
                      onClick={() => patchStatus.mutate({ id: u.id, status: s })}
                      className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                        u.status === s
                          ? "border-[var(--accent)] text-[var(--accent)] bg-[rgba(106,248,47,0.08)]"
                          : "border-[rgba(255,255,255,0.1)] text-[var(--muted)] hover:border-[rgba(255,255,255,0.25)] hover:text-white"
                      }`}
                    >
                      {s === "active" ? "Ativar" : s === "inactive" ? "Inativar" : "Bloquear"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subscription controls */}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-[var(--muted)] mb-2">Assinatura</div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    disabled={patchSub.isPending}
                    onClick={() => patchSub.mutate({ id: u.id, status: "active", billingCycle: "monthly" })}
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[var(--muted)] hover:border-[rgba(106,248,47,0.4)] hover:text-[var(--accent)] transition-colors disabled:opacity-40"
                  >
                    Ativar Mensal
                  </button>
                  <button
                    disabled={patchSub.isPending}
                    onClick={() => patchSub.mutate({ id: u.id, status: "trial", billingCycle: null })}
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[var(--muted)] hover:border-[rgba(96,165,250,0.4)] hover:text-[#60a5fa] transition-colors disabled:opacity-40"
                  >
                    Reiniciar Trial
                  </button>
                  <button
                    disabled={cancelSub.isPending || u.subStatus === "cancelled"}
                    onClick={() => cancelSub.mutate(u.id)}
                    className="text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[var(--muted)] hover:border-[rgba(244,63,94,0.4)] hover:text-[var(--expense)] transition-colors disabled:opacity-40"
                  >
                    Cancelar Assinatura
                  </button>
                </div>
              </div>

              {/* Password reset */}
              <div className="flex items-center gap-3">
                <button
                  disabled={resetPw.isPending || resetSent === u.id}
                  onClick={() => {
                    resetPw.mutate(u.id, { onSuccess: () => setResetSent(u.id) });
                  }}
                  className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] text-[var(--muted)] hover:border-[rgba(255,255,255,0.25)] hover:text-white transition-colors disabled:opacity-40"
                >
                  <Mail size={11} />
                  {resetSent === u.id ? "E-mail enviado!" : "Enviar reset de senha"}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Costs ───────────────────────────────────────────────────────────────

function CostsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ costs: OperationalCost[] }>({
    queryKey: ["/admin/costs"],
    queryFn: () => adminFetch("/admin/costs"),
  });

  const addCost = useMutation({
    mutationFn: (body: object) => adminFetch("/admin/costs", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/costs"] }); qc.invalidateQueries({ queryKey: ["/admin/metrics"] }); setAdding(false); },
  });

  const updateCost = useMutation({
    mutationFn: ({ id, ...body }: { id: number } & object) =>
      adminFetch(`/admin/costs/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/costs"] }); qc.invalidateQueries({ queryKey: ["/admin/metrics"] }); setEditing(null); },
  });

  const deleteCost = useMutation({
    mutationFn: (id: number) => adminFetch(`/admin/costs/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/admin/costs"] }); qc.invalidateQueries({ queryKey: ["/admin/metrics"] }); },
  });

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const costs = data?.costs ?? [];
  const total = costs.reduce((s, c) => s + Number(c.amountMonthly), 0);

  const grouped = Object.entries(CATEGORY_LABELS).map(([ key, label]) => ({
    key,
    label,
    items: costs.filter((c) => c.category === key),
    subtotal: costs.filter((c) => c.category === key).reduce((s, c) => s + Number(c.amountMonthly), 0),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] text-[var(--muted)] uppercase tracking-wider">Total Mensal</div>
          <div className="text-[22px] font-bold text-white">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}</div>
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 btn-primary text-[12px] px-4 py-2 rounded-xl"
        >
          <Plus size={13} />
          Adicionar Custo
        </button>
      </div>

      {adding && (
        <CostForm
          onSave={(d) => addCost.mutate(d)}
          onCancel={() => setAdding(false)}
        />
      )}

      {isLoading && <div className="text-[var(--muted)] text-[13px] py-4 text-center">Carregando…</div>}

      {grouped.map((g) => (
        <div key={g.key}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] uppercase tracking-wider text-[var(--muted)]">{g.label}</div>
            <div className="text-[12px] text-white">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(g.subtotal)}</div>
          </div>
          <div className="space-y-2">
            {g.items.map((c) => (
              <div key={c.id}>
                {editing === c.id ? (
                  <CostForm
                    initial={c}
                    onSave={(d) => updateCost.mutate({ id: c.id, ...d })}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <div className="glass rounded-xl p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-white">{c.name}</div>
                      {c.notes && <div className="text-[11px] text-[var(--muted)]">{c.notes}</div>}
                    </div>
                    <div className="text-[13px] font-semibold text-white shrink-0">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(c.amountMonthly))}
                    </div>
                    <button
                      onClick={() => setEditing(c.id)}
                      className="text-[var(--muted)] hover:text-white transition-colors shrink-0"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => deleteCost.mutate(c.id)}
                      className="text-[var(--muted)] hover:text-[var(--expense)] transition-colors shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {!isLoading && costs.length === 0 && (
        <div className="text-[var(--muted)] text-[13px] text-center py-8">
          Nenhum custo cadastrado ainda.
        </div>
      )}
    </div>
  );
}

// ─── Main admin page ──────────────────────────────────────────────────────────

type Tab = "overview" | "users" | "costs";

export default function Admin() {
  const { user, isLoading } = useRequireAuth();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [clearPending, setClearPending] = useState(false);

  const clearTests = useMutation({
    mutationFn: () => adminFetch("/admin/clear-tests", { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries();
      setClearPending(false);
    },
  });

  if (isLoading) return null;
  if (!user?.isAdmin) {
    setLocation("/dashboard");
    return null;
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "overview", label: "Visão Geral",   icon: <BarChart3 size={14} /> },
    { key: "users",    label: "Usuários",       icon: <Users size={14} /> },
    { key: "costs",    label: "Custos",         icon: <DollarSign size={14} /> },
  ];

  return (
    <div
      className="min-h-screen"
      style={{
        background: `
          radial-gradient(1200px 600px at 80% -10%, rgba(106,248,47,0.08), transparent 60%),
          #09090b
        `,
      }}
    >
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-1.5 text-[12.5px] text-[var(--muted)] hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar ao App
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-[var(--accent)]" />
            <span className="text-[12px] text-[var(--muted)]">Painel Admin</span>
          </div>
          {!clearPending ? (
            <button
              onClick={() => setClearPending(true)}
              className="flex items-center gap-1.5 text-[12px] text-[var(--expense)] border border-[rgba(244,63,94,0.3)] px-3 py-1.5 rounded-lg hover:bg-[rgba(244,63,94,0.08)] transition-colors"
            >
              <Trash2 size={12} />
              Limpar Testes
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[var(--muted)]">Confirmar?</span>
              <button
                onClick={() => clearTests.mutate()}
                disabled={clearTests.isPending}
                className="text-[12px] text-[var(--expense)] border border-[rgba(244,63,94,0.4)] px-3 py-1.5 rounded-lg hover:bg-[rgba(244,63,94,0.12)] transition-colors disabled:opacity-50"
              >
                {clearTests.isPending ? "Apagando…" : "Sim, apagar"}
              </button>
              <button
                onClick={() => setClearPending(false)}
                className="text-[12px] text-[var(--muted)] hover:text-white px-2 py-1.5 rounded-lg transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 glass rounded-xl p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 text-[13px] py-2 rounded-lg font-medium transition-colors ${
                tab === t.key
                  ? "bg-[var(--accent)] text-black"
                  : "text-[var(--muted)] hover:text-white"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && <OverviewTab />}
        {tab === "users"    && <UsersTab />}
        {tab === "costs"    && <CostsTab />}
      </div>
    </div>
  );
}
