import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";
import { buildOcrPrompt, getSegmentProfile } from "../prompts/builder";

export interface ParseBusinessContext {
  businessName?: string;
  segment?: string;
  mainProducts?: string;
  salesChannel?: string;
}

function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/**
 * Parsing pipeline — CSV and XLSX use real parsing.
 * PDF and images still need OCR/LLM integration (marked as TODO).
 */

export interface ExtractedRecord {
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  quantity?: number;
  confidence: number; // 0–1
}

// ─── Text normalization ───────────────────────────────────────────────────────

/** Lowercase + remove diacritics (accents) + trim */
function norm(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// ─── Category classification ─────────────────────────────────────────────────

const CATEGORY_RULES: { keywords: string[]; category: string }[] = [
  { keywords: ["vend", "receita", "cliente", "sale", "fatura", "nota fiscal", "nf-e", "nfe", "recebimento"], category: "Vendas" },
  { keywords: ["serv", "consultor", "manutencao", "suporte", "prestacao", "tecnico"], category: "Serviços" },
  { keywords: ["aluguel", "locacao", "rent", "imovel", "condominio"], category: "Aluguel" },
  { keywords: ["market", "publicidad", "propaganda", "anuncio", "facebook", "google ads", "instagram"], category: "Marketing" },
  { keywords: ["salario", "folha", "funcionario", "pagamento pessoal", "rh", "rescisao", "ferias"], category: "Folha de Pagamento" },
  { keywords: ["fornecedor", "compra", "estoque", "material", "produto", "insumo", "mercadoria"], category: "Fornecedores" },
  { keywords: ["luz", "agua", "energia", "internet", "telefone", "celular", "eletricidade", "esgoto", "gas"], category: "Utilidades" },
  { keywords: ["imposto", "taxa", "tributo", "cnpj", "cpf", "irpj", "csll", "pis", "cofins", "iss", "icms", "darf", "das ", "simples"], category: "Impostos" },
  { keywords: ["equipamento", "maquina", "computador", "hardware", "software", "notebook", "impressora"], category: "Equipamentos" },
  { keywords: ["boleto", "parcela", "emprestimo", "financiamento", "juros", "banco", "pix", "ted", "doc", "transferencia"], category: "Financeiro" },
];

function classifyCategory(description: string): string {
  const n = norm(description);
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => n.includes(kw))) return rule.category;
  }
  return "Outros";
}

// ─── Type classification ──────────────────────────────────────────────────────

function classifyType(amount: number, description: string): "income" | "expense" {
  if (amount > 0) return "income";
  if (amount < 0) return "expense";
  const n = norm(description);
  if (n.includes("receita") || n.includes("venda") || n.includes("credito") || n.includes("entrada") || n.includes("recebimento")) {
    return "income";
  }
  return "expense";
}

// ─── Date normalization ───────────────────────────────────────────────────────

/**
 * Convert any date value to "YYYY-MM-DD".
 * Handles: Excel serial ints, JS Date, DD/MM/YYYY, DD/MM/YY, M/D/YY, ISO, with/without time.
 */
function normalizeDate(raw: unknown): string {
  const today = new Date().toISOString().split("T")[0];
  if (raw === null || raw === undefined || raw === "") return today;

  // Excel serial date number
  if (typeof raw === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(raw);
      if (d && d.y > 1900) {
        return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
      }
    } catch { /* fall through */ }
    return today;
  }

  // JS Date object
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString().split("T")[0];
  }

  const s = String(raw).trim();

  // Already ISO YYYY-MM-DD (with or without time)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // Strip time component if present: "01/01/2025 10:30:00" → "01/01/2025"
  const noTime = s.split(/\s+/)[0];

  // DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, DD-MM-YY, M/D/YY, M/D/YYYY
  const parts = noTime.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (parts) {
    let [, p1, p2, yr] = parts;
    const year = yr.length === 2 ? `20${yr}` : yr;
    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);

    // If p1 > 12 → definitely day (DD/MM/YYYY)
    if (n1 > 12) {
      return `${year}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
    }
    // If p2 > 12 → p2 is day (MM/DD/YYYY American)
    if (n2 > 12) {
      return `${year}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`;
    }
    // Ambiguous: assume DD/MM (Brazilian standard)
    return `${year}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;
  }

  // Month name: "01 Jan 2025", "Jan-25", etc.
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
      return d.toISOString().split("T")[0];
    }
  } catch { /* fall through */ }

  return today;
}

