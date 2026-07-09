---
name: Monarch organic/direct revenue definition
description: How "organic revenue" is computed for the Spend Optimizer MER/iROAS metrics — the real feed that replaced the old 35%-of-attributed fixed assumption.
---

Organic/direct revenue for Monarch's Spend Optimizer (`totalBaseRevenue` in `spendData.ts`, `organicRevenue` field on `GET /api/data/spend`) is computed in `artifacts/api-server/src/routes/data.ts` as the sum of Shopify order `total_price` from `SHOPIFY_ORDERS_RAW` where the order is not voided/refunded AND `landing_site` has no `utm_source` param (i.e. no UTM tagging = not attributable to any paid ad channel).

**Why:** The original implementation used a hardcoded `totalAttributedRevenue × 0.35` fudge factor with no data behind it. `SHOPIFY_ORDERS_RAW.raw_data` is the full pass-through Shopify Admin API order object, which includes `landing_site` (first-touch URL with any UTM query params) even though the codebase's other queries only ever projected `source_name`/`financial_status`/`total_price` out of it.

**How to apply:** Any future change to attribution/organic modeling (e.g. NetSuite-based organic estimation, wholesale organic, or a more granular UTM parser) should extend this same query rather than reintroducing a fixed-percentage assumption. `buildSpendData()` now requires `organicRevenue` as a mandatory param (no silent fallback) — pass `0` explicitly if genuinely no data, don't make up a ratio.
