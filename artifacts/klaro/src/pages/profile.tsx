import { useMemo, useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Loader2, CheckCircle2, AlertCircle, Lock, Trash2, X, Sparkles, Pencil } from "lucide-react";
import { Link } from "wouter";
import { AnamneseCta } from "@/components/anamnese-cta";

// ─── Static data ──────────────────────────────────────────────────────────────

const SEGMENTS = [
  { key: "varejo", label: "Varejo / Loja" }, { key: "alimentacao", label: "Alimentação" },
  { key: "servicos", label: "Serviços" }, { key: "saude", label: "Saúde / Beleza" },
  { key: "educacao", label: "Educação" }, { key: "tecnologia", label: "Tecnologia" },
  { key: "construcao", label: "Construção" }, { key: "transporte", label: "Transporte" },
  { key: "agro", label: "Agronegócio" }, { key: "outro", label: "Outro" },
];

const SALES_CHANNELS = [
  { key: "presencial", label: "Presencial" }, { key: "online", label: "Online" },
  { key: "ambos", label: "Presencial + Online" }, { key: "delivery", label: "Delivery" },
  { key: "whatsapp", label: "WhatsApp" },
];

const ALL_DAYS = [
  { key: "seg", label: "Seg" }, { key: "ter", label: "Ter" }, { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" }, { key: "sex", label: "Sex" }, { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

const BRAZIL_STATES = [
  { uf: "AC", name: "Acre" }, { uf: "AL", name: "Alagoas" }, { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" }, { uf: "BA", name: "Bahia" }, { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" }, { uf: "ES", name: "Espírito Santo" }, { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" }, { uf: "MT", name: "Mato Grosso" }, { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" }, { uf: "PA", name: "Pará" }, { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" }, { uf: "PE", name: "Pernambuco" }, { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" }, { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" }, { uf: "RO", name: "Rondônia" }, { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" }, { uf: "SP", name: "São Paulo" }, { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

const CITIES_BY_STATE: Record<string, string[]> = {
  AC: ["Rio Branco","Cruzeiro do Sul","Sena Madureira"],
  AL: ["Maceió","Arapiraca","Palmeira dos Índios","Rio Largo"],
  AP: ["Macapá","Santana","Laranjal do Jari"],
  AM: ["Manaus","Parintins","Itacoatiara","Manacapuru"],
  BA: ["Salvador","Feira de Santana","Vitória da Conquista","Camaçari","Itabuna","Juazeiro","Lauro de Freitas","Ilhéus","Jequié","Barreiras"],
  CE: ["Fortaleza","Caucaia","Juazeiro do Norte","Maracanaú","Sobral","Crato"],
  DF: ["Brasília","Ceilândia","Taguatinga","Samambaia"],
  ES: ["Vitória","Serra","Vila Velha","Cariacica","Cachoeiro de Itapemirim"],
  GO: ["Goiânia","Aparecida de Goiânia","Anápolis","Rio Verde","Luziânia"],
  MA: ["São Luís","Imperatriz","São José de Ribamar","Timon"],
  MT: ["Cuiabá","Várzea Grande","Rondonópolis","Sinop"],
  MS: ["Campo Grande","Dourados","Três Lagoas","Corumbá"],
  MG: ["Belo Horizonte","Uberlândia","Contagem","Juiz de Fora","Betim","Montes Claros","Ribeirão das Neves","Uberaba","Governador Valadares","Ipatinga"],
  PA: ["Belém","Ananindeua","Santarém","Marabá","Castanhal"],
  PB: ["João Pessoa","Campina Grande","Santa Rita","Patos"],
  PR: ["Curitiba","Londrina","Maringá","Ponta Grossa","Cascavel","São José dos Pinhais","Foz do Iguaçu"],
  PE: ["Recife","Caruaru","Olinda","Petrolina","Paulista","Jaboatão dos Guararapes"],
  PI: ["Teresina","Parnaíba","Picos","Piripiri"],
  RJ: ["Rio de Janeiro","São Gonçalo","Duque de Caxias","Nova Iguaçu","Niterói","Belford Roxo","Petrópolis","Volta Redonda"],
  RN: ["Natal","Mossoró","Parnamirim","São Gonçalo do Amarante"],
  RS: ["Porto Alegre","Caxias do Sul","Pelotas","Canoas","Santa Maria","Gravataí","Novo Hamburgo","São Leopoldo","Passo Fundo"],
  RO: ["Porto Velho","Ji-Paraná","Ariquemes","Vilhena"],
  RR: ["Boa Vista","Rorainópolis","Caracaraí"],
  SC: ["Florianópolis","Joinville","Blumenau","São José","Criciúma","Chapecó","Itajaí","Lages","Balneário Camboriú"],
  SP: ["São Paulo","Guarulhos","Campinas","São Bernardo do Campo","Santo André","Osasco","São José dos Campos","Ribeirão Preto","Sorocaba","Santos","Mauá","Mogi das Cruzes","Diadema","Jundiaí","Piracicaba","Bauru","Franca","Limeira","Praia Grande","Suzano"],
  SE: ["Aracaju","Nossa Senhora do Socorro","Lagarto","Itabaiana"],
  TO: ["Palmas","Araguaína","Gurupi","Porto Nacional"],
};

const TIME_SLOTS: string[] = [];
for (let h = 5; h <= 23; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  if (h < 23) TIME_SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

function computeCompletion(fields: {
  businessName: string; segment: string; city: string; employeeCount: string;
  openDays: string[]; revenueGoal: string; marginGoal: string; mainProducts: string;
  salesChannel: string; biggestChallenge: string;
}) {
  const checks = [
    !!fields.businessName.trim(), !!fields.segment, !!fields.city.trim(),
    !!fields.employeeCount, fields.openDays.length > 0, !!fields.revenueGoal,
    !!fields.marginGoal, !!fields.mainProducts.trim(),
    !!fields.salesChannel, !!fields.biggestChallenge.trim(),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ─── UI atoms ─────────────────────────────────────────────────────────────────

function GlassSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="text-[13px] font-semibold text-white">{title}</div>
      {children}
    </div>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[var(--muted)] mb-1.5">{label}</div>;
}

function GlassDialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="glass-strong rounded-2xl p-6 w-full max-w-sm relative z-10 fadeUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="text-[15px] font-semibold text-white">{title}</div>
          <button onClick={onClose} className="w-7 h-7 grid place-items-center rounded-lg text-[var(--muted)] hover:text-white hover:bg-white/5">
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Profile() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const { data: user, refetch } = useGetMe();
  const queryClient = useQueryClient();

  const bp = (user as unknown as { businessProfile?: Record<string, unknown> } | undefined)?.businessProfile;

  const [businessName, setBusinessName] = useState(String(bp?.businessName ?? ""));
  const [name, setName] = useState(user?.name ?? "");
  const [segment, setSegment] = useState(String(bp?.segment ?? ""));
  const [segmentCustomLabel, setSegmentCustomLabel] = useState(String(bp?.segmentCustomLabel ?? ""));
  const [state, setState] = useState(String(bp?.state ?? ""));
  const [city, setCity] = useState(String(bp?.city ?? ""));
  const [employeeCount, setEmployeeCount] = useState(bp?.employeeCount ? String(bp.employeeCount) : "");
  const [openDays, setOpenDays] = useState<string[]>((bp?.openDays as string[]) ?? []);
  const [openStart, setOpenStart] = useState((bp?.openHours as Record<string, string> | undefined)?.start ?? "");
  const [openEnd, setOpenEnd] = useState((bp?.openHours as Record<string, string> | undefined)?.end ?? "");
  const [revenueGoal, setRevenueGoal] = useState(bp?.monthlyRevenueGoal ? String(bp.monthlyRevenueGoal) : "");
  const [marginGoal, setMarginGoal] = useState(bp?.profitMarginGoal ? String(bp.profitMarginGoal) : "");
  const [mainProducts, setMainProducts] = useState(String(bp?.mainProducts ?? ""));
  const [salesChannel, setSalesChannel] = useState(String(bp?.salesChannel ?? ""));
  const [biggestChallenge, setBiggestChallenge] = useState(String(bp?.biggestChallenge ?? ""));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState("");

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const completion = computeCompletion({ businessName, segment, city, employeeCount, openDays, revenueGoal, marginGoal, mainProducts, salesChannel, biggestChallenge });
  const citiesForState = useMemo(() => state ? (CITIES_BY_STATE[state] ?? []) : [], [state]);

  if (isAuthLoading) return null;

  function toggleDay(day: string) {
    setOpenDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }

  async function handleSave() {
    setSaving(true); setSaveMsg("");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          businessProfile: {
            businessName: businessName.trim() || undefined,
            segment: segment || undefined,
            segmentCustomLabel: segment === "outro" ? (segmentCustomLabel.trim() || undefined) : undefined,
            state: state || undefined, city: city.trim() || undefined,
            employeeCount: employeeCount ? Number(employeeCount) : undefined,
            openDays: openDays.length > 0 ? openDays : undefined,
            openHours: openStart && openEnd ? { start: openStart, end: openEnd } : undefined,
            monthlyRevenueGoal: revenueGoal ? Number(revenueGoal.replace(",", ".")) : undefined,
            profitMarginGoal: marginGoal ? Number(marginGoal.replace(",", ".")) : undefined,
            mainProducts: mainProducts.trim() || undefined,
            salesChannel: salesChannel || undefined,
            biggestChallenge: biggestChallenge.trim() || undefined,
          },
        }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setSaveMsg(d.error ?? "Erro ao salvar."); return; }
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["getMe"] });
      setSaveMsg("ok");
    } catch { setSaveMsg("Erro de conexão."); }
    finally { setSaving(false); setTimeout(() => setSaveMsg(""), 3000); }
  }

  async function handleChangePassword() {
    setPwdError("");
    if (newPwd.length < 6) { setPwdError("A nova senha deve ter ao menos 6 caracteres."); return; }
    if (newPwd !== confirmPwd) { setPwdError("As senhas não coincidem."); return; }
    setSavingPwd(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setPwdError(data.error ?? "Não foi possível alterar a senha."); return; }
      setChangePwdOpen(false);
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch { setPwdError("Erro de conexão."); }
    finally { setSavingPwd(false); }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await fetch("/api/auth/me", { method: "DELETE" });
      queryClient.clear();
      window.location.href = "/";
    } catch { setDeleting(false); }
  }

  const initials = (user?.name ?? "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  return (
    <Layout title="Perfil">
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-white">Perfil do Negócio</h1>
          <p className="text-[12.5px] text-[var(--muted)] mt-1">Essas informações melhoram a leitura dos arquivos e os insights gerados.</p>
        </div>

        {bp?.anamneseCompleted ? (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[rgba(16,185,129,0.06)] border border-[rgba(16,185,129,0.18)]">
            <div className="w-8 h-8 rounded-xl bg-[rgba(16,185,129,0.12)] grid place-items-center shrink-0">
              <CheckCircle2 size={15} className="text-[#10b981]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-white leading-snug">Diagnóstico do negócio concluído</div>
              <div className="text-[11px] text-[var(--muted)] mt-0.5">A IA usa essas respostas para personalizar insights e análises.</div>
            </div>
            <Link href="/anamnese">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-[rgba(255,255,255,0.1)] text-[var(--muted)] hover:text-white hover:border-[var(--border-2)] transition-colors shrink-0">
                <Pencil size={12} />
                Editar
              </button>
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-[rgba(106,248,47,0.08)] to-[rgba(106,248,47,0.03)] border border-[rgba(106,248,47,0.18)] hover:border-[rgba(106,248,47,0.35)] transition-colors">
            <div className="w-8 h-8 rounded-xl bg-[var(--accent-soft)] grid place-items-center shrink-0">
              <Sparkles size={14} className="text-[#90f048]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-semibold text-white leading-snug">Faça o diagnóstico do negócio</div>
              <div className="text-[11px] text-[var(--muted)] mt-0.5">Responda perguntas rápidas para a IA gerar análises muito mais precisas.</div>
            </div>
            <Link href="/anamnese">
              <button className="text-[12px] font-semibold text-[#90f048] shrink-0 hover:underline transition-colors">
                Fazer diagnóstico →
              </button>
            </Link>
          </div>
        )}

        {/* Completion */}
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {completion === 100
                ? <CheckCircle2 size={15} className="text-[var(--income)]" />
                : <AlertCircle size={15} className="text-[#f59e0b]" />}
              <span className="text-[13px] font-semibold text-white">Perfil {completion}% completo</span>
            </div>
            <span className="text-[11.5px] text-[var(--muted)]">
              {completion === 100 ? "Tudo certo!" : "Complete para melhores insights"}
            </span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${completion}%`,
                background: "linear-gradient(90deg, var(--accent), var(--accent-2))",
              }}
            />
          </div>
        </div>

        {/* Avatar + account */}
        <GlassSection title="Dados da conta">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#6af82f] to-[#6af82f] grid place-items-center text-[20px] font-bold text-white shrink-0">
              {initials}
            </div>
            <div>
              <div className="text-[14px] font-semibold text-white">{user?.name}</div>
              <div className="text-[12px] text-[var(--muted)]">{user?.email}</div>
            </div>
          </div>

          <div>
            <FieldLabel label="Nome" />
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
          </div>
          <div>
            <FieldLabel label="Email" />
            <input className="field opacity-60" value={user?.email ?? ""} disabled />
          </div>
        </GlassSection>

        {/* Business identity */}
        <GlassSection title="Identidade do negócio">
          <div>
            <FieldLabel label="Nome do negócio" />
            <input className="field" value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ex: Lanchonete da Maria" />
          </div>

          <div>
            <FieldLabel label="Segmento" />
            <div className="flex flex-wrap gap-2">
              {SEGMENTS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSegment(s.key === segment ? "" : s.key)}
                  className={`chip ${segment === s.key ? "chip-on" : ""}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {segment === "outro" && (
              <div className="mt-3">
                <input
                  className="field"
                  placeholder="Descreva seu segmento (ex: Panificadora, Pet Shop, Gráfica…)"
                  value={segmentCustomLabel}
                  onChange={(e) => setSegmentCustomLabel(e.target.value)}
                  maxLength={80}
                />
                <p className="text-[11px] text-[var(--muted)] mt-1">
                  A IA usará esse contexto para personalizar análises e insights.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel label="Estado" />
              <select className="field" value={state} onChange={(e) => { setState(e.target.value); setCity(""); }}>
                <option value="">Selecionar estado</option>
                {BRAZIL_STATES.map((s) => <option key={s.uf} value={s.uf}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel label="Cidade" />
              {citiesForState.length > 0 ? (
                <select className="field" value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">Selecionar cidade</option>
                  {citiesForState.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input className="field" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Nome da cidade" />
              )}
            </div>
          </div>

          <div>
            <FieldLabel label="Nº de funcionários" />
            <input className="field" type="number" min="0" value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} placeholder="0" />
          </div>
        </GlassSection>

        {/* Operations */}
        <GlassSection title="Operações">
          <div>
            <FieldLabel label="Dias de funcionamento" />
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  className={`chip ${openDays.includes(d.key) ? "chip-on" : ""}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel label="Abertura" />
              <select className="field" value={openStart} onChange={(e) => setOpenStart(e.target.value)}>
                <option value="">--:--</option>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel label="Fechamento" />
              <select className="field" value={openEnd} onChange={(e) => setOpenEnd(e.target.value)}>
                <option value="">--:--</option>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <FieldLabel label="Canal de vendas" />
            <div className="flex flex-wrap gap-2">
              {SALES_CHANNELS.map((sc) => (
                <button
                  key={sc.key}
                  type="button"
                  onClick={() => setSalesChannel(sc.key === salesChannel ? "" : sc.key)}
                  className={`chip ${salesChannel === sc.key ? "chip-on" : ""}`}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          </div>
        </GlassSection>

        {/* Goals */}
        <GlassSection title="Metas e produtos">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel label="Meta de receita mensal (R$)" />
              <input className="field" type="text" value={revenueGoal} onChange={(e) => setRevenueGoal(e.target.value)} placeholder="Ex: 15000" />
            </div>
            <div>
              <FieldLabel label="Meta de margem (%)" />
              <input className="field" type="text" value={marginGoal} onChange={(e) => setMarginGoal(e.target.value)} placeholder="Ex: 30" />
            </div>
          </div>

          <div>
            <FieldLabel label="Principais produtos / serviços" />
            <textarea
              className="field resize-none"
              rows={2}
              value={mainProducts}
              onChange={(e) => setMainProducts(e.target.value)}
              placeholder="Descreva brevemente o que você vende..."
            />
          </div>

          <div>
            <FieldLabel label="Maior desafio do negócio" />
            <textarea
              className="field resize-none"
              rows={2}
              value={biggestChallenge}
              onChange={(e) => setBiggestChallenge(e.target.value)}
              placeholder="Ex: controlar o fluxo de caixa, atrair novos clientes..."
            />
          </div>
        </GlassSection>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary px-6 py-2.5 rounded-xl text-[13.5px] font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Salvando…" : "Salvar perfil"}
          </button>
          {saveMsg === "ok" && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--income)]">
              <CheckCircle2 size={14} />
              Salvo com sucesso!
            </div>
          )}
          {saveMsg && saveMsg !== "ok" && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--expense)]">
              <AlertCircle size={14} />
              {saveMsg}
            </div>
          )}
        </div>

        {/* Security */}
        <GlassSection title="Segurança">
          <button
            onClick={() => setChangePwdOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[rgba(255,255,255,0.02)] text-[13px] text-white hover:border-[var(--border-2)] transition-colors"
          >
            <Lock size={14} className="text-[var(--muted)]" />
            Alterar senha
          </button>
        </GlassSection>

        {/* Danger zone */}
        <GlassSection title="Zona de perigo">
          <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">
            A exclusão da conta é permanente. Todos os seus dados, transações e histórico serão removidos.
          </p>
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[rgba(244,63,94,0.3)] bg-[rgba(244,63,94,0.05)] text-[13px] text-[var(--expense)] hover:bg-[rgba(244,63,94,0.1)] transition-colors"
          >
            <Trash2 size={14} />
            Excluir minha conta
          </button>
        </GlassSection>
      </div>

      {/* Change password dialog */}
      <GlassDialog open={changePwdOpen} onClose={() => setChangePwdOpen(false)} title="Alterar senha">
        <div className="space-y-4">
          <div>
            <FieldLabel label="Senha atual" />
            <input type="password" className="field" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <FieldLabel label="Nova senha" />
            <input type="password" className="field" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Mín. 6 caracteres" />
          </div>
          <div>
            <FieldLabel label="Confirmar nova senha" />
            <input type="password" className="field" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Repetir senha" />
          </div>
          {pwdError && (
            <div className="text-[12px] text-[var(--expense)] flex items-center gap-1.5">
              <AlertCircle size={12} /> {pwdError}
            </div>
          )}
          <button
            onClick={handleChangePassword}
            disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd}
            className="btn-primary w-full py-2.5 rounded-xl text-[13.5px] font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {savingPwd && <Loader2 size={14} className="animate-spin" />}
            {savingPwd ? "Alterando…" : "Alterar senha"}
          </button>
        </div>
      </GlassDialog>

      {/* Delete account dialog */}
      <GlassDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Excluir conta">
        <div className="space-y-4">
          <p className="text-[12.5px] text-[var(--muted)] leading-relaxed">
            Esta ação é irreversível. Para confirmar, digite <strong className="text-white">EXCLUIR</strong> abaixo.
          </p>
          <input
            className="field"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="EXCLUIR"
          />
          <button
            onClick={handleDeleteAccount}
            disabled={deleting || deleteConfirm !== "EXCLUIR"}
            className="w-full py-2.5 rounded-xl text-[13.5px] font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
            style={{ background: "linear-gradient(180deg, #f43f5e, #be123c)" }}
          >
            {deleting && <Loader2 size={14} className="animate-spin" />}
            {deleting ? "Excluindo…" : "Excluir minha conta"}
          </button>
        </div>
      </GlassDialog>
    </Layout>
  );
}
