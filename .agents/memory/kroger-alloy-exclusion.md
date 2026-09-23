---
name: Kroger excluded pending Alloy integration
description: Why Kroger data is deliberately absent from Monarch even though real NetSuite revenue exists for it.
---

Kroger (NetSuite entity ID 228) has real sell-in revenue in `MONARCH_RAW.FINANCE.NETSUITE_SALES_BY_PRODUCT` (~$4M since Oct 2025), but it is intentionally excluded from every part of the Monarch app: store pickers, filters, exports, forecast settings, alerts, item-performance/retailer-velocity aggregation, and the wholesale performance trend chart.

**Why:** the user confirmed this is placeholder data that should not appear yet — Kroger reporting will be sourced through an Alloy integration in the future, and until that's live the NetSuite entity 228 numbers should not surface anywhere.

**How to apply:** do not re-add "kroger" to any store list, retailer map, or dropdown without checking whether the Alloy integration has landed. The exclusion lives in multiple places (frontend constant lists, `EXCLUDED_ENTITY_IDS` in `item-performance.ts`, the Postgres `stores` table row was deleted, and NetSuite sync scripts skip entity 228). If Kroger data is needed again, all of these need to be reverted together, and the sync scripts re-enabled.
