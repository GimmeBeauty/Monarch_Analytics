import { Router } from "express";
import crypto from "crypto";
import { randomUUID } from "crypto";
import { db, integrationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET            = process.env.JWT_SECRET!;
const SHOPIFY_CLIENT_ID     = process.env.SHOPIFY_CLIENT_ID;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const APP_URL               = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SHOPIFY_SCOPES        = "read_orders,read_products,read_analytics,read_inventory,read_customers";

const ALL_PROVIDERS = [
  "shopify", "google_ads", "meta", "tiktok", "tiktok_shop",
  "pinterest", "criteo", "applovin", "walmart", "target_roundel",
  "google_analytics", "alloy_ai", "pattern_predict", "stay_ai", "yotpo",
  "google_sheets",
] as const;
type AnyProvider = (typeof ALL_PROVIDERS)[number];

// ─── GET /api/integrations ────────────────────────────────────────────────────

router.get("/", authenticate, async (_req, res) => {
  try {
    const rows = await db.select().from(integrationsTable);

    const integrations = ALL_PROVIDERS.map((provider) => {
      const row = rows.find((r) => r.provider === provider);
      let savedFields: string[] = [];
      let sheets: unknown[] = [];

      if (row?.metadata) {
        try {
          const meta = JSON.parse(row.metadata) as Record<string, unknown>;
          if (provider === "google_sheets") {
            sheets = (meta.sheets as unknown[]) ?? [];
          } else {
            savedFields = Object.keys(meta).filter(
              (k) => k !== "authType" && !!meta[k]
            );
          }
        } catch { /* ignore */ }
      }

      return {
        provider,
        connected:  !!row,
        shopDomain: row?.shopDomain ?? null,
        savedFields,
        sheets,
        status:     row?.status ?? null,
      };
    });

    res.json({ integrations });
  } catch {
    res.status(500).json({ error: "Failed to fetch integrations" });
  }
});

// ─── Shopify OAuth ────────────────────────────────────────────────────────────

router.get("/shopify/connect", authenticate, (req, res) => {
  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) {
    res.status(500).json({ error: "Shopify integration not configured" });
    return;
  }
  let shop = (req.query.shop as string | undefined)?.trim();
  if (!shop) { res.status(400).json({ error: "shop param required" }); return; }
  shop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!shop.includes(".")) shop = `${shop}.myshopify.com`;

  const state = jwt.sign({ userId: (req as any).auth!.userId, shop }, JWT_SECRET, { expiresIn: "10m" });
  const redirectUri = `${APP_URL}/api/integrations/shopify/callback`;
  const authUrl =
    `https://${shop}/admin/oauth/authorize` +
    `?client_id=${encodeURIComponent(SHOPIFY_CLIENT_ID)}` +
    `&scope=${encodeURIComponent(SHOPIFY_SCOPES)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}`;
  res.redirect(authUrl);
});

