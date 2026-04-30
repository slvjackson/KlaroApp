import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import Anthropic from "@anthropic-ai/sdk";
import { logger } from "./logger";
import { buildOcrPrompt, getSegmentProfile } from "../prompts/builder";

export interface UserCategoryExample {
  description: string;
  type: "income" | "expense";
  category: string;
}

export interface ParseBusinessContext {
  businessName?: string;
  segment?: string;
  segmentCustomLabel?: string;
  mainProducts?: string;
  salesChannel?: string;
  userExamples?: UserCategoryExample[];
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

// ─── Segment-aware LLM classification ────────────────────────────────────────

/**
 * Re-classifies type and category for all records using a fast Claude Haiku call
 * with the user's segment profile as context. This is the main fix for cases where
 * the rule-based parser can't determine type from amount sign alone (e.g. a photography
 * business tracking all receipts as positive values in a plain CSV).
 */
async function classifyWithSegment(
  records: ExtractedRecord[],
  ctx: ParseBusinessContext,
): Promise<ExtractedRecord[]> {
  const client = getAnthropicClient();
  if (!client || records.length === 0) return records;

  const profile = getSegmentProfile(ctx.segment, ctx.segmentCustomLabel);
  const items = records
    .map((r, i) => `${i + 1}. "${r.description}" (R$ ${r.amount.toFixed(2)})`)
    .join("\n");

  const examplesSection = ctx.userExamples && ctx.userExamples.length > 0
    ? `\nExemplos de como ESTE usuário já categorizou transações similares (priorize estes padrões):\n${
        ctx.userExamples
          .map((e) => `- "${e.description}" → type=${e.type}, category="${e.category}"`)
          .join("\n")
      }\n`
    : "";

  const prompt = `Você é um classificador financeiro para o segmento: ${profile.label}.
${ctx.businessName ? `Negócio: ${ctx.businessName}\n` : ""}
Definições para este segmento:
- ENTRADA (income) = ${profile.terminologia.receita}: dinheiro RECEBIDO — serviços prestados, vendas, contratos, sessões realizadas
- SAÍDA (expense) = ${profile.terminologia.despesa}: dinheiro PAGO — custos, compras, despesas operacionais

Use seu conhecimento sobre ${profile.label} para classificar cada transação.
Categorias típicas deste segmento: ${profile.categoriasComuns.join(", ")}
${examplesSection}
Responda SOMENTE com um JSON array na mesma ordem, sem texto adicional:
[{"type":"income","category":"Categoria curta"},{"type":"expense","category":"Categoria curta"}]

Transações:
${items}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      logger.warn("classifyWithSegment: no JSON array in response");
      return records;
    }

    const classifications = JSON.parse(jsonMatch[0]) as { type: string; category: string }[];
    logger.info({ segment: profile.label, count: records.length }, "Parser: segment classification applied");

    return records.map((r, i) => {
      const c = classifications[i];
      if (!c) return r;
      return {
        ...r,
        type: (c.type === "income" || c.type === "expense") ? c.type : r.type,
        category: typeof c.category === "string" && c.category.trim() ? c.category.trim() : r.category,
        confidence: 0.92,
      };
    });
  } catch (err) {
    logger.warn({ err }, "Parser: segment classification failed, keeping rule-based results");
    return records;
  }
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

/** Always resolve partial dates to the current year. */
function currentYear(): number {
  return new Date().getFullYear();
}

/**
 * Convert any date value to "YYYY-MM-DD".
 * Handles: Excel serial ints, JS Date, DD/MM/YYYY, DD/MM/YY, DD/MM (no year),
 * day-only, ISO, with/without time. Always uses the current year for partial dates.
 * Prefers Brazilian format DD/MM/YYYY; falls back to US MM/DD/YYYY only when p2 > 12.
 */
function normalizeDate(raw: unknown): string {
  const now = new Date();
  const year = now.getFullYear();
  const today = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

  // JS Date object — if year looks wrong (XLSX coercion artifact), use current year
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    const d = raw;
    const yr = d.getFullYear() < 2010 ? year : d.getFullYear();
    return `${yr}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const s = String(raw).trim();

  // Already ISO YYYY-MM-DD (with or without time)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  // Strip time component if present: "01/01/2025 10:30:00" → "01/01/2025"
  const noTime = s.split(/\s+/)[0];

  // DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY, DD-MM-YY, M/D/YY, M/D/YYYY (with year)
  const partsWithYear = noTime.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (partsWithYear) {
    const [, p1, p2, yr] = partsWithYear;
    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);
    // If the parsed year is implausible (XLSX artifact), replace with current year
    const parsedYear = parseInt(yr.length === 2 ? `20${yr}` : yr, 10);
    const resolvedYear = parsedYear < 2010 ? year : parsedYear;
    const yearStr = String(resolvedYear);
    // Prefer BR (DD/MM) — only read as US (MM/DD) when n2 > 12 forces it
    if (n1 > 12) return `${yearStr}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;  // n1=day, n2=month (DD/MM)
    if (n2 > 12) return `${yearStr}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`;  // n2=day, n1=month (MM/DD)
    return `${yearStr}-${p2.padStart(2, "0")}-${p1.padStart(2, "0")}`;               // assume DD/MM: p1=day, p2=month
  }

  // DD/MM or DD-MM without year → current year, BR format (DD/MM)
  const partsNoYear = noTime.match(/^(\d{1,2})[\/\-\.](\d{1,2})$/);
  if (partsNoYear) {
    const [, p1, p2] = partsNoYear;
    const n1 = parseInt(p1, 10);
    const n2 = parseInt(p2, 10);
    let day: number, month: number;
    if (n1 > 12) { day = n1; month = n2; }      // n1=day, n2=month (DD/MM)
    else if (n2 > 12) { day = n2; month = n1; } // n2=day, n1=month (MM/DD US)
    else { day = n1; month = n2; }              // assume DD/MM Brazilian: p1=day, p2=month
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // Day only (e.g. "16") → current month, current year
  if (/^\d{1,2}$/.test(noTime)) {
    const day = parseInt(noTime, 10);
    if (day >= 1 && day <= 31) {
      const month = now.getMonth() + 1;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // Month name: "01 Jan 2025", "Jan-25", etc.
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1970) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const categoryKey = findColumn(keys, ["categoria", "category", "grupo", "class", "classificacao"]);
  const typeKeyCandidate = findColumn(keys, ["tipo", "type", "natureza", "dc", "d/c", "operacao"]);
  // Only use the type column if its values actually look like income/expense indicators.
  // A column named "tipo" might contain service names (e.g. "Ensaio", "Evento") rather than
  // financial direction, in which case the AI classifier will handle type assignment instead.
  const TYPE_FINANCIAL_VALUES = new Set(["c", "d", "credito", "debito", "cred", "deb", "entrada", "saida", "income", "expense", "receita", "despesa", "credit", "debit"]);
  const typeKey: string | null = (() => {
    if (!typeKeyCandidate) return null;
    const sample = rows.slice(0, Math.min(rows.length, 10));
    const hasFinancialValues = sample.some((r) => {
      const v = norm(String(r[typeKeyCandidate!] ?? ""));
      return TYPE_FINANCIAL_VALUES.has(v) || v.startsWith("cred") || v.startsWith("deb");
    });
    return hasFinancialValues ? typeKeyCandidate : null;
  })();
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

    const rawCategory = categoryKey ? String(row[categoryKey] ?? "").trim() : "";
    records.push({
      date,
      description: desc,
      amount,
      type,
      category: rawCategory || classifyCategory(desc),
      confidence: 0.8,
    });
  }

  logger.info({ context, extracted: records.length, skippedZero }, "Parser: extraction complete");
  return records;
}

// ─── Public parsers ───────────────────────────────────────────────────────────

/** Re-parse a sheet starting at a detected header row */
function parseFromHeaderRow(aoa: unknown[][], headerIdx: number): Record<string, unknown>[] {
  // Use raw: true to prevent XLSX from re-formatting date-like strings (e.g. "05/01" → "5/1/01")
  // which would cause our normalizeDate to misparse the 2-digit year as 2001.
  if (headerIdx === 0) {
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  }
  const sub = aoa.slice(headerIdx);
  const subSheet = XLSX.utils.aoa_to_sheet(sub);
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(subSheet, { defval: "", raw: true });
}

export async function parseCSV(content: string, ctx?: ParseBusinessContext): Promise<ExtractedRecord[]> {
  // Try comma-delimited first, then semicolon (Brazilian bank export)
  for (const delimiter of [",", ";"]) {
    try {
      const normalized = delimiter === ";" ? content.replace(/;/g, ",") : content;
      // raw: true keeps all cells as their underlying values (strings stay strings).
      // Without this, XLSX converts "05/01" to a Date and reformats it as "5/1/01",
      // which our parser then reads as year 2001.
      const wb = XLSX.read(normalized, { type: "string", raw: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const headerIdx = findHeaderRow(aoa);
      const rows = parseFromHeaderRow(aoa, headerIdx);

      let records = rowsToRecords(rows, `CSV(${delimiter})`);
      if (records.length > 0) {
        if (ctx?.segment || ctx?.segmentCustomLabel) {
          records = await classifyWithSegment(records, ctx);
        }
        return records;
      }
    } catch (err) {
      logger.warn({ err, delimiter }, "Parser: CSV delimiter attempt failed");
    }
  }
  return [];
}

export async function parseXLSX(filePath: string, ctx?: ParseBusinessContext): Promise<ExtractedRecord[]> {
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
        let records = rowsToRecords(rows, `XLSX:${sheetName}`);
        if (records.length > 0) {
          if (ctx?.segment || ctx?.segmentCustomLabel) {
            records = await classifyWithSegment(records, ctx);
          }
          return records;
        }
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
      const records = await parseCSV(csv, ctx);
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

export async function parsePDFWithClaude(filePath: string, ctx?: ParseBusinessContext): Promise<ExtractedRecord[]> {
  const client = getAnthropicClient();
  if (!client) {
    logger.warn("ANTHROPIC_API_KEY not set — skipping PDF vision");
    return [];
  }

  const absPath = path.resolve(process.cwd(), filePath);
  const buffer = fs.readFileSync(absPath);
  const base64 = buffer.toString("base64");

  const profile = (ctx?.segment || ctx?.segmentCustomLabel)
    ? getSegmentProfile(ctx!.segment, ctx!.segmentCustomLabel)
    : null;

  const segmentHint = profile
    ? `Contexto do negócio: segmento ${profile.label}. ENTRADA: ${profile.terminologia.receita}. SAÍDA: ${profile.terminologia.despesa}.`
    : "tipo=entrada para receitas, tipo=saida para despesas.";

  const prompt = `Você é um especialista em extração de dados financeiros. Analise este documento e extraia TODAS as transações financeiras de TODAS as páginas.

O documento pode ter qualquer formato: tabela estruturada, extrato bancário, nota fiscal, recibo, lista de movimentações, etc.

Retorne SOMENTE um CSV sem cabeçalho com exatamente 5 colunas: data,descricao,categoria,valor,tipo

REGRAS PARA CADA CAMPO:
- data: DD/MM/YYYY com ano completo. Se só tiver dia/mês, use o ano do documento. Se não houver data, use a data mais recente visível.
- descricao: texto que identifica a transação — copie do documento se tiver coluna de descrição/histórico/memo/narrativa. Para extratos bancários, use o histórico ou beneficiário. Para recibos/NF, use o produto/serviço ou fornecedor. NUNCA escreva apenas "entrada" ou "saida".
- categoria: se o documento tiver coluna de categoria, copie o valor. Se não tiver, classifique inteligentemente pela descrição: ex: "Salários", "Fornecedores", "Aluguel", "Vendas", "Impostos", "Energia", "Marketing", "Transporte", "Alimentação", etc.
- valor: número positivo com ponto decimal (ex: 1234.56). Ignore sinais negativos — use o campo tipo.
- tipo: "entrada" para receitas/créditos/recebimentos, "saida" para despesas/débitos/pagamentos.

REGRAS GERAIS:
- Separador: vírgula. Se descrição ou categoria contiver vírgula, envolva em aspas duplas.
- Extraia absolutamente TODAS as linhas de TODAS as páginas, sem pular nenhuma.
- Ignore linhas de total, subtotal, saldo e cabeçalho — apenas transações individuais.
- Se não houver transações financeiras no documento, retorne apenas: SEM_DADOS
${segmentHint}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{
        role: "user" as const,
        content: [
          {
            type: "document" as const,
            source: { type: "base64" as const, media_type: "application/pdf" as const, data: base64 },
          },
          { type: "text" as const, text: prompt },
        ],
      }],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    if (!raw || raw === "SEM_DADOS") return [];

