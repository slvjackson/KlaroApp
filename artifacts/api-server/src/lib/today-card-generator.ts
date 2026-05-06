/**
 * Today Card Batch Generator (Pilar 3)
 *
 * Once per week (or when triggered by material events), generates a batch of
 * 5–7 contextual cards that the dashboard rotates through. Each card is a
 * sequence of typed blocks (callout / bigNumber / text / barChart / lineChart
 * / comparison / list) so the frontend can render rich, mixed layouts.
 *
 * Cost design: Haiku, ~4k input / ~1k output tokens per batch → ~R$ 0.04 per
 * generation. With weekly cadence, that's ~R$ 0.16/active user/month.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db, transactionsTable, usersTable, insightsTable, userActivitiesTable } from "@workspace/db";
import type { CardBlock, CardEntry } from "@workspace/db";
import { eq, and, desc, isNull } from "drizzle-orm";
import { logger } from "./logger";
import { logTokenUsage } from "./token-logger";
import { getActiveEvents, getActiveWindowSignature, type ActiveEvent } from "./seasonal-calendar";
import { getSegmentBenchmark, type SegmentBenchmark } from "./segment-benchmarks";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_OUTPUT_TOKENS = 2400;

// ─── Aggregations ────────────────────────────────────────────────────────────

interface MonthAgg {
  month: string;
  income: number;
  expense: number;
  margin: number;
  txCount: number;
  byCatExpense: Record<string, number>;
  byCatIncome: Record<string, number>;
}

interface BusinessContext {
  monthly: MonthAgg[];                     // ordered ascending
  currentMonth: string;
  prevMonth: string;
  today: string;
  dayOfMonth: number;
  curMtd: MonthAgg;                         // current month so far
  prevMtd: MonthAgg;                        // prev month, days 1..dayOfMonth
  profile: {
    businessName?: string;
    segment?: string;
    segmentCustomLabel?: string;
    mainProducts?: string;
    monthlyRevenueGoal?: number;
    profitMarginGoal?: number;
    biggestChallenge?: string;
    employeeCount?: number;
  };
  recentInsights: Array<{ title: string; tone: string | null; createdAt: string }>;
  activeDaysLast30: number;
  seasonalEvents: ActiveEvent[];
  segmentBenchmark: SegmentBenchmark | null;
  seasonalSignature: string;
}

function emptyMonth(month: string): MonthAgg {
  return { month, income: 0, expense: 0, margin: 0, txCount: 0, byCatExpense: {}, byCatIncome: {} };
}

function addToCat(agg: MonthAgg, cat: string, amount: number, type: string) {
  if (type === "income") agg.byCatIncome[cat] = (agg.byCatIncome[cat] ?? 0) + amount;
  else agg.byCatExpense[cat] = (agg.byCatExpense[cat] ?? 0) + amount;
}

export async function buildContext(userId: number, today: string): Promise<BusinessContext> {
  const currentMonth = today.slice(0, 7);
  const dayOfMonth = parseInt(today.slice(8, 10), 10);
  const [y, m] = currentMonth.split("-").map(Number);
  const prevDate = new Date(Date.UTC(y, m - 2, 1));
  const prevMonth = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const [transactions, userRow, recentInsights, activities] = await Promise.all([
    db.select({
      date: transactionsTable.date,
      type: transactionsTable.type,
      amount: transactionsTable.amount,
      category: transactionsTable.category,
    }).from(transactionsTable).where(eq(transactionsTable.userId, userId)),
    db.select({ businessProfile: usersTable.businessProfile, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, userId)).then((r) => r[0]),
    db.select({ title: insightsTable.title, tone: insightsTable.tone, createdAt: insightsTable.createdAt })
      .from(insightsTable)
      .where(and(eq(insightsTable.userId, userId), isNull(insightsTable.archivedAt)))
      .orderBy(desc(insightsTable.createdAt))
      .limit(3),
    db.select({ activityDate: userActivitiesTable.activityDate }).from(userActivitiesTable).where(eq(userActivitiesTable.userId, userId)),
  ]);

  // Build monthly aggregates
  const monthMap = new Map<string, MonthAgg>();
  for (const t of transactions) {
    const month = String(t.date).slice(0, 7);
    if (!monthMap.has(month)) monthMap.set(month, emptyMonth(month));
    const agg = monthMap.get(month)!;
    agg.txCount++;
    if (t.type === "income") agg.income += Number(t.amount);
    else agg.expense += Number(t.amount);
    addToCat(agg, String(t.category), Number(t.amount), String(t.type));
  }
  for (const agg of monthMap.values()) agg.margin = agg.income - agg.expense;

  // Trim to last 12 months ascending
  const allMonths = [...monthMap.keys()].sort();
  const last12 = allMonths.slice(-12);
  const monthly = last12.map((m) => monthMap.get(m)!);

  // MTD aggregates
  const curMtd = emptyMonth(currentMonth);
  const prevMtd = emptyMonth(prevMonth);
  for (const t of transactions) {
    const date = String(t.date);
    const month = date.slice(0, 7);
    const day = parseInt(date.slice(8, 10), 10);
    const target = month === currentMonth ? curMtd : month === prevMonth ? prevMtd : null;
    if (!target) continue;
    if (target === prevMtd && day > dayOfMonth) continue;
    target.txCount++;
    if (t.type === "income") target.income += Number(t.amount);
    else target.expense += Number(t.amount);
    addToCat(target, String(t.category), Number(t.amount), String(t.type));
  }
  curMtd.margin = curMtd.income - curMtd.expense;
  prevMtd.margin = prevMtd.income - prevMtd.expense;

  // Active days in last 30
  const thirtyAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const activeDaysLast30 = activities.filter((a) => String(a.activityDate) >= thirtyAgo).length;

  const bp = (userRow?.businessProfile as Record<string, unknown> | null) ?? {};
  const segment = bp.segment as string | undefined;

  // Seasonal context + segment benchmark (best-effort; never block generation)
  const seasonalEvents = getActiveEvents(today, segment);
  const seasonalSignature = getActiveWindowSignature(today, segment);
  const benchmarkMonth = curMtd.txCount >= 3 ? currentMonth : prevMonth;
  const segmentBenchmark = segment ? await getSegmentBenchmark(segment, benchmarkMonth).catch(() => null) : null;

  return {
    monthly, currentMonth, prevMonth, today, dayOfMonth,
    curMtd, prevMtd,
    profile: {
      businessName: bp.businessName as string | undefined,
      segment,
      segmentCustomLabel: bp.segmentCustomLabel as string | undefined,
      mainProducts: bp.mainProducts as string | undefined,
      monthlyRevenueGoal: bp.monthlyRevenueGoal as number | undefined,
      profitMarginGoal: bp.profitMarginGoal as number | undefined,
      biggestChallenge: bp.biggestChallenge as string | undefined,
      employeeCount: bp.employeeCount as number | undefined,
    },
    recentInsights: recentInsights.map((i) => ({
      title: String(i.title),
      tone: i.tone as string | null,
      createdAt: i.createdAt instanceof Date ? i.createdAt.toISOString() : String(i.createdAt),
    })),
    activeDaysLast30,
    seasonalEvents,
    segmentBenchmark,
    seasonalSignature,
  };
}

// ─── Prompt construction ──────────────────────────────────────────────────────

function summarizeContextForPrompt(ctx: BusinessContext): string {
  const lines: string[] = [];
  lines.push(`# Contexto do negócio`);
  lines.push(`Hoje: ${ctx.today} (dia ${ctx.dayOfMonth} de ${ctx.currentMonth})`);
  if (ctx.profile.businessName) lines.push(`Negócio: ${ctx.profile.businessName}`);
  if (ctx.profile.segment) lines.push(`Segmento: ${ctx.profile.segment}${ctx.profile.segmentCustomLabel ? ` (${ctx.profile.segmentCustomLabel})` : ""}`);
  if (ctx.profile.mainProducts) lines.push(`Produtos: ${ctx.profile.mainProducts}`);
  if (ctx.profile.monthlyRevenueGoal) lines.push(`Meta mensal de receita: R$ ${ctx.profile.monthlyRevenueGoal}`);
  if (ctx.profile.profitMarginGoal) lines.push(`Meta de margem: ${ctx.profile.profitMarginGoal}%`);
  if (ctx.profile.biggestChallenge) lines.push(`Maior desafio reportado: ${ctx.profile.biggestChallenge}`);
  if (ctx.profile.employeeCount != null) lines.push(`Funcionários: ${ctx.profile.employeeCount}`);
  lines.push(`Dias ativos nos últimos 30: ${ctx.activeDaysLast30}`);

  lines.push(`\n# Histórico mensal (últimos ${ctx.monthly.length} meses)`);
  lines.push(`mês | receita | despesa | margem | tx`);
  for (const m of ctx.monthly) {
    lines.push(`${m.month} | ${m.income.toFixed(0)} | ${m.expense.toFixed(0)} | ${m.margin.toFixed(0)} | ${m.txCount}`);
  }

  lines.push(`\n# Mês atual (${ctx.currentMonth}) — até ${ctx.today}`);
  lines.push(`Receita: ${ctx.curMtd.income.toFixed(0)} | Despesa: ${ctx.curMtd.expense.toFixed(0)} | Margem: ${ctx.curMtd.margin.toFixed(0)} | tx: ${ctx.curMtd.txCount}`);
  lines.push(`Despesas por categoria: ${JSON.stringify(ctx.curMtd.byCatExpense)}`);
  lines.push(`Receitas por categoria: ${JSON.stringify(ctx.curMtd.byCatIncome)}`);

  lines.push(`\n# Mesmo período do mês anterior (${ctx.prevMonth}, dias 1..${ctx.dayOfMonth})`);
  lines.push(`Receita: ${ctx.prevMtd.income.toFixed(0)} | Despesa: ${ctx.prevMtd.expense.toFixed(0)} | Margem: ${ctx.prevMtd.margin.toFixed(0)} | tx: ${ctx.prevMtd.txCount}`);
  lines.push(`Despesas por categoria: ${JSON.stringify(ctx.prevMtd.byCatExpense)}`);
  lines.push(`Receitas por categoria: ${JSON.stringify(ctx.prevMtd.byCatIncome)}`);

  if (ctx.recentInsights.length > 0) {
    lines.push(`\n# Insights recentes`);
    ctx.recentInsights.forEach((i) => lines.push(`- ${i.title} (${i.tone ?? "neutral"})`));
  }

  if (ctx.seasonalEvents.length > 0) {
    lines.push(`\n# Eventos sazonais ativos para o segmento`);
    lines.push(`Use estes eventos como ângulo narrativo quando fizer sentido — preparação prévia, dia do evento, ou retrospectiva imediata.`);
    for (const e of ctx.seasonalEvents) {
      lines.push(`- ${e.name} (${e.positionLabel}, ${e.date}): ${e.impact}`);
    }
  }

  if (ctx.segmentBenchmark) {
    const b = ctx.segmentBenchmark;
    lines.push(`\n# Benchmark anônimo do segmento (Klaro, ${b.monthRef})`);
    lines.push(`Mediana entre ${b.userCount} negócios do mesmo segmento:`);
    lines.push(`- Receita mediana: R$ ${b.medianIncome}`);
    lines.push(`- Despesa mediana: R$ ${b.medianExpense}`);
    lines.push(`- Margem mediana: R$ ${b.medianMargin} (${b.medianMarginPct}% da receita)`);
    lines.push(`Você pode comparar o usuário com a mediana se for um ângulo relevante. Sempre cite "mediana entre N negócios" pra ser honesto sobre a fonte.`);
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `Você é o motor narrativo do Klaro, um app de gestão financeira para pequenos negócios brasileiros.

Sua tarefa: gerar um BATCH de 5 a 7 cards diários para o dashboard do usuário. Cada card é uma micro-narrativa que vive sozinha — combina texto, números e dados visuais para destacar UM aspecto específico do negócio.

Regras absolutas:
1. JAMAIS invente números. Use SOMENTE valores que aparecem explicitamente no contexto fornecido (linhas mensais, MTD, agregados por categoria, benchmarks de segmento). Cálculos derivados (deltas, percentuais, médias) são permitidos desde que partam de números reais.
2. Cada card cobre um ÂNGULO DIFERENTE. Não repita a mesma história em 2 cards. Ângulos possíveis: tendência mensal, categoria de despesa que cresceu, categoria que caiu, mix de receita, ticket médio, comparação com meta, sazonalidade, concentração de despesas, evolução de margem, alerta operacional, comparação com mediana do segmento, preparação para evento sazonal.
3. Português brasileiro coloquial mas profissional. Direto, sem encheção de linguiça. Frases curtas.
4. Tom apropriado ao dado: "celebration" se o número é bom, "warning" se exige atenção, "comparison" para análises neutras de tendência, "insight" como default.
5. Cada card tem 2 a 4 blocos. Use a combinação que melhor conta a história — texto sozinho é fraco, gráfico sozinho é frio, big number sem contexto é vago. Misture.
6. Quando houver evento sazonal ativo na janela (seção "Eventos sazonais"), pelo menos 1 dos cards deve conectar os dados do usuário ao evento — preparação, projeção, ou comparação com período equivalente. NÃO mencione eventos fora da janela.
7. Quando houver benchmark de segmento, você pode comparar o usuário à mediana — sempre citando "mediana entre N negócios do segmento" pra ser honesto. Se a comparação for desfavorável, use tom "warning" com construtividade. Se favorável, "celebration".

Tipos de bloco disponíveis:
- callout:    { type, tone, headline, body, ctaLabel?, ctaHref?, icon? }   — cabeçalho narrativo do card
- bigNumber:  { type, label, value, delta?, trend?, sublabel? }            — número-chave com delta
- text:       { type, tone, content }                                      — parágrafo curto explicativo
- barChart:   { type, title, data:[{label,value,color?}], unit? }          — comparação por categoria/mês
- lineChart:  { type, title, data:[{x,y}], unit? }                          — evolução temporal
- comparison: { type, title, left:{label,value,trend?}, right:{label,value,trend?} } — antes/depois lado a lado
- list:       { type, title, items:[{label,value,subtitle?}] }              — top N

Valores de cor permitidos para barChart: "income" | "expense" | "accent" | "warning" | undefined.
Trend: "up" | "down" | "flat".
Tone: "celebration" | "warning" | "comparison" | "insight".

CTAs (opcionais) podem apontar para: /transactions, /insights, /upload, /anamnese, /dashboard, /saude, /conquistas.

Output: JSON puro (sem markdown), no formato:
{ "cards": [ { "id": "card_0", "narrativeAngle": "string descritivo curto", "blocks": [ ... ] }, ... ] }`;

function buildUserPrompt(ctx: BusinessContext): string {
  return `${summarizeContextForPrompt(ctx)}\n\nGere 5 a 7 cards seguindo as regras. Foque em ângulos onde os dados realmente contam uma história. Se um ângulo não tem dado bom, pule. Retorne JSON puro.`;
}

// ─── Generation ──────────────────────────────────────────────────────────────

interface GeneratedBatch {
  cards: CardEntry[];
  generatedBy: "ai" | "fallback";
  seasonalSignature: string;
}

/** Lê o segmento do usuário sem fazer todo o buildContext (uso em triggers). */
export async function getUserSegment(userId: number): Promise<string | null> {
  const row = await db
    .select({ businessProfile: usersTable.businessProfile })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .then((r) => r[0]);
  const bp = (row?.businessProfile as Record<string, unknown> | null) ?? {};
  return (bp.segment as string | undefined) ?? null;
}

