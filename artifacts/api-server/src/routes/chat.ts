import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db, transactionsTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { logger } from "../lib/logger";
import { getSegmentProfile } from "../prompts/builder";

const router = Router();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function getTodayBrasilia(): string {
  // Railway runs in UTC; subtract 3h to get Brasília local date
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_transactions_today",
    description: "Busca todas as transações registradas hoje no banco de dados do usuário.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_transactions_by_date",
    description: "Busca todas as transações de uma data específica.",
    input_schema: {
      type: "object" as const,
      properties: {
        date: { type: "string", description: "Data no formato YYYY-MM-DD" },
      },
      required: ["date"],
    },
  },
  {
    name: "get_transactions_by_period",
    description: "Busca transações em um intervalo de datas. Útil para consultas de semana, mês específico, etc.",
    input_schema: {
      type: "object" as const,
      properties: {
        start_date: { type: "string", description: "Data início no formato YYYY-MM-DD" },
        end_date: { type: "string", description: "Data fim no formato YYYY-MM-DD" },
        type: {
          type: "string",
          enum: ["income", "expense"],
          description: "Filtrar por tipo (opcional)",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
  {
    name: "get_monthly_summary",
    description: "Retorna resumo mensal de receitas, despesas e saldo líquido dos últimos meses.",
    input_schema: {
      type: "object" as const,
      properties: {
        months: {
          type: "number",
          description: "Quantos meses incluir (padrão: 6)",
        },
      },
      required: [],
    },
  },
  {
    name: "get_category_breakdown",
    description: "Retorna totais agrupados por categoria para um período. Útil para saber onde está gastando mais.",
    input_schema: {
      type: "object" as const,
      properties: {
        start_date: { type: "string", description: "Data início YYYY-MM-DD" },
        end_date: { type: "string", description: "Data fim YYYY-MM-DD" },
        type: {
          type: "string",
          enum: ["income", "expense"],
          description: "Filtrar por tipo (opcional)",
        },
      },
      required: ["start_date", "end_date"],
    },
  },
];

// ─── Tool executor ───────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  userId: number,
): Promise<string> {
  const today = getTodayBrasilia();

  try {
    switch (name) {
      case "get_transactions_today": {
        const rows = await db
          .select()
          .from(transactionsTable)
          .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.date, today)))
          .orderBy(transactionsTable.date);
        const income = rows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const expenses = rows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        return JSON.stringify({ date: today, count: rows.length, total_income: income, total_expenses: expenses, transactions: rows });
      }

      case "get_transactions_by_date": {
        const date = String(input.date);
        const rows = await db
          .select()
          .from(transactionsTable)
          .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.date, date)))
          .orderBy(transactionsTable.date);
        const income = rows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const expenses = rows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        return JSON.stringify({ date, count: rows.length, total_income: income, total_expenses: expenses, transactions: rows });
      }

      case "get_transactions_by_period": {
        const startDate = String(input.start_date);
        const endDate = String(input.end_date);
        const conditions = [
          eq(transactionsTable.userId, userId),
          gte(transactionsTable.date, startDate),
          lte(transactionsTable.date, endDate),
        ];
        if (input.type === "income" || input.type === "expense") {
          conditions.push(eq(transactionsTable.type, input.type as "income" | "expense"));
        }
        const rows = await db
          .select()
          .from(transactionsTable)
          .where(and(...conditions))
          .orderBy(transactionsTable.date);
        const income = rows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const expenses = rows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        return JSON.stringify({ start_date: startDate, end_date: endDate, count: rows.length, total_income: income, total_expenses: expenses, transactions: rows });
      }

      case "get_monthly_summary": {
        const months = Number(input.months ?? 6);
        const rows = await db
          .select()
          .from(transactionsTable)
          .where(eq(transactionsTable.userId, userId));

        const monthMap = new Map<string, { income: number; expenses: number; count: number }>();
        for (const t of rows) {
          const month = t.date.substring(0, 7);
          const cur = monthMap.get(month) ?? { income: 0, expenses: 0, count: 0 };
          if (t.type === "income") cur.income += t.amount;
          else cur.expenses += t.amount;
          cur.count++;
          monthMap.set(month, cur);
        }

        const summary = [...monthMap.entries()]
          .sort(([a], [b]) => b.localeCompare(a))
          .slice(0, months)
          .map(([month, d]) => ({
            month,
            income: d.income,
            expenses: d.expenses,
            net: d.income - d.expenses,
            transaction_count: d.count,
          }));

        return JSON.stringify({ months: summary });
      }

      case "get_category_breakdown": {
        const startDate = String(input.start_date);
        const endDate = String(input.end_date);
        const conditions = [
          eq(transactionsTable.userId, userId),
          gte(transactionsTable.date, startDate),
          lte(transactionsTable.date, endDate),
        ];
        if (input.type === "income" || input.type === "expense") {
          conditions.push(eq(transactionsTable.type, input.type as "income" | "expense"));
        }
        const rows = await db
          .select()
          .from(transactionsTable)
          .where(and(...conditions));

        const catMap = new Map<string, { total: number; count: number; type: string }>();
        for (const t of rows) {
          const cur = catMap.get(t.category) ?? { total: 0, count: 0, type: t.type };
          cur.total += t.amount;
          cur.count++;
          catMap.set(t.category, cur);
        }

        const breakdown = [...catMap.entries()]
          .sort((a, b) => b[1].total - a[1].total)
          .map(([category, d]) => ({ category, total: d.total, count: d.count, type: d.type }));

        return JSON.stringify({ start_date: startDate, end_date: endDate, breakdown });
      }

      default:
        return JSON.stringify({ error: `Ferramenta desconhecida: ${name}` });
    }
  } catch (err) {
    logger.error({ err, tool: name }, "Tool execution failed");
    return JSON.stringify({ error: String(err) });
  }
}

