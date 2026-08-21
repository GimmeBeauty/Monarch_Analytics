---
name: Gimme assortment SKU filter
description: Which NetSuite SKUs are not real Gimme products and must be excluded from sell-in reporting, and where the exclusion needs to be applied.
---

Gimme's NetSuite sell-in table (`FINANCE.NETSUITE_SALES_BY_PRODUCT`) contains SKUs
that are NOT part of the current Gimme assortment and must be excluded from all
reporting built on that table:
- SKUs prefixed with "P" + 4 digits (e.g. `P3368`, `P3368-OLD`)
- SKUs whose leading numeric value is below 7000 (e.g. `5925`, `5925-OLD`, `6859`)

Both rules apply regardless of trailing suffixes like `-OLD`. Confirmed against
live Snowflake data (~26 P-prefixed and a handful of sub-7000 SKUs existed in a
single year of data before filtering).

**Why:** these are legacy/placeholder codes, not real shippable Gimme products;
including them inflates SKU counts and (for `NETSUITE_SALES_BY_PRODUCT`-based
revenue totals) misstates revenue.

**How to apply:** use the shared helper in
`artifacts/api-server/src/lib/sku-filter.ts` (`GIMME_ASSORTMENT_SKU_SQL_FILTER`
for bare-column Snowflake WHERE clauses, `isGimmeAssortmentSku()` for JS-side
checks) any time a query reads directly from `NETSUITE_SALES_BY_PRODUCT`. It is
applied in `routes/item-performance.ts` (SKU table + weekly trend) and
`routes/data.ts` (`/api/data/netsuite/sales` wholesale summary). If a new route
queries that table, apply the same filter or the same non-assortment SKUs will
leak back in.
