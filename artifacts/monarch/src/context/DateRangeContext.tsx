import { createContext, useContext, useState } from "react";

export type DateRangePreset = "7d" | "30d" | "90d" | "365d" | "custom";

export interface DateRange {
  preset: DateRangePreset;
  startDate: string;
  endDate: string;
  compareEnabled: boolean;
  compareStart: string;
  compareEnd: string;
  label: string;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getPresetRange(preset: DateRangePreset): Omit<DateRange, "compareEnabled" | "compareStart" | "compareEnd"> {
  const now = new Date();
  const end = formatDate(now);
  let start: string;
  let label: string;
  switch (preset) {
    case "7d":
      start = formatDate(new Date(now.getTime() - 7 * 86400000));
      label = "Last 7 Days";
      break;
    case "30d":
      start = formatDate(new Date(now.getTime() - 30 * 86400000));
      label = "Last 30 Days";
      break;
    case "90d":
      start = formatDate(new Date(now.getTime() - 90 * 86400000));
      label = "Last Quarter";
      break;
    case "365d":
      start = formatDate(new Date(now.getTime() - 365 * 86400000));
      label = "Last Year";
      break;
    default:
      start = formatDate(new Date(now.getTime() - 30 * 86400000));
      label = "Last 30 Days";
  }
  return { preset, startDate: start, endDate: end, label };
}

function getCompareRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  return {
    compareEnd: formatDate(new Date(start.getTime() - 86400000)),
    compareStart: formatDate(new Date(start.getTime() - diff - 86400000)),
  };
}

const defaultPreset = getPresetRange("30d");
const defaultCompare = getCompareRange(defaultPreset.startDate, defaultPreset.endDate);

const defaultRange: DateRange = {
  ...defaultPreset,
  compareEnabled: false,
  ...defaultCompare,
};

interface DateRangeContextValue {
  dateRange: DateRange;
  setPreset: (preset: DateRangePreset) => void;
  toggleCompare: () => void;
}

const DateRangeContext = createContext<DateRangeContextValue>({
  dateRange: defaultRange,
  setPreset: () => {},
  toggleCompare: () => {},
});

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);

  const setPreset = (preset: DateRangePreset) => {
    const range = getPresetRange(preset);
    const compare = getCompareRange(range.startDate, range.endDate);
    setDateRange((prev) => ({ ...prev, ...range, ...compare }));
  };

  const toggleCompare = () => {
    setDateRange((prev) => ({ ...prev, compareEnabled: !prev.compareEnabled }));
  };

  return (
    <DateRangeContext.Provider value={{ dateRange, setPreset, toggleCompare }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  return useContext(DateRangeContext);
}
