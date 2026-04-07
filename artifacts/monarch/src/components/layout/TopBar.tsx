import { ChevronDown, ToggleLeft, ToggleRight } from "lucide-react";
import { useState } from "react";
import { useDateRange, type DateRangePreset } from "@/context/DateRangeContext";

interface TopBarProps {
  title: string;
  description: string;
}

const presets: { value: DateRangePreset; label: string }[] = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last Quarter" },
  { value: "365d", label: "Last Year" },
];

export default function TopBar({ title, description }: TopBarProps) {
  const { dateRange, setPreset, toggleCompare } = useDateRange();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div
      data-testid="top-bar"
      className="flex items-center justify-between px-8 py-4 border-b border-[#FFBC80]/30 dark:border-[#FFBC80]/20 bg-[#FFF9F2]/80 dark:bg-[#1a1208]/80 backdrop-blur-sm sticky top-0 z-10"
    >
      {/* Title + description */}
      <div>
        <h1
          data-testid="page-title"
          className="text-xl font-bold text-[#3A3A3A] dark:text-[#FFF9F2] tracking-tight"
        >
          {title}
        </h1>
        <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">{description}</p>
      </div>

      {/* Date range controls */}
      <div className="flex items-center gap-3">
        {/* Compare toggle */}
        <button
          data-testid="compare-toggle"
          onClick={toggleCompare}
          className="flex items-center gap-2 text-sm font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors"
        >
          {dateRange.compareEnabled ? (
            <ToggleRight size={20} className="text-[#FFBC80]" />
          ) : (
            <ToggleLeft size={20} />
          )}
          <span className={dateRange.compareEnabled ? "text-[#FFBC80]" : ""}>Compare</span>
        </button>

        {/* Date range selector */}
        <div className="relative">
          <button
            data-testid="date-range-selector"
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#3A3A3A] dark:text-[#FFF9F2] border transition-all hover:bg-[#FFBC80]/10"
            style={{
              borderImage: "linear-gradient(135deg, #FFBC80, #FFE29A) 1",
              border: "1px solid #FFBC80",
            }}
          >
            {dateRange.label}
            <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-48 rounded-xl shadow-xl overflow-hidden z-50 border"
              style={{
                background: "var(--color-card, #fff)",
                borderColor: "#FFBC80",
              }}
            >
              {presets.map((p) => (
                <button
                  key={p.value}
                  data-testid={`preset-${p.value}`}
                  onClick={() => {
                    setPreset(p.value);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors hover:bg-[#FFBC80]/10 ${
                    dateRange.preset === p.value
                      ? "font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] bg-[#FFBC80]/15"
                      : "text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
