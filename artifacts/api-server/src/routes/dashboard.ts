import { Router } from "express";
import { db, transactionsTable, rawInputsTable, usersTable, userActivitiesTable, insightsTable } from "@workspace/db";
import { eq, and, gte, lte, isNull, isNotNull, count, sum, desc, inArray } from "drizzle-orm";
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

  const uniqueDates = ([...new Set(allActivities.map((a) => String(a.activityDate)))].sort()) as string[];
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

// ─── Card "Hoje" rotativo (Pilar 3) ──────────────────────────────────────────

type CardTone = "insight" | "comparison" | "warning" | "celebration";

interface DailyCard {
  id: string;
  tone: CardTone;
  icon: string;
  headline: string;
  body: string;
  metric?: { value: string; delta?: string; trend?: "up" | "down" | "flat" };
  cta?: { label: string; href: string };
}

interface MonthAgg {
  income: number;
  expense: number;
  byCatExpense: Map<string, number>;
  byCatIncome: Map<string, number>;
  txCount: number;
}

function emptyAgg(): MonthAgg {
  return { income: 0, expense: 0, byCatExpense: new Map(), byCatIncome: new Map(), txCount: 0 };
}

function shiftMonth(yyyymm: string, delta: number): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function fmtBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function fmtPct(v: number): string {
  return `${v >= 0 ? "+" : ""}${Math.round(v)}%`;
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function topEntries(m: Map<string, number>, n: number): Array<[string, number]> {
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

router.get("/dashboard/today-card", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const today = getTodayBrasilia();
  const currentMonth = today.slice(0, 7);
  const prevMonth = shiftMonth(currentMonth, -1);
  const dayOfMonth = parseInt(today.slice(8, 10), 10);

  const transactions = await db
    .select({ date: transactionsTable.date, type: transactionsTable.type, amount: transactionsTable.amount, category: transactionsTable.category })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId));

  if (transactions.length === 0) {
    res.json({
      id: "no_data",
      tone: "insight",
      icon: "Upload",
      headline: "Comece importando seus dados",
      body: "Suba uma planilha ou extrato para destravar análises diárias do seu negócio.",
      cta: { label: "Fazer upload", href: "/upload" },
    } satisfies DailyCard);
    return;
  }

  // Aggregate by month
  const months = new Map<string, MonthAgg>();
  for (const t of transactions) {
    const month = t.date.slice(0, 7);
    if (!months.has(month)) months.set(month, emptyAgg());
    const agg = months.get(month)!;
    agg.txCount++;
    if (t.type === "income") {
      agg.income += t.amount;
      agg.byCatIncome.set(t.category, (agg.byCatIncome.get(t.category) ?? 0) + t.amount);
    } else {
      agg.expense += t.amount;
      agg.byCatExpense.set(t.category, (agg.byCatExpense.get(t.category) ?? 0) + t.amount);
    }
  }

  const cur = months.get(currentMonth) ?? emptyAgg();
  const prev = months.get(prevMonth) ?? emptyAgg();

  // Month-to-date previous month (for fair mid-month comparison)
  const prevMtdAgg = emptyAgg();
  for (const t of transactions) {
    if (!t.date.startsWith(prevMonth)) continue;
    const d = parseInt(t.date.slice(8, 10), 10);
    if (d > dayOfMonth) continue;
    prevMtdAgg.txCount++;
    if (t.type === "income") {
      prevMtdAgg.income += t.amount;
      prevMtdAgg.byCatIncome.set(t.category, (prevMtdAgg.byCatIncome.get(t.category) ?? 0) + t.amount);
    } else {
      prevMtdAgg.expense += t.amount;
      prevMtdAgg.byCatExpense.set(t.category, (prevMtdAgg.byCatExpense.get(t.category) ?? 0) + t.amount);
    }
  }

  const candidates: DailyCard[] = [];

  // Template 1: maior categoria de despesa do mês atual
  if (cur.byCatExpense.size >= 2 && cur.expense > 0) {
    const [topCat, topVal] = topEntries(cur.byCatExpense, 1)[0];
    const pct = Math.round((topVal / cur.expense) * 100);
    if (pct >= 25) {
      candidates.push({
        id: "biggest_expense",
        tone: "insight",
        icon: "PieChart",
        headline: `${topCat} concentra ${pct}% das despesas`,
        body: `Você gastou ${fmtBRL(topVal)} em ${topCat} este mês. É a sua maior categoria de saída.`,
        metric: { value: `${pct}%`, trend: "flat" },
        cta: { label: "Ver categorias", href: "/transactions" },
      });
    }
  }

  // Template 2: categoria de despesa que mais cresceu vs mesmo período mês anterior
  if (prevMtdAgg.byCatExpense.size > 0 && cur.byCatExpense.size > 0 && cur.txCount >= 3) {
    let bestCat: string | null = null;
    let bestDelta = 0;
    let bestCurVal = 0;
    for (const [cat, curVal] of cur.byCatExpense) {
      const prevVal = prevMtdAgg.byCatExpense.get(cat) ?? 0;
      if (prevVal < 100) continue;
      const delta = ((curVal - prevVal) / prevVal) * 100;
      if (delta > bestDelta) { bestDelta = delta; bestCat = cat; bestCurVal = curVal; }
    }
    if (bestCat && bestDelta >= 20) {
      candidates.push({
        id: "expense_grew",
        tone: "warning",
        icon: "TrendingUp",
        headline: `${bestCat} subiu ${Math.round(bestDelta)}%`,
        body: `Você gastou ${fmtBRL(bestCurVal)} em ${bestCat} no mês até aqui — bem acima do mesmo período do mês anterior.`,
        metric: { value: fmtPct(bestDelta), trend: "up" },
        cta: { label: "Investigar", href: "/transactions" },
      });
    }
  }

  // Template 3: categoria de despesa que mais caiu (celebration) — usa MTD para comparação justa
  if (prevMtdAgg.byCatExpense.size > 0 && cur.txCount >= 5) {
    let bestCat: string | null = null;
    let bestDelta = 0;
    let bestSaving = 0;
    for (const [cat, prevVal] of prevMtdAgg.byCatExpense) {
      if (prevVal < 200) continue;
      const curVal = cur.byCatExpense.get(cat) ?? 0;
      const delta = ((curVal - prevVal) / prevVal) * 100;
      if (delta < bestDelta) { bestDelta = delta; bestCat = cat; bestSaving = prevVal - curVal; }
    }
    if (bestCat && bestDelta <= -15) {
      candidates.push({
        id: "expense_fell",
        tone: "celebration",
        icon: "TrendingDown",
        headline: `${bestCat} caiu ${Math.abs(Math.round(bestDelta))}%`,
        body: `Você economizou ${fmtBRL(bestSaving)} em ${bestCat} comparado ao mês anterior. Continue assim.`,
        metric: { value: fmtPct(bestDelta), trend: "down" },
      });
    }
  }

  // Template 4: receita que mais cresceu — MTD vs MTD
  if (prevMtdAgg.byCatIncome.size > 0 && cur.byCatIncome.size > 0 && cur.txCount >= 3) {
    let bestCat: string | null = null;
    let bestDelta = 0;
    let bestCurVal = 0;
    let bestPrevVal = 0;
    for (const [cat, curVal] of cur.byCatIncome) {
      const prevVal = prevMtdAgg.byCatIncome.get(cat) ?? 0;
      if (prevVal < 100) continue;
      const delta = ((curVal - prevVal) / prevVal) * 100;
      if (delta > bestDelta) { bestDelta = delta; bestCat = cat; bestCurVal = curVal; bestPrevVal = prevVal; }
    }
    if (bestCat && bestDelta >= 15) {
      candidates.push({
        id: "income_grew",
        tone: "celebration",
        icon: "TrendingUp",
        headline: `${bestCat} cresceu ${Math.round(bestDelta)}%`,
        body: `Você faturou ${fmtBRL(bestCurVal)} em ${bestCat} no mês até aqui, contra ${fmtBRL(bestPrevVal)} no mesmo período do mês anterior.`,
        metric: { value: fmtPct(bestDelta), trend: "up" },
      });
    }
  }

  // Template 5: margem mês até hoje vs mesmo período mês anterior
  if (prevMtdAgg.income > 0 && cur.income > 0) {
    const curMargin = cur.income - cur.expense;
    const prevMargin = prevMtdAgg.income - prevMtdAgg.expense;
    if (Math.abs(prevMargin) >= 200) {
      const delta = ((curMargin - prevMargin) / Math.abs(prevMargin)) * 100;
      if (Math.abs(delta) >= 15) {
        const isUp = delta > 0;
        candidates.push({
          id: "margin_compare",
          tone: isUp ? "celebration" : "warning",
          icon: isUp ? "TrendingUp" : "TrendingDown",
          headline: `Margem ${isUp ? "acima" : "abaixo"} do mês passado`,
          body: `Mês até aqui: ${fmtBRL(curMargin)}. No mesmo dia do mês anterior, você tinha ${fmtBRL(prevMargin)}.`,
          metric: { value: fmtPct(delta), trend: isUp ? "up" : "down" },
        });
      }
    }
  }

  // Template 6: concentração top 3 categorias de despesa
  if (cur.byCatExpense.size >= 4 && cur.expense > 0) {
    const top3 = topEntries(cur.byCatExpense, 3);
    const top3Sum = top3.reduce((s, [, v]) => s + v, 0);
    const pct = Math.round((top3Sum / cur.expense) * 100);
    if (pct >= 60) {
      candidates.push({
        id: "expense_concentration",
        tone: "comparison",
        icon: "BarChart3",
        headline: `3 categorias somam ${pct}% das despesas`,
        body: `${top3.map(([c]) => c).join(", ")} concentram a maior parte das suas saídas. Cortes aqui têm impacto maior.`,
        metric: { value: `${pct}%`, trend: "flat" },
        cta: { label: "Ver detalhes", href: "/transactions" },
      });
    }
  }

  // Fallback: nenhum template elegível
  if (candidates.length === 0) {
    const useAnchor = cur.txCount >= 3 ? cur : prev;
    const anchorLabel = cur.txCount >= 3 ? "Mês até aqui" : "Último mês fechado";
    const margin = useAnchor.income - useAnchor.expense;
    candidates.push({
      id: "fallback_summary",
      tone: margin >= 0 ? "celebration" : "warning",
      icon: "Sparkles",
      headline: `${anchorLabel}: ${margin >= 0 ? "no azul" : "no vermelho"}`,
      body: `${useAnchor.txCount} transações registradas, ${fmtBRL(useAnchor.income)} de entradas e ${fmtBRL(useAnchor.expense)} de saídas.`,
      metric: { value: fmtBRL(margin), trend: margin >= 0 ? "up" : "down" },
      cta: { label: "Ver insights", href: "/insights" },
    });
  }

  // Pick deterministically by (userId, today)
  const seed = hashSeed(`${userId}-${today}`);
  const pick = candidates[seed % candidates.length];

  res.json(pick);
});

