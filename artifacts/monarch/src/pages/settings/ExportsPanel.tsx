import { useState } from "react";
import {
  TrendingUp, GitBranch, Store, Package, BarChart3, Database, Sliders,
  FileText, FileSpreadsheet, FileCode2, Download, Mail, Calendar,
  CheckCircle2, XCircle, Loader2, RefreshCw, Plus, Trash2,
  ChevronRight, X, Save, Clock, Zap, Play, Check,
} from "lucide-react";
import {
  useExports, BUILT_IN_TEMPLATES, EXPORT_METRICS, EXPORT_DIMENSIONS,
  EXPORT_STORES, EXPORT_CHANNELS,
  type ExportType, type ExportFormat, type ExportGranularity,
  type DateRangeConfig, type DatePreset, type ExportFilters,
  type ExportTemplate, type ExportJob, type ExportSchedule,
  type ScheduleFrequency, type RunParams,
} from "@/context/ExportsContext";
import { toast } from "@/hooks/use-toast";

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD  = "rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30";
const LABEL = "text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider";
const INPUT = "w-full px-3 py-2 rounded-lg text-sm bg-[#FFF9F2] dark:bg-[#1a1208] text-[#3A3A3A] dark:text-[#FFF9F2] border border-[#FFBC80]/50 focus:border-[#FFBC80] outline-none transition-colors placeholder-[#3A3A3A]/35 dark:placeholder-[#FFF9F2]/25";
const BTN   = "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-[#3A3A3A] hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed";
const GHOST = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:bg-[#FFBC80]/10 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors";
const GRAD  = { background: "linear-gradient(135deg,#FFBC80,#FFE29A)" };

// ─── Metadata ─────────────────────────────────────────────────────────────────

const TYPE_META: Record<ExportType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  performance: { label: "Performance", icon: TrendingUp, color: "#3B82F6", bg: "#EFF6FF" },
  attribution: { label: "Attribution", icon: GitBranch,  color: "#8B5CF6", bg: "#F3F0FF" },
  store:       { label: "Store",       icon: Store,      color: "#10B981", bg: "#ECFDF5" },
  product:     { label: "Product",     icon: Package,    color: "#F59E0B", bg: "#FFFBEB" },
  timeseries:  { label: "Time-Series", icon: BarChart3,  color: "#EC4899", bg: "#FDF2F8" },
  raw:         { label: "Raw Data",    icon: Database,   color: "#6B7280", bg: "#F3F4F6" },
  custom:      { label: "Custom",      icon: Sliders,    color: "#FFBC80", bg: "#FFF9F2" },
};

const FORMAT_META: Record<ExportFormat, { label: string; icon: React.ElementType; ext: string; mime: string }> = {
  csv:  { label: "CSV",   icon: FileText,        ext: "csv",  mime: "text/csv"               },
  xlsx: { label: "Excel", icon: FileSpreadsheet, ext: "xlsx", mime: "application/vnd.ms-excel" },
  json: { label: "JSON",  icon: FileCode2,       ext: "json", mime: "application/json"        },
};

