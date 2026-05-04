import { Router } from "express";
import { db, insightsTable, transactionsTable, usersTable } from "@workspace/db";
import { eq, isNull, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { generateInsights, generateStepsForInsight } from "../lib/insights-engine";

const router = Router();

type Period = "30d" | "3m" | "6m" | "12m";

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function fmtMonth(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return `${MONTHS_PT[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

function computePeriodLabel(period: Period, transactions: { date: string }[]): string {
  const labels: Record<Period, string> = { "30d": "30 dias", "3m": "3 meses", "6m": "6 meses", "12m": "12 meses" };
  if (transactions.length === 0) return labels[period];
  const dates = transactions.map((t) => t.date).sort();
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  return first === last
    ? `${labels[period]} · ${fmtMonth(first)}`
    : `${labels[period]} · ${fmtMonth(first)} – ${fmtMonth(last)}`;
}

// Computes startDate relative to `anchor` (latest transaction date), not today.
// This ensures period filters work correctly even for historical datasets.
function getPeriodStartDate(period: Period, anchor: Date): string {
  const d = new Date(anchor);
  switch (period) {
    case "30d": d.setDate(d.getDate() - 30); break;
    case "3m":  d.setMonth(d.getMonth() - 3); break;
    case "6m":  d.setMonth(d.getMonth() - 6); break;
    case "12m": d.setFullYear(d.getFullYear() - 1); break;
  }
  return d.toISOString().split("T")[0]!;
}

// GET /insights — list non-archived insights for current user
router.get("/insights", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const insights = await db
    .select()
    .from(insightsTable)
    .where(and(eq(insightsTable.userId, userId), isNull(insightsTable.archivedAt)))
    .orderBy(insightsTable.createdAt);

  res.json(insights);
});

// POST /insights/check-milestones — auto-generate if a milestone was hit
router.post("/insights/check-milestones", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;

  const currentMonth = new Date().toISOString().substring(0, 7); // "2024-04"

  // Check if there are any active insights from the current month
  const existing = await db
    .select({ id: insightsTable.id, createdAt: insightsTable.createdAt })
    .from(insightsTable)
    .where(and(eq(insightsTable.userId, userId), isNull(insightsTable.archivedAt)));

  const hasCurrentMonth = existing.some(
    (i) => i.createdAt.toISOString().substring(0, 7) === currentMonth,
  );

  if (hasCurrentMonth) {
    res.json({ triggered: false });
    return;
  }

  // No insights for this month — auto-generate using last 3 months of data
  const [userRow, allTx] = await Promise.all([
    db
      .select({ name: usersTable.name, businessProfile: usersTable.businessProfile })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .then((r) => r[0]),
    db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.userId, userId))
      .orderBy(transactionsTable.date),
  ]);

  if (allTx.length === 0) {
    res.json({ triggered: false });
    return;
  }

  const anchor = new Date(allTx[allTx.length - 1]!.date + "T00:00:00Z");
  const startDate = getPeriodStartDate("3m", anchor);
  const transactions = allTx.filter((t) => t.date && t.date >= startDate);

  if (transactions.length === 0) {
    res.json({ triggered: false });
    return;
  }

  const bp = userRow?.businessProfile as Record<string, unknown> | null;

  // Archive old non-pinned insights before generating new ones
  await db
    .update(insightsTable)
    .set({ archivedAt: new Date() })
    .where(and(eq(insightsTable.userId, userId), isNull(insightsTable.archivedAt), isNull(insightsTable.pinnedAt)));

  const generated = await generateInsights(transactions, {
    businessName: (bp?.businessName as string | undefined) ?? userRow?.name,
    segment: bp?.segment as string | undefined,
    segmentCustomLabel: bp?.segmentCustomLabel as string | undefined,
    city: bp?.city as string | undefined,
    state: bp?.state as string | undefined,
    mainProducts: bp?.mainProducts as string | undefined,
    salesChannel: bp?.salesChannel as string | undefined,
    biggestChallenge: bp?.biggestChallenge as string | undefined,
    tempoMercado: bp?.tempoMercado as string | undefined,
    tipoNegocio: bp?.tipoNegocio as string | undefined,
    ticketMedio: bp?.ticketMedio as string | undefined,
    faixaFaturamento: bp?.faixaFaturamento as string | undefined,
    controleFinanceiro: bp?.controleFinanceiro as string | undefined,
    sabeLucro: bp?.sabeLucro as string | undefined,
    separaFinancas: bp?.separaFinancas as string | undefined,
    conheceCustos: bp?.conheceCustos as string | undefined,
    comoDecide: bp?.comoDecide as string | undefined,
    deixouInvestir: bp?.deixouInvestir as string | undefined,
    surpresaCaixa: bp?.surpresaCaixa as string | undefined,
    maiorDificuldade: bp?.maiorDificuldade as string | undefined,
    querMelhorar: bp?.querMelhorar as string | undefined,
    comMaisClareza: bp?.comMaisClareza as string | undefined,
    observacoesAdicionais: bp?.observacoesAdicionais as string | undefined,
  });

  if (generated.length === 0) {
    res.json({ triggered: false });
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
        steps: g.steps ?? [],
        periodLabel: g.periodLabel,
        tone: g.tone || "neutral",
      })),
    )
    .returning();

  res.json({ triggered: true, reason: "new_month", insights: inserted });
});

// POST /insights/generate — generate fresh insights from transaction data
router.post("/insights/generate", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { period } = (req.body ?? {}) as { period?: Period };

  try {
    const [userRow, rawTransactions] = await Promise.all([
      db
        .select({ name: usersTable.name, businessProfile: usersTable.businessProfile })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .then((r) => r[0]),
      db
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.userId, userId))
        .orderBy(transactionsTable.date),
    ]);

    const effectivePeriod = period ?? "3m";
    // Anchor is always today — periods are relative to now, not to the last transaction date
    const anchor = new Date();
    const requestedStart = getPeriodStartDate(effectivePeriod, anchor);
    const transactions = rawTransactions.filter((t) => t.date && t.date >= requestedStart);
    const periodLabel = computePeriodLabel(effectivePeriod, transactions);

    // ── Coverage metadata ────────────────────────────────────────────────────
    // Detects when the user has less data than the requested period.
    // Gaps IN the middle of the period are intentionally ignored (per spec).
    const actualStart = transactions[0]?.date ?? null;
    const actualEnd   = transactions[transactions.length - 1]?.date ?? null;
    // Most recent transaction the user has overall (used in "no data in window" message)
    const lastDataDate = rawTransactions[rawTransactions.length - 1]?.date ?? null;
    const requestedDays = Math.round(
      (anchor.getTime() - new Date(requestedStart + "T00:00:00Z").getTime()) / 86_400_000
    );
    const actualDays = actualStart
      ? Math.round(
          (anchor.getTime() - new Date(actualStart + "T00:00:00Z").getTime()) / 86_400_000
        ) + 1
      : 0;
    // gapDays = how many days after the requested window start the first transaction falls
    const gapDays = actualStart
      ? Math.round(
          (new Date(actualStart + "T00:00:00Z").getTime() - new Date(requestedStart + "T00:00:00Z").getTime()) / 86_400_000
        )
      : requestedDays; // no data in window → gap equals the full requested period
    const coverage = {
      requestedPeriod: effectivePeriod,
      requestedDays,
      actualDays,
      requestedStart,
      actualStart,
      actualEnd,
      lastDataDate,    // most recent transaction overall, may be outside the requested window
      hasGap: gapDays >= 7,
      gapDays,
    };

    const bp = userRow?.businessProfile as Record<string, unknown> | null;

    const generated = await generateInsights(transactions, {
      businessName: (bp?.businessName as string | undefined) ?? userRow?.name,
      segment: bp?.segment as string | undefined,
      segmentCustomLabel: bp?.segmentCustomLabel as string | undefined,
      city: bp?.city as string | undefined,
      state: bp?.state as string | undefined,
      mainProducts: bp?.mainProducts as string | undefined,
      salesChannel: bp?.salesChannel as string | undefined,
      biggestChallenge: bp?.biggestChallenge as string | undefined,
      tempoMercado: bp?.tempoMercado as string | undefined,
      tipoNegocio: bp?.tipoNegocio as string | undefined,
      ticketMedio: bp?.ticketMedio as string | undefined,
      faixaFaturamento: bp?.faixaFaturamento as string | undefined,
      controleFinanceiro: bp?.controleFinanceiro as string | undefined,
      sabeLucro: bp?.sabeLucro as string | undefined,
      separaFinancas: bp?.separaFinancas as string | undefined,
      conheceCustos: bp?.conheceCustos as string | undefined,
      comoDecide: bp?.comoDecide as string | undefined,
      deixouInvestir: bp?.deixouInvestir as string | undefined,
      surpresaCaixa: bp?.surpresaCaixa as string | undefined,
      maiorDificuldade: bp?.maiorDificuldade as string | undefined,
      querMelhorar: bp?.querMelhorar as string | undefined,
      comMaisClareza: bp?.comMaisClareza as string | undefined,
    });

    if (generated.length === 0) {
      res.json({ insights: [], coverage });
      return;
    }

    // Archive only after successful generation — prevents data loss if the request is cancelled mid-flight
    await db
      .update(insightsTable)
      .set({ archivedAt: new Date() })
      .where(and(eq(insightsTable.userId, userId), isNull(insightsTable.archivedAt), isNull(insightsTable.pinnedAt)));

    const inserted = await db
      .insert(insightsTable)
      .values(
        generated.map((g) => ({
          userId,
          title: g.title,
          description: g.description,
          recommendation: g.recommendation,
          steps: g.steps ?? [],
          periodLabel,
          tone: g.tone || "neutral",
        })),
      )
      .returning();

    res.json({ insights: inserted, coverage });
  } catch (err) {
    console.error("[insights/generate] error:", err);
    res.status(500).json({ error: "Erro ao gerar insights. Tente novamente." });
  }
});

// PATCH /insights/:id/pin — pin insight + generate action-plan steps via AI
router.patch("/insights/:id/pin", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  const [existing] = await db
    .select()
    .from(insightsTable)
    .where(and(eq(insightsTable.id, id), eq(insightsTable.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Insight não encontrado." });
    return;
  }

  const existingSteps = Array.isArray(existing.steps) && existing.steps.length > 0;
  const steps = existingSteps
    ? existing.steps!
    : await generateStepsForInsight({
        title: existing.title,
        description: existing.description,
        recommendation: existing.recommendation,
      });

  const [pinned] = await db
    .update(insightsTable)
    .set({ pinnedAt: new Date(), steps })
    .where(eq(insightsTable.id, id))
    .returning();

  res.json(pinned);
});

// PATCH /insights/:id/progress — save step completion state
router.patch("/insights/:id/progress", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) { res.status(400).json({ error: "ID inválido." }); return; }

  const { stepsProgress } = req.body as { stepsProgress: boolean[] };
  if (!Array.isArray(stepsProgress)) { res.status(400).json({ error: "stepsProgress deve ser um array." }); return; }

  const [updated] = await db
    .update(insightsTable)
    .set({ stepsProgress })
    .where(and(eq(insightsTable.id, id), eq(insightsTable.userId, userId)))
    .returning();

  if (!updated) { res.status(404).json({ error: "Insight não encontrado." }); return; }

  res.json(updated);
});

// DELETE /insights/:id — soft-archive a single insight
router.delete("/insights/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const id = parseInt(req.params.id as string, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  const [updated] = await db
    .update(insightsTable)
    .set({ archivedAt: new Date() })
    .where(and(eq(insightsTable.id, id), eq(insightsTable.userId, userId), isNull(insightsTable.archivedAt)))
    .returning({ id: insightsTable.id });

  if (!updated) {
    res.status(404).json({ error: "Insight não encontrado." });
    return;
  }

  res.status(204).send();
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
      periodLabel:
        periodLabel?.trim() ??
        new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    })
    .returning();

  res.status(201).json(inserted);
});

export default router;
