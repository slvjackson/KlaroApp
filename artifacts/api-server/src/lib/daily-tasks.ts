import { db, transactionsTable, parsedRecordsTable, insightsTable, usersTable, dailyTasksTable } from "@workspace/db";
import type { DailyTaskKey } from "@workspace/db";
import { eq, and, gte, isNull, count } from "drizzle-orm";
import { generateDailyQuestion } from "./daily-question";
import { logger } from "./logger";

// ─── Brasília-relative "today" ────────────────────────────────────────────────

export function getTodayBrasilia(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ─── Task pool definition ────────────────────────────────────────────────────

export interface TaskDefinition {
  key: DailyTaskKey;
  category: "data" | "reflection" | "engagement" | "content" | "onboarding";
  title: string;
  description: string;
  cta: string;
  deepLink: string;
  icon: string; // lucide icon name
}

export const TASK_DEFINITIONS: Record<DailyTaskKey, TaskDefinition> = {
  categorize_others: {
    key: "categorize_others",
    category: "data",
    title: "Categorize 3 transações em \"Outros\"",
    description: "Refina seus dados pra ter relatórios mais precisos.",
    cta: "Categorizar agora",
    deepLink: "/transactions?category=Outros",
    icon: "Tag",
  },
  review_top_expenses: {
    key: "review_top_expenses",
    category: "reflection",
    title: "Revise as 3 maiores despesas do mês",
    description: "Tem algo aí que dá pra cortar ou negociar?",
    cta: "Ver despesas",
    deepLink: "/transactions?type=expense",
    icon: "TrendingDown",
  },
  confirm_pending: {
    key: "confirm_pending",
    category: "data",
    title: "Confirme transações pendentes",
    description: "Você tem upload aguardando revisão.",
    cta: "Revisar",
    deepLink: "/upload",
    icon: "CheckCircle",
  },
  business_question: {
    key: "business_question",
    category: "reflection",
    title: "Pergunta do dia",
    description: "Reflexão de 1 minuto sobre seu negócio.",
    cta: "Responder",
    deepLink: "",
    icon: "MessageCircleQuestion",
  },
  ask_klaro: {
    key: "ask_klaro",
    category: "engagement",
    title: "Pergunte algo ao Klaro",
    description: "Tire uma dúvida sobre seu mês ou seu setor.",
    cta: "Conversar",
    deepLink: "/chat",
    icon: "Sparkles",
  },
  read_insight: {
    key: "read_insight",
    category: "content",
    title: "Confira 1 insight novo",
    description: "Você tem análises esperando atenção.",
    cta: "Ver insights",
    deepLink: "/insights",
    icon: "Lightbulb",
  },
  complete_anamnese: {
    key: "complete_anamnese",
    category: "onboarding",
    title: "Complete +1 campo do seu perfil",
    description: "Quanto mais completo, melhores os insights.",
    cta: "Completar",
    deepLink: "/anamnese",
    icon: "User",
  },
  set_revenue_goal: {
    key: "set_revenue_goal",
    category: "onboarding",
    title: "Defina sua meta de faturamento mensal",
    description: "Sem meta, não dá pra medir progresso.",
    cta: "Definir meta",
    deepLink: "/profile",
    icon: "Target",
  },
};

// ─── Eligibility check ────────────────────────────────────────────────────────

interface UserContext {
  userId: number;
  businessProfile: Record<string, unknown> | null;
  uncategorizedCount: number;
  monthlyTxCount: number;
  pendingParsedCount: number;
  insightCount: number;
}

async function loadUserContext(userId: number): Promise<UserContext> {
  const today = getTodayBrasilia();
  const monthStart = today.substring(0, 7) + "-01";

  const [user, uncatRow, monthTxRow, pendingRow, insightRow] = await Promise.all([
    db.select({ businessProfile: usersTable.businessProfile }).from(usersTable).where(eq(usersTable.id, userId)).then((r) => r[0]),
    db.select({ c: count() }).from(transactionsTable).where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.category, "Outros"))).then((r) => r[0]),
    db.select({ c: count() }).from(transactionsTable).where(and(eq(transactionsTable.userId, userId), gte(transactionsTable.date, monthStart))).then((r) => r[0]),
    db.select({ c: count() }).from(parsedRecordsTable).where(and(eq(parsedRecordsTable.userId, userId), eq(parsedRecordsTable.isConfirmed, false))).then((r) => r[0]),
    db.select({ c: count() }).from(insightsTable).where(and(eq(insightsTable.userId, userId), isNull(insightsTable.archivedAt))).then((r) => r[0]),
  ]);

  return {
    userId,
    businessProfile: (user?.businessProfile as Record<string, unknown> | null) ?? null,
    uncategorizedCount: Number(uncatRow?.c ?? 0),
    monthlyTxCount: Number(monthTxRow?.c ?? 0),
    pendingParsedCount: Number(pendingRow?.c ?? 0),
    insightCount: Number(insightRow?.c ?? 0),
  };
}