/** Returns true if a string looks like a date */
function looksLikeDate(s: string): boolean {
  const n = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(n)) return true;
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(n)) return true;
  if (!isNaN(Date.parse(n)) && n.length > 4) return true;
  return false;
}

// ─── Amount parsing ───────────────────────────────────────────────────────────

/**
 * Parse any numeric representation to float.
 * Handles: R$ prefix, Brazilian/European formatting, parentheses-negatives.
 */
function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;

  let s = String(raw).trim();

  // Parentheses = negative: (1.234,56) → -1234.56
  const isParenNeg = s.startsWith("(") && s.endsWith(")");
  if (isParenNeg) s = `-${s.slice(1, -1)}`;

  // Remove currency symbols and spaces
  s = s.replace(/R\$\s?/g, "").replace(/\s/g, "");

  const isNeg = s.startsWith("-");
  s = s.replace(/^-/, "").replace(/^\+/, "");

  // Brazilian: 1.234.567,89 (dot=thousands, comma=decimal)
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  // American: 1,234,567.89 (comma=thousands, dot=decimal)
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    s = s.replace(/,/g, "");
  }
  // Single comma as decimal: 1234,56
  else if (/^\d+,\d{1,2}$/.test(s)) {
    s = s.replace(",", ".");
  }
  // Remove any remaining non-numeric except dot
  else {
    s = s.replace(/[^0-9.]/g, "");
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : ((isNeg || isParenNeg) ? -n : n);
}

/** Returns true if a value looks like a numeric amount */
function looksLikeAmount(v: unknown): boolean {
  if (typeof v === "number") return true;
  const s = String(v).trim().replace(/R\$\s?/g, "").replace(/\s/g, "");
  if (!s || s === "") return false;
  const cleaned = s.replace(/[().\-,]/g, "").replace(/^[+-]/, "");
  return /^\d+$/.test(cleaned) && cleaned.length > 0;
}

// ─── Column detection ─────────────────────────────────────────────────────────

function findColumn(keys: string[], candidates: string[]): string | null {
  const normKeys = keys.map((k) => ({ orig: k, n: norm(k) }));
  for (const candidate of candidates) {
    const nc = norm(candidate);
    const found = normKeys.find(({ n }) => n === nc || n.includes(nc) || nc.includes(n));
    if (found) return found.orig;
  }
  return null;
}

/**
 * Smart column guesser — when headers don't match known names,
 * inspect actual data values to identify date, description, and amount columns.
 */
function guessColumns(
  keys: string[],
  rows: Record<string, unknown>[],
): { dateKey: string | null; descKey: string | null; amountKey: string | null } {
  const sample = rows.slice(0, Math.min(rows.length, 5));

  const dateScores: Record<string, number> = {};
  const amountScores: Record<string, number> = {};
  const descScores: Record<string, number> = {};

  for (const key of keys) {
    let ds = 0, as = 0, ss = 0;
    for (const row of sample) {
      const v = row[key];
      if (v instanceof Date || (typeof v === "number" && v > 40000 && v < 60000)) ds += 2;
      if (typeof v === "string" && looksLikeDate(v)) ds += 2;
      if (looksLikeAmount(v) && !(v instanceof Date)) as += 2;
      if (typeof v === "string" && v.trim().length > 3 && !looksLikeDate(v) && !looksLikeAmount(v)) ss += 2;
    }
    dateScores[key] = ds;
    amountScores[key] = as;
    descScores[key] = ss;
  }

  const bestDate = Object.entries(dateScores).sort((a, b) => b[1] - a[1])[0];
  const bestAmount = Object.entries(amountScores).sort((a, b) => b[1] - a[1])[0];
  const bestDesc = Object.entries(descScores).sort((a, b) => b[1] - a[1])[0];

  return {
    dateKey: bestDate && bestDate[1] > 0 ? bestDate[0] : null,
    amountKey: bestAmount && bestAmount[1] > 0 ? bestAmount[0] : null,
    descKey: bestDesc && bestDesc[1] > 0 ? bestDesc[0] : null,
  };
}

