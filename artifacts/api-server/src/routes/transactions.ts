import { Router } from "express";
import { db, transactionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

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
    .orderBy(transactionsTable.date)
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