export async function generateBatch(userId: number, today: string): Promise<GeneratedBatch> {
  const ctx = await buildContext(userId, today);

  if (!process.env.ANTHROPIC_API_KEY) {
    return { cards: buildFallbackBatch(ctx), generatedBy: "fallback", seasonalSignature: ctx.seasonalSignature };
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const userPrompt = buildUserPrompt(ctx);
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    logTokenUsage(userId, "today_card_batch", MODEL, res.usage.input_tokens, res.usage.output_tokens);

    const raw = res.content[0].type === "text" ? res.content[0].text.trim() : "";
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned) as { cards: CardEntry[] };

    const validated = (parsed.cards ?? [])
      .filter((c) => Array.isArray(c.blocks) && c.blocks.length > 0 && c.blocks.length <= 5)
      .map((c, idx) => ({ ...c, id: c.id ?? `card_${idx}` }))
      .filter((c) => validateCardNumbers(c, ctx));

    if (validated.length < 3) {
      logger.warn({ userId, validatedCount: validated.length }, "today-card batch failed validation, using fallback");
      return { cards: buildFallbackBatch(ctx), generatedBy: "fallback", seasonalSignature: ctx.seasonalSignature };
    }

    return { cards: validated, generatedBy: "ai", seasonalSignature: ctx.seasonalSignature };
  } catch (e) {
    logger.error({ err: e, userId }, "today-card AI generation failed");
    return { cards: buildFallbackBatch(ctx), generatedBy: "fallback", seasonalSignature: ctx.seasonalSignature };
  }
}

