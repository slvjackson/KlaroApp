/**
 * AI-powered insight engine for Klaro.
 * Uses Claude to generate "Papo do Consultor" insights in natural language.
 * Falls back to rule-based insights when ANTHROPIC_API_KEY is not set.
 */

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";
import { buildInsightsPrompt, getSegmentProfile } from "../prompts/builder";

export type InsightTone = "positive" | "warning" | "critical" | "neutral";

export interface GeneratedInsight {
  title: string;
  description: string;
  recommendation: string;
  steps: string[];
  periodLabel: string;
  tone: InsightTone;
}

export interface InsightBusinessContext {
  businessName?: string;
  segment?: string;
  segmentCustomLabel?: string;
  city?: string;
  state?: string;
  employeeCount?: number;
  monthlyRevenueGoal?: number;
  profitMarginGoal?: number;
  mainProducts?: string;
  salesChannel?: string;
  biggestChallenge?: string;
  // Anamnesis fields
  tempoMercado?: string;
  tipoNegocio?: string;
  ticketMedio?: string;
  faixaFaturamento?: string;
  controleFinanceiro?: string;
  sabeLucro?: string;
  separaFinancas?: string;
  conheceCustos?: string;
  comoDecide?: string;
  deixouInvestir?: string;
  surpresaCaixa?: string;
  maiorDificuldade?: string;
  querMelhorar?: string;
  comMaisClareza?: string;
  observacoesAdicionais?: string;
}

interface Transaction {
  date: string;
  description: string;
  amount: number;
  type: string;
  category: string;
}

interface MonthData {
  income: number;
  expenses: number;
  count: number;
}

// ─── Statistics helpers ───────────────────────────────────────────────────────

function groupByMonth(transactions: Transaction[]): Map<string, MonthData> {
  const map = new Map<string, MonthData>();
  for (const t of transactions) {
    if (!t.date) continue;
    const month = String(t.date).substring(0, 7);
    const existing = map.get(month) ?? { income: 0, expenses: 0, count: 0 };
    if (t.type === "income") existing.income += t.amount;
    else existing.expenses += t.amount;
    existing.count++;
    map.set(month, existing);
  }
  return map;
}

function topByAmount(
  transactions: Transaction[],
  key: keyof Transaction,
  n = 5
): { label: string; total: number }[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    const k = String(t[key]);
    map.set(k, (map.get(k) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, total]) => ({ label, total }));
}

function buildSummary(transactions: Transaction[]): string {
  const income = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const netBalance = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : "0";
  const avgTicket = income.length > 0 ? (totalIncome / income.length).toFixed(2) : "0";

  const monthlyData = groupByMonth(transactions);
  const months = [...monthlyData.keys()].sort();

  const monthlyLines = months
    .map((m) => {
      const d = monthlyData.get(m)!;
      const net = d.income - d.expenses;
      return `  ${m}: receita R$${d.income.toFixed(2)}, despesas R$${d.expenses.toFixed(2)}, saldo R$${net.toFixed(2)}`;
    })
    .join("\n");

  const topIncomeCategories = topByAmount(income, "category");
  const topExpenseCategories = topByAmount(expenses, "category");
  const topProducts = topByAmount(income, "description", 8);

  return `RESUMO FINANCEIRO — ${months[0]} a ${months[months.length - 1]}

TOTAIS:
  Receita total: R$${totalIncome.toFixed(2)}
  Despesas totais: R$${totalExpenses.toFixed(2)}
  Saldo líquido: R$${netBalance.toFixed(2)}
  Margem de lucro: ${margin}%
  Ticket médio por venda: R$${avgTicket}
  Total de vendas: ${income.length}
  Total de despesas lançadas: ${expenses.length}

EVOLUÇÃO MENSAL:
${monthlyLines}

TOP CATEGORIAS DE RECEITA:
${topIncomeCategories.map((c) => `  ${c.label}: R$${c.total.toFixed(2)}`).join("\n")}

TOP CATEGORIAS DE DESPESA:
${topExpenseCategories.map((c) => `  ${c.label}: R$${c.total.toFixed(2)}`).join("\n")}

PRODUTOS/SERVIÇOS MAIS VENDIDOS (por valor total):
${topProducts.map((p) => `  ${p.label}: R$${p.total.toFixed(2)}`).join("\n")}`;
}

// ─── AI-powered insights ──────────────────────────────────────────────────────

