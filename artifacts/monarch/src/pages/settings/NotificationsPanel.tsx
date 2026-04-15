import { useState, useEffect, useRef } from "react";
import {
  Bell, BellOff, Plus, Trash2, Pause, Play, VolumeX, Volume2,
  FlaskConical, ChevronDown, ChevronUp, Check, X, Mail,
  Clock, Activity, Zap, TrendingDown, Shield, PieChart,
  AlertTriangle, Info, RefreshCw, Inbox,
} from "lucide-react";
import {
  useAlerts,
  METRIC_META,
  ALERT_TYPE_META,
  OPERATOR_LABELS,
  SALES_CHANNELS,
  TRAFFIC_CHANNELS,
  type PerformanceAlert,
  type MetricKey,
  type ConditionOperator,
  type AlertType,
  type TimeGranularity,
  type AlertSchedule,
  type SalesChannel,
  type TrafficChannel,
} from "@/context/AlertsContext";
import { useProfile } from "@/context/ProfileContext";
import { evaluateAlert, getAnalyticsData, fmtMetric, type EvaluationResult } from "@/lib/alertEngine";

// ─── Shared Styles ────────────────────────────────────────────────────────────

const CARD = "p-5 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30";
const LABEL_SM = "text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider";
const INPUT = "w-full px-3 py-2 rounded-lg text-sm bg-[#FFF9F2] dark:bg-[#1a1208] text-[#3A3A3A] dark:text-[#FFF9F2] border border-[#FFBC80]/50 focus:border-[#FFBC80] outline-none transition-colors";
const SELECT = INPUT + " cursor-pointer";
const BTN_PRIMARY = "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-[#3A3A3A] hover:opacity-90 transition-all";
const BTN_GHOST = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:bg-[#FFBC80]/10 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors";

// ─── Alert Type Icons ─────────────────────────────────────────────────────────

const TYPE_ICONS: Record<AlertType, React.ElementType> = {
  threshold:          Shield,
  change:             TrendingDown,
  efficiency:         Zap,
  contribution_shift: PieChart,
  anomaly:            Activity,
};

const TYPE_COLORS: Record<AlertType, string> = {
  threshold:          "text-blue-500",
  change:             "text-orange-500",
  efficiency:         "text-purple-500",
  contribution_shift: "text-teal-500",
  anomaly:            "text-rose-500",
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PerformanceAlert["status"] }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    muted:  "bg-amber-100  dark:bg-amber-900/30  text-amber-700  dark:text-amber-400",
    paused: "bg-slate-100  dark:bg-slate-800/50  text-slate-500  dark:text-slate-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-[#FFBC80]" : "bg-[#3A3A3A]/20 dark:bg-[#FFF9F2]/15"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4.5" : "translate-x-0.5"
        }`}
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}

// ─── Channel Multi-Select ─────────────────────────────────────────────────────

function ChannelPicker<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (v: T[]) => void;
}) {
  const toggle = (ch: T) =>
    onChange(selected.includes(ch) ? selected.filter((x) => x !== ch) : [...selected, ch]);

  return (
    <div>
      <p className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((ch) => {
          const active = selected.includes(ch);
          return (
            <button
              key={ch}
              type="button"
              onClick={() => toggle(ch)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                active
                  ? "border-[#FFBC80] text-[#3A3A3A] dark:text-[#FFF9F2]"
                  : "border-[#FFBC80]/30 text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 hover:border-[#FFBC80]/60"
              }`}
              style={active ? { background: "linear-gradient(135deg, rgba(255,188,128,0.25), rgba(255,226,154,0.25))" } : {}}
            >
              {ch}
            </button>
          );
        })}
      </div>
      {selected.length === 0 && (
        <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-1">All {label.toLowerCase()} included</p>
      )}
    </div>
  );
}

// ─── Test Result Banner ───────────────────────────────────────────────────────

