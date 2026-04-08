import { createContext, useContext, useState } from "react";

export interface DateRange {
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  label: string;
  preset: string;      // slug for highlighting the active preset
  compareEnabled: boolean;
  compareStart: string;
  compareEnd: string;
  compareLabel: string;
}

export function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export function subDays(d: Date, n: number): Date {
  return addDays(d, -n);
}

// Get quarter start/end for a given year and quarter (1-4)
export function quarterDates(year: number, q: number): { start: Date; end: Date } {
  const startMonth = (q - 1) * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 0); // last day of last month in quarter
  return { start, end };
}

export function currentQuarter(): { year: number; q: number } {
  const t = today();
  return { year: t.getFullYear(), q: Math.ceil((t.getMonth() + 1) / 3) };
}

function getCompareRange(startDate: string, endDate: string) {
  const s = new Date(startDate);
  const e = new Date(endDate);
  const diff = e.getTime() - s.getTime();
  const cEnd = subDays(s, 1);
  const cStart = new Date(cEnd.getTime() - diff);
  return {
    compareStart: fmt(cStart),
    compareEnd: fmt(cEnd),
    compareLabel: `${fmtLabel(cStart)} – ${fmtLabel(cEnd)}`,
  };
}

export function fmtLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function makeRange(start: Date, end: Date, label: string, preset: string): Omit<DateRange, "compareEnabled" | "compareStart" | "compareEnd" | "compareLabel"> {
  return { startDate: fmt(start), endDate: fmt(end), label, preset };
}

export function buildPreset(preset: string): Omit<DateRange, "compareEnabled" | "compareStart" | "compareEnd" | "compareLabel"> | null {
  const t = today();
  const yr = t.getFullYear();

  switch (preset) {
    case "today":
      return makeRange(t, t, "Today", preset);
    case "yesterday": {
      const y = subDays(t, 1);
      return makeRange(y, y, "Yesterday", preset);
    }
    case "last7d":
      return makeRange(subDays(t, 6), t, "Last 7 Days", preset);
    case "last30d":
      return makeRange(subDays(t, 29), t, "Last 30 Days", preset);
    case "last90d":
      return makeRange(subDays(t, 89), t, "Last 90 Days", preset);
    case "last365d":
      return makeRange(subDays(t, 364), t, "Last 365 Days", preset);
    case "last4w":
      return makeRange(subDays(t, 27), t, "Last 4 Weeks", preset);
    case "last8w":
      return makeRange(subDays(t, 55), t, "Last 8 Weeks", preset);
    case "last52w":
      return makeRange(subDays(t, 363), t, "Last 52 Weeks", preset);
    case "qtd": {
      const { q } = currentQuarter();
      const { start } = quarterDates(yr, q);
      const clampedStart = start > t ? t : start;
      return makeRange(clampedStart, t, "Quarter to Date", preset);
    }
    default: {
      // Handle quarter presets like "q1-2026", "q4-2025" etc.
      const m = preset.match(/^q(\d)-(\d{4})$/);
      if (m) {
        const q = parseInt(m[1]);
        const y = parseInt(m[2]);
        const { start, end } = quarterDates(y, q);
        const clampedEnd = end > t ? t : end;
        return makeRange(start, clampedEnd, `Q${q} ${y}`, preset);
      }
      return null;
    }
  }
}

function defaultState(): DateRange {
  const base = buildPreset("last30d")!;
  const compare = getCompareRange(base.startDate, base.endDate);
  return { ...base, compareEnabled: false, ...compare };
}

interface DateRangeContextValue {
  dateRange: DateRange;
  setRange: (start: string, end: string, label: string, preset: string) => void;
  setPreset: (preset: string) => void;
  toggleCompare: () => void;
  setCompareRange: (start: string, end: string) => void;
}

const DateRangeContext = createContext<DateRangeContextValue>({
  dateRange: defaultState(),
  setRange: () => {},
  setPreset: () => {},
  toggleCompare: () => {},
  setCompareRange: () => {},
});

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRange>(defaultState);

  const setRange = (start: string, end: string, label: string, preset: string) => {
    const compare = getCompareRange(start, end);
    setDateRange((prev) => ({ ...prev, startDate: start, endDate: end, label, preset, ...compare }));
  };

  const setPreset = (preset: string) => {
    const range = buildPreset(preset);
    if (!range) return;
    const compare = getCompareRange(range.startDate, range.endDate);
    setDateRange((prev) => ({ ...prev, ...range, ...compare }));
  };

  const toggleCompare = () => {
    setDateRange((prev) => ({ ...prev, compareEnabled: !prev.compareEnabled }));
  };

  const setCompareRange = (start: string, end: string) => {
    setDateRange((prev) => ({
      ...prev,
      compareStart: start,
      compareEnd: end,
      compareLabel: `${fmtLabel(new Date(start))} – ${fmtLabel(new Date(end))}`,
    }));
  };

  return (
    <DateRangeContext.Provider value={{ dateRange, setRange, setPreset, toggleCompare, setCompareRange }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  return useContext(DateRangeContext);
}