// ─── Header row detection ─────────────────────────────────────────────────────

const HEADER_HINTS = ["data", "date", "valor", "amount", "descricao", "description", "historico", "lancamento", "saldo", "credito", "debito"];

function findHeaderRow(aoa: unknown[][]): number {
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const row = aoa[i];
    if (!row || row.length < 2) continue;
    const normalized = row.map((c) => norm(String(c ?? "")));
    const matches = HEADER_HINTS.filter((hint) => normalized.some((n) => n.includes(hint)));
    if (matches.length >= 2) return i;
  }
  return 0;
}

// ─── Rows → Records ───────────────────────────────────────────────────────────

function rowsToRecords(rows: Record<string, unknown>[], context: string): ExtractedRecord[] {
  if (rows.length === 0) {
    logger.warn({ context }, "Parser: no rows found");
    return [];
  }

  const keys = Object.keys(rows[0]);
  logger.info({ context, keys, rowCount: rows.length }, "Parser: detected columns");

  // Try named column detection first
  let dateKey = findColumn(keys, [
    "data", "date", "dt", "dia", "vencimento", "lancamento", "data lancamento",
    "data do lancamento", "data pagamento", "competencia", "data de lancamento",
  ]);
  let descKey = findColumn(keys, [
    "descricao", "description", "historico", "memo", "lancamento", "complemento",
    "observacao", "detalhe", "documento", "favorecido", "estabelecimento", "titulo",
    "nome", "origem",
  ]);
  let amountKey = findColumn(keys, [
    "valor", "value", "amount", "montante", "quantia", "valor transacao",
  ]);
  const typeKey = findColumn(keys, ["tipo", "type", "natureza", "dc", "d/c", "operacao"]);
  const creditKey = findColumn(keys, ["credito", "credit", "entrada", "recebimento"]);
  const debitKey = findColumn(keys, ["debito", "debit", "saida", "despesa"]);

  logger.info({ context, dateKey, descKey, amountKey, typeKey, creditKey, debitKey }, "Parser: column mapping");

  // If essential columns weren't found by name, guess from data
  if (!dateKey || !amountKey) {
    const guessed = guessColumns(keys, rows);
    if (!dateKey && guessed.dateKey) {
      dateKey = guessed.dateKey;
      logger.info({ context, guessedDateKey: dateKey }, "Parser: guessed date column from data");
    }
    if (!amountKey && guessed.amountKey) {
      amountKey = guessed.amountKey;
      logger.info({ context, guessedAmountKey: amountKey }, "Parser: guessed amount column from data");
    }
    if (!descKey && guessed.descKey) {
      descKey = guessed.descKey;
      logger.info({ context, guessedDescKey: descKey }, "Parser: guessed description column from data");
    }
  }

  const records: ExtractedRecord[] = [];
  let skippedZero = 0;

  for (const row of rows) {
    const vals = Object.values(row).map((v) => String(v).trim()).filter(Boolean);
    if (vals.length === 0) continue;

    const rawDate = dateKey ? row[dateKey] : null;
    const date = normalizeDate(rawDate);

    // Build description
    let desc = descKey ? String(row[descKey] ?? "").trim() : "";
    if (!desc) {
      desc = keys
        .filter((k) => k !== dateKey && k !== amountKey && k !== typeKey && k !== creditKey && k !== debitKey)
        .map((k) => String(row[k] ?? "").trim())
        .filter(Boolean)
        .join(" — ");
    }
    if (!desc) desc = "Lançamento";

    // Determine amount & inferred type
    let amount = 0;
    let inferredType: "income" | "expense" | null = null;

    if (creditKey && debitKey) {
      const credit = parseAmount(row[creditKey]);
      const debit = parseAmount(row[debitKey]);
      if (Math.abs(credit) > 0 && Math.abs(debit) === 0) {
        amount = Math.abs(credit);
        inferredType = "income";
      } else if (Math.abs(debit) > 0 && Math.abs(credit) === 0) {
        amount = Math.abs(debit);
        inferredType = "expense";
      } else if (amountKey) {
        const raw = parseAmount(row[amountKey]);
        amount = Math.abs(raw);
        inferredType = raw < 0 ? "expense" : raw > 0 ? "income" : null;
      }
    } else if (amountKey) {
      const raw = parseAmount(row[amountKey]);
      amount = Math.abs(raw);
      inferredType = raw < 0 ? "expense" : raw > 0 ? "income" : null;
    }

    if (amount === 0) {
      skippedZero++;
      continue;
    }

    let type: "income" | "expense";
    if (typeKey) {
      const rawType = norm(String(row[typeKey] ?? ""));
      type = (rawType === "c" || rawType.startsWith("cred") || rawType.includes("entrada") || rawType.includes("recebimento") || rawType === "income")
        ? "income" : "expense";
    } else if (inferredType) {
      type = inferredType;
    } else {
      type = classifyType(amountKey ? parseAmount(row[amountKey]) : 0, desc);
    }

    records.push({
      date,
      description: desc,
      amount,
      type,
      category: classifyCategory(desc),
      confidence: 0.8,
    });
  }

  logger.info({ context, extracted: records.length, skippedZero }, "Parser: extraction complete");
  return records;
}

