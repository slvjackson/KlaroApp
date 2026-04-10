import { Router } from "express";
import { db, insightsTable, transactionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { generateInsights } from "../lib/insights-engine";

const router = Router();

// GET /insights — list insights for current user
router.get("/insights", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const insights = await db
    .select()
    .from(insightsTable)
    .where(eq(insightsTable.userId, userId))
    .orderBy(insightsTable.createdAt);

  res.json(insights);
});

// POST /insights/generate — generate fresh insights from transaction data
router.post("/insights/generate", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const [transactions, userRow] = await Promise.all([
    db.select().from(transactionsTable).where(eq(transactionsTable.userId, userId)).orderBy(transactionsTable.date),
    db.select({ businessProfile: usersTable.businessProfile }).from(usersTable).where(eq(usersTable.id, userId)),
  ]);

  const bp = userRow[0]?.businessProfile;
  const ctx = bp
    ? {
        businessName: bp.businessName,
        segment: bp.segment,
        city: bp.city,
        state: bp.state,
        employeeCount: bp.employeeCount,
        monthlyRevenueGoal: bp.monthlyRevenueGoal,
        profitMarginGoal: bp.profitMarginGoal,
        mainProducts: bp.mainProducts,
        salesChannel: bp.salesChannel,
        biggestChallenge: bp.biggestChallenge,
      }
    : undefined;

  // Delete existing insights for the user (refresh)
  await db.delete(insightsTable).where(eq(insightsTable.userId, userId));

  const generated = await generateInsights(transactions, ctx);

  if (generated.length === 0) {
    res.json([]);
    return;
  }

  const inserted = await db
    .insert(insightsTable)
    .values(
      generated.map((g) => ({
        userId,
        title: g.title,
        description: g.description,
        recommendation: g.recommendation,
        periodLabel: g.periodLabel,
      })),
    )
    .returning();

  res.json(inserted);
});

export default router;
