import { useState } from "react";
import { AlertTriangle, Bell, Plug, Package, Info, ChevronRight, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import type { ActivityEvent, ActivityCategory, ActivitySeverity } from "@/lib/overviewData";
import { storeById } from "@/lib/storeData";
import { CHANNEL_MAP } from "@/lib/channelStoreMapping";

// ─── Config ───────────────────────────────────────────────────────────────────

type FilterTab = "all" | ActivityCategory;

const TABS: { id: FilterTab; label: string }[] = [
  { id: "all",         label: "All"          },
  { id: "alert",       label: "Alerts"       },
  { id: "integration", label: "Integrations" },
  { id: "product",     label: "Product"      },
  { id: "data",        label: "Data"         },
];

const SEVERITY_STYLES: Record<ActivitySeverity, { border: string; bg: string; dot: string; icon: string }> = {
  critical: {
    border: "border-l-red-500",
    bg: "bg-red-50 dark:bg-red-950/20",
    dot: "bg-red-500",
    icon: "text-red-500",
  },
  warning: {
    border: "border-l-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/20",
    dot: "bg-amber-400",
    icon: "text-amber-500 dark:text-amber-400",
  },
  info: {
    border: "border-l-[#FFBC80]/60",
    bg: "bg-transparent",
    dot: "bg-[#FFBC80]",
    icon: "text-[#FFBC80] dark:text-[#FFE29A]",
  },
};

const CATEGORY_ICONS: Record<ActivityCategory, React.FC<{ className?: string }>> = {
  alert:       AlertTriangle,
  integration: Plug,
  product:     Package,
  data:        Info,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = (now - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function absTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Single Event ─────────────────────────────────────────────────────────────

function EventItem({ event }: { event: ActivityEvent }) {
  const [, navigate] = useLocation();
  const styles = SEVERITY_STYLES[event.severity];
  const CategoryIcon = CATEGORY_ICONS[event.category];

  const store = event.relatedStore ? storeById(event.relatedStore) : undefined;
  const channel = event.relatedChannel ? CHANNEL_MAP.get(event.relatedChannel) : undefined;

  const handleClick = () => {
    if (event.linkTo) navigate(event.linkTo);
  };

  return (
    <div
      className={`
        flex gap-3 pl-4 pr-4 py-3.5 rounded-xl border-l-2 transition-colors duration-150
        ${styles.border} ${styles.bg}
        ${event.linkTo ? "cursor-pointer hover:bg-[#3A3A3A]/3 dark:hover:bg-[#FFF9F2]/3" : ""}
      `}
      onClick={handleClick}
    >
      {/* Icon */}
      <div className="mt-0.5 shrink-0">
        <CategoryIcon className={`w-4 h-4 ${styles.icon}`} />
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] leading-snug">
            {event.title}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 tabular-nums whitespace-nowrap"
              title={absTime(event.timestamp)}
            >
              {relativeTime(event.timestamp)}
            </span>
            {event.linkTo && (
              <ExternalLink className="w-3 h-3 text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25" />
            )}
          </div>
        </div>

        <p className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mt-0.5 leading-relaxed">
          {event.description}
        </p>

        {/* Tags */}
        {(store || channel || event.category !== "product") && (
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className={`
                text-[10px] font-medium px-1.5 py-0.5 rounded uppercase tracking-wide
                ${event.category === "alert"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  : event.category === "integration"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : event.category === "data"
                  ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                  : "bg-[#FFBC80]/20 text-[#FFBC80] dark:text-[#FFE29A]"}
              `}
            >
              {event.category}
            </span>
            {store && (
              <span className="text-[10px] text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">
                {store.label}
              </span>
            )}
            {channel && (
              <span className="text-[10px] text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">
                {channel.channelLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Feed Container ───────────────────────────────────────────────────────────

const INITIAL_VISIBLE = 6;

interface ActivityFeedProps {
  events: ActivityEvent[];
}

export default function ActivityFeed({ events }: ActivityFeedProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [showAll, setShowAll] = useState(false);

  const filtered = activeTab === "all"
    ? events
    : events.filter((e) => e.category === activeTab);

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_VISIBLE);

  // Badge counts
  const alertCount = events.filter((e) => e.category === "alert" && e.severity !== "info").length;

  return (
    <div
      className="rounded-2xl bg-white dark:bg-[#1a1208]"
      style={{
        border: "1px solid transparent",
        backgroundImage:
          "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
        backgroundOrigin: "border-box",
        backgroundClip: "padding-box, border-box",
      }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#FFBC80]" />
            <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">
              Activity Feed
            </h3>
            {alertCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white leading-none">
                {alertCount}
              </span>
            )}
          </div>
          <span className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {TABS.map((tab) => {
            const count = tab.id === "all"
              ? events.length
              : events.filter((e) => e.category === tab.id).length;
            if (count === 0 && tab.id !== "all") return null;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setShowAll(false); }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-[#FFBC80]/20 text-[#FFBC80] dark:text-[#FFE29A]"
                    : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:bg-[#3A3A3A]/5 dark:hover:bg-[#FFF9F2]/5"
                }`}
              >
                {tab.label}
                <span className="text-[10px] opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-[#FFBC80]/15 dark:border-[#FFBC80]/10 mx-5" />

      {/* Events */}
      <div className="p-5 space-y-2">
        {visible.length === 0 ? (
          <p className="text-sm text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 text-center py-4">
            No events in this category.
          </p>
        ) : (
          visible.map((event) => <EventItem key={event.id} event={event} />)
        )}
      </div>

      {/* Show more / less */}
      {filtered.length > INITIAL_VISIBLE && (
        <div className="px-5 pb-5 pt-0">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:bg-[#3A3A3A]/5 dark:hover:bg-[#FFF9F2]/5 transition-colors border border-[#3A3A3A]/10 dark:border-[#FFF9F2]/10"
          >
            {showAll ? (
              <>Show less</>
            ) : (
              <>
                Show {filtered.length - INITIAL_VISIBLE} more
                <ChevronRight className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