const ANAMNESE_FIELDS = [
  "tempoMercado", "tipoNegocio", "ticketMedio", "faixaFaturamento",
  "controleFinanceiro", "sabeLucro", "separaFinancas", "conheceCustos",
  "comoDecide", "deixouInvestir", "surpresaCaixa", "maiorDificuldade",
  "querMelhorar", "comMaisClareza",
];

function isEligible(key: DailyTaskKey, ctx: UserContext): boolean {
  const bp = ctx.businessProfile ?? {};
  switch (key) {
    case "categorize_others":
      return ctx.uncategorizedCount >= 3;
    case "review_top_expenses":
      return ctx.monthlyTxCount >= 10;
    case "confirm_pending":
      return ctx.pendingParsedCount > 0;
    case "business_question":
      return true;
    case "ask_klaro":
      return true;
    case "read_insight":
      return ctx.insightCount > 0;
    case "complete_anamnese": {
      const filled = ANAMNESE_FIELDS.filter((f) => bp[f] != null && String(bp[f]).trim() !== "").length;
      return filled < ANAMNESE_FIELDS.length;
    }
    case "set_revenue_goal":
      return bp.monthlyRevenueGoal == null;
  }
}

// ─── Pick 3 tasks with category balance ──────────────────────────────────────

const ALL_KEYS: DailyTaskKey[] = [
  "categorize_others", "review_top_expenses", "confirm_pending",
  "business_question", "ask_klaro", "read_insight",
  "complete_anamnese", "set_revenue_goal",
];

function pickTasks(eligible: DailyTaskKey[], seed: number): DailyTaskKey[] {
  // Group by category — try to pick 1 data, 1 reflection, 1 engagement/content
  const byCategory = new Map<string, DailyTaskKey[]>();
  for (const k of eligible) {
    const cat = TASK_DEFINITIONS[k].category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(k);
  }

  // Deterministic-ish shuffle: rotate by seed (day-of-year)
  const rotate = <T,>(arr: T[]): T[] => {
    if (arr.length === 0) return arr;
    const n = seed % arr.length;
    return [...arr.slice(n), ...arr.slice(0, n)];
  };

  const preferredOrder = ["data", "reflection", "engagement", "content", "onboarding"];
  const picked: DailyTaskKey[] = [];
  const usedCategories = new Set<string>();

  for (const cat of preferredOrder) {
    if (picked.length >= 3) break;
    const list = rotate(byCategory.get(cat) ?? []);
    if (list.length > 0) {
      picked.push(list[0]!);
      usedCategories.add(cat);
    }
  }

  // Fill remaining slots from any category (avoid duplicates)
  if (picked.length < 3) {
    const remaining = rotate(eligible.filter((k) => !picked.includes(k)));
    for (const k of remaining) {
      if (picked.length >= 3) break;
      picked.push(k);
    }
  }

  return picked;
}

