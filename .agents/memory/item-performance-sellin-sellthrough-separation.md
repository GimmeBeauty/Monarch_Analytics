---
name: Item Performance sell-in/sell-through separation
description: Sell-in (NetSuite shipments) and sell-through (POS) must always be exposed as separate numbers, never merged into one "revenue" figure.
---

The Item Performance page previously merged NetSuite sell-in and POS sell-through into a single `revenue`/`totalRevenue` number per retailer/SKU, picking one source to display based on a preference order. This made a brand-new SKU's pipeline-fill shipments (sell-in) indistinguishable from real consumer purchases (sell-through) — e.g. a freshly launched SKU showed $345k "revenue" that was 100% unshipped-to-consumer sell-in, because the merge logic silently preferred sell-in when both existed.

**Why:** A user caught this when a just-launched SKU showed implausibly high revenue. Verifying directly against Snowflake confirmed the number was pure NetSuite sell-in with zero POS/Circana rows for that UPC — the UI gave no way to tell.

**How to apply:** `sellInRevenue`/`sellInUnits` and `sellThroughRevenue`/`sellThroughUnits` must always be computed and exposed as distinct fields (both at the per-retailer `byRetailer` row level and at the SKU/retailer-overview total level) in `artifacts/api-server/src/routes/item-performance.ts` and `artifacts/api-server/src/lib/retailer-velocity.ts`, regardless of the `dataSource` toggle. The toggle (`sellin`/`pos`/`all`) should only control the single "effective" `revenue`/`totalRevenue` value used internally for DPSW, benchmark, and sorting math — it must never be the only number rendered in the UI. The frontend (`artifacts/monarch/src/pages/item-performance.tsx`) renders both columns side by side (showing "—" when a source has no data) rather than one ambiguous merged column. Do not reintroduce a single merged "revenue" column as the primary display value.