// ─── Route ───────────────────────────────────────────────────────────────────

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

  const userRow = await db
    .select({ name: usersTable.name, businessProfile: usersTable.businessProfile })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then((r) => r[0]);

  const bp = userRow?.businessProfile as Record<string, unknown> | null;
  const segmentProfile = getSegmentProfile(
    bp?.segment as string | undefined,
    bp?.segmentCustomLabel as string | undefined,
  );
  const today = getTodayBrasilia();

  const anamneseLines: string[] = [];
  if (bp?.tempoMercado) anamneseLines.push(`Tempo no mercado: ${bp.tempoMercado}`);
  if (bp?.tipoNegocio) anamneseLines.push(`Tipo de negócio: ${bp.tipoNegocio}`);
  if (bp?.ticketMedio) anamneseLines.push(`Ticket médio: ${bp.ticketMedio}`);
  if (bp?.faixaFaturamento) anamneseLines.push(`Faixa de faturamento: ${bp.faixaFaturamento}`);
  if (bp?.controleFinanceiro) anamneseLines.push(`Controle financeiro atual: ${bp.controleFinanceiro}`);
  if (bp?.sabeLucro) anamneseLines.push(`Sabe se tem lucro: ${bp.sabeLucro}`);
  if (bp?.separaFinancas) anamneseLines.push(`Separa finanças pessoais/negócio: ${bp.separaFinancas}`);
  if (bp?.conheceCustos) anamneseLines.push(`Conhece custos fixos: ${bp.conheceCustos}`);
  if (bp?.comoDecide) anamneseLines.push(`Como decide financeiramente: ${bp.comoDecide}`);
  if (bp?.deixouInvestir) anamneseLines.push(`Já deixou de investir por falta de caixa: ${bp.deixouInvestir}`);
  if (bp?.surpresaCaixa) anamneseLines.push(`Já teve surpresa negativa no caixa: ${bp.surpresaCaixa}`);
  if (bp?.maiorDificuldade) anamneseLines.push(`Maior dificuldade financeira: ${bp.maiorDificuldade}`);
  if (bp?.querMelhorar) anamneseLines.push(`Quer melhorar em: ${bp.querMelhorar}`);
  if (bp?.comMaisClareza) anamneseLines.push(`Quer mais clareza sobre: ${bp.comMaisClareza}`);
  const anamneseSection = anamneseLines.length > 0
    ? `\nDIAGNÓSTICO DO NEGÓCIO (respondido pelo dono):\n${anamneseLines.map((l) => `  ${l}`).join("\n")}\n`
    : "";
  const obsSection = bp?.observacoesAdicionais
    ? `\nCONTEXTO ADICIONAL (escrito pelo dono — leia com atenção, reflete conhecimento direto sobre o mercado e a operação):\n  "${bp.observacoesAdicionais}"\n`
    : "";

  const systemPrompt = `Você é o Klaro, um consultor financeiro de IA para pequenos e médios negócios brasileiros.
Você conversa diretamente com o dono do negócio, de forma simples, amigável e acionável.
Tom de voz: ${segmentProfile.tom}
Data de hoje: ${today}

PERFIL DO NEGÓCIO:
  Nome: ${userRow?.name ?? "Usuário"}
  Segmento: ${segmentProfile.label}${bp?.segment === "outro" ? " (segmento não listado — use conhecimento geral de mercado para este setor)" : ""}
  Terminologia: receita = "${segmentProfile.terminologia.receita}", despesa = "${segmentProfile.terminologia.despesa}", cliente = "${segmentProfile.terminologia.cliente}"
  Foco de análise: ${segmentProfile.focoInsights}
${anamneseSection}${obsSection}

INFERÊNCIA DE DATAS (aplique sempre antes de chamar qualquer ferramenta):
- Apenas o dia (ex: "dia 5"): assuma mês e ano atuais
- Dia e mês sem ano (ex: "16/04"): assuma o ano atual
- Se a data resultante for posterior a hoje: recue para o mês anterior (ex: hoje é dia 10, usuário diz "dia 15" → mês passado)
- Nunca assuma uma data futura na ausência de ano explícito; sempre priorize o período vigente ou o passado imediato

INSTRUÇÕES:
- Use SEMPRE as ferramentas disponíveis para buscar dados antes de responder perguntas financeiras
- Para "hoje", "agora", "vendas de hoje" → use get_transactions_today
- Para datas ou períodos específicos → use get_transactions_by_date ou get_transactions_by_period
- Para visão geral de meses → use get_monthly_summary
- Para saber onde gasta mais → use get_category_breakdown
- Cite números reais dos dados retornados pelas ferramentas
- Máximo de 3 parágrafos por resposta
- Use linguagem simples e direta`;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const messages: Anthropic.MessageParam[] = [
      ...history.map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
      { role: "user", content: message },
    ];

    let response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });

    // Agentic loop — execute tools until the model is done
    const debugToolResults: { tool: string; input: Record<string, unknown>; result: string }[] = [];
    while (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          logger.info({ tool: block.name, input: block.input, userId }, "Executing tool");
          const result = await executeTool(block.name, block.input as Record<string, unknown>, userId);
          logger.info({ tool: block.name, result }, "Tool result");
          debugToolResults.push({ tool: block.name, input: block.input as Record<string, unknown>, result });
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
        }
      }

      messages.push({ role: "user", content: toolResults });

      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      });
    }

    const reply = response.content.find((b) => b.type === "text")?.text ?? "";
    logger.info({ userId, messageLen: message.length }, "Chat response generated");
    res.json({ reply, _debug: { today, userId, toolResults: debugToolResults } });
  } catch (err) {
    logger.error({ err }, "Chat generation failed");
    res.status(500).json({ error: "Erro ao gerar resposta. Tente novamente." });
  }
});

export default router;
