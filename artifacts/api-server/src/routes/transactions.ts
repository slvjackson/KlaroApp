import { Router } from "express";
import { db, transactionsTable, usersTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { getSegmentProfile } from "../prompts/segments/index";

const router = Router();

// POST /transactions — manually create a transaction
router.post("/transactions", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { date, description, amount, type, category } = req.body;

  if (!date || !description || amount == null || !type || !category) {
    res.status(400).json({ error: "Todos os campos são obrigatórios." });
    return;
  }
  if (type !== "income" && type !== "expense") {
    res.status(400).json({ error: "Tipo inválido." });
    return;
  }

  const [created] = await db
    .insert(transactionsTable)
    .values({ userId, date, description, amount: parseFloat(amount), type, category })
    .returning();

  res.status(201).json(created);
});

// PATCH /transactions/:id — edit a transaction
router.patch("/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id as string, 10);
  const { date, description, amount, type, category } = req.body;

  const [existing] = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Transação não encontrada." });
    return;
  }

  const [updated] = await db
    .update(transactionsTable)
    .set({
      ...(date !== undefined && { date }),
      ...(description !== undefined && { description }),
      ...(amount !== undefined && { amount: parseFloat(amount) }),
      ...(type !== undefined && { type }),
      ...(category !== undefined && { category }),
    })
    .where(eq(transactionsTable.id, id))
    .returning();

  res.json(updated);
});

// GET /transactions/categories — existing categories (by frequency) + segment suggestions
router.get("/transactions/categories", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  // Distinct categories ordered by how often they appear
  const rows = await db
    .select({ category: transactionsTable.category, count: sql<number>`count(*)::int` })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .groupBy(transactionsTable.category)
    .orderBy(desc(sql`count(*)`));

  const existing = rows.map((r) => r.category);

  // Segment-based suggestions (excluding already-used categories)
  const userRow = await db
    .select({ businessProfile: usersTable.businessProfile })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then((r) => r[0]);

  const bp = userRow?.businessProfile as Record<string, unknown> | null;
  const profile = getSegmentProfile(
    bp?.segment as string | undefined,
    bp?.segmentCustomLabel as string | undefined,
  );

  const existingLower = new Set(existing.map((c) => c.toLowerCase()));
  const suggestions = profile.categoriasComuns.filter(
    (c) => !existingLower.has(c.toLowerCase()),
  );

  res.json({ existing, suggestions });
});

// GET /transactions — list confirmed transactions with optional filters
router.get("/transactions", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 100;
  const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;

  // Build WHERE conditions in DB so type/category filters apply BEFORE the LIMIT.
  // The previous client-side filtering caused limit to cut across all types first,
  // meaning type-filtered results were a subset of the oldest N rows rather than
  // the oldest N rows of that type.
  const conditions: ReturnType<typeof eq>[] = [eq(transactionsTable.userId, userId)];
  if (req.query.type === "income" || req.query.type === "expense") {
    conditions.push(eq(transactionsTable.type, req.query.type as "income" | "expense"));
  }
  if (req.query.category && typeof req.query.category === "string") {
    conditions.push(eq(transactionsTable.category, req.query.category));
  }

  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(and(...conditions))
    .orderBy(desc(transactionsTable.date))
    .limit(limit)
    .offset(offset);

  res.json(transactions);
});

// DELETE /transactions/:id
router.delete("/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [transaction] = await db
    .select()
    .from(transactionsTable)
    .where(and(eq(transactionsTable.id, id), eq(transactionsTable.userId, userId)));

  if (!transaction) {
    res.status(404).json({ error: "Transação não encontrada." });
    return;
  }

  await db.delete(transactionsTable).where(eq(transactionsTable.id, id));
  res.sendStatus(204);
});

export default router;
