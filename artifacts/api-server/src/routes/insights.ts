import { Router } from "express";
import { db, insightsTable, transactionsTable, usersTable } from "@workspace/db";
import { eq, isNull, and, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { generateInsights } from "../lib/insights-engine";

const router = Router();

type Period = "30d" | "3m" | "6m" | "12m";

function getPeriodStartDate(period: Period): string {
  const now = new Date();
  switch (period) {
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d.toISOString().split("T")[0];
    }
    case "3m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 3);
      return d.toISOString().split("T")[0];
    }
    case "6m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 6);
      return d.toISOString().split("T")[0];
    }
    case "12m": {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      return d.toISOString().split("T")[0];
    }
  }
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
  const startDate = getPeriodStartDate("3m");

  const [userRow, transactions] = await Promise.all([
    db
      .select({ name: usersTable.name, businessProfile: usersTable.businessProfile })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .then((r) => r[0]),
    db
      .select()
      .from(transactionsTable)
      .where(and(eq(transactionsTable.userId, userId), gte(transactionsTable.date, startDate)))
      .orderBy(transactionsTable.date),
  ]);

  if (transactions.length === 0) {
    res.json({ triggered: false });
    return;
  }

  const bp = userRow?.businessProfile as Record<string, unknown> | null;

  // Archive old insights before generating new ones
  await db
    .update(insightsTable)
    .set({ archivedAt: new Date() })
    .where(and(eq(insightsTable.userId, userId), isNull(insightsTable.archivedAt)));

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

    // Default to 12 months when no period is specified to avoid feeding 25+ years of data
    const effectivePeriod = period ?? "12m";
    const startDate = getPeriodStartDate(effectivePeriod);
    const transactions = rawTransactions.filter((t) => t.date && t.date >= startDate);

    const bp = userRow?.businessProfile as Record<string, unknown> | null;

    // Archive existing insights (soft delete) before replacing
    await db
      .update(insightsTable)
      .set({ archivedAt: new Date() })
      .where(and(eq(insightsTable.userId, userId), isNull(insightsTable.archivedAt)));

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
      res.json([]);
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
          periodLabel: g.periodLabel,
          tone: g.tone || "neutral",
        })),
      )
      .returning();

    res.json(inserted);
  } catch (err) {
    console.error("[insights/generate] error:", err);
    res.status(500).json({ error: "Erro ao gerar insights. Tente novamente." });
  }
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
