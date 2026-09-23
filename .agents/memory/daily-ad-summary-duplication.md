---
name: Daily ad-summary full-history rebuild duplication
description: Root cause pattern for a scheduler bug that silently multiplied historical ad-spend rows.
---

A scheduled job that re-aggregates a channel's **entire** history from raw source tables on every run (no date filter on the INSERT) must also fully delete that channel's existing rows before re-inserting — not just a recent rolling window (e.g. "last 3 days").

**Why:** `daily_scheduler.py`'s ad-summary rebuild used a 3-day-window DELETE paired with a full-history INSERT for the CTV/Display channels (unlike the same logic in `weekly_scheduler.py`, which correctly did a full DELETE). Every run beyond the first appended a duplicate copy of all older rows, silently multiplying reported spend (confirmed 3x inflation after 3 runs) while leaving the top-level summary numbers inconsistent with drill-down queries that read the same raw source freshly.

**How to apply:** whenever a scheduler/rebuild script re-aggregates full history into a summary table, verify the paired DELETE scope matches the INSERT scope exactly (both full-history or both windowed). A mismatch is easy to introduce when copying/adapting one script from another (as happened here between the daily and weekly scheduler variants) and is easy to miss in casual testing since only the most recent window looks correct.