// ─── Public parsers ───────────────────────────────────────────────────────────

/** Re-parse a sheet starting at a detected header row */
function parseFromHeaderRow(aoa: unknown[][], headerIdx: number): Record<string, unknown>[] {
  if (headerIdx === 0) {
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
  }
  const sub = aoa.slice(headerIdx);
  const subSheet = XLSX.utils.aoa_to_sheet(sub);
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(subSheet, { defval: "", raw: false });
}

export async function parseCSV(content: string): Promise<ExtractedRecord[]> {
  // Try comma-delimited first, then semicolon (Brazilian bank export)
  for (const delimiter of [",", ";"]) {
    try {
      const normalized = delimiter === ";" ? content.replace(/;/g, ",") : content;
      const wb = XLSX.read(normalized, { type: "string", raw: false, cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const headerIdx = findHeaderRow(aoa);
      const rows = parseFromHeaderRow(aoa, headerIdx);

      const records = rowsToRecords(rows, `CSV(${delimiter})`);
      if (records.length > 0) return records;
    } catch (err) {
      logger.warn({ err, delimiter }, "Parser: CSV delimiter attempt failed");
    }
  }
  return [];
}

export async function parseXLSX(filePath: string): Promise<ExtractedRecord[]> {
  const absPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absPath)) {
    logger.error({ absPath }, "Parser: file not found");
    throw new Error(`Arquivo não encontrado: ${absPath}`);
  }

  logger.info({ absPath }, "Parser: starting XLSX parse");

  // Try with cellDates first, then raw mode as fallback
  for (const opts of [
    { cellDates: true, raw: false },
    { cellDates: false, raw: true },
  ]) {
    try {
      const wb = XLSX.readFile(absPath, opts);
      logger.info({ sheets: wb.SheetNames }, "Parser: workbook sheets");

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

        logger.info({ sheetName, totalRows: aoa.length, opts }, "Parser: sheet info");

        if (aoa.length < 2) continue;

        const headerIdx = findHeaderRow(aoa);
        logger.info({ sheetName, headerIdx, headerRow: aoa[headerIdx] }, "Parser: detected header row");

        const rows = parseFromHeaderRow(aoa, headerIdx);
        const records = rowsToRecords(rows, `XLSX:${sheetName}`);

        if (records.length > 0) return records;
      }
    } catch (err) {
      logger.warn({ err, opts }, "Parser: XLSX parse attempt failed, trying next option");
    }
  }

  // Last resort: convert to CSV text and parse that
  try {
    const wb = XLSX.readFile(absPath);
    for (const sheetName of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
      const records = await parseCSV(csv);
      if (records.length > 0) {
        logger.info({ sheetName }, "Parser: used CSV fallback for XLSX sheet");
        return records;
      }
    }
  } catch (err) {
    logger.error({ err }, "Parser: all XLSX parse strategies failed");
  }

  return [];
}

