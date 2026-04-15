import { Router } from "express";
import { db, transactionsTable, rawInputsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

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
  console.log("[trend] userId =", userId, "| auth header present:", !!req.headers.authorization);

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

  const catMap = new Map<string, { total: number; count: number }>();

  for (const t of transactions) {
    const existing = catMap.get(t.category) ?? { total: 0, count: 0 };
    existing.total += t.amount;
    existing.count++;
    catMap.set(t.category, existing);
  }

  const breakdown = [...catMap.entries()]
    .map(([category, data]) => ({ category, ...data }))
    .sort((a, b) => b.total - a.total);

  res.json(breakdown);
});

export default router;
