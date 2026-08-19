import { describe, expect, it } from "vitest";
import { buildSeasonalTrendModel, isoWeek, isoWeekStart } from "./forecast-model.js";

describe("buildSeasonalTrendModel", () => {
  it("learns a separate trend for each seasonal bucket", () => {
    const model = buildSeasonalTrendModel([
      { year: 2023, bucket: 1, value: 100 },
      { year: 2024, bucket: 1, value: 150 },
      { year: 2025, bucket: 1, value: 200 },
      { year: 2023, bucket: 2, value: 500 },
      { year: 2024, bucket: 2, value: 600 },
      { year: 2025, bucket: 2, value: 700 },
    ], 2026, [1, 2]);

    expect(model.points.get(1)?.value).toBe(250);
    expect(model.points.get(2)?.value).toBe(800);
  });

  it("derives confidence bounds from observed variance rather than a fixed percentage", () => {
    const model = buildSeasonalTrendModel([
      { year: 2023, bucket: 1, value: 100 },
      { year: 2024, bucket: 1, value: 150 },
      { year: 2025, bucket: 1, value: 240 },
      { year: 2023, bucket: 2, value: 500 },
      { year: 2024, bucket: 2, value: 600 },
      { year: 2025, bucket: 2, value: 780 },
    ], 2026, [1, 2]);

    const january = model.points.get(1)!;
    const february = model.points.get(2)!;
    expect(january.upper! - january.value!).toBeLessThan(february.upper! - february.value!);
    expect(january.lower).not.toBe(Math.round(january.value! * 0.85));
  });

  it("returns null for periods without enough history to establish a trend", () => {
    const model = buildSeasonalTrendModel([{ year: 2025, bucket: 1, value: 100 }], 2026, [1, 2]);

    expect(model.points.get(1)).toEqual({ value: null, lower: null, upper: null });
    expect(model.points.get(2)).toEqual({ value: null, lower: null, upper: null });
    expect(model.missingBuckets).toEqual([1, 2]);
  });
});

describe("monthly aggregation before modeling", () => {
  it("forecasts at monthly scale when daily rows are summed per month first", () => {
    // Simulate 30 daily ad-spend rows of $100/day = $3,000 for the month,
    // across three years, aggregated into ONE observation per year/month.
    const dailyRows = (year: number) =>
      Array.from({ length: 30 }, () => ({ year, month: 1, spend: 100 }));
    const allRows = [...dailyRows(2023), ...dailyRows(2024), ...dailyRows(2025)];

    const byYearMonth = new Map<string, number>();
    for (const row of allRows) {
      const key = `${row.year}-${row.month}`;
      byYearMonth.set(key, (byYearMonth.get(key) ?? 0) + row.spend);
    }
    const observations = [...byYearMonth.entries()].map(([key, total]) => {
      const [y, m] = key.split("-").map(Number);
      return { year: y!, bucket: m!, value: total };
    });

    const model = buildSeasonalTrendModel(observations, 2026, [1]);
    // Must forecast ~$3,000 (a full month), not ~$100 (a single day).
    expect(model.points.get(1)?.value).toBe(3000);
  });
});

describe("isoWeek / isoWeekStart", () => {
  it("assigns the same calendar week to the same ISO bucket across years", () => {
    // The same seasonal week (early-July) must map to the same bucket even
    // though its calendar date drifts year to year.
    const bucket2024 = isoWeek(new Date("2024-07-08T00:00:00Z"));
    const bucket2025 = isoWeek(new Date("2025-07-07T00:00:00Z"));
    expect(bucket2024).toBe(bucket2025);
  });

  it("round-trips a week start back to the same ISO week", () => {
    for (const [year, week] of [[2024, 1], [2025, 27], [2026, 52]] as const) {
      const start = isoWeekStart(year, week);
      expect(start.getUTCDay()).toBe(1); // Monday
      expect(isoWeek(start)).toBe(week);
    }
  });
});