router.get("/shopify/callback", async (req, res) => {
  const { code, state, shop, hmac } = req.query as Record<string, string>;
  if (!code || !state || !shop) {
    res.redirect(`${APP_URL}/integrations?error=shopify_missing_params`); return;
  }
  try { jwt.verify(state, JWT_SECRET); } catch {
    res.redirect(`${APP_URL}/integrations?error=shopify_invalid_state`); return;
  }
  if (hmac && SHOPIFY_CLIENT_SECRET) {
    const message = Object.entries(req.query)
      .filter(([k]) => k !== "hmac").sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`).join("&");
    const expected = crypto.createHmac("sha256", SHOPIFY_CLIENT_SECRET).update(message).digest("hex");
    if (expected !== hmac) { res.redirect(`${APP_URL}/integrations?error=shopify_hmac_failed`); return; }
  }
  let accessToken: string; let scopes: string;
  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: SHOPIFY_CLIENT_ID, client_secret: SHOPIFY_CLIENT_SECRET, code }),
    });
    if (!tokenRes.ok) { res.redirect(`${APP_URL}/integrations?error=shopify_token_failed`); return; }
    const td = await tokenRes.json() as { access_token: string; scope: string };
    accessToken = td.access_token; scopes = td.scope;
  } catch { res.redirect(`${APP_URL}/integrations?error=shopify_network_error`); return; }

  await db.insert(integrationsTable)
    .values({ provider: "shopify", accessToken, shopDomain: shop, scopes, status: "connected" })
    .onConflictDoUpdate({
      target: integrationsTable.provider,
      set: { accessToken, shopDomain: shop, scopes, status: "connected", updatedAt: new Date() },
    });
  res.redirect(`${APP_URL}/integrations?success=shopify`);
});

// ─── POST /api/integrations/:provider/credentials ─────────────────────────────
// Saves any set of fields for manual providers (stored as JSON in metadata).

router.post("/:provider/credentials", authenticate, async (req, res) => {
  const { provider } = req.params as { provider: AnyProvider };
  if (!ALL_PROVIDERS.includes(provider) || provider === "shopify" || provider === "google_sheets") {
    res.status(400).json({ error: `Invalid provider for manual credentials: ${provider}` }); return;
  }

  const fields = req.body as Record<string, string>;
  const filled = Object.entries(fields).filter(([, v]) => typeof v === "string" && v.trim());
  if (filled.length === 0) {
    res.status(400).json({ error: "At least one credential field is required" }); return;
  }

  const meta: Record<string, string> = {};
  filled.forEach(([k, v]) => { meta[k] = v.trim(); });

  try {
    await db.insert(integrationsTable)
      .values({ provider, accessToken: "manual", metadata: JSON.stringify(meta), status: "connected" })
      .onConflictDoUpdate({
        target: integrationsTable.provider,
        set: { accessToken: "manual", metadata: JSON.stringify(meta), status: "connected", updatedAt: new Date() },
      });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to save credentials" });
  }
});

// ─── Google Sheets management ─────────────────────────────────────────────────

interface Sheet { id: string; name: string; url: string; tab?: string; }

router.post("/google_sheets/sheets", authenticate, async (req, res) => {
  const { name, url, tab } = req.body as { name?: string; url?: string; tab?: string };
  if (!name?.trim() || !url?.trim()) {
    res.status(400).json({ error: "Sheet name and URL are required" }); return;
  }

  try {
    const existing = await db.select().from(integrationsTable)
      .where(eq(integrationsTable.provider, "google_sheets")).limit(1);
    const row = existing[0];
    let sheets: Sheet[] = [];
    if (row?.metadata) {
      try { sheets = (JSON.parse(row.metadata) as { sheets: Sheet[] }).sheets ?? []; } catch { /* ignore */ }
    }
    sheets.push({ id: randomUUID(), name: name.trim(), url: url.trim(), tab: tab?.trim() || undefined });

    await db.insert(integrationsTable)
      .values({ provider: "google_sheets", accessToken: "sheets", metadata: JSON.stringify({ sheets }), status: "connected" })
      .onConflictDoUpdate({
        target: integrationsTable.provider,
        set: { metadata: JSON.stringify({ sheets }), status: "connected", updatedAt: new Date() },
      });
    res.json({ success: true, sheets });
  } catch {
    res.status(500).json({ error: "Failed to add sheet" });
  }
});

router.delete("/google_sheets/sheets/:sheetId", authenticate, async (req, res) => {
  const { sheetId } = req.params;
  try {
    const existing = await db.select().from(integrationsTable)
      .where(eq(integrationsTable.provider, "google_sheets")).limit(1);
    const row = existing[0];
    if (!row) { res.status(404).json({ error: "No sheets configured" }); return; }

    let sheets: Sheet[] = [];
    try { sheets = (JSON.parse(row.metadata ?? "{}") as { sheets: Sheet[] }).sheets ?? []; } catch { /* ignore */ }
    sheets = sheets.filter((s) => s.id !== sheetId);

    if (sheets.length === 0) {
      await db.delete(integrationsTable).where(eq(integrationsTable.provider, "google_sheets"));
    } else {
      await db.update(integrationsTable)
        .set({ metadata: JSON.stringify({ sheets }), updatedAt: new Date() })
        .where(eq(integrationsTable.provider, "google_sheets"));
    }
    res.json({ success: true, sheets });
  } catch {
    res.status(500).json({ error: "Failed to remove sheet" });
  }
});

// ─── DELETE /api/integrations/:provider ───────────────────────────────────────

router.delete("/:provider", authenticate, async (req, res) => {
  const { provider } = req.params;
  if (!ALL_PROVIDERS.includes(provider as AnyProvider)) {
    res.status(400).json({ error: `Unknown provider: ${provider}` }); return;
  }
  try {
    await db.delete(integrationsTable).where(eq(integrationsTable.provider, provider));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

export default router;