// ─── Generate or fetch today's tasks ─────────────────────────────────────────

export interface GeneratedTask {
  id: number;
  key: DailyTaskKey;
  title: string;
  description: string;
  cta: string;
  deepLink: string;
  icon: string;
  category: string;
  params: Record<string, unknown> | null;
  completedAt: string | null;
}

export async function ensureTodaysTasks(userId: number): Promise<GeneratedTask[]> {
  const today = getTodayBrasilia();

  // Check existing tasks for today
  const existing = await db
    .select()
    .from(dailyTasksTable)
    .where(and(eq(dailyTasksTable.userId, userId), eq(dailyTasksTable.taskDate, today)));

  if (existing.length >= 3) {
    return existing.slice(0, 3).map(toGenerated);
  }

  // Need to generate fresh tasks
  const ctx = await loadUserContext(userId);
  const eligibleKeys = ALL_KEYS.filter((k) => isEligible(k, ctx));

  // Day-of-year as rotation seed for variety across days
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
  const picked = pickTasks(eligibleKeys, dayOfYear);

  if (picked.length === 0) {
    logger.warn({ userId }, "No eligible tasks for user — falling back to ask_klaro");
    picked.push("ask_klaro", "business_question");
  }

  // Generate question text for business_question if picked
  const params: Record<string, Record<string, unknown>> = {};
  if (picked.includes("business_question")) {
    const bp = ctx.businessProfile ?? {};
    const userRow = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).then((r) => r[0]);
    const question = await generateDailyQuestion(userId, {
      name: userRow?.name,
      segment: bp.segment as string | undefined,
      segmentCustomLabel: bp.segmentCustomLabel as string | undefined,
      maiorDificuldade: bp.maiorDificuldade as string | undefined,
      tempoMercado: bp.tempoMercado as string | undefined,
    });
    params.business_question = { question };
  }

  // Insert all picked tasks (skip if already there from a partial earlier generation)
  const existingKeys = new Set(existing.map((e) => e.taskKey));
  const toInsert = picked
    .filter((k) => !existingKeys.has(k))
    .map((k) => ({
      userId,
      taskDate: today,
      taskKey: k,
      params: params[k] ?? null,
    }));

  if (toInsert.length > 0) {
    await db.insert(dailyTasksTable).values(toInsert).onConflictDoNothing();
  }

  // Re-read everything for today
  const final = await db
    .select()
    .from(dailyTasksTable)
    .where(and(eq(dailyTasksTable.userId, userId), eq(dailyTasksTable.taskDate, today)))
    .orderBy(dailyTasksTable.id);

  return final.slice(0, 3).map(toGenerated);
}

function toGenerated(t: typeof dailyTasksTable.$inferSelect): GeneratedTask {
  const def = TASK_DEFINITIONS[t.taskKey];
  const params = (t.params as Record<string, unknown> | null) ?? null;

  // For business_question, use the dynamic title (the question itself)
  const title = t.taskKey === "business_question" && typeof params?.question === "string"
    ? (params.question as string)
    : def.title;

  return {
    id: t.id,
    key: t.taskKey,
    title,
    description: def.description,
    cta: def.cta,
    deepLink: def.deepLink,
    icon: def.icon,
    category: def.category,
    params,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
  };
}

// ─── Streak calculation ──────────────────────────────────────────────────────

export async function calculateStreak(userId: number, activityDates: string[]): Promise<number> {
  if (activityDates.length === 0) return 0;

  const today = getTodayBrasilia();
  const dates = new Set(activityDates);

  // Streak ends today (if active today) or yesterday (if not yet today)
  let cursor = new Date(today + "T00:00:00");
  if (!dates.has(today)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dates.has(cursor.toISOString().slice(0, 10))) return 0;
  }

  let streak = 0;
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