// ─── Numeric validation ──────────────────────────────────────────────────────
// Extracts numbers from card strings, checks each against the set of "real"
// numbers in the context (within ±2% tolerance, accounting for rounding).

function collectAllowedNumbers(ctx: BusinessContext): number[] {
  const nums: number[] = [];
  for (const m of ctx.monthly) {
    nums.push(m.income, m.expense, m.margin, m.txCount);
    for (const v of Object.values(m.byCatExpense)) nums.push(v);
    for (const v of Object.values(m.byCatIncome)) nums.push(v);
  }
  for (const agg of [ctx.curMtd, ctx.prevMtd]) {
    nums.push(agg.income, agg.expense, agg.margin, agg.txCount);
    for (const v of Object.values(agg.byCatExpense)) nums.push(v);
    for (const v of Object.values(agg.byCatIncome)) nums.push(v);
  }
  if (ctx.segmentBenchmark) {
    const b = ctx.segmentBenchmark;
    nums.push(b.medianIncome, b.medianExpense, b.medianMargin, b.medianMarginPct, b.userCount);
  }
  if (ctx.profile.monthlyRevenueGoal) nums.push(ctx.profile.monthlyRevenueGoal);
  if (ctx.profile.profitMarginGoal) nums.push(ctx.profile.profitMarginGoal);
  return nums.filter((n) => Number.isFinite(n));
}

