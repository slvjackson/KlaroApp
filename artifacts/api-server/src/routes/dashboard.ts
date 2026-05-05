import { Router } from "express";
import { db, transactionsTable, rawInputsTable, usersTable, userActivitiesTable, insightsTable } from "@workspace/db";
import { eq, and, gte, lte, isNull, isNotNull, count, sum } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { calculateStreak, getTodayBrasilia } from "../lib/daily-tasks";

const router = Router();

// GET /dashboard/summary — high-level business metrics
router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId));

  const uploads = await db
    .select({ id: rawInputsTable.id })
    .from(rawInputsTable)
    .where(eq(rawInputsTable.userId, userId));

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  // Find top category by transaction count
  const catCount = new Map<string, number>();
  for (const t of transactions) {
    catCount.set(t.category, (catCount.get(t.category) ?? 0) + 1);
  }
  const topCategoryEntry = [...catCount.entries()].sort((a, b) => b[1] - a[1])[0];

  res.json({
    totalIncome,
    totalExpenses,
    netBalance: totalIncome - totalExpenses,
    transactionCount: transactions.length,
    uploadCount: uploads.length,
    topCategory: topCategoryEntry?.[0] ?? null,
  });
});

// GET /dashboard/monthly-trend — income vs expenses by month
router.get("/dashboard/monthly-trend", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(transactionsTable.date);

  const monthMap = new Map<string, { income: number; expenses: number }>();

  for (const t of transactions) {
    const month = t.date.substring(0, 7); // YYYY-MM
    const existing = monthMap.get(month) ?? { income: 0, expenses: 0 };
    if (t.type === "income") existing.income += t.amount;
    else existing.expenses += t.amount;
    monthMap.set(month, existing);
  }

  const trend = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }));

  res.json(trend);
});

// GET /dashboard/by-category — transactions grouped by category
router.get("/dashboard/by-category", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId));

  // Key by "type::category" so income and expense categories are tracked separately
  const catMap = new Map<string, { total: number; count: number; type: string }>();

  for (const t of transactions) {
    const key = `${t.type}::${t.category}`;
    const existing = catMap.get(key) ?? { total: 0, count: 0, type: t.type };
    existing.total += t.amount;
    existing.count++;
    catMap.set(key, existing);
  }

  const breakdown = [...catMap.entries()]
    .map(([key, data]) => ({ category: key.split("::")[1], ...data }))
    .sort((a, b) => b.total - a.total);

  res.json(breakdown);
});

const ANAMNESE_FIELDS = [
  "tempoMercado", "tipoNegocio", "ticketMedio", "faixaFaturamento",
  "controleFinanceiro", "sabeLucro", "separaFinancas", "conheceCustos",
  "comoDecide", "deixouInvestir", "surpresaCaixa", "maiorDificuldade",
  "querMelhorar", "comMaisClareza",
];

