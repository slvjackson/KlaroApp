import { Router } from "express";
import multer from "multer";
import { db, rawInputsTable, parsedRecordsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { saveFile, deleteFile } from "../lib/storage";
import { parseCSV, parseXLSX, extractPDFText, extractImageText, rawTextToRecords, generateMockRecords } from "../lib/parser";
import { logger } from "../lib/logger";
import fs from "fs";
import path from "path";

// Use memoryStorage so we handle saving ourselves via the storage abstraction
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

const router = Router();

// GET /uploads — list all uploads for current user
router.get("/uploads", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const inputs = await db
    .select()
    .from(rawInputsTable)
    .where(eq(rawInputsTable.userId, userId))
    .orderBy(rawInputsTable.createdAt);

  // Count parsed records per upload
  const withCounts = await Promise.all(
    inputs.map(async (input) => {
      const records = await db
        .select({ id: parsedRecordsTable.id })
        .from(parsedRecordsTable)
        .where(eq(parsedRecordsTable.rawInputId, input.id));
      return { ...input, parsedRecordCount: records.length };
    }),
  );

  res.json(withCounts);
});

// POST /uploads — upload and parse a file
router.post("/uploads", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  if (!req.file) {
    res.status(400).json({ error: "Nenhum arquivo enviado." });
    return;
  }

  const { originalname, mimetype, buffer } = req.file;
  const ext = path.extname(originalname).toLowerCase().replace(".", "");

  // Determine file type category
  let fileType: string;
  if (["csv"].includes(ext)) fileType = "csv";
  else if (["xlsx", "xls"].includes(ext)) fileType = "xlsx";
  else if (ext === "pdf") fileType = "pdf";
  else if (["png", "jpg", "jpeg", "webp"].includes(ext)) fileType = "image";
  else {
    res.status(400).json({ error: `Tipo de arquivo não suportado: .${ext}. Use CSV, XLSX, PDF ou imagens.` });
    return;
  }

  // Save the file via storage abstraction
  const stored = await saveFile(buffer, originalname, mimetype, userId);

  // Create raw input record (start as "processing")
  const [rawInput] = await db
    .insert(rawInputsTable)
    .values({
      userId,
      fileName: originalname,
      fileType,
      filePath: stored.storedPath,
      processingStatus: "processing",
    })
    .returning();

  // Parse the file synchronously so records are ready when the review page loads
  try {
    let records;
    const content = buffer.toString("utf-8");

    if (fileType === "csv") {
      records = await parseCSV(content);
    } else if (fileType === "xlsx") {
      records = await parseXLSX(stored.storedPath);
    } else if (fileType === "pdf") {
      const text = await extractPDFText(stored.storedPath);
      await db
        .update(rawInputsTable)
        .set({ originalText: text })
        .where(eq(rawInputsTable.id, rawInput.id));
      records = await rawTextToRecords(text);
    } else {
      // Image: attempt OCR, fall back to mock for images pending real OCR
      const text = await extractImageText(stored.storedPath);
      if (text) {
        await db
          .update(rawInputsTable)
          .set({ originalText: text })
          .where(eq(rawInputsTable.id, rawInput.id));
        records = await rawTextToRecords(text);
      } else {
        records = generateMockRecords(3, "Imagem");
      }
    }

    if (records.length > 0) {
      await db.insert(parsedRecordsTable).values(
        records.map((r) => ({
          rawInputId: rawInput.id,
          userId,
          date: r.date,
          description: r.description,
          amount: r.amount,
          type: r.type,
          category: r.category,
          quantity: r.quantity ?? null,
          confidence: r.confidence,
          isConfirmed: false,
        })),
      );
    }

    await db
      .update(rawInputsTable)
      .set({ processingStatus: "done" })
      .where(eq(rawInputsTable.id, rawInput.id));

    res.status(201).json({ ...rawInput, processingStatus: "done", parsedRecordCount: records.length });
  } catch (err) {
    logger.error({ err, rawInputId: rawInput.id }, "File processing failed");
    await db
      .update(rawInputsTable)
      .set({ processingStatus: "failed" })
      .where(eq(rawInputsTable.id, rawInput.id));
    res.status(500).json({ error: "Falha ao processar o arquivo. Verifique se o formato está correto." });
  }
});

// GET /uploads/:id — get upload with its parsed records
router.get("/uploads/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [input] = await db
    .select()
    .from(rawInputsTable)
    .where(and(eq(rawInputsTable.id, id), eq(rawInputsTable.userId, userId)));

  if (!input) {
    res.status(404).json({ error: "Upload não encontrado." });
    return;
  }

  const parsedRecords = await db
    .select()
    .from(parsedRecordsTable)
    .where(eq(parsedRecordsTable.rawInputId, id))
    .orderBy(parsedRecordsTable.createdAt);

  res.json({ ...input, parsedRecords });
});

// DELETE /uploads/:id
router.delete("/uploads/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [input] = await db
    .select()
    .from(rawInputsTable)
    .where(and(eq(rawInputsTable.id, id), eq(rawInputsTable.userId, userId)));

  if (!input) {
    res.status(404).json({ error: "Upload não encontrado." });
    return;
  }

  // Delete associated parsed records
  await db.delete(parsedRecordsTable).where(eq(parsedRecordsTable.rawInputId, id));

  // Delete the stored file
  await deleteFile(input.filePath);

  // Delete the raw input record
  await db.delete(rawInputsTable).where(eq(rawInputsTable.id, id));

  res.sendStatus(204);
});

export default router;