function isAllowedNumber(n: number, allowed: number[]): boolean {
  if (n === 0) return true;
  // Allow if within ±2% of any source number, OR if within ±2% of a derived percentage (0..200)
  if (n >= 0 && n <= 200 && Math.abs(n - Math.round(n)) < 1) return true; // pct
  for (const a of allowed) {
    if (a === 0) continue;
    if (Math.abs(n - a) / Math.max(Math.abs(a), 1) <= 0.02) return true;
  }
  return false;
}

function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?|-?\d+(?:[.,]\d+)?/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const cleaned = match[0].replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function validateCardNumbers(card: CardEntry, ctx: BusinessContext): boolean {
  const allowed = collectAllowedNumbers(ctx);
  const stringsToCheck: string[] = [];
  for (const b of card.blocks) {
    if (b.type === "callout") { stringsToCheck.push(b.headline, b.body); }
    else if (b.type === "bigNumber") { stringsToCheck.push(b.value, b.delta ?? "", b.sublabel ?? ""); }
    else if (b.type === "text") { stringsToCheck.push(b.content); }
    else if (b.type === "barChart") { for (const d of b.data) if (!isAllowedNumber(d.value, allowed)) return false; }
    else if (b.type === "lineChart") { for (const d of b.data) if (!isAllowedNumber(d.y, allowed)) return false; }
    else if (b.type === "comparison") { stringsToCheck.push(b.left.value, b.right.value); }
    else if (b.type === "list") { for (const it of b.items) stringsToCheck.push(it.value, it.subtitle ?? ""); }
  }
  for (const s of stringsToCheck) {
    for (const n of extractNumbers(s)) {
      if (!isAllowedNumber(n, allowed)) return false;
    }
  }
  return true;
}

