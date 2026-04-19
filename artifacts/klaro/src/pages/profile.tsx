import { useMemo, useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, AlertCircle, Lock, Trash2 } from "lucide-react";

// ─── Static data ──────────────────────────────────────────────────────────────

const SEGMENTS = [
  { key: "varejo", label: "Varejo / Loja" },
  { key: "alimentacao", label: "Alimentação" },
  { key: "servicos", label: "Serviços" },
  { key: "saude", label: "Saúde / Beleza" },
  { key: "educacao", label: "Educação" },
  { key: "tecnologia", label: "Tecnologia" },
  { key: "construcao", label: "Construção" },
  { key: "transporte", label: "Transporte" },
  { key: "agro", label: "Agronegócio" },
  { key: "outro", label: "Outro" },
];

const SALES_CHANNELS = [
  { key: "presencial", label: "Presencial" },
  { key: "online", label: "Online" },
  { key: "ambos", label: "Presencial + Online" },
  { key: "delivery", label: "Delivery" },
  { key: "whatsapp", label: "WhatsApp" },
];

const ALL_DAYS = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeCompletion(fields: {
  businessName: string; segment: string; city: string;
  employeeCount: string; openDays: string[]; revenueGoal: string;
  marginGoal: string; mainProducts: string; salesChannel: string;
  biggestChallenge: string;
}) {
  const checks = [
    !!fields.businessName.trim(), !!fields.segment, !!fields.city.trim(),
    !!fields.employeeCount, fields.openDays.length > 0, !!fields.revenueGoal,
    !!fields.marginGoal, !!fields.mainProducts.trim(),
    !!fields.salesChannel, !!fields.biggestChallenge.trim(),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ─── Chip button ──────────────────────────────────────────────────────────────

function Chip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium border transition-colors rounded-full ${
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Profile() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const { data: user, refetch } = useGetMe();
  const queryClient = useQueryClient();

  const bp = user?.businessProfile as Record<string, unknown> | null | undefined;

  const [businessName, setBusinessName] = useState(String(bp?.businessName ?? ""));
  const [name, setName] = useState(user?.name ?? "");
  const [segment, setSegment] = useState(String(bp?.segment ?? ""));
  const [state, setState] = useState(String(bp?.state ?? ""));
  const [city, setCity] = useState(String(bp?.city ?? ""));
  const [employeeCount, setEmployeeCount] = useState(bp?.employeeCount ? String(bp.employeeCount) : "");
  const [openDays, setOpenDays] = useState<string[]>((bp?.openDays as string[]) ?? []);
  const [openStart, setOpenStart] = useState(
    (bp?.openHours as Record<string, string> | undefined)?.start ?? ""
  );
  const [openEnd, setOpenEnd] = useState(
    (bp?.openHours as Record<string, string> | undefined)?.end ?? ""
  );
  const [revenueGoal, setRevenueGoal] = useState(bp?.monthlyRevenueGoal ? String(bp.monthlyRevenueGoal) : "");
  const [marginGoal, setMarginGoal] = useState(bp?.profitMarginGoal ? String(bp.profitMarginGoal) : "");
  const [mainProducts, setMainProducts] = useState(String(bp?.mainProducts ?? ""));
  const [salesChannel, setSalesChannel] = useState(String(bp?.salesChannel ?? ""));
  const [biggestChallenge, setBiggestChallenge] = useState(String(bp?.biggestChallenge ?? ""));
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Change password dialog
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdError, setPwdError] = useState("");

  // Delete account dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const completion = computeCompletion({
    businessName, segment, city, employeeCount,
    openDays, revenueGoal, marginGoal, mainProducts, salesChannel, biggestChallenge,
  });

  const citiesForState = useMemo(() => {
    return state ? (CITIES_BY_STATE[state] ?? []) : [];
  }, [state]);

  if (isAuthLoading) return null;

  function toggleDay(day: string) {
    setOpenDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  }

  async function handleSave() {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          businessProfile: {
            businessName: businessName.trim() || undefined,
            segment: segment || undefined,
            state: state || undefined,
            city: city.trim() || undefined,
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveMsg(data.error ?? "Erro ao salvar.");
        return;
      }
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["getMe"] });
      setSaveMsg("ok");
    } catch {
      setSaveMsg("Erro de conexão.");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(""), 3000);
    }
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
    } catch {
      setPwdError("Erro de conexão.");
    } finally {
      setSavingPwd(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await fetch("/api/auth/me", { method: "DELETE" });
      queryClient.clear();
      window.location.href = "/";
    } catch {
      setDeleting(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Perfil do Negócio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Essas informações melhoram a leitura dos seus arquivos e os insights gerados.
          </p>
        </div>

        {/* Completion bar */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {completion === 100 ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                <span className="text-sm font-semibold text-white">Perfil {completion}% completo</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {completion === 100 ? "Tudo certo!" : "Complete para melhores insights"}
              </span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${completion}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Account info */}
        <Section title="Dados da conta">
          <Field label="Nome">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background border-border text-white"
              placeholder="Seu nome"
            />
          </Field>
          <Field label="Email">
            <Input
              value={user?.email ?? ""}
              disabled
              className="bg-background border-border text-muted-foreground"
            />
          </Field>
        </Section>

        {/* Identity */}
        <Section title="Identidade do negócio">
          <Field label="Nome do negócio">
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Ex: Lanchonete da Maria"
              className="bg-background border-border text-white"
            />
          </Field>

          <Field label="Segmento">
            <div className="flex flex-wrap gap-2">
              {SEGMENTS.map((s) => (
                <Chip
                  key={s.key}
                  label={s.label}
                  selected={segment === s.key}
                  onClick={() => setSegment(segment === s.key ? "" : s.key)}
                />
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Estado">
              <select
                value={state}
                onChange={(e) => { setState(e.target.value); setCity(""); }}
                className="w-full h-9 px-3 text-sm bg-background border border-border text-white rounded-md"
              >
                <option value="">Selecionar estado</option>
                {BRAZIL_STATES.map((s) => (
                  <option key={s.uf} value={s.uf}>{s.uf} — {s.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Cidade">
              {citiesForState.length > 0 ? (
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-background border border-border text-white rounded-md"
                >
                  <option value="">Selecionar cidade</option>
                  {citiesForState.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={state ? "Digite a cidade" : "Selecione o estado"}
                  disabled={!state}
                  className="bg-background border-border text-white"
                />
              )}
            </Field>
          </div>
        </Section>

        {/* Operation */}
        <Section title="Operação">
          <Field label="Funcionários (aprox.)">
            <Input
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
              placeholder="0"
              type="number"
              min={0}
              className="bg-background border-border text-white w-32"
            />
          </Field>

          <Field label="Dias de funcionamento">
            <div className="flex flex-wrap gap-2">
              {ALL_DAYS.map((d) => (
                <Chip
                  key={d.key}
                  label={d.label}
                  selected={openDays.includes(d.key)}
                  onClick={() => toggleDay(d.key)}
                />
              ))}
            </div>
          </Field>

          <Field label="Horário de funcionamento">
            <div className="flex items-center gap-3">
              <select
                value={openStart}
                onChange={(e) => setOpenStart(e.target.value)}
                className="h-9 px-3 text-sm bg-background border border-border text-white rounded-md"
              >
                <option value="">Abertura</option>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <span className="text-muted-foreground text-sm">até</span>
              <select
                value={openEnd}
                onChange={(e) => setOpenEnd(e.target.value)}
                className="h-9 px-3 text-sm bg-background border border-border text-white rounded-md"
              >
                <option value="">Fechamento</option>
                {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </Field>

          <Field label="Canal de vendas principal">
            <div className="flex flex-wrap gap-2">
              {SALES_CHANNELS.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  selected={salesChannel === c.key}
                  onClick={() => setSalesChannel(salesChannel === c.key ? "" : c.key)}
                />
              ))}
            </div>
          </Field>

          <Field label="Principais produtos / serviços">
            <textarea
              value={mainProducts}
              onChange={(e) => setMainProducts(e.target.value)}
              placeholder="Ex: Coxinha, pastel, suco natural"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-background border border-border text-white rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
        </Section>

        {/* Goals */}
        <Section title="Metas & Desafios">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Meta de receita mensal (R$)">
              <Input
                value={revenueGoal}
                onChange={(e) => setRevenueGoal(e.target.value)}
                placeholder="Ex: 20000"
                inputMode="decimal"
                className="bg-background border-border text-white"
              />
            </Field>
            <Field label="Meta de margem de lucro (%)">
              <Input
                value={marginGoal}
                onChange={(e) => setMarginGoal(e.target.value)}
                placeholder="Ex: 20"
                inputMode="decimal"
                className="bg-background border-border text-white"
              />
            </Field>
          </div>

          <Field label="Maior desafio do negócio">
            <textarea
              value={biggestChallenge}
              onChange={(e) => setBiggestChallenge(e.target.value)}
              placeholder="Ex: Controle de estoque, fluxo de caixa..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-background border border-border text-white rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </Field>
        </Section>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Salvar perfil
          </Button>
          {saveMsg === "ok" && (
            <span className="text-sm text-primary flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Salvo com sucesso
            </span>
          )}
          {saveMsg && saveMsg !== "ok" && (
            <span className="text-sm text-destructive">{saveMsg}</span>
          )}
        </div>

        {/* Account actions */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-3 pt-0">
            <button
              onClick={() => { setPwdError(""); setChangePwdOpen(true); }}
              className="flex w-full items-center gap-3 px-3 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors rounded-md"
            >
              <Lock className="w-4 h-4 text-muted-foreground" />
              Alterar senha
            </button>
            <button
              onClick={() => { setDeleteConfirm(""); setDeleteOpen(true); }}
              className="flex w-full items-center gap-3 px-3 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors rounded-md"
            >
              <Trash2 className="w-4 h-4" />
              Excluir conta
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Change password dialog */}
      <Dialog open={changePwdOpen} onOpenChange={(v) => !v && setChangePwdOpen(false)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Alterar senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Senha atual">
              <Input
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                placeholder="••••••••"
                className="bg-background border-border text-white"
              />
            </Field>
            <Field label="Nova senha">
              <Input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="bg-background border-border text-white"
              />
            </Field>
            <Field label="Confirmar nova senha">
              <Input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="Repita a nova senha"
                className="bg-background border-border text-white"
                onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
              />
            </Field>
            {pwdError && <p className="text-sm text-destructive">{pwdError}</p>}
            <Button
              onClick={handleChangePassword}
              disabled={savingPwd}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              {savingPwd ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete account dialog */}
      <Dialog open={deleteOpen} onOpenChange={(v) => !v && setDeleteOpen(false)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive">Excluir conta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta ação é <span className="text-white font-medium">irreversível</span>. Todos os seus dados serão apagados permanentemente.
            </p>
            <Field label='Digite "EXCLUIR" para confirmar'>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="EXCLUIR"
                className="bg-background border-border text-white"
              />
            </Field>
            <Button
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== "EXCLUIR" || deleting}
              variant="destructive"
              className="w-full font-semibold"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Excluir minha conta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
