import { useState, useEffect, useCallback } from "react";
import {
  SiShopify, SiGoogleads, SiMeta, SiTiktok, SiGoogleanalytics,
  SiGooglesheets, SiPinterest, SiWalmart,
} from "react-icons/si";
import {
  CheckCircle2, XCircle, Loader2, Plug2, Trash2, Pencil, Eye, EyeOff,
  Plus, ShoppingBag, Target, Zap, ChartBar, Link2, X, AlertCircle, RefreshCw,
} from "lucide-react";
import { API_BASE } from "@/lib/apiBase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldDef {
  key:          string;
  label:        string;
  placeholder?: string;
  secret?:      boolean;
}

interface ProviderDef {
  id:           string;
  name:         string;
  desc:         string;
  Icon:         React.ComponentType<{ size?: number; color?: string; className?: string }>;
  color:        string;
  section:      string;
  authMode:     "oauth_shopify" | "oauth" | "api_key";
  oauthLabel?:  string;
  fields?:      FieldDef[];
}

interface IntegrationStatus {
  provider:    string;
  connected:   boolean;
  shopDomain:  string | null;
  savedFields: string[];
  status:      string | null;
}

// ─── Provider definitions ──────────────────────────────────────────────────────

const PROVIDERS: ProviderDef[] = [
  // eCommerce
  {
    id: "shopify", name: "Shopify", desc: "Orders, revenue & attribution",
    Icon: SiShopify, color: "#96BF48", section: "eCommerce",
    authMode: "oauth_shopify", oauthLabel: "Connect Shopify",
  },
  {
    id: "tiktok_shop", name: "TikTok Shop", desc: "TikTok storefront sales data",
    Icon: SiTiktok, color: "#010101", section: "eCommerce",
    authMode: "oauth", oauthLabel: "Connect TikTok Shop",
    fields: [
      { key: "accessToken", label: "Access Token", secret: true, placeholder: "Enter access token" },
      { key: "shopId", label: "Shop ID", placeholder: "Enter shop ID" },
    ],
  },
  {
    id: "walmart", name: "Walmart Marketplace", desc: "Walmart seller performance",
    Icon: SiWalmart, color: "#0071CE", section: "eCommerce",
    authMode: "oauth", oauthLabel: "Connect Walmart",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "Enter client ID" },
      { key: "clientSecret", label: "Client Secret", secret: true, placeholder: "Enter client secret" },
    ],
  },
  {
    id: "target_roundel", name: "Target Roundel", desc: "Target media network data",
    Icon: Target, color: "#CC0000", section: "eCommerce",
    authMode: "oauth", oauthLabel: "Connect Target Roundel",
    fields: [
      { key: "apiKey", label: "API Key", secret: true, placeholder: "Enter API key" },
      { key: "advertiserId", label: "Advertiser ID", placeholder: "Enter advertiser ID" },
    ],
  },
  // Advertising
  {
    id: "google_ads", name: "Google Ads", desc: "Search, display & shopping ads",
    Icon: SiGoogleads, color: "#4285F4", section: "Advertising",
    authMode: "oauth", oauthLabel: "Connect Google Ads",
    fields: [
      { key: "developerToken", label: "Developer Token", secret: true, placeholder: "xxxx" },
      { key: "clientId", label: "Client ID", placeholder: "xxxx.apps.googleusercontent.com" },
      { key: "clientSecret", label: "Client Secret", secret: true, placeholder: "GOCSPX-..." },
      { key: "refreshToken", label: "Refresh Token", secret: true, placeholder: "1//0..." },
      { key: "customerId", label: "Customer ID", placeholder: "123-456-7890" },
    ],
  },
  {
    id: "meta", name: "Meta Ads", desc: "Facebook & Instagram advertising",
    Icon: SiMeta, color: "#0082FB", section: "Advertising",
    authMode: "oauth", oauthLabel: "Connect Meta Ads",
    fields: [
      { key: "appId", label: "App ID", placeholder: "Enter App ID" },
      { key: "appSecret", label: "App Secret", secret: true, placeholder: "Enter App Secret" },
      { key: "accessToken", label: "Access Token", secret: true, placeholder: "Enter access token" },
      { key: "adAccountId", label: "Ad Account ID", placeholder: "act_xxxx" },
    ],
  },
  {
    id: "tiktok", name: "TikTok Ads", desc: "TikTok in-feed & spark ads",
    Icon: SiTiktok, color: "#010101", section: "Advertising",
    authMode: "oauth", oauthLabel: "Connect TikTok Ads",
    fields: [
      { key: "accessToken", label: "Access Token", secret: true, placeholder: "Enter access token" },
      { key: "advertiserId", label: "Advertiser ID", placeholder: "Enter advertiser ID" },
    ],
  },
  {
    id: "pinterest", name: "Pinterest Ads", desc: "Pinterest campaign performance",
    Icon: SiPinterest, color: "#E60023", section: "Advertising",
    authMode: "oauth", oauthLabel: "Connect Pinterest Ads",
    fields: [
      { key: "accessToken", label: "Access Token", secret: true, placeholder: "Enter access token" },
      { key: "adAccountId", label: "Ad Account ID", placeholder: "Enter ad account ID" },
    ],
  },
  {
    id: "criteo", name: "Criteo", desc: "Retargeting & commerce media",
    Icon: Zap, color: "#F76B1C", section: "Advertising", authMode: "api_key",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "Enter client ID" },
      { key: "clientSecret", label: "Client Secret", secret: true, placeholder: "Enter client secret" },
    ],
  },
  {
    id: "applovin", name: "Axon by AppLovin", desc: "Mobile & CTV advertising",
    Icon: ChartBar, color: "#E8563A", section: "Advertising",
    authMode: "oauth", oauthLabel: "Connect Axon",
    fields: [
      { key: "apiKey", label: "API Key", secret: true, placeholder: "Enter API key" },
    ],
  },
  // Analytics
  {
    id: "google_analytics", name: "Google Analytics", desc: "Traffic, sessions & behavior",
    Icon: SiGoogleanalytics, color: "#E37400", section: "Analytics",
    authMode: "oauth", oauthLabel: "Connect Google Analytics",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "xxxx.apps.googleusercontent.com" },
      { key: "clientSecret", label: "Client Secret", secret: true, placeholder: "Enter client secret" },
      { key: "propertyId", label: "Property ID", placeholder: "GA4 property ID" },
    ],
  },
  // Attribution & Insights
  {
    id: "alloy_ai", name: "Alloy.ai", desc: "Supply chain & demand forecasting",
    Icon: Link2, color: "#6366F1", section: "Attribution & Insights", authMode: "api_key",
    fields: [{ key: "apiKey", label: "API Key", secret: true, placeholder: "Enter API key" }],
  },
  {
    id: "pattern_predict", name: "Pattern Predict", desc: "eCommerce intelligence & analytics",
    Icon: ChartBar, color: "#8B5CF6", section: "Attribution & Insights", authMode: "api_key",
    fields: [
      { key: "clientId", label: "Client ID", placeholder: "Enter client ID" },
      { key: "apiKey", label: "API Key", secret: true, placeholder: "Enter API key" },
    ],
  },
  // Retention
  {
    id: "stay_ai", name: "Stay.AI", desc: "Subscription retention analytics",
    Icon: ShoppingBag, color: "#10B981", section: "Retention", authMode: "api_key",
    fields: [
      { key: "apiKey", label: "API Key", secret: true, placeholder: "Enter API key" },
      { key: "storeId", label: "Store ID", placeholder: "Enter store ID" },
    ],
  },
  {
    id: "yotpo", name: "Yotpo", desc: "Reviews, loyalty & SMS",
    Icon: Plug2, color: "#3B82F6", section: "Retention", authMode: "api_key",
    fields: [
      { key: "appKey", label: "App Key", placeholder: "Enter app key" },
      { key: "secretKey", label: "Secret Key", secret: true, placeholder: "Enter secret key" },
    ],
  },
];