const GRAN: Record<ExportGranularity, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const SCHED: Record<ScheduleFrequency, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
const PRESET: Record<DatePreset, string> = { today: "Today", last7: "Last 7d", last30: "Last 30d", mtd: "MTD", custom: "Custom" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(r: DateRangeConfig) {
  return r.preset === "custom" && r.from && r.to ? `${r.from} – ${r.to}` : PRESET[r.preset];
}

function fmtSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

function fmtTs(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function nextRunDate(f: ScheduleFrequency) {
  const d = new Date();
  if (f === "daily") d.setDate(d.getDate() + 1);
  else if (f === "weekly") d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function seeded(n: number) { const x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); }

function triggerDownload(job: ExportJob) {
  const metricLabels = job.metrics.map((m) => EXPORT_METRICS[m]?.label ?? m);
  const fileName     = `${job.templateName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}`;
  const channels = ["Meta", "Google", "Email", "TikTok", "Organic"];
  const days = job.dateRange.preset === "today" ? 1 : job.dateRange.preset === "last7" ? 7 : 30;
  const baseDate = new Date();
  const bases: Record<string, number> = {
    revenue: 12000, adSpend: 4000, adRevenue: 9000, roas: 3.4, mer: 4.2,
    unitsSold: 420, impressions: 95000, cpm: 14, clicks: 2400, ctr: 2.5,
    cpa: 28, sessions: 11000, convRate: 1.9, aov: 68, newCustomers: 85, reach: 72000,
  };
  const rows: string[][] = [];
  for (let d = 0; d < days; d++) {
    const dt = new Date(baseDate); dt.setDate(dt.getDate() - d);
    const ds = dt.toISOString().slice(0, 10);
    for (const ch of channels) {
      const vals = job.metrics.map((m, mi) => {
        const meta = EXPORT_METRICS[m]; if (!meta) return "0";
        const v = (bases[m] ?? 100) * (0.6 + seeded(d * 31 + ch.charCodeAt(0) + mi * 7) * 0.8);
        return meta.format === "currency" ? v.toFixed(2) : meta.format === "percent" ? (v / 100).toFixed(3) : meta.format === "ratio" ? v.toFixed(2) : Math.round(v).toString();
      });
      rows.push([ds, ch, ...vals]);
    }
  }

  let content: string;
  if (job.format === "json") {
    content = JSON.stringify(rows.map((r) => {
      const obj: Record<string, unknown> = { date: r[0], channel: r[1] };
      job.metrics.forEach((m, i) => { obj[m] = parseFloat(r[i + 2]) || r[i + 2]; });
      return obj;
    }), null, 2);
  } else {
    content = [["date", "channel", ...metricLabels].join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  const blob = new Blob([content], { type: FORMAT_META[job.format].mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `${fileName}.${FORMAT_META[job.format].ext}`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function Pill({ label, active, onClick, disabled }: { label: string; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
        active ? "border-[#FFBC80] text-[#3A3A3A] dark:text-[#FFF9F2]"
               : "border-[#FFBC80]/30 text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:border-[#FFBC80]/55"
      }`}
      style={active ? { background: "linear-gradient(135deg,rgba(255,188,128,0.25),rgba(255,226,154,0.25))" } : {}}>
      {label}
    </button>
  );
}

function DatePicker({ value, onChange, disabled }: { value: DateRangeConfig; onChange: (v: DateRangeConfig) => void; disabled?: boolean }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {(["today","last7","last30","mtd","custom"] as DatePreset[]).map((p) => (
          <Pill key={p} label={PRESET[p]} active={value.preset === p} disabled={disabled}
            onClick={() => onChange({ ...value, preset: p })} />
        ))}
      </div>
      {value.preset === "custom" && (
        <div className="flex gap-2 mt-2">
          <input type="date" value={value.from ?? ""} disabled={disabled} className={INPUT + " text-xs"}
            onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="self-center text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">→</span>
          <input type="date" value={value.to ?? ""}   disabled={disabled} className={INPUT + " text-xs"}
            onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}

function MetricPicker({ selected, onChange, disabled }: { selected: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const toggle = (k: string) => onChange(selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k]);
  const groups: [string, string[]][] = [
    ["Commerce",    ["revenue","adRevenue","unitsSold","aov","newCustomers"]],
    ["Advertising", ["adSpend","roas","mer","impressions","cpm","clicks","ctr","cpa","reach"]],
    ["Web",         ["sessions","convRate"]],
  ];
  return (
    <div className="space-y-3">
      {groups.map(([g, keys]) => (
        <div key={g}>
          <p className="text-[10px] font-bold text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 uppercase tracking-wider mb-1.5">{g}</p>
          <div className="flex flex-wrap gap-1.5">
            {keys.map((k) => <Pill key={k} label={EXPORT_METRICS[k]?.label ?? k} active={selected.includes(k)} disabled={disabled} onClick={() => toggle(k)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function DimPicker({ selected, onChange, disabled }: { selected: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const toggle = (k: string) => onChange(selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(EXPORT_DIMENSIONS).map(([k, { label }]) => (
        <Pill key={k} label={label} active={selected.includes(k)} disabled={disabled} onClick={() => toggle(k)} />
      ))}
    </div>
  );
}

function FilterGroup({ label, opts, selected, onChange, disabled }: { label: string; opts: readonly string[]; selected: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div>
      <p className="text-[10px] font-bold text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {opts.map((v) => <Pill key={v} label={v} active={selected.includes(v)} disabled={disabled} onClick={() => toggle(v)} />)}
      </div>
      {selected.length === 0 && <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-1">All {label.toLowerCase()} included</p>}
    </div>
  );
}

function EmailList({ emails, onRemove, disabled }: { emails: string[]; onRemove: (e: string) => void; disabled?: boolean }) {
  if (!emails.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {emails.map((e) => (
        <span key={e} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[#FFBC80]/15 text-[#3A3A3A] dark:text-[#FFF9F2]">
          {e}
          {!disabled && <button onClick={() => onRemove(e)} className="text-[#3A3A3A]/40 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2]"><X size={9} /></button>}
        </span>
      ))}
    </div>
  );
}

// ─── Completed / Progress banners (shared by RunPanel + Builder) ──────────────

function ProgressBanner({ name, format, dateLabel, status }: { name: string; format: ExportFormat; dateLabel: string; status: "queued" | "processing" }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <Loader2 size={16} className="text-[#FFBC80] animate-spin shrink-0" />
        <div>
          <p className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">{status === "queued" ? "Queued" : "Preparing export…"}</p>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">{name} · {FORMAT_META[format].label} · {dateLabel}</p>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-[#FFBC80]/20 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000"
          style={{ ...GRAD, width: status === "processing" ? "72%" : "18%" }} />
      </div>
      <p className="text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 capitalize">{status}…</p>
    </div>
  );
}

function CompletedBanner({ job, onDownload, onAgain, onClose }: { job: ExportJob; onDownload: () => void; onAgain: () => void; onClose: () => void }) {
  const elapsed = ((Date.now() - new Date(job.startedAt).getTime()) / 1000).toFixed(1);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
            <CheckCircle2 size={17} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Export Ready</p>
            <p className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">
              {job.rowCount?.toLocaleString()} rows · {fmtSize(job.fileSizeKb ?? 0)} · {elapsed}s
            </p>
          </div>
        </div>
        <button onClick={onClose} className="text-[#3A3A3A]/35 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors mt-0.5"><X size={14} /></button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={onDownload} className={BTN} style={GRAD}>
          <Download size={14} /> Download {FORMAT_META[job.format].label}
        </button>
        <button onClick={onAgain} className={GHOST}><RefreshCw size={12} /> Run Again</button>
      </div>
    </div>
  );
}

// ─── Run Panel ────────────────────────────────────────────────────────────────

interface RunTarget {
  id: string; name: string; exportType: ExportType;
  metrics: string[]; dimensions: string[]; filters: ExportFilters;
  dateRange: DateRangeConfig; granularity: ExportGranularity;
  format: ExportFormat; isBuiltIn: boolean;
  schedule?: ExportSchedule | null;
}

function RunPanel({ target, jobs, onRun, onSchedule, onClose, readOnly }: {
  target:     RunTarget;
  jobs:       ExportJob[];
  onRun:      (p: RunParams) => string;
  onSchedule: (t: RunTarget, freq: ScheduleFrequency, emails: string[], name: string) => void;
  onClose:    () => void;
  readOnly?:  boolean;
}) {
  const [dateRange,   setDateRange]   = useState<DateRangeConfig>(target.dateRange);
  const [granularity, setGranularity] = useState<ExportGranularity>(target.granularity);
  const [format,      setFormat]      = useState<ExportFormat>(target.format);
  const [delivery,    setDelivery]    = useState<"download" | "email" | "schedule">("download");
  const [emails,      setEmails]      = useState<string[]>(target.schedule?.deliveryEmails ?? []);
  const [emailInput,  setEmailInput]  = useState("");
  const [schedFreq,   setSchedFreq]   = useState<ScheduleFrequency>(target.schedule?.frequency ?? "weekly");
  const [schedName,   setSchedName]   = useState(target.name);
  const [jobId,       setJobId]       = useState<string | null>(null);

  const job        = jobs.find((j) => j.id === jobId);
  const isRunning  = job?.status === "queued" || job?.status === "processing";
  const isDone     = job?.status === "completed";
  const canExport  = dateRange.preset !== "custom" || (!!dateRange.from && !!dateRange.to);

  const addEmail = () => {
    const v = emailInput.trim();
    if (v && !emails.includes(v)) { setEmails([...emails, v]); setEmailInput(""); }
  };

  const handleExport = () => {
    setJobId(onRun({ templateId: target.isBuiltIn ? null : target.id, name: target.name, exportType: target.exportType, format, metrics: target.metrics, dimensions: target.dimensions, filters: target.filters, dateRange, granularity }));
  };

  // ── Completed ──
  if (isDone && job) {
    return (
      <div className={`${CARD} p-5`} style={{ borderColor: "rgba(52,211,153,0.4)" }}>
        <CompletedBanner job={job} onDownload={() => triggerDownload(job)} onAgain={() => setJobId(null)} onClose={onClose} />
      </div>
    );
  }

  // ── Running ──
  if (isRunning && job) {
    return (
      <div className={`${CARD} p-5`}>
        <ProgressBanner name={target.name} format={format} dateLabel={fmtDate(dateRange)} status={job.status as "queued" | "processing"} />
      </div>
    );
  }

  // ── Config form ──
  return (
    <div className={`${CARD} p-5 space-y-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Configure Export</p>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">{target.name}</p>
        </div>
        <button onClick={onClose} className="text-[#3A3A3A]/35 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors"><X size={15} /></button>
      </div>

      <div>
        <p className={`${LABEL} mb-2`}>Date Range</p>
        <DatePicker value={dateRange} onChange={setDateRange} disabled={readOnly} />
      </div>

      <div>
        <p className={`${LABEL} mb-2`}>Granularity</p>
        <div className="flex gap-1.5">
          {(["daily","weekly","monthly"] as ExportGranularity[]).map((g) => (
            <Pill key={g} label={GRAN[g]} active={granularity === g} disabled={readOnly} onClick={() => setGranularity(g)} />
          ))}
        </div>
      </div>

      <div>
        <p className={`${LABEL} mb-2`}>Format</p>
        <div className="flex gap-2">
          {(["csv","xlsx","json"] as ExportFormat[]).map((f) => {
            const { label, icon: Icon } = FORMAT_META[f];
            return (
              <button key={f} onClick={() => !readOnly && setFormat(f)} disabled={readOnly}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  format === f ? "border-[#FFBC80] text-[#3A3A3A] dark:text-[#FFF9F2]" : "border-[#FFBC80]/30 text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:border-[#FFBC80]/55"
                }`}
                style={format === f ? { background: "linear-gradient(135deg,rgba(255,188,128,0.22),rgba(255,226,154,0.22))" } : {}}>
                <Icon size={12} />{label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className={`${LABEL} mb-2`}>Delivery</p>
        <div className="flex gap-1.5 mb-3">
          {([["download","Download",Download],["email","Email",Mail],["schedule","Schedule",Calendar]] as [typeof delivery, string, React.ElementType][]).map(([k, lbl, Icon]) => (
            <button key={k} onClick={() => !readOnly && setDelivery(k)} disabled={readOnly}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                delivery === k ? "border-[#FFBC80] text-[#3A3A3A] dark:text-[#FFF9F2]" : "border-[#FFBC80]/30 text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:border-[#FFBC80]/55"
              }`}
              style={delivery === k ? { background: "linear-gradient(135deg,rgba(255,188,128,0.22),rgba(255,226,154,0.22))" } : {}}>
              <Icon size={12} />{lbl}
            </button>
          ))}
        </div>

        {delivery === "email" && (
          <div>
            <div className="flex gap-2">
              <input type="email" value={emailInput} placeholder="Delivery email" disabled={readOnly}
                onChange={(e) => setEmailInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEmail()}
                className={INPUT + " text-xs"} />
              <button onClick={addEmail} disabled={!emailInput.trim() || readOnly} className={GHOST + " shrink-0"}><Plus size={12} /> Add</button>
            </div>
            <EmailList emails={emails} onRemove={(e) => setEmails(emails.filter((x) => x !== e))} disabled={readOnly} />
          </div>
        )}

        {delivery === "schedule" && (
          <div className="p-4 rounded-xl bg-[#FFBC80]/6 border border-[#FFBC80]/25 space-y-3">
            <div>
              <p className="text-[10px] font-bold text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 uppercase tracking-wider mb-1.5">Schedule Name</p>
              <input type="text" value={schedName} onChange={(e) => setSchedName(e.target.value)}
                placeholder="Name this scheduled export" className={INPUT + " text-xs"} disabled={readOnly} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 uppercase tracking-wider mb-1.5">Frequency</p>
              <div className="flex gap-1.5">
                {(["daily","weekly","monthly"] as ScheduleFrequency[]).map((f) => (
                  <Pill key={f} label={SCHED[f]} active={schedFreq === f} disabled={readOnly} onClick={() => setSchedFreq(f)} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 uppercase tracking-wider mb-1.5">Delivery Emails</p>
              <div className="flex gap-2">
                <input type="email" value={emailInput} placeholder="Add email" disabled={readOnly}
                  onChange={(e) => setEmailInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addEmail()}
                  className={INPUT + " text-xs"} />
                <button onClick={addEmail} disabled={!emailInput.trim() || readOnly} className={GHOST + " shrink-0"}><Plus size={12} /> Add</button>
              </div>
              <EmailList emails={emails} onRemove={(e) => setEmails(emails.filter((x) => x !== e))} disabled={readOnly} />
            </div>
            <p className="text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
              Next run: <span className="font-semibold">{nextRunDate(schedFreq)}</span>
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        {delivery === "schedule" ? (
          <button onClick={() => onSchedule(target, schedFreq, emails, schedName)}
            disabled={readOnly || !schedName.trim()} className={BTN} style={GRAD}>
            <Save size={14} /> Save Schedule
          </button>
        ) : (
          <button onClick={handleExport} disabled={readOnly || !canExport} className={BTN} style={GRAD}>
            <Zap size={14} /> Export Now
          </button>
        )}
        <button onClick={onClose} className={GHOST}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({ id, name, description, exportType, metrics, granularity, format, isBuiltIn, lastRunAt, runCount, schedule, isActive, onConfigure, onDelete, readOnly }: {
  id: string; name: string; description: string; exportType: ExportType;
  metrics: string[]; granularity: ExportGranularity; format: ExportFormat;
  isBuiltIn: boolean; lastRunAt: string | null; runCount: number;
  schedule?: ExportSchedule | null; isActive: boolean;
  onConfigure: () => void; onDelete?: () => void; readOnly?: boolean;
}) {
  const tm   = TYPE_META[exportType];
  const Icon = tm.icon;
  return (
    <div className={`${CARD} p-4 transition-all ${isActive ? "ring-2 ring-[#FFBC80]/65 shadow-sm" : "hover:shadow-sm"}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center" style={{ background: tm.bg }}>
          <Icon size={16} style={{ color: tm.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <p className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">{name}</p>
            {schedule?.enabled && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">Scheduled</span>
            )}
            {isBuiltIn && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide bg-[#FFBC80]/15 text-[#3A3A3A]/50 dark:text-[#FFF9F2]/35">Built-in</span>
            )}
          </div>
          <p className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 leading-relaxed line-clamp-2">{description}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">{metrics.length} metrics</span>
            <span className="text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 capitalize">{granularity}</span>
            <span className="text-[10px] font-bold text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 uppercase">{format}</span>
            {lastRunAt && <span className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25">Last {new Date(lastRunAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#FFBC80]/12">
        <button onClick={onConfigure}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#3A3A3A] hover:opacity-90 transition-all"
          style={isActive ? { background: "rgba(255,188,128,0.35)" } : GRAD}>
          {isActive ? <><ChevronRight size={12} className="rotate-90" />Configuring</> : <><Play size={11} />Run</>}
        </button>
        {!isBuiltIn && onDelete && !readOnly && (
          <button onClick={onDelete} className="p-1.5 rounded-lg text-[#3A3A3A]/30 dark:text-[#FFF9F2]/20 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
            <Trash2 size={12} />
          </button>
        )}
        {runCount > 0 && <span className="ml-auto text-[10px] text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25">{runCount} run{runCount !== 1 ? "s" : ""}</span>}
      </div>
    </div>
  );
}

// ─── Custom Builder ───────────────────────────────────────────────────────────

interface BuilderState {
  name: string; exportType: ExportType; metrics: string[]; dimensions: string[];
  filters: ExportFilters; dateRange: DateRangeConfig; granularity: ExportGranularity;
  format: ExportFormat; delivery: "download" | "email" | "schedule";
  emails: string[]; emailInput: string; schedFreq: ScheduleFrequency; saveAsTemplate: boolean;
}

const BUILDER_INIT: BuilderState = {
  name: "", exportType: "performance",
  metrics: ["revenue","adSpend","roas","mer","clicks","ctr"],
  dimensions: ["date","channel"],
  filters: { stores: [], channels: [], campaigns: [], products: [] },
  dateRange: { preset: "last30" }, granularity: "daily", format: "csv",
  delivery: "download", emails: [], emailInput: "", schedFreq: "weekly", saveAsTemplate: false,
};

const TYPE_PRESETS: Partial<Record<ExportType, Partial<BuilderState>>> = {
  performance: { metrics: ["revenue","adSpend","roas","mer","impressions","clicks","ctr"],   dimensions: ["date","channel"] },
  attribution: { metrics: ["revenue","adSpend","roas","cpa","clicks","ctr"],                 dimensions: ["channel","date"] },
  store:       { metrics: ["revenue","unitsSold","aov","newCustomers"],                      dimensions: ["store","date"], granularity: "weekly" },
  product:     { metrics: ["revenue","unitsSold","aov"],                                     dimensions: ["product","store"], format: "xlsx", granularity: "weekly" },
  timeseries:  { metrics: ["revenue","adSpend","mer","unitsSold","sessions"],                dimensions: ["date"] },
  raw:         { metrics: Object.keys(EXPORT_METRICS),                                       dimensions: Object.keys(EXPORT_DIMENSIONS) },
  custom:      { metrics: [], dimensions: [] },
};

function CustomBuilder({ jobs, onRun, onSave, onClose, readOnly }: {
  jobs: ExportJob[]; onRun: (p: RunParams) => string;
  onSave: (b: BuilderState) => void; onClose: () => void; readOnly?: boolean;
}) {
  const [b, setB] = useState<BuilderState>(BUILDER_INIT);
  const [jobId, setJobId] = useState<string | null>(null);

  const job       = jobs.find((j) => j.id === jobId);
  const isRunning = job?.status === "queued" || job?.status === "processing";
  const isDone    = job?.status === "completed";
  const canRun    = b.metrics.length > 0 && b.dimensions.length > 0 && (b.dateRange.preset !== "custom" || (!!b.dateRange.from && !!b.dateRange.to));

  const p = (patch: Partial<BuilderState>) => setB((prev) => ({ ...prev, ...patch }));

  const setType = (t: ExportType) => { const pre = TYPE_PRESETS[t] ?? {}; p({ exportType: t, ...pre }); };

  const addEmail = () => {
    const v = b.emailInput.trim();
    if (v && !b.emails.includes(v)) p({ emails: [...b.emails, v], emailInput: "" });
  };

  const handleRun = () => {
    if (!canRun || readOnly) return;
    if (b.saveAsTemplate && b.name.trim()) onSave(b);
    const name = b.name.trim() || `Custom ${TYPE_META[b.exportType].label} Export`;
    setJobId(onRun({ templateId: null, name, exportType: b.exportType, format: b.format, metrics: b.metrics, dimensions: b.dimensions, filters: b.filters, dateRange: b.dateRange, granularity: b.granularity }));
  };

  const name = b.name.trim() || `Custom ${TYPE_META[b.exportType].label} Export`;

  if (isDone && job) {
    return (
      <div className={`${CARD} p-5`} style={{ borderColor: "rgba(52,211,153,0.4)" }}>
        <CompletedBanner job={job} onDownload={() => triggerDownload(job)} onAgain={() => setJobId(null)} onClose={onClose} />
      </div>
    );
  }
  if (isRunning && job) {
    return (
      <div className={`${CARD} p-5`}>
        <ProgressBanner name={name} format={b.format} dateLabel={fmtDate(b.dateRange)} status={job.status as "queued" | "processing"} />
      </div>
    );
  }

  return (
    <div className={`${CARD} p-5 space-y-6`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Custom Export Builder</p>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">Choose any combination of metrics, dimensions, and filters.</p>
        </div>
        <button onClick={onClose} className="text-[#3A3A3A]/35 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors"><X size={15} /></button>
      </div>

      {/* 1 — Type */}
      <div>
        <p className={`${LABEL} mb-2.5`}>1 · Export Type</p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.entries(TYPE_META) as [ExportType, typeof TYPE_META[ExportType]][]).map(([key, tm]) => {
            const Icon = tm.icon; const active = b.exportType === key;
            return (
              <button key={key} onClick={() => setType(key)} disabled={readOnly}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold text-left transition-all ${
                  active ? "border-[#FFBC80]" : "border-[#FFBC80]/25 hover:border-[#FFBC80]/50"
                }`}
                style={active ? { background: "linear-gradient(135deg,rgba(255,188,128,0.18),rgba(255,226,154,0.18))" } : {}}>
                <div className="w-6 h-6 rounded-md shrink-0 flex items-center justify-center" style={{ background: tm.bg }}>
                  <Icon size={13} style={{ color: tm.color }} />
                </div>
                <span className="truncate text-[#3A3A3A] dark:text-[#FFF9F2]">{tm.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2 — Metrics */}
      <div>
        <p className={`${LABEL} mb-2.5`}>2 · Metrics <span className="normal-case font-normal text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25">({b.metrics.length} selected)</span></p>
        <MetricPicker selected={b.metrics} onChange={(v) => p({ metrics: v })} disabled={readOnly} />
      </div>

      {/* 3 — Dimensions */}
      <div>
        <p className={`${LABEL} mb-2.5`}>3 · Dimensions <span className="normal-case font-normal text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25">({b.dimensions.length} selected)</span></p>
        <DimPicker selected={b.dimensions} onChange={(v) => p({ dimensions: v })} disabled={readOnly} />
      </div>

      {/* 4 — Filters */}
      <div>
        <p className={`${LABEL} mb-2.5`}>4 · Filters <span className="normal-case font-normal text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25">(empty = all included)</span></p>
        <div className="space-y-3">
          <FilterGroup label="Stores"   opts={EXPORT_STORES}   selected={b.filters.stores}   disabled={readOnly} onChange={(v) => p({ filters: { ...b.filters, stores: v } })} />
          <FilterGroup label="Channels" opts={EXPORT_CHANNELS} selected={b.filters.channels} disabled={readOnly} onChange={(v) => p({ filters: { ...b.filters, channels: v } })} />
        </div>
      </div>

      {/* 5 — Date + granularity */}
      <div>
        <p className={`${LABEL} mb-2.5`}>5 · Date Range & Granularity</p>
        <DatePicker value={b.dateRange} onChange={(v) => p({ dateRange: v })} disabled={readOnly} />
        <div className="flex gap-1.5 mt-2.5">
          {(["daily","weekly","monthly"] as ExportGranularity[]).map((g) => (
            <Pill key={g} label={GRAN[g]} active={b.granularity === g} disabled={readOnly} onClick={() => p({ granularity: g })} />
          ))}
        </div>
      </div>

      {/* 6 — Format + delivery */}
      <div>
        <p className={`${LABEL} mb-2.5`}>6 · Format & Delivery</p>
        <div className="flex gap-2 mb-3">
          {(["csv","xlsx","json"] as ExportFormat[]).map((f) => {
            const { label, icon: Icon } = FORMAT_META[f];
            return (
              <button key={f} onClick={() => !readOnly && p({ format: f })} disabled={readOnly}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  b.format === f ? "border-[#FFBC80] text-[#3A3A3A] dark:text-[#FFF9F2]" : "border-[#FFBC80]/30 text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:border-[#FFBC80]/55"
                }`}
                style={b.format === f ? { background: "linear-gradient(135deg,rgba(255,188,128,0.22),rgba(255,226,154,0.22))" } : {}}>
                <Icon size={12} />{label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5 mb-3">
          {([["download","Download",Download],["email","Email",Mail],["schedule","Schedule",Calendar]] as [typeof b.delivery, string, React.ElementType][]).map(([k, lbl, Icon]) => (
            <button key={k} onClick={() => !readOnly && p({ delivery: k })} disabled={readOnly}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                b.delivery === k ? "border-[#FFBC80] text-[#3A3A3A] dark:text-[#FFF9F2]" : "border-[#FFBC80]/30 text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 hover:border-[#FFBC80]/55"
              }`}
              style={b.delivery === k ? { background: "linear-gradient(135deg,rgba(255,188,128,0.22),rgba(255,226,154,0.22))" } : {}}>
              <Icon size={12} />{lbl}
            </button>
          ))}
        </div>
        {(b.delivery === "email" || b.delivery === "schedule") && (
          <div className="space-y-2">
            {b.delivery === "schedule" && (
              <div className="flex gap-1.5 mb-2">
                {(["daily","weekly","monthly"] as ScheduleFrequency[]).map((f) => (
                  <Pill key={f} label={SCHED[f]} active={b.schedFreq === f} disabled={readOnly} onClick={() => p({ schedFreq: f })} />
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input type="email" value={b.emailInput} placeholder="Delivery email" disabled={readOnly}
                onChange={(e) => p({ emailInput: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addEmail()}
                className={INPUT + " text-xs"} />
              <button onClick={addEmail} disabled={!b.emailInput.trim() || readOnly} className={GHOST + " shrink-0"}><Plus size={12} /> Add</button>
            </div>
            <EmailList emails={b.emails} onRemove={(e) => p({ emails: b.emails.filter((x) => x !== e) })} disabled={readOnly} />
          </div>
        )}
      </div>

      {/* 7 — Name + save toggle */}
      <div>
        <p className={`${LABEL} mb-2.5`}>7 · Name & Save</p>
        <input type="text" value={b.name} placeholder="Export name (optional)" disabled={readOnly}
          onChange={(e) => p({ name: e.target.value })} className={INPUT + " mb-3"} />
        {!readOnly && (
          <button onClick={() => p({ saveAsTemplate: !b.saveAsTemplate })}
            className="flex items-center gap-2 cursor-pointer">
            <div className={`relative w-9 h-5 rounded-full transition-colors ${b.saveAsTemplate ? "bg-[#FFBC80]" : "bg-[#3A3A3A]/20 dark:bg-[#FFF9F2]/15"}`}>
              <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: b.saveAsTemplate ? "translateX(16px)" : "translateX(0)" }} />
            </div>
            <span className="text-xs text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50">Save as template for future use</span>
          </button>
        )}
      </div>

      <div className="flex gap-2 pt-1 border-t border-[#FFBC80]/15">
        {!readOnly ? (
          <button onClick={handleRun} disabled={!canRun} className={BTN} style={GRAD}><Zap size={14} /> Export Now</button>
        ) : (
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">Contact an Admin to run exports.</p>
        )}
        <button onClick={onClose} className={GHOST}>Cancel</button>
      </div>
    </div>
  );
}

// ─── History row ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ExportJob["status"] }) {
  const cfg = {
    queued:     { cls: "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400",                 icon: <Clock size={9} /> },
    processing: { cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",                 icon: <Loader2 size={9} className="animate-spin" /> },
    completed:  { cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",         icon: <Check size={9} /> },
    failed:     { cls: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",                        icon: <XCircle size={9} /> },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${cfg.cls}`}>
      {cfg.icon}{status}
    </span>
  );
}

function HistoryRow({ job }: { job: ExportJob }) {
  const [done, setDone] = useState(false);
  const tm = TYPE_META[job.exportType]; const Icon = tm.icon;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#FFBC80]/5 transition-colors">
      <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center" style={{ background: tm.bg }}>
        <Icon size={13} style={{ color: tm.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] truncate max-w-[180px]">{job.templateName}</p>
          <StatusBadge status={job.status} />
          <span className="text-[10px] font-bold text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 uppercase">{job.format}</span>
          {job.rowCount != null && <span className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25">{job.rowCount.toLocaleString()} rows</span>}
          {job.fileSizeKb != null && <span className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25">{fmtSize(job.fileSizeKb)}</span>}
        </div>
        <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-0.5">
          {fmtTs(job.startedAt)} · {fmtDate(job.dateRange)} · {GRAN[job.granularity]}
        </p>
      </div>
      {job.status === "completed" && (
        <button onClick={() => { triggerDownload(job); setDone(true); setTimeout(() => setDone(false), 2500); }}
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            done ? "border-emerald-400/50 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                 : "border-[#FFBC80]/35 text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:border-[#FFBC80] hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2]"
          }`}>
          {done ? <><Check size={11} />Done</> : <><Download size={11} />Download</>}
        </button>
      )}
      {job.status === "processing" && <Loader2 size={13} className="shrink-0 text-[#FFBC80] animate-spin" />}
    </div>
  );
}

// ─── Scheduled row ────────────────────────────────────────────────────────────

function ScheduledRow({ template, onToggle, onDelete, readOnly }: { template: ExportTemplate; onToggle: () => void; onDelete: () => void; readOnly?: boolean }) {
  const tm = TYPE_META[template.exportType]; const Icon = tm.icon;
  const sched = template.schedule!;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[#FFBC80]/5 transition-colors">
      <div className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center" style={{ background: tm.bg }}>
        <Icon size={13} style={{ color: tm.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] truncate max-w-[200px]">{template.name}</p>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
            sched.enabled ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                          : "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"
          }`}>{sched.enabled ? "Active" : "Paused"}</span>
        </div>
        <p className="text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 mt-0.5">
          <span className="font-medium capitalize">{sched.frequency}</span>
          {sched.deliveryEmails.length > 0 && ` → ${sched.deliveryEmails.slice(0, 2).join(", ")}${sched.deliveryEmails.length > 2 ? ` +${sched.deliveryEmails.length - 2}` : ""}`}
          {" · Next: "}<span className="font-medium">{nextRunDate(sched.frequency)}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!readOnly && (
          <button role="switch" aria-checked={sched.enabled} onClick={onToggle}
            className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${sched.enabled ? "bg-[#FFBC80]" : "bg-[#3A3A3A]/20 dark:bg-[#FFF9F2]/15"}`}>
            <span className="absolute w-3.5 h-3.5 rounded-full bg-white shadow transition-transform top-[3px]"
              style={{ transform: sched.enabled ? "translateX(18px)" : "translateX(2px)" }} />
          </button>
        )}
        {!readOnly && (
          <button onClick={onDelete} className="p-1.5 rounded-lg text-[#3A3A3A]/30 dark:text-[#FFF9F2]/20 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function ExportsPanel({ readOnly }: { readOnly?: boolean }) {
  const { templates, jobs, createTemplate, updateTemplate, deleteTemplate, runExport, clearHistory } = useExports();

  const [activeTab,     setActiveTab]     = useState<"templates" | "scheduled" | "history">("templates");
  const [configuringId, setConfiguringId] = useState<string | null>(null);
  const [builderOpen,   setBuilderOpen]   = useState(false);

  const scheduled = templates.filter((t) => t.schedule);

  function toTarget(def: { id: string; name: string; exportType: ExportType; metrics: string[]; dimensions: string[]; filters: ExportFilters; dateRange: DateRangeConfig; granularity: ExportGranularity; format: ExportFormat; isBuiltIn: boolean; schedule?: ExportSchedule | null }): RunTarget {
    return { id: def.id, name: def.name, exportType: def.exportType, metrics: def.metrics, dimensions: def.dimensions, filters: def.filters, dateRange: def.dateRange, granularity: def.granularity, format: def.format, isBuiltIn: def.isBuiltIn, schedule: def.schedule ?? null };
  }

  const handleConfigure = (id: string) => {
    setBuilderOpen(false);
    setConfiguringId((prev) => prev === id ? null : id);
  };

  const handleSchedule = (target: RunTarget, freq: ScheduleFrequency, emails: string[], name: string) => {
    const schedule: ExportSchedule = { enabled: true, frequency: freq, deliveryEmails: emails, nextRunAt: null };
    if (!target.isBuiltIn) {
      updateTemplate(target.id, { name, schedule });
    } else {
      const builtin = BUILT_IN_TEMPLATES.find((t) => t.id === target.id);
      createTemplate({ name, description: builtin?.description ?? "", exportType: target.exportType, metrics: target.metrics, dimensions: target.dimensions, filters: target.filters, dateRange: target.dateRange, granularity: target.granularity, format: target.format, isBuiltIn: false, schedule });
    }
    toast({ title: "Schedule saved", description: `"${name}" will run ${freq}.` });
    setConfiguringId(null);
    setActiveTab("scheduled");
  };

  const handleSaveTemplate = (b: BuilderState) => {
    const name = b.name.trim() || `Custom ${TYPE_META[b.exportType].label}`;
    createTemplate({ name, description: `Custom ${TYPE_META[b.exportType].label.toLowerCase()} export`, exportType: b.exportType, metrics: b.metrics, dimensions: b.dimensions, filters: b.filters, dateRange: b.dateRange, granularity: b.granularity, format: b.format, isBuiltIn: false, schedule: b.delivery === "schedule" ? { enabled: true, frequency: b.schedFreq, deliveryEmails: b.emails, nextRunAt: null } : null });
    toast({ title: "Template saved", description: `"${name}" added to My Templates.` });
  };

  const configuringTarget: RunTarget | null = (() => {
    if (!configuringId) return null;
    const builtin = BUILT_IN_TEMPLATES.find((t) => t.id === configuringId);
    if (builtin) return toTarget(builtin);
    const user = templates.find((t) => t.id === configuringId);
    if (user) return toTarget(user);
    return null;
  })();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Exports</h2>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">
            Download, schedule, and automate data exports. Your exports are private to your account.
          </p>
        </div>
        {!readOnly && (
          <button onClick={() => { setConfiguringId(null); setBuilderOpen((o) => !o); setActiveTab("templates"); }}
            className={`${BTN} shrink-0`} style={GRAD}>
            <Plus size={14} /> New Export
          </button>
        )}
      </div>

      {/* Builder */}
      {builderOpen && (
        <CustomBuilder jobs={jobs} onRun={runExport} onSave={handleSaveTemplate}
          onClose={() => setBuilderOpen(false)} readOnly={readOnly} />
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[#FFBC80]/10 dark:bg-[#FFBC80]/8">
        {([
          ["templates", "Templates",  undefined       ],
          ["scheduled", "Scheduled",  scheduled.length],
          ["history",   "History",    jobs.length     ],
        ] as [typeof activeTab, string, number | undefined][]).map(([key, label, count]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === key ? "text-[#3A3A3A] shadow-sm" : "text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2]"
            }`}
            style={activeTab === key ? GRAD : {}}>
            {label}
            {count != null && count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${activeTab === key ? "bg-[#3A3A3A]/20" : "bg-[#FFBC80]/30 dark:bg-[#FFBC80]/20"}`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Templates tab ── */}
      {activeTab === "templates" && (
        <div className="space-y-5">
          <div className={`${CARD} p-5`}>
            <p className={`${LABEL} mb-4`}>Pre-built Templates</p>
            <div className="space-y-3">
              {BUILT_IN_TEMPLATES.map((t) => (
                <TemplateCard key={t.id} {...t} lastRunAt={null} runCount={0}
                  isActive={configuringId === t.id}
                  onConfigure={() => handleConfigure(t.id)} readOnly={readOnly} />
              ))}
            </div>
          </div>

          {configuringTarget && !builderOpen && (
            <RunPanel target={configuringTarget} jobs={jobs} onRun={runExport}
              onSchedule={handleSchedule} onClose={() => setConfiguringId(null)} readOnly={readOnly} />
          )}

          <div className={`${CARD} p-5`}>
            <p className={`${LABEL} mb-4`}>My Templates</p>
            {templates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-10 h-10 rounded-xl bg-[#FFBC80]/15 flex items-center justify-center">
                  <Sliders size={18} className="text-[#FFBC80]/55" />
                </div>
                <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 text-center max-w-[220px] leading-relaxed">
                  No saved templates yet. Build a custom export or schedule a built-in to create one.
                </p>
                {!readOnly && (
                  <button onClick={() => { setBuilderOpen(true); setConfiguringId(null); }} className={GHOST + " mt-1"}>
                    <Plus size={12} /> Create Custom Export
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((t) => (
                  <TemplateCard key={t.id} {...t} isActive={configuringId === t.id}
                    onConfigure={() => handleConfigure(t.id)}
                    onDelete={() => { deleteTemplate(t.id); if (configuringId === t.id) setConfiguringId(null); toast({ title: "Template deleted" }); }}
                    readOnly={readOnly} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Scheduled tab ── */}
      {activeTab === "scheduled" && (
        <div className={`${CARD} p-5`}>
          <p className={`${LABEL} mb-1`}>Scheduled Exports</p>
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mb-4">Recurring exports that run automatically and deliver to your specified emails.</p>
          {scheduled.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="w-10 h-10 rounded-xl bg-[#FFBC80]/15 flex items-center justify-center">
                <Calendar size={18} className="text-[#FFBC80]/55" />
              </div>
              <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 text-center max-w-[240px] leading-relaxed">
                No scheduled exports. Open a template, choose "Schedule" delivery, and save.
              </p>
              {!readOnly && (
                <button onClick={() => setActiveTab("templates")} className={GHOST + " mt-1"}>
                  <ChevronRight size={12} /> Go to Templates
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1 -mx-1">
              {scheduled.map((t) => (
                <ScheduledRow key={t.id} template={t}
                  onToggle={() => { const s = t.schedule!; updateTemplate(t.id, { schedule: { ...s, enabled: !s.enabled } }); }}
                  onDelete={() => { updateTemplate(t.id, { schedule: null }); toast({ title: "Schedule removed" }); }}
                  readOnly={readOnly} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── History tab ── */}
      {activeTab === "history" && (
        <div className={`${CARD} p-5`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className={LABEL}>Export History</p>
              <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
                {jobs.length} export{jobs.length !== 1 ? "s" : ""}. Downloads available for completed exports.
              </p>
            </div>
            {jobs.length > 0 && !readOnly && (
              <button onClick={() => { clearHistory(); toast({ title: "History cleared" }); }} className={GHOST + " text-[10px]"}>
                <Trash2 size={11} /> Clear
              </button>
            )}
          </div>
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <div className="w-10 h-10 rounded-xl bg-[#FFBC80]/15 flex items-center justify-center">
                <Download size={18} className="text-[#FFBC80]/55" />
              </div>
              <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">No exports yet. Run a template to get started.</p>
            </div>
          ) : (
            <div className="space-y-1 -mx-1">
              {jobs.map((j) => <HistoryRow key={j.id} job={j} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
