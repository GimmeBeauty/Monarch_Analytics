import { Router } from "express";
import { db, integrationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET               = process.env.JWT_SECRET!;
const GOOGLE_ADS_CLIENT_ID     = process.env.GOOGLE_ADS_CLIENT_ID;
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const META_APP_ID              = process.env.META_APP_ID;
const META_APP_SECRET          = process.env.META_APP_SECRET;
const APP_URL                  = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

// ─── GET /api/oauth/google_ads/callback ───────────────────────────────────────

router.get("/google_ads/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  if (error || !code || !state) {
    res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return;
  }
  try { jwt.verify(state, JWT_SECRET); } catch {
    res.redirect(`${APP_URL}/settings/integrations?error=oauth_invalid_state`); return;
  }

  let accessToken: string; let refreshToken: string;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     GOOGLE_ADS_CLIENT_ID!,
        client_secret: GOOGLE_ADS_CLIENT_SECRET!,
        redirect_uri:  `${APP_URL}/api/oauth/google_ads/callback`,
        grant_type:    "authorization_code",
      }).toString(),
    });
    if (!tokenRes.ok) { res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return; }
    const td = await tokenRes.json() as { access_token: string; refresh_token?: string };
    accessToken  = td.access_token;
    refreshToken = td.refresh_token ?? "";
  } catch { res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return; }

  const existing = await db.select().from(integrationsTable)
    .where(eq(integrationsTable.provider, "google_ads")).limit(1);
  const existingMeta = existing[0]?.metadata
    ? JSON.parse(existing[0].metadata) as Record<string, string>
    : {};
  const newMeta = { ...existingMeta, refreshToken };

  await db.insert(integrationsTable)
    .values({ provider: "google_ads", accessToken, metadata: JSON.stringify(newMeta), status: "connected" })
    .onConflictDoUpdate({
      target: integrationsTable.provider,
      set: { accessToken, metadata: JSON.stringify(newMeta), status: "connected", updatedAt: new Date() },
    });
  res.redirect(`${APP_URL}/settings/integrations?success=google_ads`);
});

// ─── GET /api/oauth/meta/callback ─────────────────────────────────────────────

router.get("/meta/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  if (error || !code || !state) {
    res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return;
  }
  try { jwt.verify(state, JWT_SECRET); } catch {
    res.redirect(`${APP_URL}/settings/integrations?error=oauth_invalid_state`); return;
  }

  const redirectUri = `${APP_URL}/api/oauth/meta/callback`;
  let accessToken: string;
  try {
    // Exchange code for short-lived token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token` +
      `?client_id=${encodeURIComponent(META_APP_ID!)}` +
      `&client_secret=${encodeURIComponent(META_APP_SECRET!)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&code=${encodeURIComponent(code)}`,
    );
    if (!tokenRes.ok) { res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return; }
    const td = await tokenRes.json() as { access_token: string };

    // Exchange short-lived token for long-lived token (60 days)
    const longRes = await fetch(
      `https://graph.facebook.com/v18.0/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(META_APP_ID!)}` +
      `&client_secret=${encodeURIComponent(META_APP_SECRET!)}` +
      `&fb_exchange_token=${encodeURIComponent(td.access_token)}`,
    );
    if (!longRes.ok) { res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return; }
    const ld = await longRes.json() as { access_token: string };
    accessToken = ld.access_token;
  } catch { res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return; }

  const existing = await db.select().from(integrationsTable)
    .where(eq(integrationsTable.provider, "meta")).limit(1);
  const existingMeta = existing[0]?.metadata
    ? JSON.parse(existing[0].metadata) as Record<string, string>
    : {};

  await db.insert(integrationsTable)
    .values({ provider: "meta", accessToken, metadata: JSON.stringify(existingMeta), status: "connected" })
    .onConflictDoUpdate({
      target: integrationsTable.provider,
      set: { accessToken, metadata: JSON.stringify(existingMeta), status: "connected", updatedAt: new Date() },
    });
  res.redirect(`${APP_URL}/settings/integrations?success=meta`);
});

export default router;
