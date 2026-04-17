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

  const [userRow, transactions] = await Promise.all([
    db.select({ name: usersTable.name, businessProfile: usersTable.businessProfile })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .then((r) => r[0]),
    db.select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(transactionsTable.date),
  ]);

  const bp = userRow?.businessProfile as Record<string, unknown> | null;

  // Delete existing insights for the user (refresh)
  await db.delete(insightsTable).where(eq(insightsTable.userId, userId));

  const generated = await generateInsights(transactions, {
    businessName: (bp?.businessName as string | undefined) ?? userRow?.name,
    segment: bp?.segment as string | undefined,
    city: bp?.city as string | undefined,
    state: bp?.state as string | undefined,
    mainProducts: bp?.mainProducts as string | undefined,
    salesChannel: bp?.salesChannel as string | undefined,
    biggestChallenge: bp?.biggestChallenge as string | undefined,
  });

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

// POST /insights — save a single custom insight (e.g. from chat)
router.post("/insights", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { title, description, recommendation, periodLabel } = req.body as {
    title?: string;
    description?: string;
    recommendation?: string;
    periodLabel?: string;
  };

  if (!title?.trim() || !description?.trim()) {
    res.status(400).json({ error: "title e description são obrigatórios." });
    return;
  }

  const [inserted] = await db
    .insert(insightsTable)
    .values({
      userId,
      title: title.trim(),
      description: description.trim(),
      recommendation: recommendation?.trim() ?? "",
      periodLabel: periodLabel?.trim() ?? new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    })
    .returning();

  res.status(201).json(inserted);
});

export default router;