// GET /dashboard/health-score — 0–100 business health score
router.get("/dashboard/health-score", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const now = new Date();

  // Compute last complete month (YYYY-MM)
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = lastMonthDate.toISOString().slice(0, 7);
  const lastMonthStart = `${lastMonth}-01`;
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const lastMonthEndStr = lastMonthEnd.toISOString().slice(0, 10);

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

  const [userRow, recentUploadRow, totalTxRow, outrosTxRow, lastMonthIncomeRow, lastMonthExpenseRow, activities, pinnedInsights] = await Promise.all([
    db.select({ businessProfile: usersTable.businessProfile }).from(usersTable).where(eq(usersTable.id, userId)).then((r) => r[0]),
    db.select({ id: rawInputsTable.id }).from(rawInputsTable).where(and(eq(rawInputsTable.userId, userId), gte(rawInputsTable.createdAt, thirtyDaysAgo))).limit(1),
    db.select({ c: count() }).from(transactionsTable).where(eq(transactionsTable.userId, userId)).then((r) => r[0]),
    db.select({ c: count() }).from(transactionsTable).where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.category, "Outros"))).then((r) => r[0]),
    db.select({ s: sum(transactionsTable.amount) }).from(transactionsTable).where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "income"), gte(transactionsTable.date, lastMonthStart), lte(transactionsTable.date, lastMonthEndStr))).then((r) => r[0]),
    db.select({ s: sum(transactionsTable.amount) }).from(transactionsTable).where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "expense"), gte(transactionsTable.date, lastMonthStart), lte(transactionsTable.date, lastMonthEndStr))).then((r) => r[0]),
    db.select({ activityDate: userActivitiesTable.activityDate }).from(userActivitiesTable).where(eq(userActivitiesTable.userId, userId)).orderBy(userActivitiesTable.activityDate).limit(400),
    db.select({ steps: insightsTable.steps, stepsProgress: insightsTable.stepsProgress }).from(insightsTable).where(and(eq(insightsTable.userId, userId), isNull(insightsTable.archivedAt), isNotNull(insightsTable.pinnedAt))),
  ]);

  const bp = (userRow?.businessProfile as Record<string, unknown> | null) ?? {};
  const filledFields = ANAMNESE_FIELDS.filter((f) => bp[f] != null && String(bp[f]).trim() !== "").length;
  const anamneseScore = Math.round((filledFields / ANAMNESE_FIELDS.length) * 20);

  const dadosScore = recentUploadRow.length > 0 ? 15 : 0;

  const totalTx = Number(totalTxRow?.c ?? 0);
  const outrosTx = Number(outrosTxRow?.c ?? 0);
  const categorizacaoScore = totalTx === 0 ? 0 : Math.round(((totalTx - outrosTx) / totalTx) * 15);

  const lastMonthIncome = Number(lastMonthIncomeRow?.s ?? 0);
  const lastMonthExpense = Number(lastMonthExpenseRow?.s ?? 0);
  const margemScore = lastMonthIncome > 0 && lastMonthIncome > lastMonthExpense ? 10 : 0;

  const activityDates = activities.map((a) => a.activityDate);
  const streak = await calculateStreak(userId, activityDates);
  const recentActivity = activityDates.some((d) => d >= sevenDaysAgoStr);
  const engajamentoScore = streak > 0 || recentActivity ? 25 : 0;

  // Missões: pinned insights + step completion
  const totalSteps = pinnedInsights.reduce((s, i) => s + (Array.isArray(i.steps) ? (i.steps as unknown[]).length : 0), 0);
  const completedSteps = pinnedInsights.reduce((s, i) => s + (Array.isArray(i.stepsProgress) ? (i.stepsProgress as boolean[]).filter(Boolean).length : 0), 0);
  let missoesScore = 0;
  if (pinnedInsights.length > 0) {
    missoesScore = totalSteps === 0 ? 5 : Math.max(5, Math.round((completedSteps / totalSteps) * 15));
  }

  const score = anamneseScore + dadosScore + categorizacaoScore + margemScore + engajamentoScore + missoesScore;

  res.json({
    score,
    components: {
      anamnese:      { value: anamneseScore,     max: 20, label: "Perfil do negócio",  filled: filledFields, total: ANAMNESE_FIELDS.length },
      dados:         { value: dadosScore,         max: 15, label: "Dados em dia" },
      categorizacao: { value: categorizacaoScore, max: 15, label: "Categorização",       pct: totalTx === 0 ? null : Math.round(((totalTx - outrosTx) / totalTx) * 100) },
      margem:        { value: margemScore,        max: 10, label: "Margem positiva" },
      engajamento:   { value: engajamentoScore,   max: 25, label: "Rotina diária",       streak },
      missoes:       { value: missoesScore,       max: 15, label: "Missões de insights", pinnedCount: pinnedInsights.length, completedSteps, totalSteps },
    },
  });
});

export default router;
