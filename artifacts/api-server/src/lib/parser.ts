import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

/**
 * Parsing pipeline abstraction.
 * CSV and XLSX use real parsing. PDF and images have structural stubs.
 *
 * TODO: Replace extractPDFText with pdf-parse for real PDF extraction.
 * TODO: Replace extractImageText with a real OCR service (Tesseract, Google Vision, AWS Textract).
 * TODO: Replace rawTextToRecords with LLM-based structured extraction (GPT-4o, Claude).
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Classify a description string into a business category.
 * TODO: Replace with LLM-based classification for better accuracy.
 */
function classifyCategory(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes("vend") || lower.includes("receita") || lower.includes("cliente") || lower.includes("sale")) return "Vendas";
  if (lower.includes("serv") || lower.includes("consultor") || lower.includes("manutenção")) return "Serviços";
  if (lower.includes("aluguel") || lower.includes("locação") || lower.includes("rent")) return "Aluguel";
  if (lower.includes("market") || lower.includes("publicidad") || lower.includes("propaganda") || lower.includes("anúncio")) return "Marketing";
  if (lower.includes("salário") || lower.includes("folha") || lower.includes("funcionário") || lower.includes("pagamento pessoal")) return "Folha de Pagamento";
  if (lower.includes("fornecedor") || lower.includes("compra") || lower.includes("estoque") || lower.includes("material")) return "Fornecedores";
  if (lower.includes("luz") || lower.includes("água") || lower.includes("energia") || lower.includes("internet") || lower.includes("telefone")) return "Utilidades";
  if (lower.includes("imposto") || lower.includes("taxa") || lower.includes("tributo") || lower.includes("cnpj") || lower.includes("nf")) return "Impostos";
  if (lower.includes("equipamento") || lower.includes("máquina") || lower.includes("computador") || lower.includes("hardware")) return "Equipamentos";
  return "Outros";
}

/**
 * Determine transaction type from amount sign and/or description keywords.
 */
function classifyType(amount: number, description: string): "income" | "expense" {
  if (amount > 0) return "income";
  if (amount < 0) return "expense";
  const lower = description.toLowerCase();
  if (lower.includes("receita") || lower.includes("venda") || lower.includes("crédito") || lower.includes("entrada")) return "income";
  return "expense";
}

/**
 * Normalise a raw date value (string or Excel serial number) to YYYY-MM-DD.
 * Handles: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, Excel serial numbers, JS Date objects.
 */
function normalizeDate(raw: unknown): string {
  const today = new Date().toISOString().split("T")[0];
  if (!raw) return today;

  // Excel serial date number (e.g. 45123)
  if (typeof raw === "number") {
    try {
      const d = XLSX.SSF.parse_date_code(raw);
      if (d) {
        const m = String(d.m).padStart(2, "0");
        const day = String(d.d).padStart(2, "0");
        return `${d.y}-${m}-${day}`;
      }
    } catch {
      // fall through
    }
    return today;
  }

  // JS Date (sometimes xlsx returns these)
  if (raw instanceof Date) {
    return raw.toISOString().split("T")[0];
  }

  const s = String(raw).trim();

  // DD/MM/YYYY or DD-MM-YYYY
  const brMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.split("T")[0];

  // Try JS Date parse as last resort
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {
    // fall through
  }

  return today;
}

/**
 * Parse a value to a number, handling Brazilian number formatting (1.234,56 → 1234.56).
 */
function parseAmount(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  const s = String(raw).trim();
  // Remove currency symbols and spaces
  const cleaned = s.replace(/[R$\s]/g, "").trim();
  // Brazilian format: 1.234,56
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", ".")) || 0;
  }
  // May already be a plain decimal
  return parseFloat(cleaned.replace(",", ".")) || 0;
}

/**
 * Given a list of row keys (column headers), find the best match for a semantic field.
 * Matching is case-insensitive and accent-insensitive.
 */
