import crypto from "node:crypto";

const TOKEN_EXPIRY_HOURS = 24;

/** Generate a cryptographically-secure raw token (hex string, 64 chars). */
export function generateRawToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Hash a raw token for safe storage (SHA-256, hex). */
export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Return a Date that is TOKEN_EXPIRY_HOURS from now. */
export function tokenExpiresAt(): Date {
  const d = new Date();
  d.setHours(d.getHours() + TOKEN_EXPIRY_HOURS);
  return d;
}
