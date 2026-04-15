import { useState, useMemo } from "react";
import {
  CheckCircle, XCircle, Circle, Loader2, Plus, Trash2, RefreshCw,
  Settings, Eye, EyeOff, X, Info, Download, ExternalLink,
  ChevronDown, ChevronUp, Megaphone, ShoppingBag, BarChart2,
  Users, Building2, FileSpreadsheet, Zap, AlertCircle,
} from "lucide-react";
import {
  SiMeta, SiGoogleads, SiTiktok, SiGoogleanalytics, SiShopify,
  SiWalmart, SiPinterest, SiGooglesheets,
} from "react-icons/si";
import { FaAmazon } from "react-icons/fa";
import { INTEGRATION_REGISTRY } from "@/lib/integrations/registry";
import { useIntegrations } from "@/context/IntegrationsContext";
import type {
  IntegrationDef, IntegrationCategory, CredentialField,
  ConnectionStatus, SheetType, GoogleSheetConfig, SyncSchedule,
} from "@/lib/integrations/types";

// ─── Shared Styles ────────────────────────────────────────────────────────────

const CARD = "rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30";
const LABEL = "text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider";
const INPUT = "w-full px-3 py-2 rounded-lg text-sm bg-[#FFF9F2] dark:bg-[#1a1208] text-[#3A3A3A] dark:text-[#FFF9F2] border border-[#FFBC80]/50 focus:border-[#FFBC80] outline-none transition-colors placeholder-[#3A3A3A]/35 dark:placeholder-[#FFF9F2]/25";
const BTN_PRIMARY = "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-[#3A3A3A] hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_GHOST = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:bg-[#FFBC80]/10 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors";

// ─── Category Metadata ────────────────────────────────────────────────────────

const CATEGORY_META: Record<IntegrationCategory, { label: string; icon: React.ElementType; description: string }> = {
  advertising:  { label: "Advertising",          icon: Megaphone,      description: "Ad platforms and media networks" },
  ecommerce:    { label: "Ecommerce",             icon: ShoppingBag,    description: "Storefronts and marketplaces" },
  analytics:    { label: "Analytics",             icon: BarChart2,      description: "Analytics and attribution tools" },
  crm:          { label: "CRM & Retention",       icon: Users,          description: "Email, SMS, reviews, and subscriptions" },
  erp:          { label: "ERP",                   icon: Building2,      description: "Backend financial systems" },
  custom:       { label: "Custom Data",           icon: FileSpreadsheet,description: "Google Sheets and manual uploads" },
};

const CATEGORY_ORDER: IntegrationCategory[] = ["advertising", "ecommerce", "analytics", "crm", "erp", "custom"];

// ─── Platform Icon Mapping ────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  meta_ads:           SiMeta,
  google_ads:         SiGoogleads,
  tiktok_ads:         SiTiktok,
  tiktok_shop:        SiTiktok,
  google_analytics:   SiGoogleanalytics,
  shopify:            SiShopify,
  amazon_ads:         FaAmazon,
  amazon_seller:      FaAmazon,
  walmart_connect:    SiWalmart,
  walmart_marketplace:SiWalmart,
  pinterest_ads:      SiPinterest,
};

// ─── Data Capability Labels ───────────────────────────────────────────────────

const CAP_LABELS: Record<string, string> = {
  spend: "Spend", impressions: "Impressions", clicks: "Clicks",
  conversions: "Conversions", roas: "ROAS", ctr: "CTR", cpc: "CPC",
  cpm: "CPM", reach: "Reach", frequency: "Frequency", video_views: "Video Views",
  revenue: "Revenue", orders: "Orders", products: "Products", inventory: "Inventory",
  sessions: "Sessions", users: "Users", pageviews: "Pageviews",
  bounce_rate: "Bounce Rate", engagement: "Engagement",
  subscribers: "Subscribers", open_rate: "Open Rate", click_rate: "Click Rate",
  sms: "SMS", reviews: "Reviews", ratings: "Ratings", subscriptions: "Subscriptions",
  ltv: "LTV", financials: "Financials", journal_entries: "Journal Entries",
  custom_data: "Custom Data",
};

const AUTH_TYPE_LABELS: Record<string, string> = {
  oauth: "OAuth 2.0",
  api_key: "API Key",
  client_credentials: "Client Credentials",
  custom: "Custom Auth",
};

