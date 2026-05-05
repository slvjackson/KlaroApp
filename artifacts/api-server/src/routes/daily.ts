import { Router } from "express";
import { db, dailyTasksTable, userActivitiesTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { ensureTodaysTasks, calculateStreak, getTodayBrasilia } from "../lib/daily-tasks";
import { logger } from "../lib/logger";

const router = Router();

// GET /daily/today — streak + today's 3 tasks
router.get("/daily/today", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const today = getTodayBrasilia();

  const [tasks, activities] = await Promise.all([
    ensureTodaysTasks(userId),
    db
      .select({ activityDate: userActivitiesTable.activityDate })
      .from(userActivitiesTable)
      .where(eq(userActivitiesTable.userId, userId))
      .orderBy(desc(userActivitiesTable.activityDate))
      .limit(400),
  ]);

  const dates = activities.map((a) => a.activityDate);
  const streak = await calculateStreak(userId, dates);
  const activeToday = dates.includes(today);

  res.json({ streak, activeToday, today, tasks });
});

// POST /daily/tasks/:id/complete — mark a task complete + register activity if first of the day
router.post("/daily/tasks/:id/complete", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const taskId = Number(req.params.id);

  if (Number.isNaN(taskId)) {
    res.status(400).json({ error: "ID inválido." });
    return;
  }

  const { answer } = req.body as { answer?: string };

  const [task] = await db
    .select()
    .from(dailyTasksTable)
    .where(and(eq(dailyTasksTable.id, taskId), eq(dailyTasksTable.userId, userId)));

  if (!task) {
    res.status(404).json({ error: "Tarefa não encontrada." });
    return;
  }

  if (task.completedAt) {
    res.json({ alreadyCompleted: true });
    return;
  }

  // For business_question, persist the answer into businessProfile.dailyAnswers
  if (task.taskKey === "business_question") {
    if (!answer?.trim()) {
      res.status(400).json({ error: "Resposta é obrigatória para a pergunta do dia." });
      return;
    }
    const params = task.params as { question?: string } | null;
    const [user] = await db.select({ businessProfile: usersTable.businessProfile }).from(usersTable).where(eq(usersTable.id, userId));
    const bp = (user?.businessProfile as Record<string, unknown> | null) ?? {};
    const dailyAnswers = Array.isArray(bp.dailyAnswers) ? (bp.dailyAnswers as unknown[]) : [];
    dailyAnswers.push({
      date: task.taskDate,
      question: params?.question ?? "",
      answer: answer.trim(),
    });
    await db
      .update(usersTable)
      .set({ businessProfile: { ...bp, dailyAnswers } })
      .where(eq(usersTable.id, userId));
  }

  // Mark complete + persist any answer in params
  const newParams = task.taskKey === "business_question"
    ? { ...((task.params as Record<string, unknown> | null) ?? {}), answer: answer?.trim() }
    : task.params;

  await db
    .update(dailyTasksTable)
    .set({ completedAt: new Date(), params: newParams })
    .where(eq(dailyTasksTable.id, taskId));

  // Register activity for today (no-op if already exists thanks to unique index)
  await db
    .insert(userActivitiesTable)
    .values({ userId, activityDate: getTodayBrasilia() })
    .onConflictDoNothing();

  // Recompute streak
  const activities = await db
    .select({ activityDate: userActivitiesTable.activityDate })
    .from(userActivitiesTable)
    .where(eq(userActivitiesTable.userId, userId))
    .orderBy(desc(userActivitiesTable.activityDate))
    .limit(400);
  const streak = await calculateStreak(userId, activities.map((a) => a.activityDate));

  // Did the user complete all 3 today?
  const allToday = await db
    .select({ id: dailyTasksTable.id, completedAt: dailyTasksTable.completedAt })
    .from(dailyTasksTable)
    .where(and(eq(dailyTasksTable.userId, userId), eq(dailyTasksTable.taskDate, getTodayBrasilia())));
  const allCompleted = allToday.length >= 3 && allToday.every((t) => t.completedAt != null);

  logger.info({ userId, taskId, streak, allCompleted }, "[daily] task completed");

  res.json({ streak, allCompleted });
});

export default router;
