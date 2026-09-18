---
name: Monarch period-over-period comparison scope rule
description: How to decide which dashboard pages/metrics get real "vs prior" comparisons, and the scope-matching trap to avoid.
---

When fixing "vs prior period/year" comparisons across Monarch dashboard pages, fix only a metric where a UI slot already renders a comparison but is fed fake, hardcoded, or zeroed data. Never add a new comparison UI slot to a page/metric that doesn't already have one.

**Why:** The alternative turns a bounded correctness fix into an open-ended feature-design task with its own UX decisions per page.

**How to apply:** Confirmed as of this session: Overview, Traffic (product tables), and Attribution (blended KPI cards) had real slots fed fake data. Spend Optimizer, Performance Trends, Item Performance, and Forecast have no numeric comparison UI at all — leave them alone under this rule.

A second, easy-to-miss trap: whatever filtering/scoping applies to the *current*-period figure (selected channels, selected stores, a data source merged in on the frontend like Circana) must apply identically to the *prior*-period figure before computing a % change, or the comparison silently compares two different populations. Concretely on this dashboard: Attribution's blended metrics are filtered by selected ad channels on the frontend, so prior-period ad data must be returned per-channel (not pre-aggregated) so the same channel filter can apply to both sides. Circana POS revenue is merged into Overview's current-period total on the frontend but has no date-range-based prior-period query (it resolves to a period label via `resolveCircanaPeriod`), so any KPI whose current value includes Circana must suppress its % change badge rather than compare against a Circana-less prior total.
