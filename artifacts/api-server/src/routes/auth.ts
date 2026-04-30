import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SignupBody, LoginBody } from "@workspace/api-zod";
import { requireAuth, signJwt } from "../middlewares/auth";

const router = Router();

// POST /auth/signup
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
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, createdAt: usersTable.createdAt });

  req.session.userId = user.id;

  res.status(201).json({ user, message: "Conta criada com sucesso!" });
});

// POST /auth/login
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

// POST /auth/token  — mobile: returns a signed JWT
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

// POST /auth/token/signup — mobile: creates account and returns JWT
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
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, businessProfile: usersTable.businessProfile, createdAt: usersTable.createdAt });

  const token = signJwt(user.id);
  res.status(201).json({ token, user, message: "Conta criada com sucesso!" });
});

// POST /auth/logout
router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.json({ message: "Logout realizado." });
  });
});

// GET /auth/me
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, businessProfile: usersTable.businessProfile, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.id, req.session.userId!));

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Sessão inválida." });
    return;
  }

  res.json(user);
});

// POST /auth/change-password
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

// DELETE /auth/me — delete account
router.delete("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  req.session.destroy(() => {});
  res.json({ message: "Conta excluída." });
});

// PATCH /auth/me — update name and/or business profile
router.patch("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.session.userId!;
  const { name, businessProfile } = req.body;

  if (name === undefined && businessProfile === undefined) {
    res.status(400).json({ error: "Nenhum dado enviado." });
    return;
  }

  const patch: Record<string, unknown> = {};
  if (name !== undefined) patch.name = String(name).trim();
  if (businessProfile !== undefined) patch.businessProfile = businessProfile;

  const [updated] = await db
    .update(usersTable)
    .set(patch)
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id, name: usersTable.name, email: usersTable.email, businessProfile: usersTable.businessProfile, createdAt: usersTable.createdAt });

  res.json({ user: updated });
});

export default router;