async function generateWithAI(transactions: Transaction[], ctx?: InsightBusinessContext): Promise<GeneratedInsight[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const summary = buildSummary(transactions);
  const months = [...groupByMonth(transactions).keys()].sort();
  const periodLabel = months.length >= 2
    ? `${months[0]} a ${months[months.length - 1]}`
    : months[0] ?? new Date().toISOString().substring(0, 7);

  const promptText = buildInsightsPrompt(summary, {
    businessName: ctx?.businessName,
    segment: getSegmentProfile(ctx?.segment, ctx?.segmentCustomLabel),
    segmentCustomLabel: ctx?.segmentCustomLabel,
    city: ctx?.city,
    state: ctx?.state,
    employeeCount: ctx?.employeeCount,
    monthlyRevenueGoal: ctx?.monthlyRevenueGoal,
    profitMarginGoal: ctx?.profitMarginGoal,
    mainProducts: ctx?.mainProducts,
    salesChannel: ctx?.salesChannel,
    biggestChallenge: ctx?.biggestChallenge,
    periodLabel,
    tempoMercado: ctx?.tempoMercado,
    tipoNegocio: ctx?.tipoNegocio,
    ticketMedio: ctx?.ticketMedio,
    faixaFaturamento: ctx?.faixaFaturamento,
    controleFinanceiro: ctx?.controleFinanceiro,
    sabeLucro: ctx?.sabeLucro,
    separaFinancas: ctx?.separaFinancas,
    conheceCustos: ctx?.conheceCustos,
    comoDecide: ctx?.comoDecide,
    deixouInvestir: ctx?.deixouInvestir,
    surpresaCaixa: ctx?.surpresaCaixa,
    maiorDificuldade: ctx?.maiorDificuldade,
    querMelhorar: ctx?.querMelhorar,
    comMaisClareza: ctx?.comMaisClareza,
    observacoesAdicionais: ctx?.observacoesAdicionais,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: promptText }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";

  // Strip markdown fences if present
  const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const VALID_TONES: string[] = ["positive", "warning", "critical", "neutral"];
  const rawParsed = JSON.parse(json) as Array<Record<string, unknown>>;
  logger.info({ rawTones: rawParsed.map((g) => g["tone"]) }, "AI insights raw tones");
  const parsed: GeneratedInsight[] = rawParsed.map((g) => ({
    title: String(g["title"] ?? ""),
    description: String(g["description"] ?? ""),
    recommendation: String(g["recommendation"] ?? ""),
    steps: Array.isArray(g["steps"]) ? (g["steps"] as unknown[]).map(String) : [],
    periodLabel: String(g["periodLabel"] ?? periodLabel),
    tone: VALID_TONES.includes(String(g["tone"])) ? (g["tone"] as InsightTone) : "neutral",
  }));
  logger.info({ count: parsed.length, tones: parsed.map((g) => g.tone) }, "AI insights generated");
  return parsed;
}

// ─── Rule-based fallback ──────────────────────────────────────────────────────

function generateRuleBased(transactions: Transaction[]): GeneratedInsight[] {
  const insights: GeneratedInsight[] = [];
  if (transactions.length === 0) {
    return [{
      title: "Nenhuma transação encontrada",
      description: "Você ainda não tem transações confirmadas para analisar.",
      recommendation: "Faça upload de um extrato ou planilha para começar.",
      steps: ["Acesse a tela de upload", "Importe seu extrato bancário", "Confirme os registros na revisão"],
      periodLabel: "Geral",
      tone: "warning",
    }];
  }

  const income = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const netBalance = totalIncome - totalExpenses;
  const monthlyData = groupByMonth(transactions);
  const months = [...monthlyData.keys()].sort();
  const periodLabel = months.length > 0 ? `${months[0]} a ${months[months.length - 1]}` : "Geral";

  const margin = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : "0";
  insights.push({
    title: netBalance >= 0 ? "Margem de lucro positiva" : "Despesas maiores que receitas",
    description: `Receita total: R$${totalIncome.toFixed(2)}, despesas: R$${totalExpenses.toFixed(2)}, margem: ${margin}%.`,
    recommendation: netBalance >= 0
      ? "Continue monitorando mensalmente e reinvista o lucro no crescimento."
      : "Revise as maiores despesas e busque reduzir custos não essenciais.",
    steps: netBalance >= 0
      ? ["Defina uma meta de margem para o próximo mês", "Reserve parte do lucro para reinvestimento", "Compare com o mês anterior"]
      : ["Liste as 3 maiores despesas do período", "Identifique quais são cortáveis", "Negocie pelo menos um custo fixo"],
    periodLabel,
    tone: netBalance >= 0 ? "positive" : "critical",
  });

  if (months.length >= 2) {
    const last = monthlyData.get(months[months.length - 1])!;
    const prev = monthlyData.get(months[months.length - 2])!;
    if (prev.income > 0) {
      const change = ((last.income - prev.income) / prev.income) * 100;
      insights.push({
        title: change >= 0 ? "Receita em crescimento" : "Queda na receita recente",
        description: `Variação de ${change.toFixed(1)}% em relação ao mês anterior.`,
        recommendation: change >= 0
          ? "Garanta que estoque e operação acompanhem o crescimento."
          : "Investigue quais produtos ou clientes geraram menos receita.",
        steps: change >= 0
          ? ["Identifique o que impulsionou o crescimento", "Reforce a estratégia de vendas", "Prepare estoque para manter ritmo"]
          : ["Liste os clientes com menor frequência de compra", "Contate os 5 maiores clientes inativos", "Avalie promoções para reativar vendas"],
        periodLabel: `${months[months.length - 2]} → ${months[months.length - 1]}`,
        tone: change >= 0 ? "positive" : "warning",
      });
    }
  }

  const topExpCat = topByAmount(expenses, "category")[0];
  if (topExpCat) {
    const pct = ((topExpCat.total / totalExpenses) * 100).toFixed(1);
    insights.push({
      title: `Maior despesa: ${topExpCat.label}`,
      description: `${topExpCat.label} representa ${pct}% das suas despesas (R$${topExpCat.total.toFixed(2)}).`,
      recommendation: "Avalie se é possível renegociar ou encontrar alternativas para esse custo.",
      steps: ["Pesquise 2 fornecedores alternativos", "Solicite proposta de renegociação", "Calcule a economia possível por mês"],
      periodLabel,
      tone: "warning",
    });
  }

  const avgTicket = income.length > 0 ? totalIncome / income.length : 0;
  insights.push({
    title: "Ticket médio por venda",
    description: `Média de R$${avgTicket.toFixed(2)} por transação em ${income.length} vendas.`,
    recommendation: avgTicket < 100
      ? "Considere combos ou upsell para aumentar o valor médio por venda."
      : "Bom ticket médio. Foque em aumentar o volume de vendas.",
    steps: avgTicket < 100
      ? ["Crie um combo de produtos complementares", "Ofereça desconto progressivo no volume", "Teste um produto premium acima da média"]
      : ["Defina meta de volume de vendas para o próximo mês", "Crie campanha para novos clientes", "Ative clientes que compraram há mais de 30 dias"],
    periodLabel,
    tone: "neutral",
  });

  if (months.length > 0) {
    const peakMonth = months.reduce((best, m) =>
      (monthlyData.get(m)!.income > (monthlyData.get(best)?.income ?? 0) ? m : best), months[0]);
    insights.push({
      title: `Melhor mês: ${peakMonth}`,
      description: `Pico de receita em ${peakMonth}: R$${monthlyData.get(peakMonth)!.income.toFixed(2)}.`,
      recommendation: "Analise o que impulsionou esse mês e repita as ações bem-sucedidas.",
      steps: ["Anote o que foi feito diferente naquele mês", "Identifique quais produtos mais venderam", "Planeje repetir as ações no próximo pico"],
      periodLabel: peakMonth,
      tone: "positive",
    });
  }

  return insights;
}

// ─── Steps for a single insight ──────────────────────────────────────────────

export async function generateStepsForInsight(insight: {
  title: string;
  description: string;
  recommendation: string;
}): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return [
      "Leia com atenção a recomendação do insight",
      "Identifique a ação mais urgente a tomar",
      "Defina um prazo para executar a primeira ação",
      "Acompanhe o resultado após 30 dias",
    ];
  }

  const client = new Anthropic({ apiKey });
  const prompt = `Você é um consultor financeiro para pequenos negócios no Brasil.

Com base neste insight financeiro:
Título: ${insight.title}
Análise: ${insight.description}
Recomendação: ${insight.recommendation}

Crie um plano de ação com exatamente 4 passos concretos e práticos, executáveis em curto prazo, que o empresário pode fazer para agir sobre este insight. Seja específico e direto — sem jargões. Os passos devem estar em ordem lógica.

Responda APENAS com um array JSON de 4 strings, sem markdown, sem texto adicional:
["Passo 1...", "Passo 2...", "Passo 3...", "Passo 4..."]`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";
  const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(json) as unknown[];
  return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string").map(String).slice(0, 5) : [];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateInsights(transactions: Transaction[], ctx?: InsightBusinessContext): Promise<GeneratedInsight[]> {
  if (process.env.ANTHROPIC_API_KEY && transactions.length > 0) {
    try {
      const aiResult = await generateWithAI(transactions, ctx);
      if (aiResult.length > 0) return aiResult;
      logger.warn("AI returned empty insights array, falling back to rule-based");
    } catch (err) {
      logger.error({ err }, "AI insight generation failed, falling back to rule-based");
    }
  }
  try {
    return generateRuleBased(transactions);
  } catch (err) {
    logger.error({ err }, "Rule-based insight generation also failed");
    return [{
      title: "Análise temporariamente indisponível",
      description: "Não foi possível processar seus dados agora. Tente novamente em instantes.",
      recommendation: "Se o problema persistir, verifique se suas transações foram confirmadas após o upload.",
      periodLabel: new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
      tone: "warning" as InsightTone,
    }];
  }
}