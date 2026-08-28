import { useDateRange, fmtLabel } from "@/context/DateRangeContext";
import { DateRangeButton } from "@/components/ui/DateRangePicker";
import StoreFilter from "@/components/layout/StoreFilter";
import { usePricingMode } from "@/context/PricingModeContext";
import { useTheme } from "@/context/ThemeContext";
import { Tag, Menu } from "lucide-react";

interface TopBarProps {
  title: string;
  description: string;
  hideDatePicker?: boolean;
  hideStoreFilter?: boolean;
  onMenuClick?: () => void;
}

export default function TopBar({ title, description, hideDatePicker, hideStoreFilter, onMenuClick }: TopBarProps) {
  const { dateRange } = useDateRange();
  const { isWholesale } = usePricingMode();
  const { theme } = useTheme();

  const compareStart = dateRange.compareStart ? new Date(dateRange.compareStart) : null;
  const compareEnd = dateRange.compareEnd ? new Date(dateRange.compareEnd) : null;
  const accentGradient = theme === "dark"
    ? "linear-gradient(135deg, #BFA1E3, #9BDBF3)"
    : "linear-gradient(135deg, #FFBC80, #FFE29A)";

  return (
    <div
      data-testid="top-bar"
      className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-8 py-3 md:py-3.5 border-b border-[#FFBC80]/30 dark:border-[#9BDBF3]/30 bg-[#FFF9F2]/80 dark:bg-white/80 backdrop-blur-sm sticky top-0 z-20"
    >
      {/* Menu button + title/description */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          data-testid="mobile-menu-button"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="md:hidden shrink-0 -ml-1.5 p-2 rounded-lg text-[#3A3A3A] dark:text-[#003349] hover:bg-[#FFBC80]/10 dark:hover:bg-[#9BDBF3]/10"
        >
          <Menu size={20} />
        </button>
        <div className="min-w-0">
          <h1
            data-testid="page-title"
            className="text-xl font-bold text-[#3A3A3A] dark:text-[#003349] tracking-tight truncate"
          >
            {title}
          </h1>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#003349]/40 mt-0.5 truncate">{description}</p>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* Wholesale pricing badge */}
        {isWholesale && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400/50 bg-amber-400/10">
            <Tag size={12} className="text-amber-600 dark:text-amber-700" />
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-700">
              Wholesale Pricing
            </span>
          </div>
        )}

        {/* Comparison badge — shown when compare is active */}
        {!hideDatePicker && dateRange.compareEnabled && compareStart && compareEnd && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FFBC80]/40 dark:border-[#9BDBF3]/40 bg-[#FFBC80]/10 dark:bg-[#9BDBF3]/10">
            <div className="w-2 h-2 rounded-full" style={{ background: accentGradient }} />
            <span className="text-xs font-medium text-[#3A3A3A]/70 dark:text-[#003349]/60">
              vs {fmtLabel(compareStart)} – {fmtLabel(compareEnd)}
            </span>
          </div>
        )}

        {/* Store filter */}
        {!hideStoreFilter && <StoreFilter />}

        {/* Date range selector */}
        {!hideDatePicker && <DateRangeButton />}
      </div>
    </div>
  );
}
