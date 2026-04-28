import { useState } from "react";
import { useRequireAuth } from "@/hooks/use-auth";
import { useGetMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnamneseData {
  // Seção 1
  tempoMercado: string;
  tipoNegocio: string;
  ticketMedio: string;
  faixaFaturamento: string;
  // Seção 2
  controleFinanceiro: string;
  sabeLucro: string;
  separaFinancas: string;
  conheceCustos: string;
  // Seção 3
  comoDecide: string;
  deixouInvestir: string;
  surpresaCaixa: string;
  // Seção 4
  maiorDificuldade: string;
  querMelhorar: string;
  comMaisClareza: string;
  // Seção 5
  observacoesAdicionais: string;
}

const EMPTY: AnamneseData = {
  tempoMercado: "", tipoNegocio: "", ticketMedio: "", faixaFaturamento: "",
  controleFinanceiro: "", sabeLucro: "", separaFinancas: "", conheceCustos: "",
  comoDecide: "", deixouInvestir: "", surpresaCaixa: "",
  maiorDificuldade: "", querMelhorar: "", comMaisClareza: "",
  observacoesAdicionais: "",
};

// ─── Chip option ──────────────────────────────────────────────────────────────

function Chip({ value, label, selected, onSelect }: { value: string; label: string; selected: boolean; onSelect: (v: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`px-4 py-2.5 rounded-xl text-[13px] font-medium border transition-all text-left ${
        selected
          ? "bg-[var(--accent-soft)] border-[rgba(106,248,47,0.4)] text-[#90f048]"
          : "border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-[var(--border-2)] bg-[rgba(255,255,255,0.02)]"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Text area ────────────────────────────────────────────────────────────────

function AnamneseTextarea({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <label className="block text-[13.5px] font-semibold text-white">{label}</label>
      {hint && <p className="text-[11.5px] text-[var(--muted)]">{hint}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Escreva aqui…"
        className="field w-full rounded-xl px-3 py-2.5 text-[13px] resize-none"
      />
    </div>
  );
}

// ─── Section: chips question ──────────────────────────────────────────────────

function ChipsQuestion({ label, hint, field, options, data, set }: {
  label: string; hint?: string; field: keyof AnamneseData;
  options: { value: string; label: string }[];
  data: AnamneseData; set: (f: keyof AnamneseData, v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[13.5px] font-semibold text-white">{label}</div>
        {hint && <div className="text-[11.5px] text-[var(--muted)] mt-0.5">{hint}</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.value} value={o.value} label={o.label} selected={data[field] === o.value} onSelect={(v) => set(field, v)} />
        ))}
      </div>
    </div>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

const SECTIONS = [
  { title: "Visão Geral do Negócio", subtitle: "Vamos entender onde você está no mercado para contextualizar os dados." },
  { title: "Controle Financeiro", subtitle: "Como está sua relação atual com os números do negócio?" },
  { title: "Operação e Decisão", subtitle: "Entender como você toma decisões nos ajuda a gerar alertas mais certeiros." },
  { title: "Dores e Desejos", subtitle: "Isso é ouro. Suas respostas moldam diretamente os insights que vamos gerar." },
  { title: "Contexto Adicional", subtitle: "Informações extras que ajudam a IA a entender o seu negócio com mais profundidade. 100% opcional." },
];

const OBS_SUGGESTIONS = [
  { label: "Região / mercado local", snippet: "Minha região tem características específicas: " },
  { label: "Sazonalidade", snippet: "Períodos de alta/baixa no meu negócio: " },
  { label: "Perfil dos clientes", snippet: "Meus clientes são principalmente: " },
  { label: "Concorrência", snippet: "Sobre a concorrência local: " },
  { label: "Empresa familiar", snippet: "É uma empresa familiar. " },
  { label: "Expansão / crescimento", snippet: "Meu plano de crescimento é: " },
  { label: "Fornecedores", snippet: "Dependência de fornecedores: " },
  { label: "Algo que a IA deve saber", snippet: "Informação importante sobre meu negócio: " },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Anamnese() {
  const { isLoading: isAuthLoading } = useRequireAuth();
  const { data: user, refetch } = useGetMe();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const bp = user?.businessProfile as Record<string, unknown> | null | undefined;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const [data, setData] = useState<AnamneseData>({
    tempoMercado: String(bp?.tempoMercado ?? ""),
    tipoNegocio: String(bp?.tipoNegocio ?? ""),
    ticketMedio: String(bp?.ticketMedio ?? ""),
    faixaFaturamento: String(bp?.faixaFaturamento ?? ""),
    controleFinanceiro: String(bp?.controleFinanceiro ?? ""),
    sabeLucro: String(bp?.sabeLucro ?? ""),
    separaFinancas: String(bp?.separaFinancas ?? ""),
    conheceCustos: String(bp?.conheceCustos ?? ""),
    comoDecide: String(bp?.comoDecide ?? ""),
    deixouInvestir: String(bp?.deixouInvestir ?? ""),
    surpresaCaixa: String(bp?.surpresaCaixa ?? ""),
    maiorDificuldade: String(bp?.maiorDificuldade ?? ""),
    querMelhorar: String(bp?.querMelhorar ?? ""),
    comMaisClareza: String(bp?.comMaisClareza ?? ""),
    observacoesAdicionais: String(bp?.observacoesAdicionais ?? ""),
  });

  if (isAuthLoading) return null;

  const set = (field: keyof AnamneseData, value: string) =>
    setData((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessProfile: {
            ...bp,
            ...data,
            anamneseCompleted: true,
          },
        }),
      });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["getMe"] });
      setDone(true);
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Layout title="Diagnóstico">
        <div className="max-w-lg mx-auto flex flex-col items-center gap-6 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent-soft)] grid place-items-center">
            <Check size={28} className="text-[#90f048]" />
          </div>
          <div>
            <h2 className="text-[20px] font-bold text-white">Diagnóstico concluído!</h2>
            <p className="text-[13px] text-[var(--muted)] mt-2 max-w-sm leading-relaxed">
              Suas respostas foram salvas. A Klaro IA vai usar esse contexto para gerar insights muito mais precisos e relevantes pro seu negócio.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setLocation("/insights")} className="btn-primary px-5 py-2.5 rounded-xl text-[13px] font-semibold">
              Ver meus insights
            </button>
            <button onClick={() => setLocation("/profile")} className="px-5 py-2.5 rounded-xl text-[13px] font-medium border border-[var(--border)] text-[var(--muted)] hover:text-white transition-colors">
              Ir para o perfil
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  const progress = ((step + 1) / SECTIONS.length) * 100;

  return (
    <Layout title="Diagnóstico do Negócio">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--accent-soft)] grid place-items-center shrink-0">
            <Sparkles size={16} className="text-[#90f048]" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-white">Diagnóstico do Negócio</h1>
            <p className="text-[12px] text-[var(--muted)]">100% opcional · quanto mais você preencher, melhores os insights</p>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] text-[var(--muted)]">
            <span>{SECTIONS[step].title}</span>
            <span>{step + 1} / {SECTIONS.length}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#90f048] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-[16px] font-bold text-white">{SECTIONS[step].title}</h2>
            <p className="text-[12.5px] text-[var(--muted)] mt-1">{SECTIONS[step].subtitle}</p>
          </div>

          {/* Section 1 */}
          {step === 0 && (
            <div className="space-y-6">
              <ChipsQuestion label="Há quanto tempo está no mercado?" field="tempoMercado" data={data} set={set}
                options={[
                  { value: "menos_1_ano", label: "Menos de 1 ano" },
                  { value: "1_2_anos", label: "1 a 2 anos" },
                  { value: "3_5_anos", label: "3 a 5 anos" },
                  { value: "5_10_anos", label: "5 a 10 anos" },
                  { value: "mais_10_anos", label: "Mais de 10 anos" },
                ]}
              />
              <ChipsQuestion label="Você vende produto, serviço ou ambos?" field="tipoNegocio" data={data} set={set}
                options={[
                  { value: "produto", label: "Produto" },
                  { value: "servico", label: "Serviço" },
                  { value: "ambos", label: "Produto + Serviço" },
                ]}
              />
              <ChipsQuestion label="Qual é o seu ticket médio por venda?" hint="Valor médio que cada cliente paga por pedido ou serviço" field="ticketMedio" data={data} set={set}
                options={[
                  { value: "ate_100", label: "Até R$100" },
                  { value: "100_500", label: "R$100 – R$500" },
                  { value: "500_1000", label: "R$500 – R$1.000" },
                  { value: "1000_5000", label: "R$1.000 – R$5.000" },
                  { value: "acima_5000", label: "Acima de R$5.000" },
                ]}
              />
              <ChipsQuestion label="Qual a faixa do seu faturamento mensal?" field="faixaFaturamento" data={data} set={set}
                options={[
                  { value: "ate_5k", label: "Até R$5 mil" },
                  { value: "5k_15k", label: "R$5k – R$15k" },
                  { value: "15k_30k", label: "R$15k – R$30k" },
                  { value: "30k_100k", label: "R$30k – R$100k" },
                  { value: "acima_100k", label: "Acima de R$100k" },
                ]}
              />
            </div>
          )}

          {/* Section 2 */}
          {step === 1 && (
            <div className="space-y-6">
              <ChipsQuestion label="Hoje você controla seu financeiro como?" field="controleFinanceiro" data={data} set={set}
                options={[
                  { value: "sistema", label: "Sistema / App" },
                  { value: "excel", label: "Excel / Planilha" },
                  { value: "caderno", label: "Caderno / Papel" },
                  { value: "nao_controlo", label: "Não controlo" },
                ]}
              />
              <ChipsQuestion label="Você sabe seu lucro mensal com precisão?" field="sabeLucro" data={data} set={set}
                options={[
                  { value: "sim", label: "Sim, sei com clareza" },
                  { value: "mais_ou_menos", label: "Mais ou menos" },
                  { value: "nao", label: "Não sei" },
                ]}
              />
              <ChipsQuestion label="Você separa as finanças pessoais das do negócio?" field="separaFinancas" data={data} set={set}
                options={[
                  { value: "sempre", label: "Sempre separo" },
                  { value: "as_vezes", label: "Às vezes misturo" },
                  { value: "nao", label: "Não separo" },
                ]}
              />
              <ChipsQuestion label="Você conhece seus principais custos fixos e variáveis?" field="conheceCustos" data={data} set={set}
                options={[
                  { value: "sim", label: "Sim, tenho clareza" },
                  { value: "parcialmente", label: "Parcialmente" },
                  { value: "nao", label: "Não tenho clareza" },
                ]}
              />
            </div>
          )}

          {/* Section 3 */}
          {step === 2 && (
            <div className="space-y-6">
              <ChipsQuestion label="Como você toma decisões no negócio hoje?" field="comoDecide" data={data} set={set}
                options={[
                  { value: "numeros", label: "Baseado em números" },
                  { value: "intuicao", label: "Intuição / Experiência" },
                  { value: "misturado", label: "Mistura dos dois" },
                ]}
              />
              <ChipsQuestion
                label="Você já deixou de investir ou crescer por insegurança financeira?"
                hint="Aquela sensação de querer expandir mas não saber se dá"
                field="deixouInvestir" data={data} set={set}
                options={[
                  { value: "sim", label: "Sim, já aconteceu" },
                  { value: "nao", label: "Não, nunca" },
                ]}
              />
              <ChipsQuestion
                label="Você já teve surpresa negativa no caixa?"
                hint="Achou que tinha dinheiro e não tinha, ou conta chegou inesperadamente"
                field="surpresaCaixa" data={data} set={set}
                options={[
                  { value: "frequentemente", label: "Sim, frequentemente" },
                  { value: "as_vezes", label: "Às vezes" },
                  { value: "nao", label: "Não, raramente" },
                ]}
              />
            </div>
          )}

          {/* Section 4 */}
          {step === 3 && (
            <div className="space-y-6">
              <AnamneseTextarea
                label="Qual é sua maior dificuldade hoje na gestão financeira do negócio?"
                hint="Seja direto — isso vira insight personalizado"
                value={data.maiorDificuldade}
                onChange={(v) => set("maiorDificuldade", v)}
              />
              <AnamneseTextarea
                label="O que você mais quer melhorar no seu negócio nos próximos 6 meses?"
                value={data.querMelhorar}
                onChange={(v) => set("querMelhorar", v)}
              />
              <AnamneseTextarea
                label="Se tivesse clareza total dos seus números, o que faria diferente?"
                hint="Pode ser uma decisão, um investimento, uma mudança"
                value={data.comMaisClareza}
                onChange={(v) => set("comMaisClareza", v)}
              />
            </div>
          )}

          {/* Section 5 */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[13.5px] font-semibold text-white">
                  Contexto livre para a IA
                </label>
                <p className="text-[11.5px] text-[var(--muted)] leading-relaxed">
                  Escreva qualquer informação que ajude a IA a entender melhor o seu negócio — mercado local, sazonalidade, perfil dos clientes, concorrência, planos de crescimento, peculiaridades da operação. Quanto mais contexto, melhores os insights.
                </p>
                <textarea
                  value={data.observacoesAdicionais}
                  onChange={(e) => set("observacoesAdicionais", e.target.value)}
                  rows={6}
                  placeholder={`Ex: "Minha cidade tem forte sazonalidade no verão por turismo — julho é quase o dobro de qualquer outro mês. Atendo principalmente mulheres entre 30–50 anos de classe média. Tenho 2 sócios ativos. A concorrência local é intensa em datas comemorativas mas fraca no restante do ano. Quero abrir uma segunda unidade em 2026."`}
                  className="field w-full rounded-xl px-3 py-2.5 text-[13px] resize-none leading-relaxed"
                />
              </div>
              <div>
                <div className="text-[11px] text-[var(--muted)] mb-2 font-medium">Sugestões de tópicos — clique para adicionar:</div>
                <div className="flex flex-wrap gap-2">
                  {OBS_SUGGESTIONS.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => set("observacoesAdicionais", (data.observacoesAdicionais ? data.observacoesAdicionais.trimEnd() + "\n" : "") + s.snippet)}
                      className="px-3 py-1.5 rounded-lg text-[11.5px] border border-[var(--border)] text-[var(--muted)] hover:text-white hover:border-[var(--border-2)] bg-[rgba(255,255,255,0.02)] transition-colors"
                    >
                      + {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => step > 0 ? setStep(step - 1) : setLocation(-1 as never)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] text-[var(--muted)] hover:text-white border border-[var(--border)] hover:border-[var(--border-2)] transition-colors"
          >
            <ChevronLeft size={15} />
            {step === 0 ? "Voltar" : "Anterior"}
          </button>

          <button
            onClick={() => setLocation("/insights")}
            className="text-[11.5px] text-[var(--muted)] hover:text-white transition-colors"
          >
            Pular diagnóstico
          </button>

          {step < SECTIONS.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="btn-primary flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold"
            >
              Próximo
              <ChevronRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-60"
            >
              {saving ? "Salvando…" : (
                <>
                  <Check size={15} />
                  Concluir diagnóstico
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
