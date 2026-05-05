import { Router } from "express";
import jwt from "jsonwebtoken";
import { db, integrationsTable } from "@workspace/db";

const router = Router();

const JWT_SECRET              = process.env.JWT_SECRET!;
const NETSUITE_CONSUMER_KEY   = "20813f1bbc124f0a18387d23dff07d9b3bea0e0b4cc086dd4f709d03efb0f6ab";
const NETSUITE_CLIENT_SECRET  = process.env.NETSUITE_CLIENT_SECRET ?? "";
const NETSUITE_REDIRECT_URI   = "https://monarch.durhambrands.com/api/auth/netsuite/callback";
const NETSUITE_TOKEN_URL      = "https://1307706.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token";
const APP_URL                 = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

// ─── GET /api/auth/netsuite/callback ──────────────────────────────────────────

router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error || !code || !state) {
    res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return;
  }

  try { jwt.verify(state, JWT_SECRET); } catch {
    res.redirect(`${APP_URL}/settings/integrations?error=oauth_invalid_state`); return;
  }

  let accessToken: string; let refreshToken: string; let expiresIn: number;
  try {
    const credentials = Buffer.from(`${NETSUITE_CONSUMER_KEY}:${NETSUITE_CLIENT_SECRET}`).toString("base64");
    const tokenRes = await fetch(NETSUITE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type:   "authorization_code",
        code,
        redirect_uri: NETSUITE_REDIRECT_URI,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text().catch(() => "");
      console.error("[netsuite/callback] Token exchange failed:", tokenRes.status, detail);
      res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return;
    }

    const td = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in?: number };
    accessToken  = td.access_token;
    refreshToken = td.refresh_token ?? "";
    expiresIn    = td.expires_in ?? 3600;
  } catch (e) {
    console.error("[netsuite/callback] Token exchange error:", e);
    res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return;
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const metadata  = JSON.stringify({ refreshToken, expiresAt });

  await db.insert(integrationsTable)
    .values({ provider: "netsuite", accessToken, metadata, status: "connected" })
    .onConflictDoUpdate({
      target: integrationsTable.provider,
      set: { accessToken, metadata, status: "connected", updatedAt: new Date() },
    });

  res.redirect(`${APP_URL}/settings/integrations?success=netsuite`);
});

export default router;
