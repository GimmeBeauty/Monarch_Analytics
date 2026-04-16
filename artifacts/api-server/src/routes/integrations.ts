import { Router } from "express";
import crypto from "crypto";
import { db, integrationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";
import jwt from "jsonwebtoken";

const router = Router();

// ─── Config ───────────────────────────────────────────────────────────────────

const JWT_SECRET         = process.env.JWT_SECRET!;
const SHOPIFY_CLIENT_ID  = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
// APP_URL is the public-facing base URL of the app (e.g. https://monarch.durhambrands.com)
const APP_URL            = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const SHOPIFY_SCOPES = "read_orders,read_products,read_analytics,read_inventory,read_customers";

const ALL_PROVIDERS = ["shopify", "google_ads", "google_analytics", "meta", "tiktok"] as const;

// ─── GET /api/integrations ────────────────────────────────────────────────────
// Returns the connection status for every known provider.

router.get("/", authenticate, async (_req, res) => {
  try {
    const rows = await db.select().from(integrationsTable);

    const integrations = ALL_PROVIDERS.map((provider) => {
      const row = rows.find((r) => r.provider === provider);
      return {
        provider,
        connected:  !!row,
        shopDomain: row?.shopDomain ?? null,
        status:     row?.status    ?? null,
      };
    });

    res.json({ integrations });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch integrations" });
  }
});

// ─── GET /api/integrations/shopify/connect?shop=mystore.myshopify.com ─────────
// Initiates the Shopify OAuth flow. Redirects the browser to Shopify.

router.get("/shopify/connect", authenticate, (req, res) => {
  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    res.status(500).json({ error: "Shopify integration is not configured — set SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET" });
    return;
  }

  let shop = (req.query.shop as string | undefined)?.trim();
  if (!shop) {
    res.status(400).json({ error: "shop query parameter is required (e.g. mystore.myshopify.com)" });
    return;
  }

  // Normalize: strip protocol/trailing slash, append .myshopify.com if bare name
  shop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!shop.includes(".")) {
    shop = `${shop}.myshopify.com`;
  }

  // Sign a short-lived state JWT so we can re-identify the user on callback
  const state = jwt.sign(
    { userId: (req as any).auth!.userId, shop },
    JWT_SECRET,
    { expiresIn: "10m" }
  );

  const redirectUri  = `${APP_URL}/api/integrations/shopify/callback`;
  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(SHOPIFY_CLIENT_ID)}` +
    `&scope=${encodeURIComponent(SHOPIFY_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(authUrl);
});

// ─── GET /api/integrations/shopify/callback ───────────────────────────────────
// Shopify redirects here after the user approves/denies the app.

router.get("/shopify/callback", async (req, res) => {
  const { code, state, shop, hmac } = req.query as Record<string, string>;

  if (!code || !state || !shop) {
    res.redirect(`${APP_URL}/integrations?error=shopify_missing_params`);
    return;
  }

  // Verify state JWT
  try {
    jwt.verify(state, JWT_SECRET);
  } catch {
    res.redirect(`${APP_URL}/integrations?error=shopify_invalid_state`);
    return;
  }

  // Verify Shopify HMAC signature
  if (hmac && SHOPIFY_CLIENT_SECRET) {
    const message = Object.entries(req.query)
      .filter(([k]) => k !== "hmac")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");

    const expected = crypto
      .createHmac("sha256", SHOPIFY_CLIENT_SECRET)
      .update(message)
      .digest("hex");

    if (expected !== hmac) {
      res.redirect(`${APP_URL}/integrations?error=shopify_hmac_failed`);
      return;
    }
  }

  // Exchange authorization code for an access token
  let accessToken: string;
  let scopes: string;
  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        client_id:     SHOPIFY_CLIENT_ID,
        client_secret: SHOPIFY_CLIENT_SECRET,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Shopify token exchange failed:", err);
      res.redirect(`${APP_URL}/integrations?error=shopify_token_failed`);
      return;
    }

    const tokenData = await tokenRes.json() as { access_token: string; scope: string };
    accessToken = tokenData.access_token;
    scopes      = tokenData.scope;
  } catch (err) {
    console.error("Shopify token exchange error:", err);
    res.redirect(`${APP_URL}/integrations?error=shopify_network_error`);
    return;
  }

  // Upsert the integration record
  await db
    .insert(integrationsTable)
    .values({
      provider:    "shopify",
      accessToken,
      shopDomain:  shop,
      scopes,
      status:      "connected",
    })
    .onConflictDoUpdate({
      target: integrationsTable.provider,
      set: {
        accessToken,
        shopDomain: shop,
        scopes,
        status:    "connected",
        updatedAt: new Date(),
      },
    });

  res.redirect(`${APP_URL}/integrations?success=shopify`);
});

// ─── DELETE /api/integrations/shopify ─────────────────────────────────────────
// Removes the stored Shopify credentials.

router.delete("/shopify", authenticate, async (_req, res) => {
  try {
    await db.delete(integrationsTable).where(eq(integrationsTable.provider, "shopify"));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to disconnect Shopify" });
  }
});

export default router;
