---
name: TikTok Shop core ad channel integration
description: How TikTok Shop was wired in as a core channel alongside Meta/Google/TikTok Ads/Pinterest — auth model, sync pattern, and status surfacing.
---

TikTok Shop is a **different product and auth domain** from "TikTok Ads": the connected OAuth token in this app comes from the TikTok Shop **Partner API** (`auth.tiktok-shops.com` / `open-api.tiktokglobalshop.com`), not the TikTok Marketing API (`business-api.tiktok.com`). Any TikTok Shop work must use Partner API request signing (HMAC-SHA256 over sorted query params, wrapped with the app secret), not Marketing API auth.

Unlike the other core ad channels, TikTok Shop has **no external Snowflake `ADS.*_RAW` pipeline**. Its daily metrics are synced directly into a Postgres table (`tiktok_shop_daily_metrics`, date-unique) by the api-server, then merged into `/api/data/attribution` and `/api/data/spend` alongside the Snowflake-sourced channels using the same row shape (spend/impressions/clicks/conversions/revenue) so CPC/CTR/ROAS compute identically without special-casing.

**Why:** This repo has no cron/scheduler infrastructure (confirmed by search — only Snowflake ad-hoc queries and a one-time server-start bootstrap), so any future non-Snowflake channel integration should follow the same **on-demand, throttled, non-blocking** sync pattern: the read endpoint always serves whatever is currently in Postgres, and fires a background (fire-and-forget) resync only if the last sync is older than a threshold (30 min used for TikTok Shop). This avoids adding latency or hang risk to dashboard requests when a third-party API is slow or down.

**How to apply:** For a channel status ("connected"/"stale"/"needs_reconnect"), store `lastSyncedAt` and any error in the `integrations.metadata` JSON blob and flip `integrations.status` to `"expired"` only on an auth-specific failure (bad/expired token, missing API scope) — never on a generic network/API error, so a transient outage doesn't wrongly tell the user to reconnect. Surface the status as an additive `dataStatus` field on the channel object rather than threading it through the whole channel type.
