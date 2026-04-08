import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronRight, ChevronLeft, ChevronDown, X } from "lucide-react";
import { useDateRange, buildPreset, fmtLabel, fmt, today, addDays, quarterDates, currentQuarter } from "@/context/DateRangeContext";

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isBetween(d: Date, s: Date, e: Date) {
  return d > s && d < e;
}

function displayFmt(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function inputFmt(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ─── Dynamic quarter list ────────────────────────────────────────────────────

function getQuarterPresets() {
  const { year, q } = currentQuarter();
  const presets: { key: string; label: string }[] = [];
  presets.push({ key: "qtd", label: "Quarter to Date" });
  // current quarter and 4 previous quarters
  let cy = year;
  let cq = q;
  for (let i = 0; i < 5; i++) {
    presets.push({ key: `q${cq}-${cy}`, label: `Q${cq} ${cy}` });
    cq--;
    if (cq < 1) { cq = 4; cy--; }
  }
  return presets;
}

// ─── Month Calendar ──────────────────────────────────────────────────────────

interface CalendarProps {
  year: number;
  month: number; // 0-indexed
  selecting: { start: Date | null; end: Date | null };
  hovered: Date | null;
  onDayClick: (d: Date) => void;
  onDayHover: (d: Date | null) => void;
}

function MonthCalendar({ year, month, selecting, hovered, onDayClick, onDayHover }: CalendarProps) {
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  // pad to full rows
  while (cells.length % 7 !== 0) cells.push(null);

  const t = today();
  const { start: selStart, end: selEnd } = selecting;
  const rangeEnd = selEnd ?? hovered ?? null;

  const effectiveStart = selStart && rangeEnd && rangeEnd < selStart ? rangeEnd : selStart;
  const effectiveEnd = selStart && rangeEnd && rangeEnd < selStart ? selStart : rangeEnd;

  return (
    <div className="min-w-[220px]">
      <div className="grid grid-cols-7 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const isToday = sameDay(day, t);
          const isStart = !!(effectiveStart && sameDay(day, effectiveStart));
          const isEnd = !!(effectiveEnd && sameDay(day, effectiveEnd));
          const inRange = !!(effectiveStart && effectiveEnd && isBetween(day, effectiveStart, effectiveEnd));
          const isFuture = day > t;

          let cellCls = "relative flex items-center justify-center h-8 text-xs cursor-pointer select-none transition-colors ";
          let innerCls = "w-8 h-8 flex items-center justify-center rounded-full transition-colors z-10 relative ";

          if (isFuture) {
            cellCls += "opacity-30 cursor-default ";
          }

          if (isStart || isEnd) {
            innerCls += "text-[#3A3A3A] font-bold ";
            // gradient background
          } else if (inRange) {
            cellCls += "bg-[#FFBC80]/15 ";
            innerCls += "text-[#3A3A3A] dark:text-[#FFF9F2] hover:bg-[#FFBC80]/20 ";
          } else {
            innerCls += "text-[#3A3A3A] dark:text-[#FFF9F2] hover:bg-[#FFBC80]/15 ";
          }

          if (isToday && !isStart && !isEnd) {
            innerCls += "ring-1 ring-[#FFBC80]/60 ";
          }

          // Range cap styling
          const capLeft = isStart && effectiveEnd && !sameDay(effectiveStart!, effectiveEnd);
          const capRight = isEnd && effectiveStart && !sameDay(effectiveStart!, effectiveEnd);

          return (
            <div
              key={i}
              className={cellCls}
              onClick={() => !isFuture && onDayClick(day)}
              onMouseEnter={() => !isFuture && onDayHover(day)}
              onMouseLeave={() => onDayHover(null)}
            >
              {/* Range fill behind cap */}
              {(capLeft || inRange || capRight) && (
                <div className={`absolute inset-y-1 bg-[#FFBC80]/15 ${
                  capLeft ? "left-1/2 right-0" : capRight ? "left-0 right-1/2" : "left-0 right-0"
                }`} />
              )}
              <div
                className={innerCls}
                style={isStart || isEnd ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Picker ─────────────────────────────────────────────────────────────

type LeftPanel = "main" | "last" | "quarters";

interface Props {
  onClose: () => void;
}

export function DateRangePicker({ onClose }: Props) {
  const { dateRange, setRange, setPreset, toggleCompare, setCompareRange } = useDateRange();

  // Pending selection (before Apply)
  const [pendingStart, setPendingStart] = useState<Date | null>(() => parseDate(dateRange.startDate));
  const [pendingEnd, setPendingEnd] = useState<Date | null>(() => parseDate(dateRange.endDate));
  const [clickCount, setClickCount] = useState(0); // 0 = waiting for start, 1 = waiting for end
  const [hovered, setHovered] = useState<Date | null>(null);
  const [activePreset, setActivePreset] = useState(dateRange.preset);

  // Calendar navigation: left month displayed
  const [calYear, setCalYear] = useState(() => {
    const d = parseDate(dateRange.endDate);
    return d.getFullYear();
  });
  const [calMonth, setCalMonth] = useState(() => {
    const d = parseDate(dateRange.endDate);
    return d.getMonth(); // right calendar = this month, left = previous
  });

  const leftYear = calMonth === 0 ? calYear - 1 : calYear;
  const leftMonth = calMonth === 0 ? 11 : calMonth - 1;

  // Left panel navigation
  const [leftPanel, setLeftPanel] = useState<LeftPanel>("main");

  // Comparison
  const [compareEnabled, setCompareEnabled] = useState(dateRange.compareEnabled);
  const [comparePreset, setComparePreset] = useState<"previous_period" | "previous_year" | "custom">("previous_period");

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleDayClick = useCallback((d: Date) => {
    if (clickCount === 0) {
      setPendingStart(d);
      setPendingEnd(null);
      setClickCount(1);
      setActivePreset("custom");
    } else {
      if (d < pendingStart!) {
        setPendingEnd(pendingStart);
        setPendingStart(d);
      } else {
        setPendingEnd(d);
      }
      setClickCount(0);
    }
  }, [clickCount, pendingStart]);

  const selectPreset = (key: string) => {
    const range = buildPreset(key);
    if (!range) return;
    setPendingStart(parseDate(range.startDate));
    setPendingEnd(parseDate(range.endDate));
    setActivePreset(key);
    setClickCount(0);
    // Navigate calendar to show the end date
    const end = parseDate(range.endDate);
    setCalYear(end.getFullYear());
    setCalMonth(end.getMonth());
  };

  const handleApply = () => {
    if (!pendingStart) return;
    const s = fmt(pendingStart);
    const e = fmt(pendingEnd ?? pendingStart);
    const preset = activePreset;
    const label = buildPreset(preset)?.label ?? `${fmtLabel(pendingStart)} – ${fmtLabel(pendingEnd ?? pendingStart)}`;
    setRange(s, e, label, preset);
    if (compareEnabled !== dateRange.compareEnabled) toggleCompare();
    onClose();
  };

  // Formatted labels
  const startLabel = pendingStart ? inputFmt(pendingStart) : "Start date";
  const endLabel = (pendingEnd ?? (clickCount === 1 ? hovered : null));
  const endLabelStr = endLabel ? inputFmt(endLabel instanceof Date ? endLabel : parseDate(String(endLabel))) : pendingStart ? inputFmt(pendingStart) : "End date";

  const btnActive = "w-full text-left px-3 py-1.5 rounded-lg text-sm font-semibold text-[#3A3A3A]";
  const btnInactive = "w-full text-left px-3 py-1.5 rounded-lg text-sm text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 hover:bg-[#FFBC80]/10 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors";

  const lastItems = [
    { key: "last7d", label: "Last 7 Days" },
    { key: "last30d", label: "Last 30 Days" },
    { key: "last90d", label: "Last 90 Days" },
    { key: "last365d", label: "Last 365 Days" },
    { key: "last4w", label: "Last 4 Weeks" },
    { key: "last8w", label: "Last 8 Weeks" },
    { key: "last52w", label: "Last 52 Weeks" },
  ];

  const quarterItems = getQuarterPresets();

  const isLastActive = lastItems.some((i) => i.key === activePreset);
  const isQuarterActive = quarterItems.some((i) => i.key === activePreset);

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-full mt-2 z-50 rounded-xl shadow-2xl overflow-hidden flex"
      style={{
        background: "var(--color-bg-card, #fff)",
        border: "1px solid #FFBC80",
        minWidth: 620,
      }}
    >
      {/* ── Left preset panel ───────────────────────────────────────────── */}
      <div className="w-44 border-r border-[#FFBC80]/20 py-2 shrink-0 bg-[#FFF9F2] dark:bg-[#1a1208]">
        {leftPanel === "main" && (
          <nav className="space-y-0.5 px-2">
            <button
              className={activePreset === "today" ? btnActive : btnInactive}
              style={activePreset === "today" ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
              onClick={() => selectPreset("today")}
            >Today</button>
            <button
              className={activePreset === "yesterday" ? btnActive : btnInactive}
              style={activePreset === "yesterday" ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
              onClick={() => selectPreset("yesterday")}
            >Yesterday</button>

            <div className="pt-1 pb-0.5">
              <button
                className={`${isLastActive ? btnActive : btnInactive} flex items-center justify-between`}
                style={isLastActive ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
                onClick={() => setLeftPanel("last")}
              >
                <span>Last</span>
                <ChevronRight size={13} className="opacity-50" />
              </button>
            </div>

            <div className="pt-0.5">
              <button
                className={`${isQuarterActive ? btnActive : btnInactive} flex items-center justify-between`}
                style={isQuarterActive ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
                onClick={() => setLeftPanel("quarters")}
              >
                <span>Quarters</span>
                <ChevronRight size={13} className="opacity-50" />
              </button>
            </div>

            <div className="pt-1">
              <button
                className={activePreset === "custom" ? btnActive : btnInactive}
                style={activePreset === "custom" ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
                onClick={() => { setActivePreset("custom"); setClickCount(0); }}
              >Custom Range</button>
            </div>
          </nav>
        )}

        {leftPanel === "last" && (
          <div>
            <button
              onClick={() => setLeftPanel("main")}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors w-full"
            >
              <ChevronLeft size={13} /> Last
            </button>
            <nav className="space-y-0.5 px-2">
              {lastItems.map((item) => (
                <button
                  key={item.key}
                  className={activePreset === item.key ? btnActive : btnInactive}
                  style={activePreset === item.key ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
                  onClick={() => selectPreset(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        )}

        {leftPanel === "quarters" && (
          <div>
            <button
              onClick={() => setLeftPanel("main")}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors w-full"
            >
              <ChevronLeft size={13} /> Quarters
            </button>
            <nav className="space-y-0.5 px-2">
              {quarterItems.map((item) => (
                <button
                  key={item.key}
                  className={activePreset === item.key ? btnActive : btnInactive}
                  style={activePreset === item.key ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
                  onClick={() => selectPreset(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </div>

      {/* ── Right: calendar + inputs ─────────────────────────────────────── */}
      <div className="flex flex-col bg-white dark:bg-[#231a0e]">
        {/* Date text inputs */}
        <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-[#FFBC80]/15">
          <div className="flex-1 px-3 py-1.5 rounded-lg border border-[#FFBC80]/40 text-sm text-[#3A3A3A] dark:text-[#FFF9F2] bg-[#FFF9F2] dark:bg-[#1a1208] min-w-[160px] truncate">
            {startLabel}
          </div>
          <span className="text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 text-sm">→</span>
          <div className="flex-1 px-3 py-1.5 rounded-lg border border-[#FFBC80]/40 text-sm text-[#3A3A3A] dark:text-[#FFF9F2] bg-[#FFF9F2] dark:bg-[#1a1208] min-w-[160px] truncate">
            {endLabelStr}
          </div>
        </div>

        {/* Dual calendar */}
        <div className="flex gap-6 px-5 pt-4">
          {/* Left month nav + calendar */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => {
                  if (leftMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); }
                  else setCalMonth(calMonth - 1);
                }}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#FFBC80]/15 transition-colors text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">
                {new Date(leftYear, leftMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <div className="w-6" />
            </div>
            <MonthCalendar
              year={leftYear} month={leftMonth}
              selecting={{ start: pendingStart, end: pendingEnd }}
              hovered={clickCount === 1 ? hovered : null}
              onDayClick={handleDayClick}
              onDayHover={setHovered}
            />
          </div>

          {/* Right month nav + calendar */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-6" />
              <span className="text-xs font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">
                {new Date(calYear, calMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <button
                onClick={() => {
                  if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); }
                  else setCalMonth(calMonth + 1);
                }}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-[#FFBC80]/15 transition-colors text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <MonthCalendar
              year={calYear} month={calMonth}
              selecting={{ start: pendingStart, end: pendingEnd }}
              hovered={clickCount === 1 ? hovered : null}
              onDayClick={handleDayClick}
              onDayHover={setHovered}
            />
          </div>
        </div>

        {/* Comparison toggle */}
        <div className="px-5 pt-3 pb-2 border-t border-[#FFBC80]/15 mt-3">
          <button
            onClick={() => setCompareEnabled((v) => !v)}
            className="flex items-center gap-2 text-xs font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors"
          >
            <div className={`w-8 h-4 rounded-full transition-colors relative ${compareEnabled ? "" : "bg-[#3A3A3A]/15 dark:bg-[#FFF9F2]/15"}`}
              style={compareEnabled ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all ${compareEnabled ? "left-[18px]" : "left-0.5"}`} />
            </div>
            Compare to previous period
          </button>
          {compareEnabled && (
            <div className="mt-2 ml-10 flex gap-2">
              {(["previous_period","previous_year"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setComparePreset(opt)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${comparePreset === opt ? "text-[#3A3A3A]" : "text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:bg-[#FFBC80]/10"}`}
                  style={comparePreset === opt ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)" } : {}}
                >
                  {opt === "previous_period" ? "Previous period" : "Previous year"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#FFBC80]/15">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:bg-[#FFBC80]/10 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors border border-[#FFBC80]/30"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={!pendingStart}
            className="px-5 py-1.5 rounded-lg text-sm font-bold text-[#3A3A3A] hover:opacity-90 transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Trigger button + overlay ────────────────────────────────────────────────

export function DateRangeButton() {
  const { dateRange } = useDateRange();
  const [open, setOpen] = useState(false);

  const startD = parseDate(dateRange.startDate);
  const endD = parseDate(dateRange.endDate);
  const label = dateRange.preset === "custom"
    ? `${fmtLabel(startD)} – ${fmtLabel(endD)}`
    : dateRange.label;

  return (
    <div className="relative">
      <button
        data-testid="date-range-selector"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#3A3A3A] dark:text-[#FFF9F2] transition-all hover:bg-[#FFBC80]/10"
        style={{ border: "1px solid #FFBC80" }}
      >
        <span className="max-w-[200px] truncate">{label}</span>
        <ChevronDown size={13} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && <DateRangePicker onClose={() => setOpen(false)} />}
    </div>
  );
}
