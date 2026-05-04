import type { Request, Response, NextFunction } from "express";
import { db, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
  const userId = req.session.userId!;

  const [sub] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.userId, userId));

  if (!sub) {
    res.status(402).json({ error: "Assinatura necessária.", code: "NO_SUBSCRIPTION" });
    return;
  }

  const now = new Date();

  if (sub.status === "active") {
    next();
    return;
  }

  if (sub.status === "trial") {
    if (sub.trialEndsAt && sub.trialEndsAt > now) {
      next();
      return;
    }
    // Trial expired — mark it
    await db
      .update(subscriptionsTable)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, sub.id));

    res.status(402).json({ error: "Período de teste encerrado.", code: "TRIAL_EXPIRED" });
    return;
  }

  res.status(402).json({ error: "Assinatura necessária.", code: sub.status.toUpperCase() });
}