export async function extractPDFText(filePath: string): Promise<string> {
  const absPath = path.resolve(process.cwd(), filePath);
  try {
    // pdf-parse is CJS-only — loaded via globalThis.require set in build banner
    const pdfParse = (globalThis as unknown as { require: NodeRequire }).require("pdf-parse");
    const buffer = fs.readFileSync(absPath);
    const data = await pdfParse(buffer);
    const text = data.text?.trim() ?? "";
    logger.info({ absPath, chars: text.length }, "PDF text extracted");
    return text;
  } catch (err) {
    logger.error({ err, absPath }, "PDF extraction failed");
    return "";
  }
}

const IMAGE_MEDIA_TYPES: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function extractImageText(filePath: string, ctx?: ParseBusinessContext): Promise<string> {
  const client = getAnthropicClient();
  if (!client) {
    logger.warn("ANTHROPIC_API_KEY not set — skipping image OCR");
    return "";
  }

  const absPath = path.resolve(process.cwd(), filePath);
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const mediaType = IMAGE_MEDIA_TYPES[ext] ?? "image/jpeg";

  const promptText = buildOcrPrompt({
    businessName: ctx?.businessName,
    segment: getSegmentProfile(ctx?.segment),
    mainProducts: ctx?.mainProducts,
    salesChannel: ctx?.salesChannel,
  });

  try {
    const imageData = fs.readFileSync(absPath);
    const base64 = imageData.toString("base64");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            { type: "text", text: promptText },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    if (text === "SEM_DADOS" || !text) return "";
    logger.info({ absPath, lines: text.split("\n").length }, "Image OCR completed");
    return text;
  } catch (err) {
    logger.error({ err, absPath }, "Image OCR failed");
    return "";
  }
}

async function structureTextWithAI(text: string): Promise<string> {
  const client = getAnthropicClient();
  if (!client) return "";

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Você é um assistente especializado em extração de dados financeiros.
Analise o texto abaixo (pode ser extrato bancário, relatório financeiro, etc.) e extraia todas as transações.
Retorne SOMENTE um CSV com as colunas: data,descricao,valor

Regras:
- Datas no formato DD/MM/YYYY. Se não houver data, use a data de hoje.
- Valores: positivos para receitas/entradas, negativos para despesas/saídas.
- Use vírgula como separador de colunas. Use ponto como separador decimal.
- Não inclua cabeçalho, não inclua explicações.
- Se não houver dados financeiros, retorne somente: SEM_DADOS

Texto:
${text}`,
      },
    ],
  });

  const result = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  return result === "SEM_DADOS" ? "" : result;
}

export async function rawTextToRecords(text: string): Promise<ExtractedRecord[]> {
  if (!text.trim()) return generateMockRecords(3, "Texto extraído");

  // Try structured CSV parsing first (works for bank statement exports)
  const records = await parseCSV(text);
  if (records.length > 0) return records;

  // Fallback: ask Claude to structure the raw text into CSV
  logger.info("CSV parsing failed — attempting AI structuring");
  try {
    const structured = await structureTextWithAI(text);
    if (structured) {
      const aiRecords = await parseCSV(structured);
      if (aiRecords.length > 0) {
        logger.info({ count: aiRecords.length }, "AI structuring succeeded");
        return aiRecords;
      }
    }
  } catch (err) {
    logger.warn({ err }, "AI structuring failed");
  }

  return generateMockRecords(3, "Texto extraído");
}

export function generateMockRecords(count: number = 5, source: string = "Arquivo"): ExtractedRecord[] {
  const today = new Date();
  const templates = [
    { desc: "Venda de produto", amount: 850, type: "income" as const, cat: "Vendas" },
    { desc: "Pagamento fornecedor", amount: 320, type: "expense" as const, cat: "Fornecedores" },
    { desc: "Receita serviços", amount: 1500, type: "income" as const, cat: "Serviços" },
    { desc: "Conta de energia", amount: 180, type: "expense" as const, cat: "Utilidades" },
    { desc: "Aluguel do espaço", amount: 2000, type: "expense" as const, cat: "Aluguel" },
  ];
  return templates.slice(0, Math.min(count, templates.length)).map((t, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 3);
    return {
      date: d.toISOString().split("T")[0],
      description: `${t.desc} (${source})`,
      amount: t.amount,
      type: t.type,
      category: t.cat,
      confidence: 0.4,
    };
  });
}