    // Prepend header so parseCSV can identify columns by name reliably
    const csv = `data,descricao,categoria,valor,tipo\n${raw}`;
    const records = await parseCSV(csv, ctx);
    logger.info({ count: records.length, filePath }, "PDF vision extraction completed");
    return records;
  } catch (err) {
    logger.error({ err, absPath }, "PDF vision extraction failed");
    return [];
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
    segment: getSegmentProfile(ctx?.segment, ctx?.segmentCustomLabel),
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

async function structureTextWithAI(text: string, ctx?: ParseBusinessContext): Promise<string> {
  const client = getAnthropicClient();
  if (!client) return "";

  const profile = (ctx?.segment || ctx?.segmentCustomLabel)
    ? getSegmentProfile(ctx!.segment, ctx!.segmentCustomLabel)
    : null;

  const segmentHint = profile
    ? `\nContexto do negócio: segmento ${profile.label}.
- ENTRADA (tipo=entrada): ${profile.terminologia.receita} — dinheiro recebido por serviços ou vendas
- SAÍDA (tipo=saida): ${profile.terminologia.despesa} — custos, compras, despesas
Use seu conhecimento sobre ${profile.label} para classificar o tipo de cada transação.\n`
    : "\n- tipo=entrada para receitas/recebimentos, tipo=saida para despesas/pagamentos\n";

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `Você é um especialista em extração de dados financeiros. Analise o texto abaixo e extraia TODAS as transações financeiras.

O texto pode vir de qualquer fonte: extrato bancário, planilha exportada, nota fiscal, recibo, relatório contábil, etc.

Retorne SOMENTE um CSV sem cabeçalho com 5 colunas: data,descricao,categoria,valor,tipo
${segmentHint}
REGRAS:
- data: DD/MM/YYYY com ano completo. Se só tiver dia/mês, use ano atual (${new Date().getFullYear()}). Se apenas dia, use mês atual (${new Date().getMonth() + 1}/${new Date().getFullYear()}). Nunca invente datas; se não houver, use hoje (${new Date().toLocaleDateString("pt-BR")}).
- descricao: texto que identifica a transação — use o histórico, beneficiário, produto, fornecedor ou qualquer texto descritivo presente. NUNCA escreva apenas "entrada" ou "saida".
- categoria: classifique inteligentemente pela descrição quando não houver coluna explícita. Ex: "Salários", "Fornecedores", "Aluguel", "Vendas", "Impostos", "Energia", "Marketing", "Transporte", "Alimentação", "Serviços". Seja específico.
- valor: número positivo com ponto decimal (ex: 1234.56). Não use sinal negativo.
- tipo: "entrada" para receitas/créditos, "saida" para despesas/débitos.
- Separador: vírgula. Se descrição ou categoria tiver vírgula, envolva em aspas duplas.
- Ignore linhas de total, saldo, cabeçalho — apenas transações individuais.
- Se não houver dados financeiros, retorne somente: SEM_DADOS

Texto:
${text}`,
      },
    ],
  });

  const result = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  if (result === "SEM_DADOS" || !result) return "";
  // Prepend header so parseCSV identifies columns by name reliably
  return `data,descricao,categoria,valor,tipo\n${result}`;
}

