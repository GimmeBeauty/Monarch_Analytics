import { Router, type Request, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { eq, and, isNull, gt } from "drizzle-orm";
import { db, usersTable, authTokensTable } from "@workspace/db";
import { signToken, COOKIE_NAME, MAX_AGE_SEC } from "../lib/jwt.js";
import { generateRawToken, hashToken, tokenExpiresAt } from "../lib/tokens.js";
import { sendInviteEmail, sendPasswordResetEmail } from "../lib/email.js";
import { authenticate, requireRole } from "../middlewares/authenticate.js";

const router = Router();

// ─── Rate Limiters ────────────────────────────────────────────────────────────

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});

const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many email requests. Please try again later." },
});

// ─── Cookie Helper ────────────────────────────────────────────────────────────

function setSessionCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_SEC * 1000, // ms
    path: "/",
  });
}

function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post("/login", loginLimiter, async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()))
    .limit(1);

  if (!user || !user.passwordHash) {
    // Constant-time response to avoid user enumeration
    await bcrypt.compare(password, "$2b$12$invalidhashpadding000000000000000000000000000000000000");
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.status === "disabled") {
    res.status(403).json({ error: "Account is disabled" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  // Update last login
  await db
    .update(usersTable)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(usersTable.id, user.id));

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  setSessionCookie(res, token);

  res.json({
    user: {
      id:     user.id,
      email:  user.email,
      name:   user.name,
      role:   user.role,
      status: user.status,
    },
  });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────────

router.post("/logout", (req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────

router.get("/me", authenticate, async (req: Request, res: Response) => {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.auth!.userId))
    .limit(1);

  if (!user || user.status === "disabled") {
    clearSessionCookie(res);
    res.status(401).json({ error: "User not found or disabled" });
    return;
  }

  res.json({
    user: {
      id:        user.id,
      email:     user.email,
      name:      user.name,
      title:     user.title,
      avatarUrl: user.avatarUrl,
      role:      user.role,
      status:    user.status,
    },
  });
});

// ─── PATCH /auth/profile ──────────────────────────────────────────────────────
// Update the current user's name, title, and/or avatarUrl.

router.patch("/profile", authenticate, async (req: Request, res: Response) => {
  const { name, title, avatarUrl } = req.body as {
    name?:      string;
    title?:     string;
    avatarUrl?: string | null;
  };

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name      !== undefined) updates.name      = name.trim() || null;
  if (title     !== undefined) updates.title     = title.trim() || null;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl || null;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.auth!.userId))
    .returning({
      id:        usersTable.id,
      email:     usersTable.email,
      name:      usersTable.name,
      title:     usersTable.title,
      avatarUrl: usersTable.avatarUrl,
      role:      usersTable.role,
      status:    usersTable.status,
    });

  res.json({ user: updated });
});

// ─── GET /auth/users ──────────────────────────────────────────────────────────
// Returns all team members. Available to all authenticated users so everyone
// can see who is on the team and their status.

router.get("/users", authenticate, async (_req: Request, res: Response) => {
  const users = await db
    .select({
      id:        usersTable.id,
      name:      usersTable.name,
      email:     usersTable.email,
      role:      usersTable.role,
      status:    usersTable.status,
      avatarUrl: usersTable.avatarUrl,
      joinedAt:  usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(usersTable.createdAt);

  res.json({ users });
});

// ─── POST /auth/invite ────────────────────────────────────────────────────────

router.post("/invite", authenticate, requireRole("owner", "admin"), emailLimiter, async (req: Request, res: Response) => {
  const { email, name, role } = req.body as {
    email?: string;
    name?: string;
    role?: string;
  };

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const userRole = (role === "admin" || role === "owner") ? role : "user";

  // Find or create the user
  let [existingUser] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (existingUser?.status === "active") {
    res.status(409).json({ error: "A user with this email is already active" });
    return;
  }

  let userId: string;

  if (existingUser) {
    // Re-invite: update name/role if provided
    await db
      .update(usersTable)
      .set({
        name:      name ?? existingUser.name,
        role:      userRole,
        status:    "invited",
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, existingUser.id));
    userId = existingUser.id;
  } else {
    const [newUser] = await db
      .insert(usersTable)
      .values({ email: normalizedEmail, name, role: userRole, status: "invited" })
      .returning({ id: usersTable.id });
    userId = newUser.id;
  }

  // Invalidate any previous invite tokens for this user
  await db
    .update(authTokensTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokensTable.userId, userId),
        eq(authTokensTable.type, "invite"),
        isNull(authTokensTable.usedAt),
      ),
    );

  // Generate a fresh invite token
  const raw = generateRawToken();
  await db.insert(authTokensTable).values({
    userId,
    tokenHash: hashToken(raw),
    type:      "invite",
    expiresAt: tokenExpiresAt(),
  });

  // Look up inviter name for the email
  const [inviter] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, req.auth!.userId))
    .limit(1);

  await sendInviteEmail(normalizedEmail, raw, inviter?.name ?? undefined);

  res.json({ ok: true, message: "Invitation sent" });
});

