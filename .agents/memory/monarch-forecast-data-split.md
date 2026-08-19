---
name: Monarch forecast data model split
description: Where Forecast Settings data actually lives — Snowflake vs Postgres vs (formerly) localStorage — so a future agent doesn't misdiagnose "goals aren't shared" reports.
---

Monarch's Forecast Settings page (`artifacts/monarch/src/pages/settings/ForecastSettings.tsx`) has three distinct pieces of data, previously easy to confuse:

1. **Monthly/annual dollar goals** — stored in Snowflake `FORECAST_SETTINGS`, read/written via `GET/POST /api/data/forecast/settings`. Always shared across users; this was never the problem.
2. **The list of stores and years** shown in the dropdowns — stored in Postgres via `artifacts/api-server/src/routes/forecast.ts` (`/api/forecast/stores`, `/api/forecast/years`), keyed by numeric id, distinct schema from the Snowflake goals. This is now the source of truth for the dropdown lists (wired up; previously it existed but was unused dead code).
3. There used to be a third copy in browser `localStorage` (both for the store/year list AND as a silent fallback when goal save/load API calls failed). This has been removed — any API failure now surfaces a visible error banner instead of silently degrading to per-browser data.

**Why:** "goals aren't visible to other users" reports could stem from any of these three layers failing independently; conflating them wastes investigation time.

**How to apply:** if a future report says forecast data (goals, or the store/year lists) isn't shared, check which of the two live backends (Snowflake for goal values, Postgres for store/year metadata) is actually failing — don't reintroduce a localStorage fallback as a "fix," since that recreates the exact per-browser-only bug.
