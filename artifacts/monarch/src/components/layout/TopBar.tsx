import { useDateRange, fmtLabel } from "@/context/DateRangeContext";
import { DateRangeButton } from "@/components/ui/DateRangePicker";

interface TopBarProps {
  title: string;
  description: string;
}

export default function TopBar({ title, description }: TopBarProps) {
  const { dateRange } = useDateRange();

  const compareStart = dateRange.compareStart ? new Date(dateRange.compareStart) : null;
  const compareEnd = dateRange.compareEnd ? new Date(dateRange.compareEnd) : null;

  return (
    <div
      data-testid="top-bar"
      className="flex items-center justify-between px-8 py-3.5 border-b border-[#FFBC80]/30 dark:border-[#FFBC80]/20 bg-[#FFF9F2]/80 dark:bg-[#1a1208]/80 backdrop-blur-sm sticky top-0 z-20"
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

      {/* Right controls */}
      <div className="flex items-center gap-3">
        {/* Comparison badge — shown when compare is active */}
        {dateRange.compareEnabled && compareStart && compareEnd && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FFBC80]/40 bg-[#FFBC80]/10">
            <div className="w-2 h-2 rounded-full" style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }} />
            <span className="text-xs font-medium text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">
              vs {fmtLabel(compareStart)} – {fmtLabel(compareEnd)}
            </span>
          </div>
        )}

        {/* Date range selector */}
        <DateRangeButton />
      </div>
    </div>
  );
}
