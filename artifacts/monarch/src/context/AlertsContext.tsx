import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useTeam } from "./TeamContext";

// ─── Core Types ───────────────────────────────────────────────────────────────

export type MetricKey =
  | "revenue" | "roas" | "mer" | "cpa" | "ctr"
  | "impressions" | "clicks" | "spend" | "sessions" | "conversionRate";

export type ConditionOperator =
  | "above" | "below" | "increase_pct" | "decrease_pct";

export type TimeGranularity = "day" | "week" | "month";
export type AlertSchedule = "hourly" | "daily" | "weekly";
export type AlertStatus = "active" | "muted" | "paused";
export type AlertType = "threshold" | "change" | "efficiency" | "contribution_shift" | "anomaly";

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const METRIC_META: Record<MetricKey, {
  label: string;
  format: "currency" | "ratio" | "percent" | "number";
  unit: string;
}> = {
  revenue:        { label: "Revenue",         format: "currency", unit: "$"  },
  roas:           { label: "ROAS",            format: "ratio",    unit: "x"  },
  mer:            { label: "MER",             format: "ratio",    unit: "x"  },
  cpa:            { label: "CPA",             format: "currency", unit: "$"  },
  ctr:            { label: "CTR",             format: "percent",  unit: "%"  },
  impressions:    { label: "Impressions",     format: "number",   unit: ""   },
  clicks:         { label: "Clicks",          format: "number",   unit: ""   },
  spend:          { label: "Ad Spend",        format: "currency", unit: "$"  },
  sessions:       { label: "Sessions",        format: "number",   unit: ""   },
  conversionRate: { label: "Conv. Rate",      format: "percent",  unit: "%"  },
};

export const ALERT_TYPE_META: Record<AlertType, { label: string; description: string }> = {
  threshold:         { label: "Threshold",          description: "Alert when a metric crosses a fixed value" },
  change:            { label: "Period Change",       description: "Alert when a metric changes % vs previous period" },
  efficiency:        { label: "Efficiency",          description: "Alert when spend rises while revenue drops" },
  contribution_shift:{ label: "Contribution Shift",  description: "Alert when a channel's revenue share shifts significantly" },
  anomaly:           { label: "Anomaly Detection",   description: "Alert when a metric deviates from recent baseline" },
};

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  above:        "rises above",
  below:        "drops below",
  increase_pct: "increases by more than",
  decrease_pct: "decreases by more than",
};

export const SALES_CHANNELS = [
  "Shopify", "Amazon", "Target", "Walmart",
  "Kroger", "CVS", "Publix", "Ulta Beauty", "Walgreens",
] as const;

export const TRAFFIC_CHANNELS = [
  "Meta", "Google", "Email", "TikTok",
  "Organic", "Direct", "Referral",
] as const;

export type SalesChannel = typeof SALES_CHANNELS[number];
export type TrafficChannel = typeof TRAFFIC_CHANNELS[number];

// ─── Data Models ──────────────────────────────────────────────────────────────

export interface PerformanceAlert {
  id: string;
  userId: string;
  name: string;
  metric: MetricKey;
  alertType: AlertType;
  operator: ConditionOperator;
  threshold: number;
  baselinePeriods: number;        // for anomaly: lookback window (days)
  timeGranularity: TimeGranularity;
  salesChannels: SalesChannel[];
  trafficChannels: TrafficChannel[];
  schedule: AlertSchedule;
  status: AlertStatus;
  notificationEmail: string;
  cooldownMinutes: number;
  createdAt: string;
  lastEvaluatedAt: string | null;
  lastTriggeredAt: string | null;
  triggerCount: number;
}