function findColumn(keys: string[], candidates: string[]): string | null {
  const normalize = (s: string) =>
    s.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const normKeys = keys.map(normalize);
  for (const candidate of candidates) {
    const normCandidate = normalize(candidate);
    const idx = normKeys.findIndex((k) => k === normCandidate || k.includes(normCandidate) || normCandidate.includes(k));
    if (idx >= 0) return keys[idx];
  }
  return null;
}

/**
 * Convert an array of raw row objects (from xlsx) into ExtractedRecord[].
 * Robustly finds date, description, and amount columns regardless of column names.
 */
function rowsToRecords(rows: Record<string, unknown>[]): ExtractedRecord[] {
  if (rows.length === 0) return [];

  const keys = Object.keys(rows[0]);

  // Find columns by common header names (Portuguese + English)
  const dateKey = findColumn(keys, ["data", "date", "dt", "dia", "vencimento", "lancamento", "lançamento", "data lancamento"]);
  const descKey = findColumn(keys, [
    "descricao", "descrição", "description", "historico", "histórico", "memo",
    "lancamento", "lançamento", "complemento", "observacao", "observação", "detalhe"
  ]);
  const amountKey = findColumn(keys, ["valor", "value", "amount", "montante", "quantia", "credito", "crédito", "debito", "débito", "saldo"]);
  const typeKey = findColumn(keys, ["tipo", "type", "natureza", "dc", "d/c", "credito/debito", "operacao", "operação"]);
  const creditKey = findColumn(keys, ["credito", "crédito", "credit", "entrada", "receita"]);
  const debitKey = findColumn(keys, ["debito", "débito", "debit", "saida", "saída", "despesa"]);

  const records: ExtractedRecord[] = [];

  for (const row of rows) {
    // Determine date
    const rawDate = dateKey ? row[dateKey] : null;
    const date = normalizeDate(rawDate);

    // Determine description
    let desc = descKey ? String(row[descKey] ?? "").trim() : "";

    // If no description column, join all non-numeric columns
    if (!desc) {
      desc = keys
        .filter((k) => k !== dateKey && k !== amountKey && k !== typeKey && k !== creditKey && k !== debitKey)
        .map((k) => String(row[k] ?? "").trim())
        .filter(Boolean)
        .join(" – ");
    }

    if (!desc) desc = "Lançamento";

    // Determine amount — handle separate credit/debit columns (common in bank exports)
    let amount = 0;
    let inferredType: "income" | "expense" | null = null;

    if (creditKey && debitKey) {
      const credit = parseAmount(row[creditKey]);
      const debit = parseAmount(row[debitKey]);
      if (credit > 0 && debit === 0) {
        amount = credit;
        inferredType = "income";
      } else if (debit > 0 && credit === 0) {
        amount = debit;
        inferredType = "expense";
      } else if (amountKey) {
        amount = Math.abs(parseAmount(row[amountKey]));
      }
    } else if (amountKey) {
      const raw = parseAmount(row[amountKey]);
      amount = Math.abs(raw);
      if (raw < 0) inferredType = "expense";
      else if (raw > 0) inferredType = "income";
    }

    // Skip rows with zero or missing amount
    if (amount === 0) continue;

    // Determine type
    let type: "income" | "expense";
    if (typeKey) {
      const rawType = String(row[typeKey] ?? "").toLowerCase();
      if (rawType.includes("c") || rawType.includes("income") || rawType.includes("entrada") || rawType.includes("crédito")) {
        type = "income";
      } else {
        type = "expense";
      }
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

  return records;
}

// ─── Public parsers ───────────────────────────────────────────────────────────

/**
 * Parse CSV file content into extracted records.
 * Handles comma and semicolon delimiters, and Brazilian date formats.
 */
export async function parseCSV(content: string): Promise<ExtractedRecord[]> {
  // Detect delimiter: semicolon (common in Brazilian exports) or comma
  const firstLine = content.split(/\r?\n/)[0] ?? "";
  const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";

  // Use xlsx to parse CSV uniformly (handles encoding edge cases)
  const workbook = XLSX.read(content, { type: "string", raw: false, cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const records = rowsToRecords(rows);

  // Fallback: if xlsx couldn't parse it, try manual split
  if (records.length === 0) {
    return parseCSVManual(content, delimiter);
  }

  return records;
}

/**
 * Manual CSV fallback parser for edge cases.
 */
function parseCSVManual(content: string, delimiter: string): ExtractedRecord[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/['"]/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

  const getCol = (row: string[], names: string[]): string => {
    for (const name of names) {
      const idx = header.indexOf(name);
      if (idx >= 0) return (row[idx] ?? "").replace(/['"]/g, "").trim();
    }
    return "";
  };

  const records: ExtractedRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter);
    const rawDate = getCol(row, ["data", "date", "dt", "dia"]);
    const desc = getCol(row, ["descricao", "description", "historico", "memo", "lancamento", "complemento"]);
    const rawAmount = getCol(row, ["valor", "value", "amount", "montante", "quantia"]);
    const rawType = getCol(row, ["tipo", "type", "natureza", "dc"]);

    if (!rawAmount && !desc) continue;

    const amount = parseAmount(rawAmount);
    const absAmount = Math.abs(amount);
    if (absAmount === 0) continue;

    const type = rawType
      ? (rawType.toLowerCase().startsWith("c") || rawType.toLowerCase().includes("entrada") ? "income" : "expense")
      : classifyType(amount, desc);

    records.push({
      date: normalizeDate(rawDate),
      description: desc || `Linha ${i}`,
      amount: absAmount,
      type,
      category: classifyCategory(desc),
      confidence: 0.8,
    });
  }
  return records;
}

/**
 * Parse an Excel XLSX (or XLS) file into extracted records.
 * Reads the first sheet, auto-detects column layout.
 */
export async function parseXLSX(filePath: string): Promise<ExtractedRecord[]> {
  const absPath = path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`);
  }

  // Read workbook — cellDates:true converts Excel date serials to JS Date objects
  const workbook = XLSX.readFile(absPath, { cellDates: true, raw: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];

  const sheet = workbook.Sheets[firstSheet];

  // Convert to array of objects (first row = headers)
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",   // use "" for empty cells instead of undefined
    raw: false,   // convert numbers/dates to formatted strings
  });

  if (rows.length === 0) return [];

  const records = rowsToRecords(rows);

  // If column detection failed (very unusual layout), try raw approach
  if (records.length === 0) {
    // Try treating the sheet as plain text and re-parse
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return parseCSVManual(csv, ",");
  }

  return records;
}

/**
 * Extract text from a PDF file.
 * TODO: Install 'pdf-parse' for real PDF extraction:
 *   import pdfParse from 'pdf-parse';
 *   const buffer = fs.readFileSync(filePath);
 *   const data = await pdfParse(buffer);
 *   return data.text;
 */
export async function extractPDFText(_filePath: string): Promise<string> {
  // TODO: Implement real PDF text extraction
  return "Extrato bancário - dados extraídos em formato mock para MVP\nData;Descrição;Valor\n01/04/2024;Venda produto A;500.00\n05/04/2024;Pagamento fornecedor;-200.00\n10/04/2024;Receita serviços;1200.00";
}

/**
 * Process an image for OCR extraction.
 * TODO: Integrate Tesseract.js or Google Vision API.
 */
export async function extractImageText(_filePath: string): Promise<string> {
  // TODO: Implement real OCR extraction
  return "";
}

/**
 * Convert raw text (from PDF or OCR) into structured records.
 * Tries semicolon-delimited parsing first (common in Brazilian bank exports).
 * TODO: Replace with LLM-based extraction (GPT-4o with structured output).
 */
export async function rawTextToRecords(text: string): Promise<ExtractedRecord[]> {
  if (!text.trim()) return generateMockRecords(3, "Texto extraído");

  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const csvLike = lines.map((l) => l.replace(/;/g, ",")).join("\n");
  const records = await parseCSV(csvLike);
  if (records.length > 0) return records;

  return generateMockRecords(3, "Texto extraído");
}

/**
 * Generate placeholder records when extraction is not possible.
 * Used for image files pending OCR, or completely unreadable inputs.
 */
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
