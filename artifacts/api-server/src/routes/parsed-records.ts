import { Router } from "express";
import { db, parsedRecordsTable, rawInputsTable, transactionsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { UpdateParsedRecordBody, CreateParsedRecordsBody, ConfirmParsedRecordsBody } from "@workspace/api-zod";

const router = Router();

// GET /parsed-records — list parsed records (optionally filtered)
router.get("/parsed-records", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const rawInputId = req.query.rawInputId ? parseInt(String(req.query.rawInputId), 10) : null;

  let records;
  if (rawInputId) {
    records = await db
      .select()
      .from(parsedRecordsTable)
      .where(and(eq(parsedRecordsTable.userId, userId), eq(parsedRecordsTable.rawInputId, rawInputId)))
      .orderBy(parsedRecordsTable.date);
  } else {
    records = await db
      .select()
      .from(parsedRecordsTable)
      .where(eq(parsedRecordsTable.userId, userId))
      .orderBy(parsedRecordsTable.date);
  }

  res.json(records);
});

// PATCH /parsed-records/:id — update a parsed record
router.patch("/parsed-records/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = UpdateParsedRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(parsedRecordsTable)
    .where(and(eq(parsedRecordsTable.id, id), eq(parsedRecordsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Registro não encontrado." });
    return;
  }

  const [updated] = await db
    .update(parsedRecordsTable)
    .set(parsed.data)
    .where(eq(parsedRecordsTable.id, id))
    .returning();

  res.json(updated);
});

// DELETE /parsed-records/:id
router.delete("/parsed-records/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [existing] = await db
    .select()
    .from(parsedRecordsTable)
    .where(and(eq(parsedRecordsTable.id, id), eq(parsedRecordsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Registro não encontrado." });
    return;
  }

  await db.delete(parsedRecordsTable).where(eq(parsedRecordsTable.id, id));
  res.sendStatus(204);
});

// PATCH /parsed-records/bulk-update — update category/type on multiple records at once
router.patch("/parsed-records/bulk-update", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { ids, category, type } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids obrigatório." });
    return;
  }
  if (type !== undefined && type !== "income" && type !== "expense") {
    res.status(400).json({ error: "type inválido." });
    return;
  }

  const patch: Record<string, unknown> = {};
  if (typeof category === "string" && category.trim()) patch.category = category.trim();
  if (type) patch.type = type;

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Nada para atualizar." });
    return;
  }

  await db
    .update(parsedRecordsTable)
    .set(patch)
    .where(and(inArray(parsedRecordsTable.id, ids), eq(parsedRecordsTable.userId, userId)));

  res.json({ updatedCount: ids.length });
});

// POST /parsed-records/bulk — bulk create parsed records
router.post("/parsed-records/bulk", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const parsed = CreateParsedRecordsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { records, rawInputId } = parsed.data;

  // Verify the rawInput belongs to this user
  const [input] = await db
    .select({ id: rawInputsTable.id })
    .from(rawInputsTable)
    .where(and(eq(rawInputsTable.id, rawInputId), eq(rawInputsTable.userId, userId)));

  if (!input) {
    res.status(404).json({ error: "Upload não encontrado." });
    return;
  }

  const inserted = await db
    .insert(parsedRecordsTable)
    .values(
      records.map((r) => ({
        rawInputId,
        userId,
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
        category: r.category,
        quantity: r.quantity ?? null,
        confidence: null,
        isConfirmed: false,
      })),
    )
    .returning();

  res.status(201).json(inserted);
});

// POST /parsed-records/confirm — confirm all unconfirmed records and create transactions
router.post("/parsed-records/confirm", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const parsed = ConfirmParsedRecordsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { rawInputId } = parsed.data;

  // Get unconfirmed records for this upload
  const unconfirmed = await db
    .select()
    .from(parsedRecordsTable)
    .where(
      and(
        eq(parsedRecordsTable.rawInputId, rawInputId),
        eq(parsedRecordsTable.userId, userId),
        eq(parsedRecordsTable.isConfirmed, false),
      ),
    );

  if (unconfirmed.length === 0) {
    res.status(400).json({ error: "Nenhum registro para confirmar." });
    return;
  }

  // Create final Transaction records
  const transactions = await db
    .insert(transactionsTable)
    .values(
      unconfirmed.map((r) => ({
        userId,
        date: r.date,
        description: r.description,
        amount: r.amount,
        type: r.type,
        category: r.category,
        quantity: r.quantity,
        sourceRawInputId: r.rawInputId,
      })),
    )
    .returning();

  // Mark parsed records as confirmed
  await db
    .update(parsedRecordsTable)
    .set({ isConfirmed: true })
    .where(and(eq(parsedRecordsTable.rawInputId, rawInputId), eq(parsedRecordsTable.userId, userId)));

  res.json({ confirmedCount: transactions.length, transactions });
});

export default router;