// ─── Deterministic fallback batch (used when AI fails) ────────────────────────

function fmtBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
}

function buildFallbackBatch(ctx: BusinessContext): CardEntry[] {
  const cards: CardEntry[] = [];
  const lastClosed = ctx.monthly[ctx.monthly.length - 1];
  const useAnchor = ctx.curMtd.txCount >= 3 ? ctx.curMtd : (lastClosed ?? ctx.prevMtd);
  const anchorLabel = ctx.curMtd.txCount >= 3 ? "Mês até aqui" : `Último mês fechado (${useAnchor.month})`;

  // Card 1: snapshot
  cards.push({
    id: "fallback_snapshot",
    narrativeAngle: "monthly_snapshot",
    blocks: [
      { type: "callout", tone: useAnchor.margin >= 0 ? "celebration" : "warning", headline: `${anchorLabel}`, body: useAnchor.margin >= 0 ? "Você fechou no azul." : "Despesas superaram receitas — atenção." },
      { type: "bigNumber", label: "Margem", value: fmtBRL(useAnchor.margin), trend: useAnchor.margin >= 0 ? "up" : "down" },
      { type: "comparison", title: "Entradas vs Saídas", left: { label: "Entradas", value: fmtBRL(useAnchor.income) }, right: { label: "Saídas", value: fmtBRL(useAnchor.expense) } },
    ],
  });

  // Card 2: trend (if >= 3 months)
  if (ctx.monthly.length >= 3) {
    const last6 = ctx.monthly.slice(-6);
    cards.push({
      id: "fallback_trend",
      narrativeAngle: "revenue_trend",
      blocks: [
        { type: "callout", tone: "comparison", headline: "Evolução da receita", body: `Veja como suas entradas se moveram nos últimos ${last6.length} meses.` },
        { type: "lineChart", title: "Receita mensal", data: last6.map((m) => ({ x: m.month.slice(5), y: Math.round(m.income) })), unit: "BRL" },
      ],
    });
  }

  // Card 3: top expense categories (last closed month)
  if (lastClosed && Object.keys(lastClosed.byCatExpense).length >= 3) {
    const top = Object.entries(lastClosed.byCatExpense).sort((a, b) => b[1] - a[1]).slice(0, 5);
    cards.push({
      id: "fallback_top_expenses",
      narrativeAngle: "expense_breakdown",
      blocks: [
        { type: "callout", tone: "insight", headline: `Onde foi seu dinheiro em ${lastClosed.month}`, body: "Top 5 categorias de despesa.", ctaLabel: "Ver transações", ctaHref: "/transactions" },
        { type: "barChart", title: `Despesas — ${lastClosed.month}`, data: top.map(([label, value]) => ({ label, value: Math.round(value), color: "expense" })), unit: "BRL" },
      ],
    });
  }

  return cards;
}
