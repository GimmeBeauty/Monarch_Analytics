import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error("JWT_SECRET environment variable is required");

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

const COOKIE_NAME = "monarch_session";
const EXPIRES_IN  = "7d";
const MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days in seconds

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, SECRET!, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET!) as JwtPayload;
}

export { COOKIE_NAME, MAX_AGE_SEC };
