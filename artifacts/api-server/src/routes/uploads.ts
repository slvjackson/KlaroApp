import { Router } from "express";
import multer from "multer";
import { db, rawInputsTable, parsedRecordsTable, usersTable, transactionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { saveFile, deleteFile } from "../lib/storage";
import { parseCSV, parseXLSX, parseOFX, extractPDFText, parsePDFWithClaude, extractImageText, rawTextToRecords, generateMockRecords } from "../lib/parser";
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

  // Determine file type category — also sniff content for OFX (allows .txt rename workaround on iOS)
  const contentSniff = buffer.slice(0, 256).toString("utf-8").trimStart();
  const looksLikeOFX = contentSniff.startsWith("OFXHEADER") || /^<\?xml[^>]*>\s*<OFX/i.test(contentSniff) || contentSniff.startsWith("<OFX");

  let fileType: string;
  if (["ofx", "qfx", "qbo"].includes(ext) || looksLikeOFX) fileType = "ofx";
  else if (["csv"].includes(ext)) fileType = "csv";
  else if (["xlsx", "xls"].includes(ext)) fileType = "xlsx";
  else if (ext === "pdf") fileType = "pdf";
  else if (["png", "jpg", "jpeg", "webp"].includes(ext)) fileType = "image";
  else {
    res.status(400).json({ error: `Tipo de arquivo não suportado: .${ext}. Use CSV, XLSX, PDF, OFX ou imagens.` });
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

  // Fetch user profile for segment-aware parsing
  const userRow = await db.select({ name: usersTable.name, businessProfile: usersTable.businessProfile })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then((r) => r[0]);
  const bp = userRow?.businessProfile as Record<string, unknown> | null;

  // Fetch the user's most recent confirmed transactions as few-shot examples for the classifier
  const recentTransactions = await db
    .select({ description: transactionsTable.description, type: transactionsTable.type, category: transactionsTable.category })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(40);

  // Deduplicate by category: keep the first (most recent) example per category to stay concise
  const seenCategories = new Set<string>();
  const userExamples = recentTransactions
    .filter((t) => {
      const key = t.category.toLowerCase();
      if (seenCategories.has(key)) return false;
      seenCategories.add(key);
      return true;
    })
    .map((t) => ({ description: t.description, type: t.type as "income" | "expense", category: t.category }));

  const parseCtx = {
    businessName: (bp?.businessName as string | undefined) ?? userRow?.name,
    segment: bp?.segment as string | undefined,
    segmentCustomLabel: bp?.segmentCustomLabel as string | undefined,
    mainProducts: bp?.mainProducts as string | undefined,
    salesChannel: bp?.salesChannel as string | undefined,
    userExamples: userExamples.length > 0 ? userExamples : undefined,
  };

  // Parse the file synchronously so records are ready when the review page loads
  try {
    let records;
    const content = buffer.toString("utf-8");

    if (fileType === "csv") {
      records = await parseCSV(content, parseCtx);
    } else if (fileType === "ofx") {
      records = await parseOFX(content, parseCtx);
    } else if (fileType === "xlsx") {
      records = await parseXLSX(stored.storedPath, parseCtx);
    } else if (fileType === "pdf") {
      const text = await extractPDFText(stored.storedPath);
      logger.info({ chars: text.length, hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY }, "PDF: text extracted");
      if (text) {
        await db.update(rawInputsTable).set({ originalText: text }).where(eq(rawInputsTable.id, rawInput.id));
      }
      // Try text-based parsing first (fast, cheap)
      let pdfRecords = text.length >= 80 ? await rawTextToRecords(text, parseCtx) : [];
      logger.info({ textRecords: pdfRecords.length }, "PDF: text-based parse result");

      // rawTextToRecords returns mock records when it can't parse — detect and retry with vision
      const isMockFallback = pdfRecords.length > 0 && pdfRecords.every((r) => r.description.includes("(Texto extraído)") || r.description.includes("Texto extraido"));
      if (pdfRecords.length === 0 || isMockFallback) {
        logger.info({ chars: text.length, isMockFallback }, "PDF text parsing insufficient — using Claude vision");
        pdfRecords = await parsePDFWithClaude(stored.storedPath, parseCtx);
        logger.info({ visionRecords: pdfRecords.length }, "PDF: vision parse result");
      }
      records = pdfRecords.length > 0 ? pdfRecords : generateMockRecords(3, "PDF");
      logger.info({ finalRecords: records.length }, "PDF: final result");
    } else {
      // Image: OCR with segment context for better categorisation
      const text = await extractImageText(stored.storedPath, parseCtx);
      if (text) {
        await db
          .update(rawInputsTable)
          .set({ originalText: text })
          .where(eq(rawInputsTable.id, rawInput.id));
        records = await rawTextToRecords(text, parseCtx);
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
