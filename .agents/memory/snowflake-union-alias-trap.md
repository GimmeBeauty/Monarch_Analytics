---
name: Snowflake UNION ALL alias trap
description: A UNION ALL branch missing column aliases only breaks when a filter excludes the aliased branch — easy to miss in testing.
---

When combining per-source queries (e.g. per-channel or per-store data) with `UNION ALL` in Snowflake, every branch must alias its columns identically (e.g. all branches must produce `rev`, `units`, not just the first/primary branch).

**Why:** if only one branch (say, the "main" data source) aliases its columns and the others rely on Snowflake to infer names, the outer query only fails with `invalid identifier` when a filter (e.g. a store/channel selector) excludes that aliased branch — so it can look correct in default testing and fail unpredictably for specific filter combinations. This caused a full outage of Monarch's Forecast tab for any store filter that excluded the Shopify branch.

**How to apply:** whenever adding a new source to an existing UNION ALL query (new channel, new store type, etc.), explicitly copy the alias list from the reference branch to the new branch. When debugging a "works sometimes" 500 error involving UNION ALL, check aliasing first regardless of which branch reports the error — the missing alias is often in a *different* branch than the one that ends up erroring.