// ─── Google Sheets Config ─────────────────────────────────────────────────────

const SHEET_TYPE_META: Record<SheetType, {
  label: string;
  description: string;
  columns: string[];
  sampleRows: string[][];
}> = {
  sales_by_store: {
    label: "Sales by Store",
    description: "Weekly sales broken down by retail store location.",
    columns: ["Location", "Store Name", "Address", "City", "State", "Zipcode", "Week 2024-01-01", "Week 2024-01-08", "..."],
    sampleRows: [
      ["Northeast", "Target #1234", "100 Main St", "Boston", "MA", "02101", "12500.00", "13200.00"],
      ["Southeast", "Walmart #5678", "200 Oak Ave", "Atlanta", "GA", "30301", "9800.00",  "10100.00"],
    ],
  },
  product_sales: {
    label: "Product Sales",
    description: "Weekly revenue per product / SKU.",
    columns: ["Item Name", "Week 2024-01-01", "Week 2024-01-08", "..."],
    sampleRows: [
      ["Product A 12oz", "28500.00", "31200.00"],
      ["Product B 6-pack", "14300.00", "15800.00"],
    ],
  },
  product_units: {
    label: "Product Units",
    description: "Weekly unit sales per product / SKU.",
    columns: ["Item Name", "Week 2024-01-01", "Week 2024-01-08", "..."],
    sampleRows: [
      ["Product A 12oz", "2850", "3120"],
      ["Product B 6-pack", "1430", "1580"],
    ],
  },
};

// ─── CSV Template Generator ───────────────────────────────────────────────────

function downloadTemplate(type: SheetType) {
  const meta = SHEET_TYPE_META[type];
  const weeks: string[] = [];
  const start = new Date("2024-01-01");
  for (let i = 0; i < 12; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i * 7);
    weeks.push(`Week ${d.toISOString().slice(0, 10)}`);
  }

  const fixedCols = meta.columns.filter((c) => !c.startsWith("Week") && c !== "...");
  const headers  = [...fixedCols, ...weeks];
  const rows     = meta.sampleRows.map((r) => {
    const fixed = r.slice(0, fixedCols.length);
    const vals  = Array(weeks.length).fill("0");
    return [...fixed, ...vals];
  });

  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `monarch_${type}_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Utility Hooks ────────────────────────────────────────────────────────────

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function IntegrationIcon({ def }: { def: Pick<IntegrationDef, "id" | "name" | "iconColor" | "iconBg"> }) {
  const Icon = PLATFORM_ICONS[def.id];
  if (Icon) {
    return (
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: def.iconBg }}>
        <Icon size={20} color={def.iconColor} />
      </div>
    );
  }
  // Letter badge fallback
  const letter = (def.name.replace(/[^A-Z]/g, "")[0] ?? def.name[0]).toUpperCase();
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
      style={{ background: def.iconBg, color: def.iconColor }}
    >
      {letter}
    </div>
  );
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  switch (status) {
    case "connected":
      return <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-medium"><CheckCircle size={13} /> Connected</span>;
    case "syncing":
      return <span className="flex items-center gap-1.5 text-[#FFBC80] text-xs font-medium"><Loader2 size={13} className="animate-spin" /> Syncing…</span>;
    case "error":
      return <span className="flex items-center gap-1.5 text-rose-500 text-xs font-medium"><XCircle size={13} /> Error</span>;
    default:
      return <span className="flex items-center gap-1.5 text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 text-xs font-medium"><Circle size={13} /> Not connected</span>;
  }
}

function AuthBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    oauth: "text-blue-600 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-900/30",
    api_key: "text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-900/30",
    client_credentials: "text-purple-600 dark:text-purple-400 bg-purple-100/70 dark:bg-purple-900/30",
    custom: "text-amber-600 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-900/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${colors[type] ?? colors.custom}`}>
      {AUTH_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function CapBadge({ cap }: { cap: string }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFBC80]/12 text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 border border-[#FFBC80]/20">
      {CAP_LABELS[cap] ?? cap}
    </span>
  );
}

// ─── Credential Form ──────────────────────────────────────────────────────────