function TestResultBanner({
  result,
  alertName,
  onDismiss,
}: {
  result: EvaluationResult;
  alertName: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 8000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`rounded-xl p-4 border flex gap-3 items-start ${
        result.didTrigger
          ? "bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800"
          : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
      }`}
    >
      <div className="mt-0.5 shrink-0">
        {result.didTrigger
          ? <AlertTriangle size={15} className="text-rose-500" />
          : <Check size={15} className="text-emerald-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">
          {result.didTrigger ? `⚡ Alert triggered: ${alertName}` : `✓ No trigger: ${alertName}`}
        </p>
        <p className="text-xs text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 mt-0.5">{result.explanation}</p>
        {result.channelBreakdown.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5">
            {result.channelBreakdown.slice(0, 4).map((c) => (
              <span key={c.channel} className="text-[11px] text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">
                {c.channel}: <strong className="text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">{fmtMetric(c.value, "revenue")}</strong>
              </span>
            ))}
          </div>
        )}
      </div>
      <button onClick={onDismiss} className="shrink-0 text-[#3A3A3A]/40 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors">
        <X size={13} />
      </button>
    </div>
  );
}

// ─── Alert Form Data ──────────────────────────────────────────────────────────

interface FormData {
  name: string;
  metric: MetricKey;
  alertType: AlertType;
  operator: ConditionOperator;
  threshold: number;
  baselinePeriods: number;
  timeGranularity: TimeGranularity;
  salesChannels: SalesChannel[];
  trafficChannels: TrafficChannel[];
  schedule: AlertSchedule;
  cooldownMinutes: number;
  notificationEmail: string;
}

const DEFAULT_FORM: FormData = {
  name: "",
  metric: "revenue",
  alertType: "threshold",
  operator: "below",
  threshold: 30000,
  baselinePeriods: 14,
  timeGranularity: "day",
  salesChannels: [],
  trafficChannels: [],
  schedule: "daily",
  cooldownMinutes: 1440,
  notificationEmail: "",
};

/** Operators valid for each alert type */
const TYPE_OPERATORS: Record<AlertType, ConditionOperator[]> = {
  threshold:          ["above", "below"],
  change:             ["increase_pct", "decrease_pct"],
  efficiency:         ["above"],           // not shown in UI; threshold = spend % rise trigger
  contribution_shift: ["above"],           // not shown; threshold = pp shift
  anomaly:            ["above"],           // not shown; threshold = % deviation
};

function defaultOperator(type: AlertType): ConditionOperator {
  return TYPE_OPERATORS[type][0];
}

// ─── Create / Edit Modal ──────────────────────────────────────────────────────

