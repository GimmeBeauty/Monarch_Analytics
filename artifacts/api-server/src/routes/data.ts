import { Router } from "express";
import { db, integrationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMeta(raw: string | null | undefined): Record<string, string> {
  if (!raw) return {};
  try { return JSON.parse(raw) as Record<string, string>; } catch { return {}; }
}

/**
 * Exchange a Google OAuth refresh token for a short-lived access token.
 * Accepts clientId / clientSecret from the stored credentials (metadata) so
 * we don't rely on application-level env vars.
 */
async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        client_id:     clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });
    if (!res.ok) return null;
    const d = await res.json() as { access_token?: string };
    return d.access_token ?? null;
  } catch { return null; }
}

// ─── GET /api/data/shopify ────────────────────────────────────────────────────

router.get("/shopify", authenticate, async (req, res) => {
  const { start, end } = req.query as Record<string, string>;
  if (!start || !end) { res.status(400).json({ error: "start and end required" }); return; }

  const rows = await db.select().from(integrationsTable)
    .where(eq(integrationsTable.provider, "shopify")).limit(1);
  const row = rows[0];
  if (!row?.shopDomain || !row.accessToken || row.accessToken === "manual") {
    res.status(404).json({ error: "Shopify not connected" }); return;
  }

  const { shopDomain, accessToken } = row;
  const orders: Array<{ created_at: string; total_price: string; financial_status?: string }> = [];
  let pageInfo: string | null = null;
  let isFirstPage = true;

  try {
    do {
      const url = new URL(`https://${shopDomain}/admin/api/2025-01/orders.json`);
      url.searchParams.set("limit", "250");

      if (isFirstPage) {
        url.searchParams.set("status",         "any");
        url.searchParams.set("created_at_min", `${start}T00:00:00Z`);
        url.searchParams.set("created_at_max", `${end}T23:59:59Z`);
        url.searchParams.set("fields", "id,created_at,total_price,financial_status");
        isFirstPage = false;
      } else {
        url.searchParams.set("page_info", pageInfo!);
      }

      const r = await fetch(url.toString(), {
        headers: { "X-Shopify-Access-Token": accessToken },
      });
      if (!r.ok) {
        const errBody = await r.text().catch(() => "");
        res.status(r.status).json({ error: "Shopify API error", detail: errBody }); return;
      }

      const d = await r.json() as { orders: Array<{ created_at: string; total_price: string; financial_status?: string }> };
      orders.push(...d.orders.filter(o =>
        !o.financial_status || o.financial_status === "paid" || o.financial_status === "partially_refunded"
      ));

      const link  = r.headers.get("link") ?? "";
      const match = link.match(/page_info=([^&>]+)[^>]*>;\s*rel="next"/);
      pageInfo = match ? match[1] : null;
    } while (pageInfo && orders.length < 10_000);
  } catch {
    res.status(502).json({ error: "Failed to reach Shopify" }); return;
  }

  const dailyMap: Record<string, { revenue: number; orders: number }> = {};
  let totalRevenue = 0;

  for (const order of orders) {
    const date  = order.created_at.split("T")[0];
    const price = parseFloat(order.total_price ?? "0");
    totalRevenue += price;
    if (!dailyMap[date]) dailyMap[date] = { revenue: 0, orders: 0 };
    dailyMap[date].revenue += price;
    dailyMap[date].orders  += 1;
  }

  const dailySeries = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  res.json({
    revenue:     totalRevenue,
    orders:      orders.length,
    aov:         orders.length > 0 ? totalRevenue / orders.length : 0,
    dailySeries,
  });
});

// ─── GET /api/data/google_ads ─────────────────────────────────────────────────