const SECTIONS = ["eCommerce", "Advertising", "Analytics", "Attribution & Insights", "Retention"];

// ─── ShopifyModal ─────────────────────────────────────────────────────────────

function ShopifyModal({ onClose }: { onClose: () => void }) {
  const [shop, setShop] = useState("");
  const [error, setError] = useState("");

  const go = () => {
    const s = shop.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!s) { setError("Enter your store URL."); return; }
    window.location.href = `${API_BASE}/api/integrations/shopify/connect?shop=${encodeURIComponent(s)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl p-6 monarch-card-settings">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <SiShopify size={16} color="#96BF48" />
            <span className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Connect Shopify</span>
          </div>
          <button onClick={onClose} className="opacity-40 hover:opacity-80 transition-opacity text-[#3A3A3A] dark:text-[#FFF9F2]"><X size={16} /></button>
        </div>
        <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-4">You'll be redirected to Shopify to approve access and then returned here.</p>
        <input
          autoFocus value={shop} onChange={e => { setShop(e.target.value); setError(""); }}
          onKeyDown={e => e.key === "Enter" && go()}
          placeholder="mystore.myshopify.com"
          className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#FFBC80]/40 bg-white dark:bg-[#2e2010] text-[#3A3A3A] dark:text-[#FFF9F2] placeholder-[#3A3A3A]/30 dark:placeholder-[#FFF9F2]/25 focus:outline-none focus:ring-2 focus:ring-[#FFBC80]/60 transition-all"
        />
        {error && <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1"><AlertCircle size={11} />{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#3A3A3A]/10 dark:border-[#FFF9F2]/10 text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:bg-[#3A3A3A]/5 dark:hover:bg-[#FFF9F2]/5 transition-colors">Cancel</button>
          <button onClick={go} className="flex-1 py-2 rounded-lg text-xs font-semibold text-[#3A3A3A] hover:opacity-85 transition-opacity" style={{ background: "linear-gradient(135deg,#FFBC80,#FFE29A)" }}>Authorize with Shopify</button>
        </div>
      </div>
    </div>
  );
}

// ─── Integration Card ─────────────────────────────────────────────────────────

function IntegrationCard({
  provider, status, onSaved, onDisconnected,
}: {
  provider:       ProviderDef;
  status?:        IntegrationStatus;
  onSaved:        (p: string, fields: string[]) => void;
  onDisconnected: (p: string) => void;
}) {
  const connected = status?.connected ?? false;
  const [editing,          setEditing]          = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [removing,         setRemoving]         = useState(false);
  const [showShopify,      setShowShopify]      = useState(false);
  const [confirm,          setConfirm]          = useState(false);
  const [err,              setErr]              = useState("");
  const [vals,             setVals]             = useState<Record<string, string>>({});
  const [revealed,         setRevealed]         = useState<Record<string, boolean>>({});
  const [oauthRedirecting, setOauthRedirecting] = useState(false);

  const setVal = (k: string, v: string) => setVals(p => ({ ...p, [k]: v }));
  const toggleReveal = (k: string) => setRevealed(p => ({ ...p, [k]: !p[k] }));

  const isOAuth  = provider.authMode === "oauth" || provider.authMode === "oauth_shopify";
  const hasFields = Boolean(provider.fields?.length);

  const handleOAuth = () => {
    if (provider.authMode === "oauth_shopify") {
      setShowShopify(true);
    } else {
      setOauthRedirecting(true);
      window.location.href = `${API_BASE}/api/integrations/${provider.id}/connect`;
    }
  };

  const handleSave = async () => {
    const payload: Record<string, string> = {};
    (provider.fields ?? []).forEach(f => { if (vals[f.key]?.trim()) payload[f.key] = vals[f.key].trim(); });
    if (!Object.keys(payload).length) { setErr("Enter at least one field."); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${provider.id}/credentials`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Save failed."); return; }
      onSaved(provider.id, Object.keys(payload));
      setEditing(false); setVals({});
    } catch { setErr("Network error."); }
    finally { setSaving(false); }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await fetch(`${API_BASE}/api/integrations/${provider.id}`, { method: "DELETE", credentials: "include" });
      onDisconnected(provider.id);
    } finally { setRemoving(false); setConfirm(false); }
  };

  // Show the credential form when: (not connected and has fields) OR (connected and editing)
  const showForm = hasFields && (!connected || editing);
  const { Icon, color } = provider;

  return (
    <>
      {showShopify && <ShopifyModal onClose={() => setShowShopify(false)} />}

      <div className="rounded-xl p-4 monarch-card-settings flex flex-col gap-3">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-gray-50 dark:bg-[#2e2010]">
              <Icon size={18} color={color} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] leading-tight">{provider.name}</p>
              <p className="text-[11px] text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5 leading-snug">{provider.desc}</p>
            </div>
          </div>
          <div className="shrink-0">
            {connected ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-900/25 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40">
                <CheckCircle2 size={10} />Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#3A3A3A]/6 dark:bg-[#FFF9F2]/6 text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 border border-[#3A3A3A]/10 dark:border-[#FFF9F2]/10">
                <XCircle size={10} />Not connected
              </span>
            )}
          </div>
        </div>

        {/* ── Connected Summary ───────────────────────────── */}
        {connected && !editing && (
          <div>
            {hasFields && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
                {(provider.fields ?? []).map(f => {
                  const saved = status?.savedFields?.includes(f.key);
                  return (
                    <div key={f.key} className="flex items-center gap-1">
                      <span className="text-[10px] text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">{f.label}</span>
                      <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${saved ? "text-emerald-500" : "text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25"}`}>
                        <CheckCircle2 size={9} />{saved ? "Saved" : "Not set"}
                      </span>
                    </div>
                  );
                })}
                {provider.authMode === "oauth_shopify" && status?.shopDomain && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">Store</span>
                    <span className="text-[10px] font-semibold text-emerald-500">{status.shopDomain}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {isOAuth ? (
                <button
                  onClick={handleOAuth}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-[#3A3A3A] hover:opacity-85 transition-opacity"
                  style={{ background: "linear-gradient(135deg,#FFBC80,#FFE29A)" }}
                >
                  <RefreshCw size={11} />Reconnect
                </button>
              ) : (
                <button
                  onClick={() => { setEditing(true); setErr(""); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[#3A3A3A]/12 dark:border-[#FFF9F2]/12 text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:border-[#FFBC80]/50 transition-colors"
                >
                  <Pencil size={11} />Edit
                </button>
              )}
              {!confirm ? (
                <button
                  onClick={() => setConfirm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[#3A3A3A]/12 dark:border-[#FFF9F2]/12 text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:border-red-400/50 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={11} />Disconnect
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Are you sure?</span>
                  <button
                    onClick={handleRemove}
                    disabled={removing}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-red-500 hover:bg-red-600 text-white disabled:opacity-60 transition-colors flex items-center gap-1"
                  >
                    {removing ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}Yes
                  </button>
                  <button
                    onClick={() => setConfirm(false)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-[#3A3A3A]/10 dark:border-[#FFF9F2]/10 text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:bg-[#3A3A3A]/5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Primary OAuth Button (not connected) ────────── */}
        {!connected && isOAuth && (
          <button
            onClick={handleOAuth}
            disabled={oauthRedirecting}
            className="w-full py-2.5 rounded-lg text-xs font-semibold text-[#3A3A3A] hover:opacity-85 disabled:opacity-60 transition-opacity flex items-center justify-center gap-1.5"
            style={{ background: "linear-gradient(135deg,#FFBC80,#FFE29A)" }}
          >
            {oauthRedirecting ? (
              <><Loader2 size={13} className="animate-spin" />Redirecting…</>
            ) : (
              <><Icon size={13} color={color} />{provider.oauthLabel ?? `Connect ${provider.name}`}</>
            )}
          </button>
        )}

        {/* ── Divider (OAuth providers with manual fallback) ── */}
        {!connected && isOAuth && hasFields && (
          <div className="flex items-center gap-3 py-0.5">
            <div className="flex-1 h-px bg-[#3A3A3A]/10 dark:bg-[#FFF9F2]/10" />
            <span className="text-[9px] font-semibold text-[#3A3A3A]/35 dark:text-[#FFF9F2]/28 uppercase tracking-widest whitespace-nowrap">
              or enter credentials manually
            </span>
            <div className="flex-1 h-px bg-[#3A3A3A]/10 dark:bg-[#FFF9F2]/10" />
          </div>
        )}

        {/* ── Credential Form ─────────────────────────────── */}
        {showForm && (
          <div className="space-y-2.5">
            {(provider.fields ?? []).map(f => (
              <div key={f.key}>
                <label className="block text-[10px] font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-1">
                  {f.label}
                </label>
                <div className="relative">
                  <input
                    type={f.secret && !revealed[f.key] ? "password" : "text"}
                    value={vals[f.key] ?? ""}
                    onChange={e => { setVal(f.key, e.target.value); setErr(""); }}
                    placeholder={f.placeholder}
                    autoComplete="new-password"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#FFBC80]/35 bg-white dark:bg-[#2e2010] text-[#3A3A3A] dark:text-[#FFF9F2] placeholder-[#3A3A3A]/25 dark:placeholder-[#FFF9F2]/20 focus:outline-none focus:ring-2 focus:ring-[#FFBC80]/50 transition-all font-mono"
                    style={{ paddingRight: f.secret ? "2.25rem" : undefined }}
                  />
                  {f.secret && (
                    <button
                      type="button"
                      onClick={() => toggleReveal(f.key)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25 hover:text-[#3A3A3A]/60 dark:hover:text-[#FFF9F2]/55"
                    >
                      {revealed[f.key] ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {err && (
              <p className="text-[11px] text-red-500 flex items-center gap-1">
                <AlertCircle size={11} />{err}
              </p>
            )}

            <div className="flex gap-2 pt-0.5">
              {editing && (
                <button
                  onClick={() => { setEditing(false); setVals({}); setErr(""); }}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#3A3A3A]/10 dark:border-[#FFF9F2]/10 text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:bg-[#3A3A3A]/5 transition-colors"
                >
                  Cancel
                </button>
              )}
              {/* Primary gradient for manual-only; subdued outline for OAuth fallback */}
              {(!isOAuth || editing) ? (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold text-[#3A3A3A] hover:opacity-85 disabled:opacity-60 transition-opacity flex items-center justify-center gap-1.5"
                  style={{ background: "linear-gradient(135deg,#FFBC80,#FFE29A)" }}
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                  {editing ? "Update Credentials" : "Save & Connect"}
                </button>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#3A3A3A]/15 dark:border-[#FFF9F2]/15 text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 hover:bg-[#FFBC80]/10 hover:border-[#FFBC80]/40 disabled:opacity-60 transition-all flex items-center justify-center gap-1.5"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                  Save & Connect
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Google Sheets Section ────────────────────────────────────────────────────

interface Sheet { id: string; name: string; url: string; tab?: string; }

function GoogleSheetsSection({ initialSheets }: { initialSheets: Sheet[] }) {
  const [sheets,   setSheets]   = useState<Sheet[]>(initialSheets);
  const [adding,   setAdding]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [name,     setName]     = useState("");
  const [url,      setUrl]      = useState("");
  const [tab,      setTab]      = useState("");
  const [err,      setErr]      = useState("");

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) { setErr("Sheet name and URL are required."); return; }
    setSaving(true); setErr("");
    try {
      const res = await fetch(`${API_BASE}/api/integrations/google_sheets/sheets`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), tab: tab.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Failed to add sheet."); return; }
      setSheets(data.sheets);
      setAdding(false); setName(""); setUrl(""); setTab("");
    } catch { setErr("Network error."); }
    finally { setSaving(false); }
  };

  const handleRemove = async (id: string) => {
    setRemoving(id);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/google_sheets/sheets/${id}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (res.ok) setSheets(data.sheets ?? []);
    } finally { setRemoving(null); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Data Exports</h3>
          <p className="text-[11px] text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">Google Sheets — add as many sheets as needed</p>
        </div>
        <button
          onClick={() => { setAdding(true); setErr(""); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#3A3A3A] hover:opacity-85 transition-opacity"
          style={{ background: "linear-gradient(135deg,#FFBC80,#FFE29A)" }}
        >
          <Plus size={13} />Add Sheet
        </button>
      </div>

      <div className="space-y-2">
        {sheets.length === 0 && !adding && (
          <div className="rounded-xl p-5 monarch-card-settings text-center">
            <SiGooglesheets size={24} color="#34A853" className="mx-auto mb-2 opacity-60" />
            <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">No sheets connected yet. Click "Add Sheet" to link a Google Sheet.</p>
          </div>
        )}

        {sheets.map(s => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3 rounded-xl monarch-card-settings">
            <SiGooglesheets size={16} color="#34A853" className="shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] truncate">{s.name}</p>
              <p className="text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 truncate">{s.url}{s.tab ? ` · ${s.tab}` : ""}</p>
            </div>
            <button
              onClick={() => handleRemove(s.id)}
              disabled={removing === s.id}
              className="shrink-0 p-1.5 rounded-lg text-[#3A3A3A]/35 dark:text-[#FFF9F2]/30 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              {removing === s.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            </button>
          </div>
        ))}

        {adding && (
          <div className="rounded-xl p-4 monarch-card-settings space-y-2.5">
            <p className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-1">New Google Sheet</p>
            <div>
              <label className="block text-[10px] font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-1">Sheet Name</label>
              <input autoFocus value={name} onChange={e => { setName(e.target.value); setErr(""); }} placeholder="e.g. Sales Data Q1" className="w-full px-3 py-2 text-xs rounded-lg border border-[#FFBC80]/35 bg-white dark:bg-[#2e2010] text-[#3A3A3A] dark:text-[#FFF9F2] placeholder-[#3A3A3A]/25 dark:placeholder-[#FFF9F2]/20 focus:outline-none focus:ring-2 focus:ring-[#FFBC80]/50 transition-all" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-1">Sheet URL</label>
              <input value={url} onChange={e => { setUrl(e.target.value); setErr(""); }} placeholder="https://docs.google.com/spreadsheets/d/..." className="w-full px-3 py-2 text-xs rounded-lg border border-[#FFBC80]/35 bg-white dark:bg-[#2e2010] text-[#3A3A3A] dark:text-[#FFF9F2] placeholder-[#3A3A3A]/25 dark:placeholder-[#FFF9F2]/20 focus:outline-none focus:ring-2 focus:ring-[#FFBC80]/50 transition-all font-mono" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-1">Tab Name <span className="normal-case font-normal opacity-60">(optional)</span></label>
              <input value={tab} onChange={e => setTab(e.target.value)} placeholder="Sheet1" className="w-full px-3 py-2 text-xs rounded-lg border border-[#FFBC80]/35 bg-white dark:bg-[#2e2010] text-[#3A3A3A] dark:text-[#FFF9F2] placeholder-[#3A3A3A]/25 dark:placeholder-[#FFF9F2]/20 focus:outline-none focus:ring-2 focus:ring-[#FFBC80]/50 transition-all" />
            </div>
            {err && <p className="text-[11px] text-red-500 flex items-center gap-1"><AlertCircle size={11} />{err}</p>}
            <div className="flex gap-2 pt-0.5">
              <button onClick={() => { setAdding(false); setName(""); setUrl(""); setTab(""); setErr(""); }} className="flex-1 py-2 rounded-lg text-xs font-semibold border border-[#3A3A3A]/10 dark:border-[#FFF9F2]/10 text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 hover:bg-[#3A3A3A]/5 transition-colors">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="flex-1 py-2 rounded-lg text-xs font-semibold text-[#3A3A3A] hover:opacity-85 disabled:opacity-60 transition-opacity flex items-center justify-center gap-1.5" style={{ background: "linear-gradient(135deg,#FFBC80,#FFE29A)" }}>
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}Add Sheet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function IntegrationsPanel({ readOnly = false }: { readOnly?: boolean }) {
  const [statuses, setStatuses] = useState<IntegrationStatus[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [banner,   setBanner]   = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [sheets,   setSheets]   = useState<Sheet[]>([]);

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStatuses(data.integrations ?? []);
        const gsRow = data.integrations?.find((i: IntegrationStatus & { sheets: Sheet[] }) => i.provider === "google_sheets");
        setSheets((gsRow as any)?.sheets ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error   = params.get("error");
    if (success === "shopify") {
      setBanner({ type: "success", msg: "Shopify connected successfully!" });
      fetchStatuses();
    } else if (success) {
      const name = PROVIDERS.find(p => p.id === success)?.name ?? success;
      setBanner({ type: "success", msg: `${name} connected successfully!` });
      fetchStatuses();
    } else if (error) {
      const msgs: Record<string, string> = {
        shopify_auth_failed:    "Shopify authorization failed.",
        shopify_invalid_state:  "OAuth state mismatch — please try again.",
        shopify_hmac_failed:    "Shopify signature verification failed.",
        shopify_token_failed:   "Failed to exchange authorization code.",
        shopify_network_error:  "Network error during Shopify authorization.",
        shopify_missing_params: "Missing parameters in Shopify callback.",
        oauth_failed:           "OAuth authorization failed — please try again.",
        oauth_invalid_state:    "OAuth state mismatch — please try again.",
      };
      setBanner({ type: "error", msg: msgs[error] ?? "OAuth error." });
    }
    if (success || error) window.history.replaceState({}, "", window.location.pathname);
  }, [fetchStatuses]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  const statusFor = (id: string) => statuses.find(s => s.provider === id);

  const handleSaved = (id: string, fields: string[]) => {
    setStatuses(prev => prev.map(s =>
      s.provider === id ? { ...s, connected: true, savedFields: [...new Set([...s.savedFields, ...fields])] } : s
    ));
    setBanner({ type: "success", msg: `${PROVIDERS.find(p => p.id === id)?.name} connected!` });
  };

  const handleDisconnected = (id: string) => {
    setStatuses(prev => prev.map(s =>
      s.provider === id ? { ...s, connected: false, savedFields: [], shopDomain: null } : s
    ));
    setBanner({ type: "success", msg: `${PROVIDERS.find(p => p.id === id)?.name} disconnected.` });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[#FFBC80]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Banner */}
      {banner && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${banner.type === "success" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200/60 dark:border-red-800/40"}`}>
          {banner.type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {banner.msg}
          <button onClick={() => setBanner(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {/* Sections */}
      {SECTIONS.map(section => {
        const sectionProviders = PROVIDERS.filter(p => p.section === section);
        const connectedCount   = sectionProviders.filter(p => statusFor(p.id)?.connected).length;

        return (
          <div key={section}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">{section}</h3>
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FFBC80]/15 text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50">
                {connectedCount}/{sectionProviders.length} connected
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {sectionProviders.map(p => (
                <IntegrationCard
                  key={p.id}
                  provider={p}
                  status={statusFor(p.id)}
                  onSaved={readOnly ? () => {} : handleSaved}
                  onDisconnected={readOnly ? () => {} : handleDisconnected}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Google Sheets */}
      {!readOnly && <GoogleSheetsSection initialSheets={sheets} />}
    </div>
  );
}
