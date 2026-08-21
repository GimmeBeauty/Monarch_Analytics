---
name: Item Performance data-source toggle bug
description: Why the Sell-In / Sell-Through / Best-Available toggle on Item Performance looked like it did nothing, and what fixed it.
---

Item Performance (`artifacts/api-server/src/routes/item-performance.ts`) lets
users pick a data source: `sellin` (NetSuite shipments), `pos` (consumer POS
from Target/Walmart/Circana), or `all` (POS preferred, sell-in fallback).

Originally only the displayed Revenue/Units cell swapped based on the toggle.
The SKU-level `avgDpsw`, `targetDpsw`, `velocityBenchmark`, and `retailerCount`
— which drive sorting, badges, and the summary KPI cards — were always computed
from the raw sell-in aggregation (`agg.retailerRevenue`), never from the
POS-merged `byRetailerMap`. So switching data sources looked like a no-op for
most of the page.

**Why:** the POS merge (`byRetailerMap`) was built AFTER the DPSW/benchmark
math ran, so those numbers never saw it.

**How to apply:** always derive per-SKU totals/DPSW/benchmark/retailer-count
from the merged `byRetailerArr` (built from `byRetailerMap`), not from the
pre-merge sell-in aggregate. If you add a new SKU-level metric to that route,
compute it after the POS merge for the same reason — otherwise it will silently
ignore the data-source toggle again.
