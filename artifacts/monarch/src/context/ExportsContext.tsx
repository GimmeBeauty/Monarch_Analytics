import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useTeam } from "./TeamContext";

// ─── Core Types ───────────────────────────────────────────────────────────────

export type ExportType =
  | "performance" | "attribution" | "store"
  | "product" | "timeseries" | "raw" | "custom";

export type ExportFormat    = "csv" | "xlsx" | "json";
export type ExportGranularity = "daily" | "weekly" | "monthly";
export type JobStatus         = "queued" | "processing" | "completed" | "failed";
export type ScheduleFrequency = "daily" | "weekly" | "monthly";
export type DatePreset        = "today" | "last7" | "last30" | "mtd" | "custom";

export interface DateRangeConfig {
  preset: DatePreset;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

export interface ExportFilters {
  stores:    string[];
  channels:  string[];
  campaigns: string[];
  products:  string[];
}

export interface ExportSchedule {
  enabled:        boolean;
  frequency:      ScheduleFrequency;
  deliveryEmails: string[];
  nextRunAt:      string | null;
}

export interface ExportTemplate {
  id:          string;
  userId:      string;
  name:        string;
  description: string;
  exportType:  ExportType;
  metrics:     string[];
  dimensions:  string[];
  filters:     ExportFilters;
  dateRange:   DateRangeConfig;
  granularity: ExportGranularity;
  format:      ExportFormat;
  isBuiltIn:   boolean;
  schedule:    ExportSchedule | null;
  createdAt:   string;
  updatedAt:   string;
  lastRunAt:   string | null;
  runCount:    number;
}

export interface ExportJob {
  id:           string;
  userId:       string;
  templateId:   string | null;
  templateName: string;
  exportType:   ExportType;
  format:       ExportFormat;
  metrics:      string[];
  dateRange:    DateRangeConfig;
  granularity:  ExportGranularity;
  status:       JobStatus;
  rowCount:     number | null;
  fileSizeKb:   number | null;
  startedAt:    string;
  completedAt:  string | null;
  errorMessage: string | null;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export interface MetricMeta {
  label:  string;
  group:  "commerce" | "advertising" | "web";
  format: "currency" | "ratio" | "percent" | "number";
}

export const EXPORT_METRICS: Record<string, MetricMeta> = {
  revenue:      { label: "Revenue",        group: "commerce",    format: "currency" },
  adSpend:      { label: "Ad Spend",       group: "advertising", format: "currency" },
  adRevenue:    { label: "Ad Revenue",     group: "advertising", format: "currency" },
  roas:         { label: "ROAS",           group: "advertising", format: "ratio"    },
  mer:          { label: "MER",            group: "advertising", format: "ratio"    },
  unitsSold:    { label: "Units Sold",     group: "commerce",    format: "number"   },
  impressions:  { label: "Impressions",    group: "advertising", format: "number"   },
  cpm:          { label: "CPM",            group: "advertising", format: "currency" },
  clicks:       { label: "Clicks",         group: "advertising", format: "number"   },
  ctr:          { label: "CTR",            group: "advertising", format: "percent"  },
  cpa:          { label: "CPA",            group: "advertising", format: "currency" },
  sessions:     { label: "Sessions",       group: "web",         format: "number"   },
  convRate:     { label: "Conv. Rate",     group: "web",         format: "percent"  },
  aov:          { label: "AOV",            group: "commerce",    format: "currency" },
  newCustomers: { label: "New Customers",  group: "commerce",    format: "number"   },
  reach:        { label: "Reach",          group: "advertising", format: "number"   },
};

export const EXPORT_DIMENSIONS: Record<string, { label: string }> = {
  date:     { label: "Date"            },
  store:    { label: "Store"           },
  channel:  { label: "Traffic Channel" },
  campaign: { label: "Campaign"        },
  product:  { label: "Product"         },
  region:   { label: "Region"          },
  device:   { label: "Device"          },
};

export const EXPORT_STORES = [
  "Shopify", "Amazon", "Target", "Walmart",
  "Kroger", "CVS", "Publix", "Ulta Beauty", "Walgreens",
] as const;

export const EXPORT_CHANNELS = [
  "Meta", "Google", "Email", "TikTok",
  "Organic", "Direct", "Referral", "Pinterest", "Criteo",
] as const;

// ─── Built-in Templates ───────────────────────────────────────────────────────

type BuiltInDef = Omit<ExportTemplate,
  "userId" | "createdAt" | "updatedAt" | "lastRunAt" | "runCount" | "schedule">;

export const BUILT_IN_TEMPLATES: BuiltInDef[] = [
  {
    id: "builtin_performance",
    name: "Performance Overview",
    description: "Key marketing metrics across all channels — Revenue, ROAS, Spend, and MER by day.",
    exportType: "performance",
    metrics: ["revenue", "adSpend", "roas", "mer", "impressions", "clicks", "ctr"],
    dimensions: ["date", "channel"],
    filters: { stores: [], channels: [], campaigns: [], products: [] },
    dateRange: { preset: "last30" },
    granularity: "daily",
    format: "csv",
    isBuiltIn: true,
  },
  {
    id: "builtin_attribution",
    name: "Channel Attribution",
    description: "Which traffic channels drive revenue — contribution %, ROAS, and CPA by channel.",
    exportType: "attribution",
    metrics: ["revenue", "adSpend", "roas", "cpa", "clicks", "ctr"],
    dimensions: ["channel", "date"],
    filters: { stores: [], channels: [], campaigns: [], products: [] },
    dateRange: { preset: "last30" },
    granularity: "daily",
    format: "csv",
    isBuiltIn: true,
  },
  {
    id: "builtin_store",
    name: "Store Performance",
    description: "Revenue and unit sales by retail store — Shopify, Amazon, Target, and more.",
    exportType: "store",
    metrics: ["revenue", "unitsSold", "aov", "newCustomers"],
    dimensions: ["store", "date"],
    filters: { stores: [], channels: [], campaigns: [], products: [] },
    dateRange: { preset: "last30" },
    granularity: "weekly",
    format: "csv",
    isBuiltIn: true,
  },
  {
    id: "builtin_product",
    name: "Product Performance",
    description: "Revenue and units by product SKU — ideal for merchandising and inventory planning.",
    exportType: "product",
    metrics: ["revenue", "unitsSold", "aov"],
    dimensions: ["product", "store"],
    filters: { stores: [], channels: [], campaigns: [], products: [] },
    dateRange: { preset: "last30" },
    granularity: "weekly",
    format: "xlsx",
    isBuiltIn: true,
  },
  {
    id: "builtin_timeseries",
    name: "Time-Series Trends",
    description: "Daily and weekly trends for finance teams, forecasting models, and BI tools.",
    exportType: "timeseries",
    metrics: ["revenue", "adSpend", "mer", "unitsSold", "sessions"],
    dimensions: ["date"],
    filters: { stores: [], channels: [], campaigns: [], products: [] },
    dateRange: { preset: "last30" },
    granularity: "daily",
    format: "csv",
    isBuiltIn: true,
  },
  {
    id: "builtin_raw",
    name: "Raw Data Export",
    description: "Full-grain data across all metrics and dimensions for warehousing and external modeling.",
    exportType: "raw",
    metrics: ["revenue", "adSpend", "adRevenue", "roas", "mer", "unitsSold",
              "impressions", "cpm", "clicks", "ctr", "cpa", "sessions", "convRate"],
    dimensions: ["date", "store", "channel", "campaign", "product"],
    filters: { stores: [], channels: [], campaigns: [], products: [] },
    dateRange: { preset: "last30" },
    granularity: "daily",
    format: "csv",
    isBuiltIn: true,
  },
];

// ─── State & Context ──────────────────────────────────────────────────────────

interface ExportsState {
  templates: ExportTemplate[];
  jobs:      ExportJob[];
}

export interface RunParams {
  templateId:  string | null;
  name:        string;
  exportType:  ExportType;
  format:      ExportFormat;
  metrics:     string[];
  dimensions:  string[];
  filters:     ExportFilters;
  dateRange:   DateRangeConfig;
  granularity: ExportGranularity;
}

interface ExportsContextValue extends ExportsState {
  createTemplate: (
    data: Omit<ExportTemplate, "id" | "userId" | "createdAt" | "updatedAt" | "lastRunAt" | "runCount">
  ) => string;
  updateTemplate: (id: string, patch: Partial<ExportTemplate>) => void;
  deleteTemplate: (id: string) => void;
  runExport:      (params: RunParams) => string;
  clearHistory:   () => void;
}

const ExportsCtx = createContext<ExportsContextValue | null>(null);

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "monarch-exports";

function loadState(userId: string): ExportsState {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { templates: [], jobs: [] };
}

function saveState(userId: string, state: ExportsState) {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(state));
  } catch {}
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ExportsProvider({ children }: { children: ReactNode }) {
  const { currentUserId } = useTeam();
  const [state, setState] = useState<ExportsState>(() => loadState(currentUserId));

  const update = useCallback(
    (fn: (s: ExportsState) => ExportsState) => {
      setState((prev) => {
        const next = fn(prev);
        saveState(currentUserId, next);
        return next;
      });
    },
    [currentUserId],
  );

  const createTemplate = useCallback(
    (data: Omit<ExportTemplate, "id" | "userId" | "createdAt" | "updatedAt" | "lastRunAt" | "runCount">) => {
      const id  = `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      const tpl: ExportTemplate = {
        ...data, id, userId: currentUserId,
        createdAt: now, updatedAt: now, lastRunAt: null, runCount: 0,
      };
      update((s) => ({ ...s, templates: [tpl, ...s.templates] }));
      return id;
    },
    [update, currentUserId],
  );

  const updateTemplate = useCallback(
    (id: string, patch: Partial<ExportTemplate>) => {
      update((s) => ({
        ...s,
        templates: s.templates.map((t) =>
          t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
        ),
      }));
    },
    [update],
  );

  const deleteTemplate = useCallback(
    (id: string) => update((s) => ({ ...s, templates: s.templates.filter((t) => t.id !== id) })),
    [update],
  );

  const runExport = useCallback(
    (params: RunParams) => {
      const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const now   = new Date().toISOString();

      const job: ExportJob = {
        id: jobId, userId: currentUserId,
        templateId: params.templateId, templateName: params.name,
        exportType: params.exportType, format: params.format,
        metrics: params.metrics, dateRange: params.dateRange,
        granularity: params.granularity,
        status: "queued", rowCount: null, fileSizeKb: null,
        startedAt: now, completedAt: null, errorMessage: null,
      };

      update((s) => ({ ...s, jobs: [job, ...s.jobs].slice(0, 100) }));

      // queued → processing
      setTimeout(() => {
        update((s) => ({
          ...s,
          jobs: s.jobs.map((j) => j.id === jobId ? { ...j, status: "processing" } : j),
        }));
      }, 700);

      // processing → completed
      const delay = 2400 + Math.random() * 1800;
      setTimeout(() => {
        const rowCount   = Math.floor(Math.random() * 8000) + 200;
        const sizePerRow = params.format === "xlsx" ? 0.75 : params.format === "json" ? 1.4 : 0.38;
        const fileSizeKb = Math.floor(rowCount * sizePerRow + 24);
        const completedAt = new Date().toISOString();

        update((s) => ({
          ...s,
          jobs: s.jobs.map((j) =>
            j.id === jobId ? { ...j, status: "completed", completedAt, rowCount, fileSizeKb } : j,
          ),
          templates: params.templateId
            ? s.templates.map((t) =>
                t.id === params.templateId
                  ? { ...t, lastRunAt: completedAt, runCount: t.runCount + 1, updatedAt: completedAt }
                  : t,
              )
            : s.templates,
        }));
      }, delay);

      return jobId;
    },
    [update, currentUserId],
  );

  const clearHistory = useCallback(
    () => update((s) => ({ ...s, jobs: [] })),
    [update],
  );

  return (
    <ExportsCtx.Provider
      value={{ ...state, createTemplate, updateTemplate, deleteTemplate, runExport, clearHistory }}
    >
      {children}
    </ExportsCtx.Provider>
  );
}

export function useExports() {
  const ctx = useContext(ExportsCtx);
  if (!ctx) throw new Error("useExports must be used inside ExportsProvider");
  return ctx;
}
