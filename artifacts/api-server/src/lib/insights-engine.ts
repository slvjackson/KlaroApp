/**
 * AI-powered insight engine for Klaro.
 * Uses Claude to generate "Papo do Consultor" insights in natural language.
 * Falls back to rule-based insights when ANTHROPIC_API_KEY is not set.
 */

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";
import { buildInsightsPrompt, getSegmentProfile } from "../prompts/builder";

export interface GeneratedInsight {
  title: string;
  description: string;
  recommendation: string;
  periodLabel: string;
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
    const month = t.date.substring(0, 7);
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
  const periodLabel = `${months[0]} a ${months[months.length - 1]}`;

  const promptText = buildInsightsPrompt(summary, {
    businessName: ctx?.businessName,
    segment: getSegmentProfile(ctx?.segment, ctx?.segmentCustomLabel),
    city: ctx?.city,
    state: ctx?.state,
    employeeCount: ctx?.employeeCount,
    monthlyRevenueGoal: ctx?.monthlyRevenueGoal,
    profitMarginGoal: ctx?.profitMarginGoal,
    mainProducts: ctx?.mainProducts,
    salesChannel: ctx?.salesChannel,
    biggestChallenge: ctx?.biggestChallenge,
    periodLabel,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [{ role: "user", content: promptText }],
  });

  const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "[]";

  // Strip markdown fences if present
  const json = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(json) as GeneratedInsight[];
  logger.info({ count: parsed.length }, "AI insights generated");
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
      periodLabel: "Geral",
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
    periodLabel,
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
        periodLabel: `${months[months.length - 2]} → ${months[months.length - 1]}`,
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
      periodLabel,
    });
  }

  const avgTicket = income.length > 0 ? totalIncome / income.length : 0;
  insights.push({
    title: "Ticket médio por venda",
    description: `Média de R$${avgTicket.toFixed(2)} por transação em ${income.length} vendas.`,
    recommendation: avgTicket < 100
      ? "Considere combos ou upsell para aumentar o valor médio por venda."
      : "Bom ticket médio. Foque em aumentar o volume de vendas.",
    periodLabel,
  });

  const peakMonth = months.reduce((best, m) =>
    (monthlyData.get(m)!.income > monthlyData.get(best)!.income ? m : best), months[0]);
  if (peakMonth) {
    insights.push({
      title: `Melhor mês: ${peakMonth}`,
      description: `Pico de receita em ${peakMonth}: R$${monthlyData.get(peakMonth)!.income.toFixed(2)}.`,
      recommendation: "Analise o que impulsionou esse mês e repita as ações bem-sucedidas.",
      periodLabel: peakMonth,
    });
  }

  return insights;
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
  return generateRuleBased(transactions);
}