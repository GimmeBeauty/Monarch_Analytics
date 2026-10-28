/**
 * Attribution-window toggle for GET /api/data/attribution?window=default|7|14|30.
 *
 * DAILY_AD_SUMMARY stays the platform-default source and the only source for spend,
 * impressions and clicks. For 7/14/30, channels mapped in ADS.AD_ATTRIBUTION_DEFAULTS read
 * conversions and value from ADS.DAILY_AD_SUMMARY_WINDOWS; every other channel keeps its
 * DAILY_AD_SUMMARY figures (fixed windows such as Roundel 14d and Criteo 30d click).
 * See sql/attribution_windows.sql.
 */
import { querySnowflake } from "./snowflake.js";

export type RequestedWindow = "default" | "7" | "14" | "30";
const WINDOWS: RequestedWindow[] = ["default", "7", "14", "30"];

/** Missing parameter means default, so existing callers are unchanged. */
export function parseWindowParam(raw: unknown): RequestedWindow | null {
  if (raw === undefined || raw === "") return "default";
  return WINDOWS.includes(raw as RequestedWindow) ? (raw as RequestedWindow) : null;
}

export interface AttributionDefault {
  channel: string;
  defaultLabel: string;
  defaultDays: number | null;
  defaultUnit: string;
  windowKeys: Record<"7" | "14" | "30", string | null>;
}

export interface WindowUsed {
  /** "default" when the numbers are the channel's DAILY_AD_SUMMARY figures. */
  key: string;
  label: string;
  days: number | null;
  unit: string;
  /** True when the figures are exactly the requested window. Always false in default mode. */
  exact: boolean;
  /** Short qualifier for the channel row; null when nothing needs flagging. */
  chip: string | null;
  /** Longer explanation for the tooltip. */
  note: string | null;
}

// Google reports begin-checkout conversions on 8 campaigns, which the platform default includes
// and the purchase-only window figures do not.
const GOOGLE_BEGIN_CHECKOUT_CAMPAIGNS = 8;

const KEY_LABELS: Record<string, string> = {
  "1d_click": "1d click", "7d_click": "7d click", "28d_click": "28d click", "1d_view": "1d view",
  "1d": "1d", "7d": "7d", "14d": "14d", "30d": "30d",
};

// Channels whose platform window we haven't verified read the same label in every mode;
// "not verified" is said only in the tooltip.
const UNVERIFIED_CHANNELS = new Set(["tiktok_ads", "amazon_ads"]);
const UNVERIFIED_LABEL = "Default";
const UNVERIFIED_NOTE = "Attribution window not verified.";

/** Chip text names the window, then the conversion unit. */
const withUnit = (text: string, unit: string) => `${text} · ${unit}`;

const TIKTOK_SHOP_DEFAULT: AttributionDefault = {
  channel: "tiktok_shop", defaultLabel: "TikTok Shop default", defaultDays: null, defaultUnit: "orders",
  windowKeys: { "7": null, "14": null, "30": null },
};

export async function loadAttributionDefaults(db: string): Promise<Record<string, AttributionDefault>> {
  const rows = await querySnowflake(`
    SELECT channel, default_label, default_days, default_unit, window_7_key, window_14_key, window_30_key
    FROM ${db}.ADS.AD_ATTRIBUTION_DEFAULTS
  `);
  const out: Record<string, AttributionDefault> = { tiktok_shop: TIKTOK_SHOP_DEFAULT };
  for (const r of rows) {
    const g = (k: string) => r[k.toUpperCase()] ?? r[k];
    const key = (k: string) => (g(k) == null ? null : String(g(k)));
    const ch = String(g("channel"));
    out[ch] = {
      channel: ch,
      defaultLabel: String(g("default_label")),
      defaultDays: g("default_days") == null ? null : Number(g("default_days")),
      defaultUnit: String(g("default_unit")),
      windowKeys: { "7": key("window_7_key"), "14": key("window_14_key"), "30": key("window_30_key") },
    };
  }
  return out;
}

export interface WindowDay { date: string; conversions: number | null; revenue: number | null; }
export interface ChannelWindowData { key: string; days: number; unit: string; daily: WindowDay[]; }

/** Per-day window figures for every channel mapped for `window`, keyed by DAILY_AD_SUMMARY channel. */
export async function loadWindowData(
  db: string, start: string, end: string, window: Exclude<RequestedWindow, "default">,
  defaults: Record<string, AttributionDefault>, toDateStr: (v: unknown) => string,
): Promise<Record<string, ChannelWindowData>> {
  const mapped = Object.values(defaults).filter(d => d.windowKeys[window]);
  if (!mapped.length) return {};
  // Channel names and keys come from our own defaults table, not from the request.
  const pairs = mapped.map(d => `(channel='${d.channel}' AND window_key='${d.windowKeys[window]}')`).join(" OR ");
  const rows = await querySnowflake(`
    SELECT summary_date, channel, window_key, window_days, conversion_unit, conversions, conversion_value
    FROM ${db}.ADS.DAILY_AD_SUMMARY_WINDOWS
    WHERE summary_date BETWEEN '${start}' AND '${end}' AND (${pairs})
    ORDER BY summary_date
  `);
  const out: Record<string, ChannelWindowData> = {};
  for (const r of rows) {
    const g = (k: string) => r[k.toUpperCase()] ?? r[k];
    const ch = String(g("channel"));
    const entry = out[ch] ??= { key: String(g("window_key")), days: Number(g("window_days")), unit: String(g("conversion_unit")), daily: [] };
    entry.daily.push({
      date: toDateStr(g("summary_date")),
      conversions: g("conversions") == null ? null : Number(g("conversions")),
      revenue: g("conversion_value") == null ? null : Number(g("conversion_value")),
    });
  }
  return out;
}

