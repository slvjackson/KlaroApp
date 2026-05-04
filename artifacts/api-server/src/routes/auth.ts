import crypto from "crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SignupBody, LoginBody } from "@workspace/api-zod";
import { requireAuth, signJwt } from "../middlewares/auth";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/email";
import { logger } from "../lib/logger";

const router = Router();

// ─── Helpers ───────────────────────────────────────────────────────────────────

function verificationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function expiresIn(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

async function issueVerificationEmail(userId: number, email: string, name: string) {
  const token = verificationToken();
  await db
    .update(usersTable)
    .set({ emailVerificationToken: token, emailVerificationExpiresAt: expiresIn(24) })
    .where(eq(usersTable.id, userId));
  sendVerificationEmail(email, name, token).catch((e) =>
    logger.error({ err: e }, "Failed to send verification email"),
  );
}

// ─── Signup (web session) ──────────────────────────────────────────────────────

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Este email já está cadastrado." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(usersTable)
    .values({ name, email, passwordHash })
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, emailVerifiedAt: usersTable.emailVerifiedAt, createdAt: usersTable.createdAt });

  await issueVerificationEmail(user.id, user.email, user.name);

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 7);
  await db.insert(subscriptionsTable).values({ userId: user.id, status: "trial", trialEndsAt });

  req.session.userId = user.id;
  res.status(201).json({ user, message: "Conta criada com sucesso! Verifique seu e-mail." });
});

// ─── Login (web session) ───────────────────────────────────────────────────────

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Email ou senha inválidos." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Email ou senha inválidos." });
    return;
  }

  req.session.userId = user.id;

  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser, message: "Login realizado com sucesso!" });
});

// ─── Token login (mobile) ─────────────────────────────────────────────────────

router.post("/auth/token", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Email ou senha inválidos." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Email ou senha inválidos." });
    return;
  }

  const token = signJwt(user.id);
  const { passwordHash: _, ...safeUser } = user;

  res.json({ token, user: safeUser, message: "Login realizado com sucesso!" });
});

// ─── Token signup (mobile) ────────────────────────────────────────────────────

router.post("/auth/token/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, password } = parsed.data;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Este email já está cadastrado." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ name, email, passwordHash })
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, emailVerifiedAt: usersTable.emailVerifiedAt, businessProfile: usersTable.businessProfile, createdAt: usersTable.createdAt });

  await issueVerificationEmail(user.id, user.email, user.name);

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 7);
  await db.insert(subscriptionsTable).values({ userId: user.id, status: "trial", trialEndsAt });

  const token = signJwt(user.id);
  res.status(201).json({ token, user, message: "Conta criada com sucesso! Verifique seu e-mail." });
});

// ─── Email verification ────────────────────────────────────────────────────────

router.get("/auth/verify-email", async (req, res): Promise<void> => {
  const token = typeof req.query.token === "string" ? req.query.token : null;
  if (!token) {
    res.status(400).json({ error: "Token inválido." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.emailVerificationToken, token));

  if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
    res.status(400).json({ error: "Link inválido ou expirado. Solicite um novo." });
    return;
  }

  await db
    .update(usersTable)
    .set({ emailVerifiedAt: new Date(), emailVerificationToken: null, emailVerificationExpiresAt: null })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "E-mail confirmado com sucesso!" });
});

// ─── Resend verification email ────────────────────────────────────────────────

router.post("/auth/resend-verification", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) {
    res.status(401).json({ error: "Sessão inválida." });
    return;
  }
  if (user.emailVerifiedAt) {
    res.json({ message: "E-mail já confirmado." });
    return;
  }

  await issueVerificationEmail(user.id, user.email, user.name);
  res.json({ message: "E-mail de confirmação reenviado!" });
});

// ─── Forgot password ──────────────────────────────────────────────────────────

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : null;
  if (!email) {
    res.status(400).json({ error: "Informe o e-mail." });
    return;
  }

  // Always respond the same — prevents email enumeration
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (user) {
    const token = verificationToken();
    await db
      .update(usersTable)
      .set({ passwordResetToken: token, passwordResetExpiresAt: expiresIn(1) })
      .where(eq(usersTable.id, user.id));
    sendPasswordResetEmail(user.email, user.name, token).catch((e) =>
      logger.error({ err: e }, "Failed to send password reset email"),
    );
  }

  res.json({ message: "Se o e-mail estiver cadastrado, você receberá um link em breve." });
});

// ─── Reset password ───────────────────────────────────────────────────────────

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body;
  if (!token || typeof token !== "string" || !password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "Dados inválidos. A senha deve ter ao menos 6 caracteres." });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.passwordResetToken, token));

  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    res.status(400).json({ error: "Link inválido ou expirado. Solicite um novo." });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db
    .update(usersTable)
    .set({ passwordHash, passwordResetToken: null, passwordResetExpiresAt: null })
    .where(eq(usersTable.id, user.id));

  res.json({ message: "Senha redefinida com sucesso! Faça login com a nova senha." });
});

// ─── Logout ───────────────────────────────────────────────────────────────────

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ message: "Logout realizado." });
  });
});

// ─── Me ───────────────────────────────────────────────────────────────────────

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, emailVerifiedAt: usersTable.emailVerifiedAt, businessProfile: usersTable.businessProfile, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Sessão inválida." });
    return;
  }

  res.json(user);
});

// ─── Change password ──────────────────────────────────────────────────────────

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    res.status(400).json({ error: "Dados inválidos. Nova senha deve ter ao menos 6 caracteres." });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId!));
  if (!user) { res.status(401).json({ error: "Sessão inválida." }); return; }

  const match = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!match) { res.status(400).json({ error: "Senha atual incorreta." }); return; }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, user.id));
  res.json({ message: "Senha alterada com sucesso." });
});

// ─── Delete account ───────────────────────────────────────────────────────────

router.delete("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  req.session.destroy(() => {});
  res.json({ message: "Conta excluída." });
});

// ─── Update profile ───────────────────────────────────────────────────────────

router.patch("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { name, businessProfile } = req.body;

  if (name === undefined && businessProfile === undefined) {
    res.status(400).json({ error: "Nenhum dado enviado." });
    return;
  }

  const [current] = await db
    .select({ businessProfile: usersTable.businessProfile })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (businessProfile !== undefined) {
    const existing = (current?.businessProfile as Record<string, unknown> | null) ?? {};
    patch.businessProfile = { ...existing, ...businessProfile };
  }

  const [updated] = await db
    .update(usersTable)
    .set(patch)
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, emailVerifiedAt: usersTable.emailVerifiedAt, businessProfile: usersTable.businessProfile, createdAt: usersTable.createdAt });

  res.json({ user: updated });
});

export default router;
