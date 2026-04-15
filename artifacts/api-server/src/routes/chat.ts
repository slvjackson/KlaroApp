import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db, transactionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";

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
    db.select({ name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .then((r) => r[0]),
    db.select().from(transactionsTable).where(eq(transactionsTable.userId, userId)),
  ]);

  // Build financial summary
  const income = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");
  const totalIncome = income.reduce((s, t) => s + t.amount, 0);
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
  const netBalance = totalIncome - totalExpenses;
  const margin = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : "0";

  // Monthly breakdown (last 3 months)
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
    .slice(0, 3)
    .map(([month, d]) => `  ${month}: receita R$${d.income.toFixed(0)}, despesas R$${d.expenses.toFixed(0)}`)
    .join("\n");

  // Top expense categories
  const catMap = new Map<string, number>();
  for (const t of expenses) catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount);
  const topCats = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cat, val]) => `  ${cat}: R$${val.toFixed(0)}`)
    .join("\n");

  const systemPrompt = `Você é o Klaro, um consultor financeiro de IA para pequenos e médios negócios brasileiros.
Você conversa diretamente com o dono do negócio, de forma simples, amigável e acionável.

PERFIL DO NEGÓCIO:
  Nome: ${userRow?.name ?? "Usuário"}

RESUMO FINANCEIRO ATUAL:
  Receita total: R$${totalIncome.toFixed(0)}
  Despesas totais: R$${totalExpenses.toFixed(0)}
  Saldo líquido: R$${netBalance.toFixed(0)}
  Margem de lucro: ${margin}%
  Total de transações: ${transactions.length}

ÚLTIMOS 3 MESES:
${recentMonths || "  Sem dados"}

PRINCIPAIS DESPESAS POR CATEGORIA:
${topCats || "  Sem dados"}

INSTRUÇÕES:
- Responda de forma direta e conversacional, como um amigo que entende de finanças
- Use os dados acima para dar respostas personalizadas e concretas
- Se o usuário perguntar algo que não está nos dados, diga que não tem essa informação
- Cite números reais quando relevante
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