/** Totals for a channel's window rows. Conversions are null only when no day reported them. */
export function sumWindow(daily: WindowDay[]): { conversions: number | null; revenue: number; nullConversionDays: number; nullRevenueDays: number } {
  let conv = 0, rev = 0, nullConv = 0, nullRev = 0;
  for (const d of daily) {
    if (d.conversions == null) nullConv++; else conv += d.conversions;
    if (d.revenue == null) nullRev++; else rev += d.revenue;
  }
  return { conversions: nullConv === daily.length && daily.length > 0 ? null : conv, revenue: rev, nullConversionDays: nullConv, nullRevenueDays: nullRev };
}

/** What a channel's numbers mean under the requested window. */
export function describeWindow(
  def: AttributionDefault | undefined, window: RequestedWindow,
  data?: { key: string; days: number; unit: string; nullConversionDays: number; nullRevenueDays: number },
): WindowUsed {
  const d = def ?? { channel: "", defaultLabel: "Platform default", defaultDays: null, defaultUnit: "conversions", windowKeys: { "7": null, "14": null, "30": null } };

  const unverified = UNVERIFIED_CHANNELS.has(d.channel);
  const defaultLabel = unverified ? UNVERIFIED_LABEL : d.defaultLabel;

  if (window === "default") {
    let chip = defaultLabel;
    if (d.channel === "google_ads") chip = `incl. begin checkout on ${GOOGLE_BEGIN_CHECKOUT_CAMPAIGNS} campaigns`;
    chip = withUnit(chip, d.defaultUnit);
    const note = d.channel === "walmart_connect"
      ? "Platform default counts units sold; the 14 and 30 windows count orders."
      : d.channel === "google_ads"
      ? "Google's default conversions include begin checkout; the 7/14/30 windows count purchases only."
      : unverified ? UNVERIFIED_NOTE
      : null;
    return { key: "default", label: defaultLabel, days: d.defaultDays, unit: d.defaultUnit, exact: false, chip, note };
  }

  const requested = Number(window);
  if (data && d.windowKeys[window]) {
    const exact = data.days === requested;
    let label = KEY_LABELS[data.key] ?? data.key;
    if (d.channel === "google_ads" && requested > 7) label = "7d (lookback max)";
    const notes: string[] = [];
    let chip: string | null = exact ? null : withUnit(label, data.unit);
    if (data.nullConversionDays > 0) {
      chip = chip ? `${chip} · orders n/a before 2026` : "orders n/a before 2026";
      notes.push(`Walmart reports orders from 2026 only; ${data.nullConversionDays} day(s) in this range have no order count.`);
      if (data.nullRevenueDays > 0) notes.push(`${data.key} revenue is also unavailable for those days.`);
    }
    if (d.channel === "google_ads" && requested > 7) notes.push("Google's purchase lookback is 7 days, so longer windows read the 7-day figure.");
    if (d.channel === "meta_ads") notes.push("Click-only window (view-through excluded).");
    return { key: data.key, label, days: data.days, unit: data.unit, exact, chip, note: notes.join(" ") || null };
  }

  // No per-window data: the channel keeps its platform-default figures.
  const exact = d.defaultDays === requested;
  const text = unverified ? UNVERIFIED_LABEL : d.defaultDays == null ? "platform default" : `${d.defaultLabel} (fixed)`;
  const chip = exact ? null : withUnit(text, d.defaultUnit);
  return { key: "default", label: defaultLabel, days: d.defaultDays, unit: d.defaultUnit, exact, chip,
    note: unverified ? `${UNVERIFIED_NOTE} No per-window data for this channel; showing its platform default.`
      : d.defaultDays == null ? "No per-window data for this channel; showing its platform default." : null };
}

/** Mixed when the channels' windows differ. Units are not part of it; the page notes them separately. */
export function isMixed(used: WindowUsed[], window: RequestedWindow): boolean {
  if (used.length <= 1) return false;
  // Default mode compares labels (e.g. "7d click + 1d view" vs a 7-day lookback); 7/14/30 compare
  // the days actually used, with unknown windows kept apart by their label.
  const windowOf = (u: WindowUsed) => window === "default" || u.days == null ? `label:${u.label}` : `days:${u.days}`;
  return new Set(used.map(windowOf)).size > 1;
}
