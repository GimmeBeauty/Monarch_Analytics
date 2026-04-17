import { Router } from "express";
import { db, integrationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate.js";

const router = Router();

const GOOGLE_ADS_CLIENT_ID     = process.env.GOOGLE_ADS_CLIENT_ID!;
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET!;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        client_id:     GOOGLE_ADS_CLIENT_ID,
        client_secret: GOOGLE_ADS_CLIENT_SECRET,
        refresh_token: refreshToken,
      }).toString(),
    });
    if (!res.ok) return null;
    const d = await res.json() as { access_token: string };
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
  if (!row?.shopDomain || !row.accessToken) {
    res.status(404).json({ error: "Shopify not connected" }); return;
  }

  const { shopDomain, accessToken } = row;
  const orders: Array<{ created_at: string; total_price: string }> = [];
  let pageInfo: string | null = null;
  let isFirstPage = true;

  try {
    do {
      const url = new URL(`https://${shopDomain}/admin/api/2024-01/orders.json`);
      url.searchParams.set("limit",  "250");
      url.searchParams.set("fields", "id,created_at,total_price");

      if (isFirstPage) {
        // Date filters only go on the first request — they're encoded in the cursor thereafter
        url.searchParams.set("financial_status", "paid");
        url.searchParams.set("status",           "any");
        url.searchParams.set("created_at_min",   `${start}T00:00:00Z`);
        url.searchParams.set("created_at_max",   `${end}T23:59:59Z`);
        isFirstPage = false;
      } else {
        url.searchParams.set("page_info", pageInfo!);
      }

      const r = await fetch(url.toString(), {
        headers: { "X-Shopify-Access-Token": accessToken },
      });
      if (!r.ok) { res.status(r.status).json({ error: "Shopify API error" }); return; }

      const d = await r.json() as { orders: typeof orders };
      orders.push(...d.orders);

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

  let { accessToken } = row;
  let meta: Record<string, string> = {};
  try { meta = JSON.parse(row.metadata ?? "{}"); } catch {}

  const { refreshToken, developerToken, customerId } = meta;
  if (!developerToken || !customerId) {
    res.status(400).json({ error: "Developer token and customer ID required" }); return;
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
        Authorization:    `Bearer ${token}`,
        "developer-token": developerToken,
        "Content-Type":   "application/json",
      },
      body: JSON.stringify({ query }),
    });

  let gRes = await doFetch(accessToken);

  // Token may have expired — try one refresh
  if (gRes.status === 401 && refreshToken) {
    const newToken = await refreshGoogleToken(refreshToken);
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
    dailyMap[date].impressions += r.metrics?.impressions ?? 0;
    dailyMap[date].clicks      += r.metrics?.clicks      ?? 0;
    dailyMap[date].conversions += r.metrics?.conversions ?? 0;
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

  const { accessToken } = row;
  let meta: Record<string, string> = {};
  try { meta = JSON.parse(row.metadata ?? "{}"); } catch {}

  const { adAccountId } = meta;
  if (!adAccountId) {
    res.status(400).json({ error: "Ad account ID required" }); return;
  }

  const fields     = "spend,impressions,clicks,actions,action_values,frequency,reach";
  const timeRange  = JSON.stringify({ since: start, until: end });

  const mRes = await fetch(
    `https://graph.facebook.com/v18.0/${adAccountId}/insights` +
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