export async function rawTextToRecords(text: string, ctx?: ParseBusinessContext): Promise<ExtractedRecord[]> {
  if (!text.trim()) return generateMockRecords(3, "Texto extraído");

  // Try structured CSV parsing first (works for bank statement exports)
  const records = await parseCSV(text, ctx);
  if (records.length > 0) return records;

  // Fallback: ask Claude to structure the raw text into CSV with segment context
  logger.info("CSV parsing failed — attempting AI structuring");
  try {
    const structured = await structureTextWithAI(text, ctx);
    if (structured) {
      const aiRecords = await parseCSV(structured, ctx);
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

// ─── OFX Parser ──────────────────────────────────────────────────────────────

/**
 * Extract a single tag value from OFX content.
 * Handles both SGML style (<TAG>value\n) and XML style (<TAG>value</TAG>).
 */
function ofxTag(content: string, tag: string): string | null {
  const xmlMatch = content.match(new RegExp(`<${tag}>([^<\\r\\n]+)</${tag}>`, "i"));
  if (xmlMatch) return xmlMatch[1].trim();
  const sgmlMatch = content.match(new RegExp(`<${tag}>([^<\\r\\n]+)`, "i"));
  return sgmlMatch ? sgmlMatch[1].trim() : null;
}

/**
 * Parse OFX date: YYYYMMDD[HHMMSS][.mmm][TZ] → YYYY-MM-DD
 */
function parseOFXDate(raw: string): string | null {
  const clean = raw.replace(/\[.*?\]/, "").replace(/\..+$/, "").trim();
  if (clean.length < 8) return null;
  return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
}

/**
 * Parse OFX/QFX file (both SGML 1.x and XML 2.x formats).
 * Extraction is 100% deterministic — no AI required.
 * AI (Haiku) is only used for segment-aware category classification.
 */
export async function parseOFX(content: string, ctx?: ParseBusinessContext): Promise<ExtractedRecord[]> {
  // Extract all <STMTTRN>...</STMTTRN> blocks
  // In SGML the closing tag may be absent; we look for the next opening tag as boundary
  const blocks: string[] = [];
  const openRe = /<STMTTRN>/gi;
  const closeRe = /<\/STMTTRN>/gi;

  // Try XML-style first (has closing tags)
  let match;
  const xmlBlocks = [...content.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)];
  if (xmlBlocks.length > 0) {
    xmlBlocks.forEach((m) => blocks.push(m[0]));
  } else {
    // SGML: split on <STMTTRN> and treat each chunk as a block
    const parts = content.split(/<STMTTRN>/i);
    parts.slice(1).forEach((p) => blocks.push("<STMTTRN>" + p.split(/<\/BANKTRANLIST>/i)[0]));
  }

  if (blocks.length === 0) {
    logger.warn("OFX: no STMTTRN blocks found");
    return [];
  }

  const records: ExtractedRecord[] = [];

  for (const block of blocks) {
    const trnType = ofxTag(block, "TRNTYPE") ?? "OTHER";
    const dateRaw = ofxTag(block, "DTPOSTED") ?? ofxTag(block, "DTUSER") ?? "";
    const amountRaw = ofxTag(block, "TRNAMT") ?? "0";
    const memo = ofxTag(block, "MEMO") ?? ofxTag(block, "NAME") ?? "";

    const date = parseOFXDate(dateRaw);
    if (!date) continue;

    const amount = parseFloat(amountRaw.replace(",", "."));
    if (isNaN(amount) || amount === 0) continue;

    // OFX sign convention: positive = credit (income), negative = debit (expense)
    // But some banks invert this for checking accounts; TRNTYPE is the truth source
    const creditTypes = new Set(["CREDIT", "DEP", "DIRECTDEP", "INT", "DIV"]);
    const debitTypes  = new Set(["DEBIT", "ATM", "POS", "PAYMENT", "DIRECTDEBIT", "FEE", "SRVCHG", "CHECK"]);
    let type: "income" | "expense";
    if (creditTypes.has(trnType.toUpperCase())) {
      type = "income";
    } else if (debitTypes.has(trnType.toUpperCase())) {
      type = "expense";
    } else {
      type = amount >= 0 ? "income" : "expense";
    }

    const description = memo.trim() || trnType;
    const category = classifyCategory(description);

    records.push({
      date,
      description,
      amount: Math.abs(amount),
      type,
      category,
      confidence: 0.85,
    });
  }

  logger.info({ count: records.length }, "OFX: transactions extracted");

  // Upgrade category/type with segment-aware AI when context is available
  if (ctx && (ctx.segment || ctx.segmentCustomLabel || ctx.userExamples?.length)) {
    return classifyWithSegment(records, ctx);
  }

  return records;
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