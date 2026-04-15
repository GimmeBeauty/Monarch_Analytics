import type { Request, Response, NextFunction } from "express";
import { verifyToken, COOKIE_NAME, type JwtPayload } from "../lib/jwt.js";

// Extend Express Request to carry the decoded JWT payload
declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

/**
 * Middleware that reads the session cookie, verifies the JWT,
 * and attaches the decoded payload to `req.auth`.
 *
 * On failure, responds 401. Does NOT call next() in that case.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.[COOKIE_NAME];

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Session expired or invalid" });
  }
}

/**
 * Middleware factory that requires a specific role (or higher).
 * Roles in ascending order of privilege: user < admin < owner.
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