router.get("/google_ads", authenticate, async (req, res) => {
  const { start, end } = req.query as Record<string, string>;
  if (!start || !end) { res.status(400).json({ error: "start and end required" }); return; }

  const rows = await db.select().from(integrationsTable)
    .where(eq(integrationsTable.provider, "google_ads")).limit(1);
  const row = rows[0];
  if (!row) { res.status(404).json({ error: "Google Ads not connected" }); return; }

  const meta         = parseMeta(row.metadata);
  const developerToken = meta.developerToken;
  const customerId     = meta.customerId;
  const clientId       = meta.clientId;
  const clientSecret   = meta.clientSecret;
  const refreshToken   = meta.refreshToken;

  if (!developerToken || !customerId) {
    res.status(400).json({ error: "Developer Token and Customer ID are required" }); return;
  }
  if (!clientId || !clientSecret || !refreshToken) {
    res.status(400).json({ error: "Client ID, Client Secret, and Refresh Token are required" }); return;
  }

  // The stored accessToken may be "manual" (new credential format) or a cached OAuth token.
  // Always try to get a fresh access token via the refresh token.
  let accessToken = row.accessToken !== "manual" ? row.accessToken : "";

  // Refresh the token if we don't have a valid one cached
  if (!accessToken) {
    const fresh = await refreshGoogleToken(refreshToken, clientId, clientSecret);
    if (!fresh) {
      res.status(401).json({ error: "Failed to obtain Google access token — check Client ID, Secret, and Refresh Token" });
      return;
    }
    accessToken = fresh;
    await db.update(integrationsTable)
      .set({ accessToken: fresh, updatedAt: new Date() })
      .where(eq(integrationsTable.provider, "google_ads"));
  }

  const cleanCid = customerId.replace(/-/g, "");
  const query = `
    SELECT
      segments.date,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${start}' AND '${end}'
      AND campaign.status != 'REMOVED'
  `;

  const doFetch = (token: string) =>
    fetch(`https://googleads.googleapis.com/v15/customers/${cleanCid}/googleAds:search`, {
      method: "POST",
      headers: {
        Authorization:     `Bearer ${token}`,
        "developer-token": developerToken,
        "Content-Type":    "application/json",
      },
      body: JSON.stringify({ query }),
    });

  let gRes = await doFetch(accessToken);

  // Token expired — try one refresh cycle
  if (gRes.status === 401) {
    const newToken = await refreshGoogleToken(refreshToken, clientId, clientSecret);
    if (newToken) {
      accessToken = newToken;
      await db.update(integrationsTable)
        .set({ accessToken: newToken, updatedAt: new Date() })
        .where(eq(integrationsTable.provider, "google_ads"));
      gRes = await doFetch(newToken);
    }
  }

  if (!gRes.ok) {
    const body = await gRes.text();
    res.status(gRes.status).json({ error: "Google Ads API error", detail: body }); return;
  }

  type GRow = {
    segments?: { date?: string };
    metrics?: {
      impressions?: number; clicks?: number;
      costMicros?: number; conversions?: number; conversionsValue?: number;
    };
  };
  const gData = await gRes.json() as { results?: GRow[] };

  const dailyMap: Record<string, {
    spend: number; impressions: number; clicks: number; conversions: number; revenue: number;
  }> = {};

  for (const r of gData.results ?? []) {
    const date = r.segments?.date ?? "";
    if (!date) continue;
    if (!dailyMap[date]) dailyMap[date] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    dailyMap[date].spend       += (r.metrics?.costMicros ?? 0) / 1_000_000;
    dailyMap[date].impressions += r.metrics?.impressions    ?? 0;
    dailyMap[date].clicks      += r.metrics?.clicks         ?? 0;
    dailyMap[date].conversions += r.metrics?.conversions    ?? 0;
    dailyMap[date].revenue     += r.metrics?.conversionsValue ?? 0;
  }

  const dailySeries = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));

  const totals = dailySeries.reduce(
    (acc, d) => ({
      spend:       acc.spend       + d.spend,
      impressions: acc.impressions + d.impressions,
      clicks:      acc.clicks      + d.clicks,
      conversions: acc.conversions + d.conversions,
      revenue:     acc.revenue     + d.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );

  res.json({ ...totals, dailySeries });
});

// ─── GET /api/data/meta ───────────────────────────────────────────────────────

router.get("/meta", authenticate, async (req, res) => {
  const { start, end } = req.query as Record<string, string>;
  if (!start || !end) { res.status(400).json({ error: "start and end required" }); return; }

  const rows = await db.select().from(integrationsTable)
    .where(eq(integrationsTable.provider, "meta")).limit(1);
  const row = rows[0];
  if (!row) { res.status(404).json({ error: "Meta Ads not connected" }); return; }

  const meta = parseMeta(row.metadata);

  // Access token: stored in metadata.accessToken (new credential format) or
  // directly in row.accessToken (legacy format where it was saved there).
  const accessToken = (meta.accessToken?.trim())
    || (row.accessToken !== "manual" ? row.accessToken : "");

  // Ad account ID — stored in metadata
  const adAccountId = meta.adAccountId?.trim();

  if (!accessToken) {
    res.status(400).json({ error: "Access Token is required — update your Meta Ads credentials" }); return;
  }
  if (!adAccountId) {
    res.status(400).json({ error: "Ad Account ID is required — update your Meta Ads credentials" }); return;
  }

  // Normalize: ensure act_ prefix
  const normalizedAccountId = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;

  const fields    = "spend,impressions,clicks,actions,action_values,frequency,reach";
  const timeRange = JSON.stringify({ since: start, until: end });

  const mRes = await fetch(
    `https://graph.facebook.com/v18.0/${normalizedAccountId}/insights` +
    `?fields=${encodeURIComponent(fields)}` +
    `&time_range=${encodeURIComponent(timeRange)}` +
    `&time_increment=1&level=account&limit=90`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!mRes.ok) {
    const body = await mRes.text();
    res.status(mRes.status).json({ error: "Meta API error", detail: body }); return;
  }

  type MRow = {
    date_start: string; spend: string; impressions: string; clicks: string;
    frequency?: string;
    actions?:       Array<{ action_type: string; value: string }>;
    action_values?: Array<{ action_type: string; value: string }>;
  };
  const mData = await mRes.json() as { data?: MRow[] };

  const dailySeries = (mData.data ?? [])
    .map(r => {
      const purchases     = r.actions?.find(a => a.action_type === "purchase");
      const purchaseValue = r.action_values?.find(a => a.action_type === "purchase");
      return {
        date:        r.date_start,
        spend:       parseFloat(r.spend       ?? "0"),
        impressions: parseInt(r.impressions   ?? "0", 10),
        clicks:      parseInt(r.clicks        ?? "0", 10),
        conversions: parseFloat(purchases?.value     ?? "0"),
        revenue:     parseFloat(purchaseValue?.value ?? "0"),
        frequency:   parseFloat(r.frequency   ?? "0"),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const totals = dailySeries.reduce(
    (acc, d) => ({
      spend:       acc.spend       + d.spend,
      impressions: acc.impressions + d.impressions,
      clicks:      acc.clicks      + d.clicks,
      conversions: acc.conversions + d.conversions,
      revenue:     acc.revenue     + d.revenue,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );

  const avgFrequency = dailySeries.length > 0
    ? dailySeries.reduce((s, d) => s + d.frequency, 0) / dailySeries.length
    : 0;

  res.json({ ...totals, frequency: avgFrequency, dailySeries });
});

export default router;