export interface AlertTriggerEvent {
  id: string;
  alertId: string;
  alertName: string;
  metric: MetricKey;
  alertType: AlertType;
  triggeredAt: string;
  currentValue: number;
  comparedValue: number | null;
  percentChange: number | null;
  period: string;
  explanation: string;
  didTrigger: boolean;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface AlertsState {
  alertsEnabled: boolean;
  defaultEmail: string;
  alerts: PerformanceAlert[];
  events: AlertTriggerEvent[];
}

interface AlertsContextValue extends AlertsState {
  toggleAlertsEnabled: () => void;
  setDefaultEmail: (email: string) => void;
  createAlert: (data: Omit<PerformanceAlert, "id" | "userId" | "createdAt" | "lastEvaluatedAt" | "lastTriggeredAt" | "triggerCount">) => void;
  updateAlert: (id: string, patch: Partial<PerformanceAlert>) => void;
  deleteAlert: (id: string) => void;
  toggleStatus: (id: string) => void;     // active ↔ paused
  toggleMute: (id: string) => void;       // active ↔ muted
  markEvaluated: (id: string, triggered: boolean) => void;
  recordEvent: (event: Omit<AlertTriggerEvent, "id" | "triggeredAt">) => void;
  clearHistory: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AlertsContext = createContext<AlertsContextValue | null>(null);

const STORAGE_BASE = "monarch-alerts";

function load(userId: string): AlertsState {
  try {
    const raw = localStorage.getItem(`${STORAGE_BASE}-${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { alertsEnabled: true, defaultEmail: "", alerts: [], events: [] };
}

function persist(userId: string, state: AlertsState) {
  try {
    localStorage.setItem(`${STORAGE_BASE}-${userId}`, JSON.stringify(state));
  } catch {}
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { currentUserId } = useTeam();

  const [state, setState] = useState<AlertsState>(() => load(currentUserId));

  const update = useCallback(
    (fn: (s: AlertsState) => AlertsState) => {
      setState((prev) => {
        const next = fn(prev);
        persist(currentUserId, next);
        return next;
      });
    },
    [currentUserId],
  );

  const value: AlertsContextValue = {
    ...state,

    toggleAlertsEnabled: () =>
      update((s) => ({ ...s, alertsEnabled: !s.alertsEnabled })),

    setDefaultEmail: (email) =>
      update((s) => ({ ...s, defaultEmail: email })),

    createAlert: (data) => {
      const alert: PerformanceAlert = {
        ...data,
        id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        userId: currentUserId,
        createdAt: new Date().toISOString(),
        lastEvaluatedAt: null,
        lastTriggeredAt: null,
        triggerCount: 0,
      };
      update((s) => ({ ...s, alerts: [alert, ...s.alerts] }));
    },

    updateAlert: (id, patch) =>
      update((s) => ({
        ...s,
        alerts: s.alerts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      })),

    deleteAlert: (id) =>
      update((s) => ({ ...s, alerts: s.alerts.filter((a) => a.id !== id) })),

    toggleStatus: (id) =>
      update((s) => ({
        ...s,
        alerts: s.alerts.map((a) =>
          a.id === id ? { ...a, status: a.status === "active" ? "paused" : "active" } : a,
        ),
      })),

    toggleMute: (id) =>
      update((s) => ({
        ...s,
        alerts: s.alerts.map((a) =>
          a.id === id ? { ...a, status: a.status === "muted" ? "active" : "muted" } : a,
        ),
      })),

    markEvaluated: (id, triggered) =>
      update((s) => ({
        ...s,
        alerts: s.alerts.map((a) =>
          a.id === id
            ? {
                ...a,
                lastEvaluatedAt: new Date().toISOString(),
                ...(triggered
                  ? {
                      lastTriggeredAt: new Date().toISOString(),
                      triggerCount: a.triggerCount + 1,
                    }
                  : {}),
              }
            : a,
        ),
      })),

    recordEvent: (eventData) => {
      const event: AlertTriggerEvent = {
        ...eventData,
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        triggeredAt: new Date().toISOString(),
      };
      update((s) => ({
        ...s,
        events: [event, ...s.events].slice(0, 50),
      }));
    },

    clearHistory: () => update((s) => ({ ...s, events: [] })),
  };

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used inside AlertsProvider");
  return ctx;
}