function CredentialForm({
  fields,
  values,
  onChange,
  showOAuthCallback = false,
}: {
  fields: CredentialField[];
  values: Record<string, string>;
  onChange: (key: string, val: string) => void;
  showOAuthCallback?: boolean;
}) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const visible = fields.filter(
    (f) => f.group !== "oauth_callback" || showOAuthCallback,
  );

  return (
    <div className="space-y-3">
      {visible.map((f) => {
        const isRevealed = revealed[f.key];
        const inputType = f.type === "password" && !isRevealed ? "password" : f.type === "textarea" ? undefined : "text";

        return (
          <div key={f.key}>
            <label className="flex items-center gap-1 text-xs text-[#3A3A3A]/60 dark:text-[#FFF9F2]/45 mb-1">
              {f.label}
              {f.required && <span className="text-rose-400 ml-0.5">*</span>}
            </label>

            <div className="relative">
              {f.type === "textarea" ? (
                <textarea
                  rows={3}
                  value={values[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className={`${INPUT} font-mono text-xs resize-none`}
                />
              ) : (
                <input
                  type={inputType}
                  value={values[f.key] ?? ""}
                  onChange={(e) => onChange(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className={`${INPUT} ${f.sensitive ? "pr-9 font-mono" : ""}`}
                  autoComplete="off"
                />
              )}
              {f.sensitive && f.type === "password" && (
                <button
                  type="button"
                  onClick={() => setRevealed((r) => ({ ...r, [f.key]: !r[f.key] }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3A3A3A]/35 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors"
                >
                  {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              )}
            </div>

            {f.hint && (
              <p className="flex items-start gap-1 mt-1 text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
                <Info size={9} className="mt-0.5 shrink-0" /> {f.hint}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Connect Modal ────────────────────────────────────────────────────────────

type ModalMode = "connect" | "configure";

function ConnectModal({
  def,
  existingCredentials,
  mode,
  onConnect,
  onClose,
}: {
  def: IntegrationDef;
  existingCredentials?: Record<string, string>;
  mode: ModalMode;
  onConnect: (credentials: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [creds, setCreds] = useState<Record<string, string>>(existingCredentials ?? {});
  const [phase, setPhase] = useState<"idle" | "testing" | "oauth_redirect" | "oauth_complete" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const setField = (key: string, val: string) => setCreds((c) => ({ ...c, [key]: val }));

  const requiredFilled = def.credentials
    .filter((f) => f.required && f.group !== "oauth_callback")
    .every((f) => (creds[f.key] ?? "").trim().length > 0);

  const handleConnect = () => {
    if (def.authType === "oauth") {
      setPhase("oauth_redirect");
      setTimeout(() => {
        setPhase("oauth_complete");
        // Simulate OAuth callback: populate mock tokens
        const mockTokens: Record<string, string> = {
          access_token: `mock_at_${Math.random().toString(36).slice(2, 18)}`,
          refresh_token: `mock_rt_${Math.random().toString(36).slice(2, 18)}`,
        };
        setCreds((c) => ({ ...c, ...mockTokens }));
        setTimeout(() => {
          onConnect({ ...creds, ...mockTokens });
        }, 1000);
      }, 2000);
    } else {
      setPhase("testing");
      setTimeout(() => {
        // Demo: 95% success rate
        if (Math.random() > 0.05) {
          setPhase("success");
          setTimeout(() => onConnect(creds), 800);
        } else {
          setPhase("error");
          setErrorMsg("Connection failed. Please verify your credentials and try again.");
        }
      }, 1200);
    }
  };

  const isOAuth = def.authType === "oauth";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#FFF9F2] dark:bg-[#1a1208] shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#FFBC80]/25 bg-[#FFF9F2] dark:bg-[#1a1208]">
          <div className="flex items-center gap-3">
            <IntegrationIcon def={def} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">{def.name}</h3>
                <AuthBadge type={def.authType} />
                {def.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-[#3A3A3A]"
                    style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
                    {def.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
                {mode === "configure" ? "Update credentials" : "Set up connection"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#3A3A3A]/40 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* OAuth info banner */}
          {isOAuth && (
            <div className="flex gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                Enter your app credentials below, then click <strong>{def.oauthButtonLabel ?? "Connect"}</strong> to authenticate through {def.name.split(" ")[0]}'s secure OAuth consent screen.
                Access and refresh tokens are managed automatically.
              </p>
            </div>
          )}

          {/* Data capabilities */}
          <div>
            <p className={`${LABEL} mb-2`}>Data Collected</p>
            <div className="flex flex-wrap gap-1.5">
              {def.dataCapabilities.map((cap) => <CapBadge key={cap} cap={cap} />)}
            </div>
          </div>

          {/* Credentials */}
          <div>
            <p className={`${LABEL} mb-3`}>Credentials</p>
            <CredentialForm
              fields={def.credentials}
              values={creds}
              onChange={setField}
              showOAuthCallback={mode === "configure"}
            />
          </div>

          {/* Error */}
          {phase === "error" && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <AlertCircle size={13} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 dark:text-rose-300">{errorMsg}</p>
            </div>
          )}

          {/* OAuth phase messages */}
          {phase === "oauth_redirect" && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[#FFBC80]/10 border border-[#FFBC80]/30">
              <Loader2 size={14} className="text-[#FFBC80] animate-spin shrink-0" />
              <p className="text-xs text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">Redirecting to {def.name.split(" ")[0]} authorization…</p>
            </div>
          )}
          {phase === "oauth_complete" && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <Loader2 size={14} className="text-emerald-500 animate-spin shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Authentication successful — completing connection…</p>
            </div>
          )}
          {phase === "success" && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle size={14} className="text-emerald-500 shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Connection verified. Saving…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-3 px-6 py-4 border-t border-[#FFBC80]/25 bg-[#FFF9F2] dark:bg-[#1a1208]">
          {def.docsUrl ? (
            <a href={def.docsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#3A3A3A]/45 hover:text-[#FFBC80] transition-colors">
              <ExternalLink size={11} /> Docs
            </a>
          ) : <div />}

          <div className="flex gap-2">
            <button onClick={onClose} className={BTN_GHOST}>Cancel</button>
            <button
              onClick={handleConnect}
              disabled={!requiredFilled || ["testing", "oauth_redirect", "oauth_complete", "success"].includes(phase)}
              className={BTN_PRIMARY}
              style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
            >
              {phase === "testing" && <Loader2 size={13} className="animate-spin" />}
              {isOAuth
                ? (def.oauthButtonLabel ?? `Connect with ${def.name}`)
                : mode === "configure" ? "Save Credentials" : "Test & Connect"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Integration Card ─────────────────────────────────────────────────────────

function IntegrationCard({ def }: { def: IntegrationDef }) {
  const { connections, connect, disconnect, setSyncing, completeSyncNow, toggleSync, setSchedule } = useIntegrations();
  const conn = connections[def.id];
  const status: ConnectionStatus = conn?.status ?? "disconnected";
  const isConnected = status === "connected" || status === "syncing" || status === "error";

  const [showModal, setShowModal] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("connect");

  const handleSync = () => {
    setSyncing(def.id);
    setTimeout(() => completeSyncNow(def.id), 1800);
  };

  const openConnect = () => { setModalMode("connect"); setShowModal(true); };
  const openConfigure = () => { setModalMode("configure"); setShowModal(true); };

  return (
    <>
      {showModal && (
        <ConnectModal
          def={def}
          existingCredentials={conn?.credentials}
          mode={modalMode}
          onConnect={(creds) => { connect(def.id, creds); setShowModal(false); }}
          onClose={() => setShowModal(false)}
        />
      )}

      <div className={`${CARD} overflow-hidden transition-shadow hover:shadow-sm`}>
        {/* Main row */}
        <div className="flex items-start gap-3.5 p-4">
          <IntegrationIcon def={def} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{def.shortName ?? def.name}</span>
              {def.badge && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-[#3A3A3A]"
                  style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
                  {def.badge}
                </span>
              )}
              <AuthBadge type={def.authType} />
            </div>
            <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 leading-relaxed line-clamp-2">{def.description}</p>

            {/* Capabilities */}
            <div className="flex flex-wrap gap-1 mt-2">
              {def.dataCapabilities.slice(0, 6).map((c) => <CapBadge key={c} cap={c} />)}
              {def.dataCapabilities.length > 6 && (
                <span className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 self-center">+{def.dataCapabilities.length - 6} more</span>
              )}
            </div>
          </div>

          {/* Right: status + primary action */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <StatusDot status={status} />
            {!isConnected ? (
              <button onClick={openConnect} className={BTN_PRIMARY + " text-xs"} style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
                <Plus size={12} /> Connect
              </button>
            ) : (
              <button
                onClick={() => setExpanded((e) => !e)}
                className={BTN_GHOST + " text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30"}
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </div>
        </div>

        {/* Error message */}
        {status === "error" && conn?.errorMessage && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
            <p className="text-xs text-rose-600 dark:text-rose-400">{conn.errorMessage}</p>
          </div>
        )}

        {/* Expanded management row */}
        {isConnected && expanded && (
          <div className="border-t border-[#FFBC80]/15 px-4 py-3 space-y-3">
            {/* Sync status + schedule */}
            <div className="flex items-center justify-between gap-3 text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">
              <div className="flex items-center gap-3">
                <span>Last sync: <strong className="text-[#3A3A3A] dark:text-[#FFF9F2]">{relativeTime(conn?.lastSyncAt ?? null)}</strong></span>
                <span>Schedule:
                  <select
                    value={conn?.syncSchedule ?? def.defaultSyncSchedule}
                    onChange={(e) => setSchedule(def.id, e.target.value as SyncSchedule)}
                    className="ml-1 text-xs bg-transparent text-[#3A3A3A] dark:text-[#FFF9F2] outline-none cursor-pointer"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </span>
              </div>
              {/* Sync enabled toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer">
                <span className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Auto-sync</span>
                <div
                  onClick={() => toggleSync(def.id)}
                  className={`relative inline-flex h-4 w-7 rounded-full transition-colors cursor-pointer ${conn?.syncEnabled ? "bg-[#FFBC80]" : "bg-[#3A3A3A]/20 dark:bg-[#FFF9F2]/15"}`}
                >
                  <span
                    className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform"
                    style={{ transform: conn?.syncEnabled ? "translateX(14px)" : "translateX(2px)" }}
                  />
                </div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button onClick={handleSync} disabled={status === "syncing"} className={BTN_GHOST}>
                <RefreshCw size={11} className={status === "syncing" ? "animate-spin" : ""} />
                Sync Now
              </button>
              <button onClick={openConfigure} className={BTN_GHOST}>
                <Settings size={11} /> Configure
              </button>
              <button
                onClick={() => disconnect(def.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 hover:text-rose-500 hover:bg-rose-500/10 transition-colors ml-auto"
              >
                <Trash2 size={11} /> Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Google Sheet Card ────────────────────────────────────────────────────────

function SheetCard({ sheet }: { sheet: GoogleSheetConfig }) {
  const { removeSheet, updateSheet, setSyncingSheet, completeSyncSheet } = useIntegrations();
  const meta = SHEET_TYPE_META[sheet.sheetType];

  const handleSync = () => {
    setSyncingSheet(sheet.id);
    setTimeout(() => completeSyncSheet(sheet.id), 1800);
  };

  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#0F9D58]/10">
          <SiGooglesheets size={18} color="#0F9D58" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] truncate">{sheet.name}</span>
            <StatusDot status={sheet.status} />
          </div>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">{meta.label} · {sheet.spreadsheetId.slice(0, 20)}…</p>
          <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-0.5">
            Sheet: "{sheet.sheetName}" · Last sync: {relativeTime(sheet.lastSyncAt)}
          </p>
        </div>
      </div>

      {sheet.errorMessage && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
          <p className="text-xs text-rose-600 dark:text-rose-400">{sheet.errorMessage}</p>
        </div>
      )}

      <div className="flex items-center gap-1.5 mt-3">
        <button onClick={handleSync} disabled={sheet.status === "syncing"} className={BTN_GHOST}>
          <RefreshCw size={11} className={sheet.status === "syncing" ? "animate-spin" : ""} />
          Sync Now
        </button>
        <label className="flex items-center gap-1.5 ml-2 cursor-pointer">
          <span className="text-[11px] text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">Auto-sync</span>
          <div
            onClick={() => updateSheet(sheet.id, { syncEnabled: !sheet.syncEnabled })}
            className={`relative inline-flex h-4 w-7 rounded-full transition-colors cursor-pointer ${sheet.syncEnabled ? "bg-[#FFBC80]" : "bg-[#3A3A3A]/20 dark:bg-[#FFF9F2]/15"}`}
          >
            <span
              className="absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform"
              style={{ transform: sheet.syncEnabled ? "translateX(14px)" : "translateX(2px)" }}
            />
          </div>
        </label>
        <button
          onClick={() => removeSheet(sheet.id)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 hover:text-rose-500 hover:bg-rose-500/10 transition-colors ml-auto"
        >
          <Trash2 size={11} /> Remove
        </button>
      </div>
    </div>
  );
}

// ─── Google Sheet Modal ───────────────────────────────────────────────────────

interface SheetForm {
  name: string;
  sheetType: SheetType;
  spreadsheetId: string;
  sheetName: string;
  serviceAccountEmail: string;
  privateKey: string;
  syncEnabled: boolean;
}

const DEFAULT_SHEET_FORM: SheetForm = {
  name: "",
  sheetType: "sales_by_store",
  spreadsheetId: "",
  sheetName: "",
  serviceAccountEmail: "",
  privateKey: "",
  syncEnabled: true,
};

function AddSheetModal({ onAdd, onClose }: { onAdd: (data: SheetForm) => void; onClose: () => void }) {
  const [form, setForm] = useState<SheetForm>(DEFAULT_SHEET_FORM);
  const [phase, setPhase] = useState<"idle" | "validating" | "success" | "error">("idle");
  const [showKey, setShowKey] = useState(false);

  const set = <K extends keyof SheetForm>(key: K, val: SheetForm[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  const isValid = form.name.trim() && form.spreadsheetId.trim() && form.sheetName.trim() &&
    form.serviceAccountEmail.includes("@") && form.privateKey.trim().length > 10;

  const handleConnect = () => {
    setPhase("validating");
    setTimeout(() => {
      if (Math.random() > 0.05) {
        setPhase("success");
        setTimeout(() => onAdd(form), 800);
      } else {
        setPhase("error");
      }
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#FFF9F2] dark:bg-[#1a1208] shadow-2xl">

        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-[#FFBC80]/25 bg-[#FFF9F2] dark:bg-[#1a1208]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#0F9D58]/10">
              <SiGooglesheets size={18} color="#0F9D58" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Add Google Sheet</h3>
              <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">Configure a data dump via Service Account</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#3A3A3A]/40 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors"><X size={16} /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Custom name */}
          <div>
            <label className={`block ${LABEL} mb-2`}>Dataset Label <span className="text-rose-400">*</span></label>
            <input
              type="text"
              placeholder="e.g. Q2 Store Sales, Weekly Units"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={INPUT}
            />
          </div>

          {/* Sheet type */}
          <div>
            <label className={`block ${LABEL} mb-3`}>Data Dump Type <span className="text-rose-400">*</span></label>
            <div className="space-y-2">
              {(Object.entries(SHEET_TYPE_META) as [SheetType, typeof SHEET_TYPE_META[SheetType]][]).map(([type, meta]) => (
                <label key={type} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  form.sheetType === type
                    ? "border-[#FFBC80] bg-[#FFBC80]/8"
                    : "border-[#FFBC80]/25 hover:border-[#FFBC80]/50"
                }`}>
                  <input
                    type="radio"
                    name="sheetType"
                    value={type}
                    checked={form.sheetType === type}
                    onChange={() => set("sheetType", type)}
                    className="mt-0.5 accent-[#FFBC80]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{meta.label}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); downloadTemplate(type); }}
                        className="flex items-center gap-1 text-[10px] text-[#3A3A3A]/40 hover:text-[#FFBC80] transition-colors"
                      >
                        <Download size={10} /> Template
                      </button>
                    </div>
                    <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">{meta.description}</p>
                    <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-1 font-mono">
                      Columns: {meta.columns.slice(0, 5).join(", ")}{meta.columns.length > 5 ? `, +${meta.columns.length - 5} more…` : ""}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Sheet identifiers */}
          <div>
            <label className={`block ${LABEL} mb-3`}>Sheet Details</label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-1">
                  Spreadsheet ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                  value={form.spreadsheetId}
                  onChange={(e) => set("spreadsheetId", e.target.value)}
                  className={`${INPUT} font-mono text-xs`}
                />
                <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-1">
                  Found in the Google Sheets URL: docs.google.com/spreadsheets/d/<strong>ID</strong>/edit
                </p>
              </div>
              <div>
                <label className="block text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-1">
                  Sheet Name (Tab) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Sheet1"
                  value={form.sheetName}
                  onChange={(e) => set("sheetName", e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>
          </div>

          {/* Service account */}
          <div>
            <label className={`block ${LABEL} mb-3`}>Service Account Credentials</label>
            <div className="px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800 mb-3">
              <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                <strong>Required:</strong> Create a Service Account in Google Cloud Console, share your spreadsheet with the service account email, and download its JSON key file.
              </p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-1">
                  Service Account Email <span className="text-rose-400">*</span>
                </label>
                <input
                  type="email"
                  placeholder="my-account@project.iam.gserviceaccount.com"
                  value={form.serviceAccountEmail}
                  onChange={(e) => set("serviceAccountEmail", e.target.value)}
                  className={INPUT}
                />
              </div>
              <div>
                <label className="flex items-center justify-between text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-1">
                  <span>Private Key <span className="text-rose-400">*</span></span>
                  <button type="button" onClick={() => setShowKey((v) => !v)} className="flex items-center gap-1 text-[10px] text-[#3A3A3A]/40 hover:text-[#FFBC80] transition-colors">
                    {showKey ? <EyeOff size={10} /> : <Eye size={10} />} {showKey ? "Hide" : "Show"}
                  </button>
                </label>
                <textarea
                  rows={4}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;MIIEpAIBAAKCAQEA...&#10;-----END RSA PRIVATE KEY-----"
                  value={form.privateKey}
                  onChange={(e) => set("privateKey", e.target.value)}
                  className={`${INPUT} font-mono text-xs resize-none ${!showKey ? "text-security-disc" : ""}`}
                  style={!showKey ? { WebkitTextSecurity: "disc" } as React.CSSProperties : {}}
                />
                <p className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-1">
                  Paste the "private_key" field from your downloaded JSON key file.
                </p>
              </div>
            </div>
          </div>

          {/* Phase feedback */}
          {phase === "validating" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-[#FFBC80]/10 border border-[#FFBC80]/30">
              <Loader2 size={13} className="text-[#FFBC80] animate-spin" />
              <p className="text-xs text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">Validating sheet structure and permissions…</p>
            </div>
          )}
          {phase === "success" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle size={13} className="text-emerald-500" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Sheet validated. Adding dataset…</p>
            </div>
          )}
          {phase === "error" && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
              <XCircle size={13} className="text-rose-500" />
              <p className="text-xs text-rose-700 dark:text-rose-300">Could not access the sheet. Verify the spreadsheet ID, sheet name, and that the service account has been granted access.</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-[#FFBC80]/25 bg-[#FFF9F2] dark:bg-[#1a1208]">
          <button onClick={onClose} className={BTN_GHOST}>Cancel</button>
          <button
            onClick={handleConnect}
            disabled={!isValid || ["validating", "success"].includes(phase)}
            className={BTN_PRIMARY}
            style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
          >
            {phase === "validating" ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            Validate & Connect
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

type FilterCategory = IntegrationCategory | "all";

const CONNECTED_STATS_LABEL: Record<string, string> = {
  connected: "Connected",
  disconnected: "Not Connected",
  error: "Error",
  syncing: "Syncing",
};

export default function IntegrationsPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { connections, sheets, addSheet } = useIntegrations();
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");
  const [search, setSearch] = useState("");
  const [showSheetModal, setShowSheetModal] = useState(false);

  // Connected count for header
  const connectedCount = INTEGRATION_REGISTRY.filter(
    (d) => connections[d.id]?.status === "connected" || connections[d.id]?.status === "syncing",
  ).length;

  const filtered = useMemo(() => {
    let list = INTEGRATION_REGISTRY;
    if (activeCategory !== "all") list = list.filter((d) => d.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q),
      );
    }
    return list;
  }, [activeCategory, search]);

  // Group by category for "all" view
  const grouped = useMemo(() => {
    if (activeCategory !== "all") return null;
    const map = new Map<IntegrationCategory, IntegrationDef[]>();
    for (const def of filtered) {
      const arr = map.get(def.category) ?? [];
      arr.push(def);
      map.set(def.category, arr);
    }
    return map;
  }, [activeCategory, filtered]);

  return (
    <>
      {showSheetModal && (
        <AddSheetModal
          onAdd={(data) => {
            addSheet({ ...data });
            setShowSheetModal(false);
          }}
          onClose={() => setShowSheetModal(false)}
        />
      )}

      <div className="space-y-5">
        {/* Header */}
        <div>
          <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Integrations</h2>
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">
            Connect external platforms to power your analytics pipeline. {connectedCount > 0 && `${connectedCount} active connection${connectedCount !== 1 ? "s" : ""}.`}
          </p>
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", ...CATEGORY_ORDER] as FilterCategory[]).map((cat) => {
            const meta = cat === "all" ? null : CATEGORY_META[cat];
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                style={
                  active
                    ? { background: "linear-gradient(135deg, #FFBC80, #FFE29A)", borderColor: "transparent", color: "#3A3A3A" }
                    : { borderColor: "rgba(255,188,128,0.3)", color: "rgba(58,58,58,0.55)" }
                }
              >
                {meta && <meta.icon size={11} />}
                {cat === "all" ? "All" : meta?.label}
                <span className={`ml-0.5 px-1 py-0 rounded-full text-[9px] font-bold ${active ? "bg-[#3A3A3A]/15" : "bg-[#FFBC80]/25"}`}>
                  {cat === "all"
                    ? INTEGRATION_REGISTRY.length
                    : INTEGRATION_REGISTRY.filter((d) => d.category === cat).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search integrations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${INPUT} pl-8`}
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3A3A3A]/30 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Integration list */}
        {filtered.length === 0 ? (
          <div className={`${CARD} p-10 flex flex-col items-center gap-2`}>
            <p className="text-sm text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">No integrations match your search.</p>
          </div>
        ) : grouped ? (
          // All view — grouped by category
          CATEGORY_ORDER.filter((cat) => grouped.has(cat)).map((cat) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                {(() => { const Icon = CATEGORY_META[cat].icon; return <Icon size={13} className="text-[#FFBC80]" />; })()}
                <p className={LABEL}>{CATEGORY_META[cat].label}</p>
                <span className="text-[10px] text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25">{grouped.get(cat)?.length}</span>
              </div>
              <div className="space-y-2">
                {grouped.get(cat)!.map((def) => (
                  <IntegrationCard key={def.id} def={def} />
                ))}
              </div>
            </div>
          ))
        ) : (
          // Single category view
          <div className="space-y-2">
            {filtered.map((def) => <IntegrationCard key={def.id} def={def} />)}
          </div>
        )}

        {/* ── Google Sheets Section ── */}
        <div className="pt-2 border-t border-[#FFBC80]/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SiGooglesheets size={15} color="#0F9D58" />
              <p className={LABEL}>Google Sheets Data Dumps</p>
            </div>
            {!readOnly && (
              <button
                onClick={() => setShowSheetModal(true)}
                className={BTN_PRIMARY + " text-xs"}
                style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
              >
                <Plus size={12} /> Add Sheet
              </button>
            )}
          </div>

          <div className="px-4 py-3 rounded-xl bg-[#FFBC80]/5 border border-[#FFBC80]/20 mb-4">
            <p className="text-xs text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 leading-relaxed">
              Ingest structured data from Google Sheets using a Service Account. Supports <strong>Sales by Store</strong>, <strong>Product Sales</strong>, and <strong>Product Units</strong> formats with dynamic weekly columns.
              Download a CSV template to see the expected structure.
            </p>
          </div>

          {sheets.length === 0 ? (
            <div className={`${CARD} p-8 flex flex-col items-center gap-3`}>
              <FileSpreadsheet size={24} className="text-[#FFBC80]/50" />
              <div className="text-center">
                <p className="text-sm font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/35">No sheets connected</p>
                <p className="text-xs text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 mt-0.5">Add a Google Sheet to start ingesting structured data dumps.</p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => setShowSheetModal(true)}
                  className={BTN_PRIMARY + " mt-1 text-xs"}
                  style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
                >
                  <Plus size={12} /> Add your first sheet
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {sheets.map((sh) => <SheetCard key={sh.id} sheet={sh} />)}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