// GET /dashboard/ranking — global ranking by active days
router.get("/dashboard/ranking", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  // Activity counts for all users, sorted desc
  const activityCounts = await db
    .select({ userId: userActivitiesTable.userId, pts: count() })
    .from(userActivitiesTable)
    .groupBy(userActivitiesTable.userId)
    .orderBy(desc(count()));

  const ranked = activityCounts.map((r, idx) => ({ userId: r.userId, pts: Number(r.pts), rank: idx + 1 }));

  let userEntry = ranked.find((r) => r.userId === userId);
  let userRank: number;
  let userPts: number;

  if (!userEntry) {
    userRank = ranked.length + 1;
    userPts = 0;
    userEntry = { userId, pts: 0, rank: userRank };
  } else {
    userRank = userEntry.rank;
    userPts = userEntry.pts;
  }

  const totalUsers = ranked.length + (userPts === 0 && !ranked.find((r) => r.userId === userId) ? 1 : 0);

  const above = ranked.filter((r) => r.rank < userRank).slice(-5);
  const below = ranked.filter((r) => r.rank > userRank).slice(0, 5);
  const nearbyEntries = [...above, userEntry, ...below];

  const nearbyIds = nearbyEntries.map((e) => e.userId);
  const users = nearbyIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable).where(inArray(usersTable.id, nearbyIds))
    : [];
  const nameMap = new Map(users.map((u) => [u.id, u.name ?? "Usuário"]));

  function maskName(name: string): string {
    return name.split(" ").map((w, i) => {
      if (w.length <= 1) return w;
      return i === 0 ? w[0] + "***" : w[0] + ".";
    }).join(" ");
  }

  const nearby = nearbyEntries.map((e) => ({
    rank: e.rank,
    name: e.userId === userId ? String(nameMap.get(userId) ?? "Você") : maskName(String(nameMap.get(e.userId) ?? "Usuário")),
    pts: e.pts,
    isCurrentUser: e.userId === userId,
  }));

  res.json({ userRank, userPts, totalUsers, nearby });
});

export default router;
