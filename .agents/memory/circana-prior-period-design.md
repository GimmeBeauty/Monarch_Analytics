---
name: Circana "vs prior period" design
description: How Circana POS product rows compute a prior-period comparison despite the data only ever having one snapshot per rolling-window bucket.
---

Circana's period labels (e.g. "Latest 4 Week", "Latest 13 Week") are pre-aggregated rolling windows, all re-stamped to the same as-of date on refresh. There is no historical row per bucket to diff against — only one snapshot per window size exists at a time — so the literal start/end-date comparison used for every other retailer on the Traffic page doesn't apply.

The windows nest (4w ⊂ 13w ⊂ 26w ⊂ 52w, all ending on the same date). The "prior" period is defined per bucket as:
- 4w → prior slice = 13w total − 4w total (a 9-week slice)
- 13w → prior slice = 26w total − 13w total (a matching same-length slice)
- 26w → prior slice = 52w total − 26w total (a matching same-length slice)
- 52w and year-to-date → no larger nested bucket exists, so both fall back to comparing against the full prior calendar year's snapshot
- a full prior calendar year selection → no earlier snapshot exists at all, so no comparison is possible; stays at 0

Because the isolated prior slice's day-count doesn't always match the current window's day-count (e.g. 4w's 9-week prior slice), both sides are converted to a per-day rate and the prior side is re-expressed over the current window's day-count before computing % change — an implicit run-rate normalization.

Two related gotchas discovered while building this:
- Mapping a date range to a bucket must check for specific preset shapes (Jan-1 start for "year to date", ~350-375 day span for "last 52 weeks") *before* generic day-count thresholds — a plain day-count check misclassifies a January "year to date" range (very few days) as a short rolling window instead.
- A per-product prior figure must be clamped to zero (and treated as "unavailable" when the product has no matching row in the reference bucket) rather than left free to go negative — syndicated POS data can be revised between snapshot pulls, so a reference-bucket total can legitimately dip below the current-bucket total for a given product.

**Why:** Confirmed via direct query that the underlying POS table only ever contains one row per rolling-window bucket at any time — there is no per-week historical grain to build an exact same-length comparison for every bucket.

**How to apply:** Any future "vs prior" comparison for this data source should reuse the same bucket-nesting/day-normalization approach rather than re-deriving it, and must reuse (not bypass) the preset-aware bucket classification and the zero-clamping/unavailable handling described above.