function AlertFormModal({
  initial,
  defaultEmail,
  onSave,
  onCancel,
}: {
  initial?: PerformanceAlert;
  defaultEmail: string;
  onSave: (data: FormData) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormData>(
    initial
      ? {
          name: initial.name,
          metric: initial.metric,
          alertType: initial.alertType,
          operator: initial.operator,
          threshold: initial.threshold,
          baselinePeriods: initial.baselinePeriods,
          timeGranularity: initial.timeGranularity,
          salesChannels: initial.salesChannels,
          trafficChannels: initial.trafficChannels,
          schedule: initial.schedule,
          cooldownMinutes: initial.cooldownMinutes,
          notificationEmail: initial.notificationEmail,
        }
      : { ...DEFAULT_FORM, notificationEmail: defaultEmail },
  );

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleTypeChange = (type: AlertType) => {
    setForm((f) => ({
      ...f,
      alertType: type,
      operator: defaultOperator(type),
      threshold:
        type === "threshold"          ? (METRIC_META[f.metric].format === "currency" ? 30000 : METRIC_META[f.metric].format === "ratio" ? 2 : 2)
        : type === "change"           ? 20
        : type === "efficiency"       ? 15
        : type === "contribution_shift"? 10
        : /* anomaly */                 20,
    }));
  };

  const showOperator   = form.alertType === "threshold" || form.alertType === "change";
  const showBaseline   = form.alertType === "anomaly";
  const thresholdLabel =
    form.alertType === "threshold"          ? METRIC_META[form.metric].unit + " value"
    : form.alertType === "change"           ? "% change"
    : form.alertType === "efficiency"       ? "% spend increase to trigger"
    : form.alertType === "contribution_shift"? "pp shift to trigger"
    : "% deviation from baseline";

  const isValid = form.name.trim() && form.threshold > 0 && form.notificationEmail.includes("@");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#FFF9F2] dark:bg-[#1a1208] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#FFBC80]/25 bg-[#FFF9F2] dark:bg-[#1a1208]">
          <div>
            <h3 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">
              {initial ? "Edit Alert" : "New Performance Alert"}
            </h3>
            <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
              Define when and how you want to be notified.
            </p>
          </div>
          <button onClick={onCancel} className="text-[#3A3A3A]/40 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* ── Name ── */}
          <div>
            <label className={`block ${LABEL_SM} mb-2`}>Alert Name</label>
            <input
              type="text"
              placeholder="e.g. Low ROAS Warning"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={INPUT}
            />
          </div>

          {/* ── Metric & Alert Type ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block ${LABEL_SM} mb-2`}>Metric</label>
              <select
                value={form.metric}
                onChange={(e) => set("metric", e.target.value as MetricKey)}
                className={SELECT}
              >
                {(Object.keys(METRIC_META) as MetricKey[]).map((k) => (
                  <option key={k} value={k}>{METRIC_META[k].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block ${LABEL_SM} mb-2`}>Alert Type</label>
              <select
                value={form.alertType}
                onChange={(e) => handleTypeChange(e.target.value as AlertType)}
                className={SELECT}
              >
                {(Object.keys(ALERT_TYPE_META) as AlertType[]).map((k) => (
                  <option key={k} value={k}>{ALERT_TYPE_META[k].label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Alert type description */}
          <div className="flex gap-2 px-3 py-2.5 rounded-lg bg-[#FFBC80]/8 border border-[#FFBC80]/20">
            <Info size={13} className="text-[#FFBC80] shrink-0 mt-0.5" />
            <p className="text-xs text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50">
              {ALERT_TYPE_META[form.alertType].description}
            </p>
          </div>

          {/* ── Condition ── */}
          <div>
            <label className={`block ${LABEL_SM} mb-2`}>Condition</label>
            <div className={showOperator ? "grid grid-cols-2 gap-3" : ""}>
              {showOperator && (
                <select
                  value={form.operator}
                  onChange={(e) => set("operator", e.target.value as ConditionOperator)}
                  className={SELECT}
                >
                  {TYPE_OPERATORS[form.alertType].map((op) => (
                    <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                  ))}
                </select>
              )}
              <div>
                <input
                  type="number"
                  min={0}
                  step={form.alertType === "threshold" && METRIC_META[form.metric].format === "currency" ? 1000 : 0.1}
                  value={form.threshold}
                  onChange={(e) => set("threshold", parseFloat(e.target.value) || 0)}
                  className={INPUT}
                  placeholder={thresholdLabel}
                />
                <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-1">{thresholdLabel}</p>
              </div>
            </div>
          </div>

          {/* Baseline window — anomaly only */}
          {showBaseline && (
            <div>
              <label className={`block ${LABEL_SM} mb-2`}>Baseline Window (days)</label>
              <input
                type="number"
                min={3}
                max={90}
                value={form.baselinePeriods}
                onChange={(e) => set("baselinePeriods", parseInt(e.target.value) || 14)}
                className={INPUT}
              />
              <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-1">
                Number of historical days to use as baseline for anomaly detection
              </p>
            </div>
          )}

          {/* ── Time Granularity ── */}
          <div>
            <label className={`block ${LABEL_SM} mb-2`}>Evaluation Period</label>
            <div className="flex gap-2">
              {(["day", "week", "month"] as TimeGranularity[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => set("timeGranularity", g)}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all capitalize"
                  style={
                    form.timeGranularity === g
                      ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)", borderColor: "transparent", color: "#3A3A3A" }
                      : { borderColor: "rgba(255,188,128,0.3)", color: "rgba(58,58,58,0.55)" }
                  }
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* ── Channel Filters ── */}
          <div className="space-y-4">
            <label className={LABEL_SM}>Channel Filters <span className="normal-case font-normal opacity-70">(optional — leave empty for all)</span></label>
            <ChannelPicker
              label="Sales Channels"
              options={SALES_CHANNELS}
              selected={form.salesChannels}
              onChange={(v) => set("salesChannels", v as SalesChannel[])}
            />
            <ChannelPicker
              label="Traffic Channels"
              options={TRAFFIC_CHANNELS}
              selected={form.trafficChannels}
              onChange={(v) => set("trafficChannels", v as TrafficChannel[])}
            />
          </div>

          {/* ── Schedule ── */}
          <div>
            <label className={`block ${LABEL_SM} mb-2`}>Evaluation Schedule</label>
            <div className="flex gap-2">
              {(["hourly", "daily", "weekly"] as AlertSchedule[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    set("schedule", s);
                    set("cooldownMinutes", s === "hourly" ? 60 : s === "daily" ? 1440 : 10080);
                  }}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border transition-all capitalize"
                  style={
                    form.schedule === s
                      ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)", borderColor: "transparent", color: "#3A3A3A" }
                      : { borderColor: "rgba(255,188,128,0.3)", color: "rgba(58,58,58,0.55)" }
                  }
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* ── Cooldown ── */}
          <div>
            <label className={`block ${LABEL_SM} mb-2`}>Cooldown (minutes)</label>
            <input
              type="number"
              min={15}
              step={15}
              value={form.cooldownMinutes}
              onChange={(e) => set("cooldownMinutes", parseInt(e.target.value) || 60)}
              className={INPUT}
            />
            <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-1">
              Minimum time between repeated notifications for this alert ({Math.round(form.cooldownMinutes / 60)}h)
            </p>
          </div>

          {/* ── Notification Email ── */}
          <div>
            <label className={`block ${LABEL_SM} mb-2`}>Notification Email</label>
            <input
              type="email"
              placeholder="you@company.com"
              value={form.notificationEmail}
              onChange={(e) => set("notificationEmail", e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-[#FFBC80]/25 bg-[#FFF9F2] dark:bg-[#1a1208]">
          <button onClick={onCancel} className={BTN_GHOST}>Cancel</button>
          <button
            onClick={() => isValid && onSave(form)}
            disabled={!isValid}
            className={`${BTN_PRIMARY} disabled:opacity-40 disabled:cursor-not-allowed`}
            style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
          >
            <Check size={13} />
            {initial ? "Save Changes" : "Create Alert"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onEdit,
  onDelete,
  onToggleStatus,
  onToggleMute,
  onTest,
}: {
  alert: PerformanceAlert;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onToggleMute: () => void;
  onTest: (result: EvaluationResult) => void;
}) {
  const [testing, setTesting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const TypeIcon = TYPE_ICONS[alert.alertType];

  const handleTest = () => {
    setTesting(true);
    // Simulate slight async delay for UX feedback
    setTimeout(() => {
      const data = getAnalyticsData(60);
      const result = evaluateAlert(alert, data);
      onTest(result);
      setTesting(false);
    }, 600);
  };

  const conditionSummary = () => {
    const m = METRIC_META[alert.metric].label;
    if (alert.alertType === "threshold") {
      return `${m} ${OPERATOR_LABELS[alert.operator]} ${fmtMetric(alert.threshold, alert.metric)}`;
    }
    if (alert.alertType === "change") {
      return `${m} ${OPERATOR_LABELS[alert.operator]} ${alert.threshold}% (${alert.timeGranularity}-over-${alert.timeGranularity})`;
    }
    if (alert.alertType === "efficiency") return `Spend ↑${alert.threshold}% while Revenue is flat/down`;
    if (alert.alertType === "contribution_shift") return `Channel share shifts >${alert.threshold}pp`;
    if (alert.alertType === "anomaly") return `${m} deviates >${alert.threshold}% from ${alert.baselinePeriods}-day baseline`;
    return "";
  };

  const relativeTime = (iso: string | null) => {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const channels = [...alert.salesChannels, ...alert.trafficChannels];

  return (
    <div className={`rounded-xl border transition-all ${
      alert.status === "active"
        ? "border-[#FFBC80]/30 bg-white dark:bg-[#231a0e]"
        : "border-[#FFBC80]/15 bg-[#FFBC80]/3 dark:bg-[#1a1208]/60 opacity-70"
    }`}>
      {/* Card header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`shrink-0 ${TYPE_COLORS[alert.alertType]}`}>
              <TypeIcon size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] truncate">{alert.name}</span>
                <StatusBadge status={alert.status} />
              </div>
              <p className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mt-0.5 truncate">{conditionSummary()}</p>
            </div>
          </div>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="shrink-0 text-[#3A3A3A]/35 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Meta row */}
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
          <span className="flex items-center gap-1"><Clock size={10} /> {alert.schedule}</span>
          <span className="flex items-center gap-1"><Bell size={10} /> Last: {relativeTime(alert.lastTriggeredAt)} ({alert.triggerCount}×)</span>
          <span className="flex items-center gap-1"><RefreshCw size={10} /> Checked: {relativeTime(alert.lastEvaluatedAt)}</span>
          {channels.length > 0 && (
            <span className="flex items-center gap-1">
              Channels: {channels.slice(0, 3).join(", ")}{channels.length > 3 ? ` +${channels.length - 3}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 border-t border-[#FFBC80]/15 space-y-2 text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <span>Period: <strong className="text-[#3A3A3A] dark:text-[#FFF9F2]">{alert.timeGranularity}</strong></span>
            <span>Cooldown: <strong className="text-[#3A3A3A] dark:text-[#FFF9F2]">{Math.round(alert.cooldownMinutes / 60)}h</strong></span>
            <span>Email: <strong className="text-[#3A3A3A] dark:text-[#FFF9F2] truncate">{alert.notificationEmail || "—"}</strong></span>
            <span>Type: <strong className="text-[#3A3A3A] dark:text-[#FFF9F2]">{ALERT_TYPE_META[alert.alertType].label}</strong></span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-3 flex items-center gap-1 flex-wrap">
        <button
          onClick={handleTest}
          disabled={testing}
          className={`${BTN_GHOST} disabled:opacity-50`}
          title="Test against current data"
        >
          {testing ? <RefreshCw size={11} className="animate-spin" /> : <FlaskConical size={11} />}
          {testing ? "Testing…" : "Test"}
        </button>
        <button onClick={onEdit} className={BTN_GHOST} title="Edit alert">Edit</button>
        <button
          onClick={onToggleStatus}
          className={BTN_GHOST}
          title={alert.status === "active" ? "Pause" : "Resume"}
        >
          {alert.status === "paused" ? <Play size={11} /> : <Pause size={11} />}
          {alert.status === "paused" ? "Resume" : "Pause"}
        </button>
        <button
          onClick={onToggleMute}
          className={BTN_GHOST}
          title={alert.status === "muted" ? "Unmute" : "Mute"}
        >
          {alert.status === "muted" ? <Volume2 size={11} /> : <VolumeX size={11} />}
          {alert.status === "muted" ? "Unmute" : "Mute"}
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 hover:text-rose-500 hover:bg-rose-500/10 transition-colors ml-auto"
          title="Delete alert"
        >
          <Trash2 size={11} /> Delete
        </button>
      </div>
    </div>
  );
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

function ActivityLog() {
  const { events, clearHistory } = useAlerts();

  if (events.length === 0) return null;

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between mb-4">
        <p className={LABEL_SM}>Recent Activity</p>
        <button onClick={clearHistory} className={BTN_GHOST}>
          <X size={11} /> Clear
        </button>
      </div>
      <div className="space-y-2">
        {events.slice(0, 10).map((ev) => (
          <div
            key={ev.id}
            className={`rounded-lg px-3 py-2.5 border text-xs ${
              ev.didTrigger
                ? "bg-rose-50 dark:bg-rose-950/25 border-rose-200 dark:border-rose-800"
                : "bg-[#FFF9F2] dark:bg-[#1a1208] border-[#FFBC80]/20"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] truncate">
                {ev.didTrigger ? "⚡" : "✓"} {ev.alertName}
              </span>
              <span className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 shrink-0">
                {new Date(ev.triggeredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mt-0.5 leading-relaxed">{ev.explanation}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function NotificationsPanel() {
  const {
    alertsEnabled, toggleAlertsEnabled,
    defaultEmail, setDefaultEmail,
    alerts, createAlert, updateAlert, deleteAlert,
    toggleStatus, toggleMute, markEvaluated, recordEvent,
  } = useAlerts();

  const { profile } = useProfile();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ result: EvaluationResult; alertName: string } | null>(null);
  const [emailDraft, setEmailDraft] = useState(defaultEmail || profile.name ? "" : "");
  const emailSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingAlert = alerts.find((a) => a.id === editingId);

  // Auto-save email after typing stops
  const handleEmailChange = (val: string) => {
    setEmailDraft(val);
    if (emailSaveTimer.current) clearTimeout(emailSaveTimer.current);
    emailSaveTimer.current = setTimeout(() => setDefaultEmail(val), 700);
  };

  // Scheduler: evaluate alerts that are due (runs every 60s)
  useEffect(() => {
    const tick = () => {
      if (!alertsEnabled) return;
      const data = getAnalyticsData(60);
      for (const alert of alerts) {
        if (alert.status !== "active") continue;
        const due = !alert.lastEvaluatedAt ||
          Date.now() - new Date(alert.lastEvaluatedAt).getTime() >=
            ({ hourly: 3_600_000, daily: 86_400_000, weekly: 604_800_000 }[alert.schedule] ?? 86_400_000);
        if (!due) continue;

        const result = evaluateAlert(alert, data);
        markEvaluated(alert.id, result.didTrigger);
        if (result.didTrigger) {
          recordEvent({
            alertId: alert.id,
            alertName: alert.name,
            metric: alert.metric,
            alertType: alert.alertType,
            currentValue: result.currentValue,
            comparedValue: result.comparedValue,
            percentChange: result.percentChange,
            period: result.period,
            explanation: result.explanation,
            didTrigger: true,
          });
        }
      }
    };

    tick(); // run once on mount
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertsEnabled, alerts.length]);

  const handleSave = (form: FormData) => {
    if (editingId) {
      updateAlert(editingId, form);
    } else {
      createAlert({ ...form, status: "active" });
    }
    setShowForm(false);
    setEditingId(null);
  };

  const handleTest = (result: EvaluationResult, alertName: string) => {
    setTestResult({ result, alertName });
    recordEvent({
      alertId: "",
      alertName,
      metric: alerts.find((a) => a.name === alertName)?.metric ?? "revenue",
      alertType: alerts.find((a) => a.name === alertName)?.alertType ?? "threshold",
      currentValue: result.currentValue,
      comparedValue: result.comparedValue,
      percentChange: result.percentChange,
      period: result.period,
      explanation: result.explanation,
      didTrigger: result.didTrigger,
    });
  };

  const activeCount = alerts.filter((a) => a.status === "active").length;

  return (
    <>
      {/* Form Modal */}
      {(showForm || editingId) && (
        <AlertFormModal
          initial={editingAlert}
          defaultEmail={defaultEmail}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingId(null); }}
        />
      )}

      <div className="space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Notifications</h2>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">
            Create personal performance alerts. Conditions are evaluated on your schedule and notify you by email when triggered.
          </p>
        </div>

        {/* Master toggle */}
        <div className={CARD}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {alertsEnabled
                ? <Bell size={16} className="text-[#FFBC80]" />
                : <BellOff size={16} className="text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25" />
              }
              <div>
                <p className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Performance Alerts</p>
                <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">
                  {alertsEnabled
                    ? `${activeCount} active alert${activeCount !== 1 ? "s" : ""} — evaluating on schedule`
                    : "All alerts are paused"}
                </p>
              </div>
            </div>
            <Toggle checked={alertsEnabled} onChange={toggleAlertsEnabled} />
          </div>
        </div>

        {/* Email config */}
        <div className={CARD}>
          <p className={`${LABEL_SM} mb-3`}>Notification Email</p>
          <div className="flex gap-2 items-center">
            <Mail size={14} className="text-[#FFBC80] shrink-0" />
            <input
              type="email"
              placeholder="your@email.com"
              value={emailDraft || defaultEmail}
              onChange={(e) => handleEmailChange(e.target.value)}
              className={INPUT}
            />
          </div>
          <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-1.5 ml-5">
            Used as the default for new alerts. Each alert can have its own email.
          </p>
        </div>

        {/* Test result banner */}
        {testResult && (
          <TestResultBanner
            result={testResult.result}
            alertName={testResult.alertName}
            onDismiss={() => setTestResult(null)}
          />
        )}

        {/* Alert list */}
        <div className={CARD}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className={LABEL_SM}>Performance Alerts</p>
              <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-0.5">
                {alerts.length} total · {activeCount} active
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className={`${BTN_PRIMARY}`}
              style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
            >
              <Plus size={13} /> New Alert
            </button>
          </div>

          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Inbox size={28} className="text-[#FFBC80]/40" />
              <div className="text-center">
                <p className="text-sm font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/35">No alerts yet</p>
                <p className="text-xs text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-0.5">
                  Create an alert to get notified when your metrics cross defined thresholds.
                </p>
              </div>
              <button
                onClick={() => setShowForm(true)}
                className={`${BTN_PRIMARY} mt-1`}
                style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
              >
                <Plus size={13} /> Create your first alert
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onEdit={() => setEditingId(alert.id)}
                  onDelete={() => deleteAlert(alert.id)}
                  onToggleStatus={() => toggleStatus(alert.id)}
                  onToggleMute={() => toggleMute(alert.id)}
                  onTest={(result) => handleTest(result, alert.name)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Activity log */}
        <ActivityLog />

        {/* Alert types guide */}
        <div className="rounded-xl border border-[#FFBC80]/30 overflow-hidden">
          <div className="px-5 py-3 border-b border-[#FFBC80]/20 bg-[#FFBC80]/5">
            <p className={LABEL_SM}>Alert Type Reference</p>
          </div>
          <div className="divide-y divide-[#FFBC80]/15">
            {(Object.entries(ALERT_TYPE_META) as [AlertType, typeof ALERT_TYPE_META[AlertType]][]).map(([type, meta]) => {
              const Icon = TYPE_ICONS[type];
              return (
                <div key={type} className="flex items-start gap-3 px-5 py-3 bg-white dark:bg-[#231a0e]">
                  <Icon size={14} className={`${TYPE_COLORS[type]} shrink-0 mt-0.5`} />
                  <div>
                    <p className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{meta.label}</p>
                    <p className="text-[11px] text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">{meta.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
