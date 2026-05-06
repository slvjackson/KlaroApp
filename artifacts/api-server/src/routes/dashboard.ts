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

// ─── Achievements & Levels ───────────────────────────────────────────────────

const ANAMNESE_FIELDS_ACHV = [
  "tempoMercado", "tipoNegocio", "ticketMedio", "faixaFaturamento",
  "controleFinanceiro", "sabeLucro", "separaFinancas", "conheceCustos",
  "comoDecide", "deixouInvestir", "surpresaCaixa", "maiorDificuldade",
  "querMelhorar", "comMaisClareza",
];

function computeMaxStreak(sortedUniqueDates: string[]): number {
  if (sortedUniqueDates.length === 0) return 0;
  let max = 1, cur = 1;
  for (let i = 1; i < sortedUniqueDates.length; i++) {
    const diffMs = new Date(sortedUniqueDates[i]).getTime() - new Date(sortedUniqueDates[i - 1]).getTime();
    const diffDays = Math.round(diffMs / 86_400_000);
    if (diffDays === 1) { cur++; if (cur > max) max = cur; }
    else if (diffDays > 1) cur = 1;
  }
  return max;
}

router.get("/dashboard/achievements", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [userRow, uploadCountRow, totalTxRow, outrosTxRow, allActivities, pinnedInsights, insightCountRow, allTransactions] = await Promise.all([
    db.select({ businessProfile: usersTable.businessProfile }).from(usersTable).where(eq(usersTable.id, userId)).then((r) => r[0]),
    db.select({ c: count() }).from(rawInputsTable).where(eq(rawInputsTable.userId, userId)).then((r) => r[0]),
    db.select({ c: count() }).from(transactionsTable).where(eq(transactionsTable.userId, userId)).then((r) => r[0]),
    db.select({ c: count() }).from(transactionsTable).where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.category, "Outros"))).then((r) => r[0]),
    db.select({ activityDate: userActivitiesTable.activityDate }).from(userActivitiesTable).where(eq(userActivitiesTable.userId, userId)).orderBy(userActivitiesTable.activityDate),
    db.select({ steps: insightsTable.steps, stepsProgress: insightsTable.stepsProgress }).from(insightsTable).where(and(eq(insightsTable.userId, userId), isNull(insightsTable.archivedAt), isNotNull(insightsTable.pinnedAt))),
    db.select({ c: count() }).from(insightsTable).where(and(eq(insightsTable.userId, userId), isNull(insightsTable.archivedAt))).then((r) => r[0]),
    db.select({ date: transactionsTable.date, type: transactionsTable.type, amount: transactionsTable.amount }).from(transactionsTable).where(eq(transactionsTable.userId, userId)),
  ]);

  const bp = (userRow?.businessProfile as Record<string, unknown> | null) ?? {};
  const filledAnamneseFields = ANAMNESE_FIELDS_ACHV.filter((f) => bp[f] != null && String(bp[f]).trim() !== "").length;

  const uniqueDates = [...new Set(allActivities.map((a) => String(a.activityDate)))].sort();
  const totalActiveDays = uniqueDates.length;
  const currentStreak = await calculateStreak(userId, uniqueDates);
  const maxStreak = computeMaxStreak(uniqueDates);

  const uploadCount = Number(uploadCountRow?.c ?? 0);
  const totalTx = Number(totalTxRow?.c ?? 0);
  const outrosTx = Number(outrosTxRow?.c ?? 0);
  const insightCount = Number(insightCountRow?.c ?? 0);

  // Find any month with positive margin
  const monthMap = new Map<string, { income: number; expense: number }>();
  for (const t of allTransactions) {
    const month = t.date.substring(0, 7);
    const m = monthMap.get(month) ?? { income: 0, expense: 0 };
    if (t.type === "income") m.income += t.amount; else m.expense += t.amount;
    monthMap.set(month, m);
  }
  const hasPositiveMonth = [...monthMap.values()].some((m) => m.income > 0 && m.income > m.expense);

  const anyStepCompleted = pinnedInsights.some(
    (i) => Array.isArray(i.stepsProgress) && (i.stepsProgress as boolean[]).some(Boolean),
  );

  const achievements = [
    { id: "primeiro_upload",        title: "Primeiro Upload",      description: "Enviou os primeiros dados financeiros",      category: "dados",        unlocked: uploadCount > 0 },
    { id: "anamnese_completa",      title: "Diagnóstico Completo", description: "Respondeu o diagnóstico do negócio",          category: "perfil",       unlocked: !!bp.anamneseCompleted || filledAnamneseFields >= ANAMNESE_FIELDS_ACHV.length },
    { id: "streak_7",               title: "Uma Semana Firme",     description: "7 dias consecutivos de uso",                 category: "engajamento",  unlocked: maxStreak >= 7 },
    { id: "streak_30",              title: "Mês de Ouro",          description: "30 dias consecutivos de uso",                category: "engajamento",  unlocked: maxStreak >= 30 },
    { id: "cem_transacoes",         title: "Centenário",           description: "100 transações importadas",                  category: "dados",        unlocked: totalTx >= 100 },
    { id: "primeira_missao",        title: "Missão Ativada",       description: "Ativou um plano de ação em Insights",        category: "insights",     unlocked: pinnedInsights.length > 0 },
    { id: "passo_concluido",        title: "Primeiro Passo",       description: "Concluiu o primeiro passo de uma missão",    category: "insights",     unlocked: anyStepCompleted },
    { id: "mes_positivo",           title: "No Azul",              description: "Registrou margem positiva em algum mês",     category: "financas",     unlocked: hasPositiveMonth },
    { id: "categorizacao_perfeita", title: "Tudo Organizado",      description: "Zero transações na categoria 'Outros'",      category: "dados",        unlocked: totalTx > 0 && outrosTx === 0 },
    { id: "cinco_insights",         title: "Gerador de Insights",  description: "Gerou 5 ou mais insights com a IA",          category: "insights",     unlocked: insightCount >= 5 },
  ];

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const points = totalActiveDays + unlockedCount * 5;

  let level: string, levelIndex: number, currentLevelStart: number, nextLevelThreshold: number;
  if (points >= 100)      { level = "Mestre";       levelIndex = 3; currentLevelStart = 100; nextLevelThreshold = 100; }
  else if (points >= 50)  { level = "Estrategista"; levelIndex = 2; currentLevelStart = 50;  nextLevelThreshold = 100; }
  else if (points >= 20)  { level = "Operador";     levelIndex = 1; currentLevelStart = 20;  nextLevelThreshold = 50; }
  else                    { level = "Iniciante";    levelIndex = 0; currentLevelStart = 0;   nextLevelThreshold = 20; }

  const levelPct = levelIndex === 3
    ? 100
    : Math.round(((points - currentLevelStart) / (nextLevelThreshold - currentLevelStart)) * 100);

  res.json({
    level, levelIndex, levelPct, points, nextLevelThreshold,
    totalActiveDays, currentStreak, achievements,
    unlockedCount, totalAchievements: achievements.length,
  });
});

export default router;
