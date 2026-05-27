import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  type TooltipProps,
  type DotProps,
} from "recharts";
import { API_BASE } from "@/lib/apiBase";
import { useAuth } from "@/context/AuthContext";

type Metric = "revenue" | "units" | "both";

interface TrendPoint {
  date: string;
  revenue: number;
  units: number;
}

interface StoreTrend {
  storeId: string;
  storeName: string;
  color: string;
  data: TrendPoint[];
}

interface Note {
  id: string;
  storeId: string;
  noteDate: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
}

interface Props {
  selectedStoreIds: string[];
  startDate: string;
  endDate: string;
}

function formatCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v).toLocaleString()}`;
}

function formatUnits(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────

function CustomTooltip({
  active, payload, label, metric, trends, onAddNote,
}: TooltipProps<number, string> & { metric: Metric; trends: StoreTrend[] | undefined; onAddNote: (date: string) => void }) {
  if (!active || !payload?.length) return null;
  const dataLines = payload.filter(e => String(e.dataKey ?? "") !== "__note__");
  if (!dataLines.length) return null;
  const date = String(label);
  return (
    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-lg px-3 py-2.5">
      <p className="text-xs text-muted-foreground mb-1.5">{formatDate(date)}</p>
      {dataLines.map((entry) => {
        const key = String(entry.dataKey ?? "");
        const isRev = key.endsWith("_revenue");
        const store = trends?.find(s => key === `${s.storeId}_revenue` || key === `${s.storeId}_units`);
        const name = store
          ? store.storeName + (metric === "both" ? (isRev ? " Rev" : " Units") : "")
          : key;
        const val = Number(entry.value ?? 0);
        return (
          <p key={key} className="text-sm font-semibold" style={{ color: entry.color }}>
            {name}: {isRev ? formatCurrency(val) : formatUnits(val)}
          </p>
        );
      })}
      <button
        onClick={() => onAddNote(date)}
        className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        + Add note
      </button>
    </div>
  );
}

// ── Add Note modal ────────────────────────────────────────────────────────────

interface AddNoteModalProps {
  date: string;
  startDate: string;
  endDate: string;
  storeIds: string[];
  trends: StoreTrend[];
  createdBy: string;
  onClose: () => void;
  onSaved: () => void;
}

function AddNoteModal({ date: initialDate, startDate, endDate, storeIds, trends, createdBy, onClose, onSaved }: AddNoteModalProps) {
  const storeOptions = storeIds.length
    ? storeIds.map(id => trends.find(t => t.storeId === id)).filter(Boolean) as StoreTrend[]
    : trends;

  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedStore, setSelectedStore] = useState(storeOptions[0]?.storeId ?? "all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!title.trim()) { setError("Title is required"); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/data/notes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId:   selectedStore,
          noteDate:  selectedDate,
          title:     title.trim(),
          body:      body.trim(),
          createdBy,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl p-6 mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-foreground mb-4">Add Note</h3>

        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              min="2025-01-01"
              max={endDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Store selector */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Store</label>
            {storeOptions.length === 1 ? (
              <div className="text-sm text-foreground">{storeOptions[0].storeName}</div>
            ) : (
              <select
                value={selectedStore}
                onChange={e => setSelectedStore(e.target.value)}
                className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <option value="all">All Stores</option>
                {storeOptions.map(s => (
                  <option key={s.storeId} value={s.storeId}>{s.storeName}</option>
                ))}
              </select>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Title <span className="text-muted-foreground/60">({title.length}/100)</span>
            </label>
            <input
              type="text"
              maxLength={100}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Brief summary…"
              className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Notes <span className="text-muted-foreground/60">({body.length}/1000)</span>
            </label>
            <textarea
              maxLength={1000}
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              placeholder="Details…"
              className="w-full rounded-lg border border-border bg-background text-foreground text-sm px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving…" : "Save Note"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Note detail lightbox ──────────────────────────────────────────────────────

interface NoteDetailProps {
  notes: Note[];
  trends: StoreTrend[];
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function NoteDetail({ notes, trends, onClose, onDeleted }: NoteDetailProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState(notes);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`${API_BASE}/api/data/notes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const remaining = localNotes.filter(n => n.id !== id);
      setLocalNotes(remaining);
      onDeleted(id);
      if (remaining.length === 0) onClose();
    } catch (e) {
      console.error("Delete note error:", e);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-6 mx-4 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">
            Notes for {formatDate(notes[0]?.noteDate ?? "")}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </div>

        <div className="space-y-4">
          {localNotes.map(note => {
            const store = trends.find(t => t.storeId === note.storeId);
            return (
              <div key={note.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{note.title}</p>
                    {store && (
                      <p className="text-xs text-muted-foreground mt-0.5">{store.storeName}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(note.id)}
                    disabled={deleting === note.id}
                    className="text-xs text-destructive/70 hover:text-destructive disabled:opacity-50 shrink-0 transition-colors"
                  >
                    {deleting === note.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
                {note.body && (
                  <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap">{note.body}</p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  {note.createdBy} · {formatDateTime(note.createdAt)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main chart component ──────────────────────────────────────────────────────

export default function PerformanceOverTimeChart({ selectedStoreIds, startDate, endDate }: Props) {
  const [metric, setMetric] = useState<Metric>("revenue");
  const [addNoteDate, setAddNoteDate] = useState<string | null>(null);
  const [detailNotes, setDetailNotes] = useState<Note[] | null>(null);
  const [hoveredNoteDot, setHoveredNoteDot] = useState<{ date: string; cx: number; cy: number } | null>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const storeParam = selectedStoreIds.length ? `&storeIds=${selectedStoreIds.join(",")}` : "";

  const { data: trends, isLoading } = useQuery<StoreTrend[]>({
    queryKey: ["traffic-trends", startDate, endDate, selectedStoreIds.join(",")],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/traffic/trends?start=${startDate}&end=${endDate}${storeParam}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<StoreTrend[]>;
    },
    staleTime: 1000 * 60 * 15,
    retry: false,
  });

  const { data: notes } = useQuery<Note[]>({
    queryKey: ["traffic-notes", startDate, endDate, selectedStoreIds.join(",")],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/notes?start=${startDate}&end=${endDate}${storeParam}`,
        { credentials: "include" },
      );
      if (!res.ok) return [];
      return res.json() as Promise<Note[]>;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const notesByDate = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const n of notes ?? []) {
      const arr = map.get(n.noteDate) ?? [];
      arr.push(n);
      map.set(n.noteDate, arr);
    }
    return map;
  }, [notes]);

  const chartData = useMemo(() => {
    if (!trends?.length) return [];
    const dateMap = new Map<string, Record<string, number | undefined>>();
    for (const store of trends) {
      for (const point of store.data) {
        if (!dateMap.has(point.date)) dateMap.set(point.date, {});
        const entry = dateMap.get(point.date)!;
        entry[`${store.storeId}_revenue`] = point.revenue;
        entry[`${store.storeId}_units`]   = point.units;
      }
    }
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({
        date,
        ...vals,
        __note__: notesByDate.has(date) ? 1 : undefined,
      }));
  }, [trends, notesByDate]);

  const isSingleStore = (trends?.length ?? 0) === 1;
  const hasData = chartData.length > 0;

  function invalidateNotes() {
    void queryClient.invalidateQueries({ queryKey: ["traffic-notes", startDate, endDate, selectedStoreIds.join(",")] });
  }

  function renderNoteDot(props: DotProps & { payload?: { date?: string } }) {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload?.date) return <g key={`nd-empty`} />;
    if (!notesByDate.has(payload.date)) return <g key={`nd-${payload.date}`} />;
    const date = payload.date;
    const isHovered = hoveredNoteDot?.date === date;
    return (
      <circle
        key={`nd-${date}`}
        cx={cx}
        cy={8}
        r={isHovered ? 6 : 5}
        fill="#F5C842"
        stroke="white"
        strokeWidth={1.5}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => {
          setHoveredNoteDot({ date, cx: cx as number, cy: 8 });
        }}
        onMouseLeave={() => setHoveredNoteDot(null)}
        onClick={() => {
          const n = notesByDate.get(date);
          if (n) setDetailNotes(n);
        }}
      />
    );
  }

  return (
    <div className="rounded-2xl p-6 monarch-card">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">
          Performance Over Time
        </h2>
        <div className="flex items-center gap-2">
          {/* Add Note button */}
          {hasData && (
            <button
              onClick={() => setAddNoteDate(endDate)}
              className="px-3 py-1 rounded-md text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              + Note
            </button>
          )}
          {/* Metric toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#3A3A3A]/5 dark:bg-[#FFF9F2]/5">
            {(["revenue", "units", "both"] as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                  metric === m
                    ? "bg-white dark:bg-[#2a1f0f] text-[#3A3A3A] dark:text-[#FFF9F2] shadow-sm"
                    : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:text-[#3A3A3A]/80 dark:hover:text-[#FFF9F2]/60"
                }`}
              >
                {m === "both" ? "Both" : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 rounded-xl bg-muted animate-pulse" />
      ) : !hasData ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          No trend data available for the selected period
        </div>
      ) : (
        <div className="relative">
          {/* Note dot hover popover */}
          {hoveredNoteDot && (
            <div
              className="absolute z-10 pointer-events-none"
              style={{ left: hoveredNoteDot.cx, top: hoveredNoteDot.cy + 14, transform: "translateX(-50%)" }}
            >
              <div className="rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-md px-2.5 py-1.5 text-xs text-foreground whitespace-nowrap">
                <span className="font-semibold">{formatDate(hoveredNoteDot.date)}</span>
                {" · "}
                {notesByDate.get(hoveredNoteDot.date)?.length ?? 0} note{(notesByDate.get(hoveredNoteDot.date)?.length ?? 0) !== 1 ? "s" : ""}
                <span className="text-muted-foreground ml-1">· click to view</span>
              </div>
            </div>
          )}

          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={chartData}
              margin={{ top: 16, right: metric === "both" ? 64 : 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-[#3A3A3A]/8 dark:text-[#FFF9F2]/8"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11, fill: "currentColor", className: "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30" }}
                axisLine={false}
                tickLine={false}
                minTickGap={48}
              />
              <YAxis
                yAxisId="left"
                tickFormatter={metric === "units" ? formatUnits : formatCurrency}
                tick={{ fontSize: 11, fill: "currentColor", className: "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30" }}
                axisLine={false}
                tickLine={false}
                width={64}
              />
              {metric === "both" && (
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={formatUnits}
                  tick={{ fontSize: 11, fill: "currentColor", className: "text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30" }}
                  axisLine={false}
                  tickLine={false}
                  width={52}
                />
              )}
              {/* Hidden axis for note dot positioning at top of chart */}
              <YAxis yAxisId="notes" hide domain={[0, 1]} />

              <Tooltip content={(props) => <CustomTooltip {...(props as TooltipProps<number, string>)} metric={metric} trends={trends} onAddNote={setAddNoteDate} />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                formatter={(value) => {
                  const key = String(value);
                  if (key === "__note__") return null;
                  const store = trends?.find(s => key === `${s.storeId}_revenue` || key === `${s.storeId}_units`);
                  if (!store) return key;
                  if (metric !== "both") return store.storeName;
                  return store.storeName + (key.endsWith("_revenue") ? " (Rev)" : " (Units)");
                }}
              />

              {/* Note markers */}
              <Line
                yAxisId="notes"
                dataKey="__note__"
                stroke="transparent"
                dot={renderNoteDot as never}
                activeDot={false}
                legendType="none"
                isAnimationActive={false}
              />

              {trends?.flatMap((store) => {
                const lines = [];
                if (metric === "revenue" || metric === "both") {
                  lines.push(
                    <Line
                      key={`${store.storeId}_revenue`}
                      yAxisId="left"
                      type="monotone"
                      dataKey={`${store.storeId}_revenue`}
                      stroke={store.color}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: store.color }}
                      connectNulls
                    />,
                  );
                }
                if (metric === "units" || metric === "both") {
                  lines.push(
                    <Line
                      key={`${store.storeId}_units`}
                      yAxisId={metric === "both" ? "right" : "left"}
                      type="monotone"
                      dataKey={`${store.storeId}_units`}
                      stroke={store.color}
                      strokeWidth={metric === "both" ? 1.5 : 2}
                      strokeDasharray={metric === "both" ? "5 3" : undefined}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: store.color }}
                      connectNulls
                    />,
                  );
                }
                return lines;
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {metric === "both" && hasData && (
        <p className="mt-3 text-xs text-muted-foreground text-center">
          {isSingleStore
            ? "Solid line = Revenue (left axis) · Dashed line = Units (right axis)"
            : "Solid lines = Revenue (left axis) · Dashed lines = Units (right axis)"}
        </p>
      )}

      {/* Add Note modal */}
      {addNoteDate && trends && (
        <AddNoteModal
          date={addNoteDate}
          startDate={startDate}
          endDate={endDate}
          storeIds={selectedStoreIds}
          trends={trends}
          createdBy={user?.name ?? user?.email ?? "Unknown"}
          onClose={() => setAddNoteDate(null)}
          onSaved={invalidateNotes}
        />
      )}

      {/* Note detail lightbox */}
      {detailNotes && trends && (
        <NoteDetail
          notes={detailNotes}
          trends={trends}
          onClose={() => setDetailNotes(null)}
          onDeleted={(id) => {
            invalidateNotes();
            setDetailNotes(prev => prev ? prev.filter(n => n.id !== id) : null);
          }}
        />
      )}
    </div>
  );
}
