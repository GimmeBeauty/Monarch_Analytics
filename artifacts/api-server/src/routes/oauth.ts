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
const TIKTOK_SHOP_APP_KEY      = process.env.TIKTOK_SHOP_APP_KEY;
const TIKTOK_SHOP_SECRET       = process.env.TIKTOK_SHOP_SECRET;
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

// ─── GET /api/oauth/tiktok_shop/callback ──────────────────────────────────────

router.get("/tiktok_shop/callback", async (req, res) => {
  const { code, state } = req.query as Record<string, string>;
  if (!code || !state) {
    res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return;
  }
  try { jwt.verify(state, JWT_SECRET); } catch {
    res.redirect(`${APP_URL}/settings/integrations?error=oauth_invalid_state`); return;
  }

  let accessToken: string; let refreshToken: string; let shopId: string;
  try {
    const tokenRes = await fetch(
      `https://auth.tiktok-shops.com/api/authorize/token` +
      `?app_key=${encodeURIComponent(TIKTOK_SHOP_APP_KEY!)}` +
      `&app_secret=${encodeURIComponent(TIKTOK_SHOP_SECRET!)}` +
      `&auth_code=${encodeURIComponent(code)}` +
      `&grant_type=authorized_code`,
    );
    if (!tokenRes.ok) { res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return; }
    const body = await tokenRes.json() as {
      data?: { access_token: string; refresh_token?: string; seller_id?: string };
      access_token?: string; refresh_token?: string; seller_id?: string;
    };
    // TikTok Shop wraps the payload in a `data` field
    const td   = body.data ?? body;
    accessToken  = td.access_token ?? "";
    refreshToken = td.refresh_token ?? "";
    shopId       = td.seller_id ?? "";
    if (!accessToken) { res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return; }
  } catch { res.redirect(`${APP_URL}/settings/integrations?error=oauth_failed`); return; }

  const existing = await db.select().from(integrationsTable)
    .where(eq(integrationsTable.provider, "tiktok_shop")).limit(1);
  const existingMeta = existing[0]?.metadata
    ? JSON.parse(existing[0].metadata) as Record<string, string>
    : {};
  const newMeta = { ...existingMeta, refreshToken, ...(shopId && { shopId }) };

  await db.insert(integrationsTable)
    .values({ provider: "tiktok_shop", accessToken, metadata: JSON.stringify(newMeta), status: "connected" })
    .onConflictDoUpdate({
      target: integrationsTable.provider,
      set: { accessToken, metadata: JSON.stringify(newMeta), status: "connected", updatedAt: new Date() },
    });
  res.redirect(`${APP_URL}/settings/integrations?success=tiktok_shop`);
});

export default router;