// ─── GET /auth/validate-token ─────────────────────────────────────────────────

router.get("/validate-token", async (req: Request, res: Response) => {
  const { token, type } = req.query as { token?: string; type?: string };

  if (!token || !type) {
    res.status(400).json({ error: "token and type are required" });
    return;
  }

  const [record] = await db
    .select()
    .from(authTokensTable)
    .where(
      and(
        eq(authTokensTable.tokenHash, hashToken(token)),
        eq(authTokensTable.type, type),
        isNull(authTokensTable.usedAt),
        gt(authTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!record) {
    res.status(400).json({ valid: false, error: "Token is invalid or has expired" });
    return;
  }

  // Return the email so the UI can display it
  const [user] = await db
    .select({ email: usersTable.email, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, record.userId))
    .limit(1);

  res.json({ valid: true, email: user?.email, name: user?.name });
});

// ─── POST /auth/set-password ──────────────────────────────────────────────────
// Used for both invite activation and (optionally) first-time password setup.

router.post("/set-password", async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || !password) {
    res.status(400).json({ error: "token and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const [record] = await db
    .select()
    .from(authTokensTable)
    .where(
      and(
        eq(authTokensTable.tokenHash, hashToken(token)),
        eq(authTokensTable.type, "invite"),
        isNull(authTokensTable.usedAt),
        gt(authTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!record) {
    res.status(400).json({ error: "Invitation link is invalid or has expired" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Activate the user
  await db
    .update(usersTable)
    .set({
      passwordHash,
      status:      "active",
      lastLoginAt: new Date(),
      updatedAt:   new Date(),
    })
    .where(eq(usersTable.id, record.userId));

  // Mark token as used
  await db
    .update(authTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(authTokensTable.id, record.id));

  // Fetch updated user
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, record.userId))
    .limit(1);

  if (!user) {
    res.status(500).json({ error: "User not found after activation" });
    return;
  }

  const jwtToken = signToken({ userId: user.id, email: user.email, role: user.role });
  setSessionCookie(res, jwtToken);

  res.json({
    user: {
      id:     user.id,
      email:  user.email,
      name:   user.name,
      role:   user.role,
      status: user.status,
    },
  });
});

// ─── POST /auth/forgot-password ───────────────────────────────────────────────

router.post("/forgot-password", emailLimiter, async (req: Request, res: Response) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Always respond the same way to prevent user enumeration
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  if (user && user.status === "active") {
    // Invalidate existing password reset tokens
    await db
      .update(authTokensTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(authTokensTable.userId, user.id),
          eq(authTokensTable.type, "password_reset"),
          isNull(authTokensTable.usedAt),
        ),
      );

    const raw = generateRawToken();
    await db.insert(authTokensTable).values({
      userId:    user.id,
      tokenHash: hashToken(raw),
      type:      "password_reset",
      expiresAt: tokenExpiresAt(),
    });

    await sendPasswordResetEmail(normalizedEmail, raw);
  }

  // Always return 200 to prevent email enumeration
  res.json({ ok: true, message: "If an account with that email exists, a reset link has been sent." });
});

// ─── POST /auth/reset-password ────────────────────────────────────────────────

router.post("/reset-password", async (req: Request, res: Response) => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || !password) {
    res.status(400).json({ error: "token and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const [record] = await db
    .select()
    .from(authTokensTable)
    .where(
      and(
        eq(authTokensTable.tokenHash, hashToken(token)),
        eq(authTokensTable.type, "password_reset"),
        isNull(authTokensTable.usedAt),
        gt(authTokensTable.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!record) {
    res.status(400).json({ error: "Reset link is invalid or has expired" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await db
    .update(usersTable)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(usersTable.id, record.userId));

  await db
    .update(authTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(authTokensTable.id, record.id));

  res.json({ ok: true, message: "Password updated successfully" });
});

// ─── DELETE /auth/users/:id ────────────────────────────────────────────────────
// Permanently removes a user. Only owners and admins can do this.
// Cannot remove yourself or the owner account.

router.delete("/users/:id", authenticate, requireRole("owner", "admin"), async (req: Request, res: Response) => {
  const targetId = req.params.id;
  const requesterId = req.auth!.userId;

  if (targetId === requesterId) {
    res.status(400).json({ error: "You cannot remove your own account." });
    return;
  }

  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, targetId))
    .limit(1);

  if (!target) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  if (target.role === "owner") {
    res.status(403).json({ error: "The owner account cannot be removed." });
    return;
  }

  await db.delete(usersTable).where(eq(usersTable.id, targetId));

  res.json({ ok: true });
});

export default router;
