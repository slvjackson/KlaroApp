import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db, transactionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getSegmentProfile } from "../prompts/builder";

const router = Router();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// POST /chat — conversational AI with full financial context
router.post("/chat", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { message, history = [] } = req.body as { message: string; history: ChatMessage[] };

  if (!message?.trim()) {
    res.status(400).json({ error: "Mensagem não pode ser vazia." });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: "IA não disponível no momento." });
    return;
  }

  // Fetch user and transactions in parallel
  const [userRow, transactions] = await Promise.all([
    db.select({ name: usersTable.name, businessProfile: usersTable.businessProfile })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .then((r) => r[0]),
    db.select().from(transactionsTable).where(eq(transactionsTable.userId, userId)),
  ]);

  const bp = userRow?.businessProfile as Record<string, unknown> | null;
  const segmentProfile = getSegmentProfile(bp?.segment as string | undefined);

  // Use UTC-3 (Brazil) local date to match how dates are stored by the mobile app
  const nowBrasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const today = nowBrasilia.toISOString().slice(0, 10);

  // Build financial summary
  const income = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const netBalance = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : "0";

  // Today's transactions
  const todayTx = transactions.filter((t) => t.date === today);
  const todayIncome = todayTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const todayExpenses = todayTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const todayLines = todayTx.length > 0
    ? todayTx.map((t) => `  ${t.type === "income" ? "+" : "-"}R$${t.amount.toFixed(0)} ${t.description} (${t.category})`).join("\n")
    : "  Nenhuma transação registrada hoje";

  // Last 30 days individual transactions (most recent first, max 50)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const recentTx = transactions
    .filter((t) => t.date >= thirtyDaysAgo)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50);
  const recentTxLines = recentTx.length > 0
    ? recentTx.map((t) => `  ${t.date} ${t.type === "income" ? "+" : "-"}R$${t.amount.toFixed(0)} ${t.description} (${t.category})`).join("\n")
    : "  Sem transações nos últimos 30 dias";

  // Monthly breakdown (last 6 months)
  const monthMap = new Map<string, { income: number; expenses: number }>();
  for (const t of transactions) {
    const m = t.date.substring(0, 7);
    const cur = monthMap.get(m) ?? { income: 0, expenses: 0 };
    if (t.type === "income") cur.income += t.amount;
    else cur.expenses += t.amount;
    monthMap.set(m, cur);
  }
  const recentMonths = [...monthMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 6)
    .map(([month, d]) => `  ${month}: receita R$${d.income.toFixed(0)}, despesas R$${d.expenses.toFixed(0)}, saldo R$${(d.income - d.expenses).toFixed(0)}`)
    .join("\n");

  // Top expense categories
  const catMap = new Map<string, number>();
  for (const t of expenses) catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount);
  const topCats = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, val]) => `  ${cat}: R$${val.toFixed(0)}`)
    .join("\n");

  const systemPrompt = `Você é o Klaro, um consultor financeiro de IA para pequenos e médios negócios brasileiros.
Você conversa diretamente com o dono do negócio, de forma simples, amigável e acionável.
Tom de voz: ${segmentProfile.tom}
Data de hoje: ${today}

PERFIL DO NEGÓCIO:
  Nome: ${userRow?.name ?? "Usuário"}
  Segmento: ${segmentProfile.label}
  Terminologia: receita = "${segmentProfile.terminologia.receita}", despesa = "${segmentProfile.terminologia.despesa}", cliente = "${segmentProfile.terminologia.cliente}"
  Foco de análise: ${segmentProfile.focoInsights}

HOJE (${today}):
  Receita: R$${todayIncome.toFixed(0)} | Despesas: R$${todayExpenses.toFixed(0)}
${todayLines}

TRANSAÇÕES DOS ÚLTIMOS 30 DIAS (${recentTx.length} registros):
${recentTxLines}

RESUMO GERAL:
  Receita total: R$${totalIncome.toFixed(0)}
  Despesas totais: R$${totalExpenses.toFixed(0)}
  Saldo líquido: R$${netBalance.toFixed(0)}
  Margem de lucro: ${margin}%
  Total de transações: ${transactions.length}

EVOLUÇÃO MENSAL (últimos 6 meses):
${recentMonths || "  Sem dados"}

PRINCIPAIS DESPESAS POR CATEGORIA:
${topCats || "  Sem dados"}

INSTRUÇÕES:
- Responda de forma direta e conversacional, como um amigo que entende de finanças
- Você TEM ACESSO a todas as transações individuais — use-as para responder perguntas específicas
- Cite datas, valores e descrições reais das transações quando relevante
- Se o usuário perguntar sobre hoje, use a seção HOJE
- Máximo de 3 parágrafos por resposta
- Use linguagem simples e direta, adequada para pequenos e médios empresários`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: message },
      ],
    });

    const reply = response.content[0].type === "text" ? response.content[0].text : "";
    logger.info({ userId, messageLen: message.length }, "Chat response generated");
    res.json({ reply });
  } catch (err) {
    logger.error({ err }, "Chat generation failed");
    res.status(500).json({ error: "Erro ao gerar resposta. Tente novamente." });
  }
});

export default router;
