import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Augment the session type to include userId
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

const JWT_SECRET = process.env.SESSION_SECRET ?? "klaro-dev-secret-change-in-prod";

export interface JwtPayload {
  userId: number;
  iat?: number;
  exp?: number;
}

export function signJwt(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Middleware to require an authenticated session OR a valid Bearer JWT.
 * Returns 401 if neither is present.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // 1. Bearer token auth (mobile) — checked first so a stale session cookie
  //    from a previous user never shadows the JWT of the current user.
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyJwt(token);
    if (payload) {
      req.session.userId = payload.userId;
      next();
      return;
    }
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  // 2. Session-based auth (web)
  if (req.session.userId) {
    next();
    return;
  }

  res.status(401).json({ error: "Not authenticated" });
}
