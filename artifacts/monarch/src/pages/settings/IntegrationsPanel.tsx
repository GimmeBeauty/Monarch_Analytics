import { useState, useEffect, useCallback } from "react";
import {
  SiGoogleads, SiMeta, SiTiktok, SiGoogleanalytics, SiShopify,
} from "react-icons/si";
import {
  CheckCircle, X, ExternalLink, Loader2, AlertCircle, Unplug, Eye, EyeOff, Key,
} from "lucide-react";
import { API_BASE } from "@/lib/apiBase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntegrationStatus {
  provider:   string;
  connected:  boolean;
  shopDomain: string | null;
  clientId:   string | null;
  status:     string | null;
}

// ─── Provider metadata ────────────────────────────────────────────────────────

type AuthMode = "oauth_shopify" | "api_key";

const PROVIDERS: {
  id:          string;
  Icon:        React.ComponentType<{ size?: number; color?: string }>;
  name:        string;
  desc:        string;
  color:       string;
  authMode:    AuthMode;
  clientIdLabel?:     string;
  clientSecretLabel?: string;
  hint?:       string;
}[] = [
  {
    id:      "shopify",
    Icon:    SiShopify,
    name:    "Shopify",
    desc:    "Connect your store for revenue attribution",
    color:   "#96BF48",
    authMode: "oauth_shopify",
  },
  {
    id:                 "google_ads",
    Icon:               SiGoogleads,
    name:               "Google Ads",
    desc:               "Import campaign data, spend, and conversions",
    color:              "#4285F4",
    authMode:           "api_key",
    clientIdLabel:      "Client ID",
    clientSecretLabel:  "Client Secret",
    hint:               "Found in Google Cloud Console → APIs & Services → Credentials",
  },
  {
    id:                 "meta",
    Icon:               SiMeta,
    name:               "Meta Ads",
    desc:               "Sync Facebook and Instagram ad data",
    color:              "#0082FB",
    authMode:           "api_key",
    clientIdLabel:      "App ID",
    clientSecretLabel:  "App Secret",
    hint:               "Found in Meta for Developers → Your App → Settings → Basic",
  },
  {
    id:                 "tiktok",
    Icon:               SiTiktok,
    name:               "TikTok Ads",
    desc:               "Connect TikTok for Business campaigns",
    color:              "#010101",
    authMode:           "api_key",
    clientIdLabel:      "App ID",
    clientSecretLabel:  "App Secret",
    hint:               "Found in TikTok for Business → Developer Portal → App Management",
  },
  {
    id:                 "google_analytics",
    Icon:               SiGoogleanalytics,
    name:               "Google Analytics",
    desc:               "Pull traffic, pageview, and behavior data",
    color:              "#E37400",
    authMode:           "api_key",
    clientIdLabel:      "Client ID",
    clientSecretLabel:  "Client Secret",
    hint:               "Found in Google Cloud Console → APIs & Services → Credentials",
  },
];

// ─── Shopify OAuth Modal ───────────────────────────────────────────────────────

function ShopifyModal({ onClose }: { onClose: () => void }) {
  const [shop, setShop]   = useState("");
  const [error, setError] = useState("");

  const handleConnect = () => {
    const cleaned = shop.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!cleaned) { setError("Please enter your Shopify store URL."); return; }
    window.location.href = `${API_BASE}/api/integrations/shopify/connect?shop=${encodeURIComponent(cleaned)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl p-6 monarch-card-settings">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <SiShopify size={18} color="#96BF48" />
            <h2 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Connect Shopify</h2>
          </div>
          <button onClick={onClose} className="text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-4">
          Enter your store domain. You'll be redirected to Shopify to approve access, then returned here automatically.
        </p>

        <label className="block text-xs font-semibold text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 mb-1.5 uppercase tracking-wider">
          Store URL
        </label>
        <input
          type="text"
          value={shop}
          onChange={(e) => { setShop(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          placeholder="mystore.myshopify.com"
          autoFocus
          className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#FFBC80]/40 bg-white dark:bg-[#2e2010] text-[#3A3A3A] dark:text-[#FFF9F2] placeholder-[#3A3A3A]/30 dark:placeholder-[#FFF9F2]/25 focus:outline-none focus:ring-2 focus:ring-[#FFBC80]/60 focus:border-transparent transition-all"
        />
        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-500 mt-1.5">
            <AlertCircle size={12} /> {error}
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-semibold text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 border border-[#3A3A3A]/10 dark:border-[#FFF9F2]/10 hover:bg-[#3A3A3A]/5 dark:hover:bg-[#FFF9F2]/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConnect}
            className="flex-1 py-2 rounded-lg text-xs font-semibold text-[#3A3A3A] transition-opacity hover:opacity-85 flex items-center justify-center gap-1.5"
            style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
          >
            Authorize with Shopify <ExternalLink size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── API Key Credentials Modal ─────────────────────────────────────────────────

function CredentialsModal({
  provider,
  name,
  clientIdLabel,
  clientSecretLabel,
  hint,
  existingClientId,
  onSaved,
  onClose,
}: {
  provider:          string;
  name:              string;
  clientIdLabel:     string;
  clientSecretLabel: string;
  hint?:             string;
  existingClientId?: string | null;
  onSaved:           (clientId: string) => void;
  onClose:           () => void;
}) {
  const [clientId,     setClientId]     = useState(existingClientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret,   setShowSecret]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      setError(`Both ${clientIdLabel} and ${clientSecretLabel} are required.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${provider}/credentials`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ clientId: clientId.trim(), clientSecret: clientSecret.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save credentials."); return; }
      onSaved(clientId.trim());
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isUpdate = !!existingClientId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl p-6 monarch-card-settings">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">
            {isUpdate ? "Update" : "Connect"} {name}
          </h2>
          <button onClick={onClose} className="text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors">
            <X size={16} />
          </button>
        </div>

        {hint && (
          <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-4 leading-relaxed">
            {hint}
          </p>
        )}

        <div className="space-y-3">
          {/* Client ID */}
          <div>
            <label className="block text-xs font-semibold text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 mb-1.5 uppercase tracking-wider">
              {clientIdLabel}
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setError(""); }}
              placeholder={`Enter ${clientIdLabel}`}
              autoFocus
              autoComplete="off"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#FFBC80]/40 bg-white dark:bg-[#2e2010] text-[#3A3A3A] dark:text-[#FFF9F2] placeholder-[#3A3A3A]/30 dark:placeholder-[#FFF9F2]/25 focus:outline-none focus:ring-2 focus:ring-[#FFBC80]/60 focus:border-transparent transition-all font-mono"
            />
          </div>

          {/* Client Secret */}
          <div>
            <label className="block text-xs font-semibold text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 mb-1.5 uppercase tracking-wider">
              {clientSecretLabel} {isUpdate && <span className="normal-case font-normal text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">(leave blank to keep existing)</span>}
            </label>
            <div className="relative">
              <input
                type={showSecret ? "text" : "password"}
                value={clientSecret}
                onChange={(e) => { setClientSecret(e.target.value); setError(""); }}
                placeholder={isUpdate ? "Enter new value to update" : `Enter ${clientSecretLabel}`}
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg border border-[#FFBC80]/40 bg-white dark:bg-[#2e2010] text-[#3A3A3A] dark:text-[#FFF9F2] placeholder-[#3A3A3A]/30 dark:placeholder-[#FFF9F2]/25 focus:outline-none focus:ring-2 focus:ring-[#FFBC80]/60 focus:border-transparent transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowSecret((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3A3A3A]/35 dark:text-[#FFF9F2]/30 hover:text-[#3A3A3A]/70 dark:hover:text-[#FFF9F2]/60"
              >
                {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-xs text-red-500 mt-3">
            <AlertCircle size={12} /> {error}
          </p>
        )}

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-semibold text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 border border-[#3A3A3A]/10 dark:border-[#FFF9F2]/10 hover:bg-[#3A3A3A]/5 dark:hover:bg-[#FFF9F2]/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2 rounded-lg text-xs font-semibold text-[#3A3A3A] transition-opacity hover:opacity-85 disabled:opacity-60 flex items-center justify-center gap-1.5"
            style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Key size={12} />}
            {isUpdate ? "Update Credentials" : "Save & Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Disconnect Confirm Modal ──────────────────────────────────────────────────

function DisconnectModal({
  name, onConfirm, onClose, loading,
}: {
  name: string; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-xs rounded-2xl p-6 monarch-card-settings">
        <h2 className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2] mb-2">Disconnect {name}?</h2>
        <p className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mb-5">
          This removes the stored credentials. You can reconnect at any time.
        </p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-semibold text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 border border-[#3A3A3A]/10 dark:border-[#FFF9F2]/10 hover:bg-[#3A3A3A]/5 dark:hover:bg-[#FFF9F2]/5 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Unplug size={12} />}
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function IntegrationsPanel({ readOnly = false }: { readOnly?: boolean }) {
  const [statuses, setStatuses]                 = useState<IntegrationStatus[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [shopifyModal, setShopifyModal]         = useState(false);
  const [credentialsFor, setCredentialsFor]     = useState<string | null>(null);
  const [disconnecting, setDisconnecting]       = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<string | null>(null);
  const [banner, setBanner]                     = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/integrations`, { credentials: "include" });
      if (res.ok) setStatuses((await res.json()).integrations ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  // Handle OAuth callback redirect params
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const error   = params.get("error");
    if (success === "shopify") {
      setBanner({ type: "success", msg: "Shopify connected successfully!" });
      fetchStatuses();
    } else if (error) {
      const msgs: Record<string, string> = {
        shopify_auth_failed:    "Shopify authorization failed. Please try again.",
        shopify_invalid_state:  "OAuth state mismatch — please try connecting again.",
        shopify_hmac_failed:    "Shopify signature verification failed.",
        shopify_token_failed:   "Failed to exchange the authorization code.",
        shopify_network_error:  "Network error during Shopify authorization.",
        shopify_missing_params: "Missing parameters in Shopify callback.",
      };
      setBanner({ type: "error", msg: msgs[error] ?? "An error occurred during OAuth." });
    }
    if (success || error) window.history.replaceState({}, "", window.location.pathname);
  }, [fetchStatuses]);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(t);
  }, [banner]);

  const handleDisconnect = async (provider: string) => {
    setDisconnecting(provider);
    try {
      const res = await fetch(`${API_BASE}/api/integrations/${provider}`, {
        method: "DELETE", credentials: "include",
      });
      if (res.ok) {
        setStatuses((prev) =>
          prev.map((s) => s.provider === provider ? { ...s, connected: false, shopDomain: null, clientId: null } : s)
        );
        setBanner({ type: "success", msg: `${PROVIDERS.find(p => p.id === provider)?.name} disconnected.` });
      } else {
        setBanner({ type: "error", msg: "Failed to disconnect. Please try again." });
      }
    } finally {
      setDisconnecting(null);
      setDisconnectTarget(null);
    }
  };

  const handleCredentialsSaved = (provider: string, clientId: string) => {
    setStatuses((prev) =>
      prev.map((s) => s.provider === provider ? { ...s, connected: true, clientId } : s)
    );
    setCredentialsFor(null);
    setBanner({ type: "success", msg: `${PROVIDERS.find(p => p.id === provider)?.name} connected successfully!` });
  };

  const statusFor = (id: string) => statuses.find((s) => s.provider === id);
  const credentialTarget = PROVIDERS.find((p) => p.id === credentialsFor);

  return (
    <div className="space-y-4">
      {/* Modals */}
      {shopifyModal && <ShopifyModal onClose={() => setShopifyModal(false)} />}

      {credentialsFor && credentialTarget && credentialTarget.authMode === "api_key" && (
        <CredentialsModal
          provider={credentialsFor}
          name={credentialTarget.name}
          clientIdLabel={credentialTarget.clientIdLabel ?? "Client ID"}
          clientSecretLabel={credentialTarget.clientSecretLabel ?? "Client Secret"}
          hint={credentialTarget.hint}
          existingClientId={statusFor(credentialsFor)?.clientId ?? null}
          onSaved={(clientId) => handleCredentialsSaved(credentialsFor, clientId)}
          onClose={() => setCredentialsFor(null)}
        />
      )}

      {disconnectTarget && (
        <DisconnectModal
          name={PROVIDERS.find((p) => p.id === disconnectTarget)?.name ?? disconnectTarget}
          onConfirm={() => handleDisconnect(disconnectTarget)}
          onClose={() => setDisconnectTarget(null)}
          loading={disconnecting === disconnectTarget}
        />
      )}

      {/* Banner */}
      {banner && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
          banner.type === "success"
            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40"
            : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200/60 dark:border-red-800/40"
        }`}>
          {banner.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {banner.msg}
          <button onClick={() => setBanner(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {/* Callback URI reference */}
      <div className="rounded-xl p-4 bg-[#FFBC80]/8 border border-[#FFBC80]/25">
        <p className="text-xs font-semibold text-[#3A3A3A]/65 dark:text-[#FFF9F2]/55 uppercase tracking-wider mb-1.5">
          OAuth Callback URI
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs font-mono text-[#3A3A3A] dark:text-[#FFF9F2] break-all">
            {window.location.origin}/api/integrations/&#123;provider&#125;/callback
          </code>
          <button
            onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/api/integrations/shopify/callback`)}
            className="shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 border border-[#FFBC80]/30 hover:bg-[#FFBC80]/15 transition-colors"
          >
            Copy Shopify URI
          </button>
        </div>
        <p className="text-[10px] text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-1.5">
          Register this in your platform's app settings before connecting.
        </p>
      </div>

      {/* Integration list */}
      <div className="space-y-2.5">
        {PROVIDERS.map(({ id, Icon, name, desc, color, authMode, clientIdLabel, clientSecretLabel }) => {
          const status    = statusFor(id);
          const connected = status?.connected ?? false;

          return (
            <div key={id} className="flex items-center gap-4 p-4 rounded-xl monarch-card-settings">
              {/* Icon */}
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-50 dark:bg-[#2e2010]">
                {loading
                  ? <div className="w-5 h-5 rounded bg-[#3A3A3A]/10 dark:bg-[#FFF9F2]/10 animate-pulse" />
                  : <Icon size={20} color={color} />
                }
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{name}</p>
                <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5 truncate">
                  {connected
                    ? (status?.shopDomain ?? (status?.clientId ? `${clientIdLabel}: ${status.clientId}` : "Connected"))
                    : desc}
                </p>
              </div>

              {/* Action */}
              <div className="flex items-center gap-2 shrink-0">
                {loading ? (
                  <Loader2 size={16} className="text-[#3A3A3A]/30 dark:text-[#FFF9F2]/25 animate-spin" />
                ) : connected ? (
                  <>
                    <CheckCircle size={16} className="text-emerald-500" />
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Connected</span>
                    {!readOnly && (
                      <div className="flex items-center gap-1.5 ml-1">
                        {/* Update credentials button for API key providers */}
                        {authMode === "api_key" && (
                          <button
                            onClick={() => setCredentialsFor(id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 border border-[#3A3A3A]/15 dark:border-[#FFF9F2]/15 hover:border-[#FFBC80]/50 hover:text-[#3A3A3A] dark:hover:text-[#FFF9F2] transition-colors"
                          >
                            Update
                          </button>
                        )}
                        <button
                          onClick={() => setDisconnectTarget(id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 border border-[#3A3A3A]/15 dark:border-[#FFF9F2]/15 hover:border-red-400/60 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          Disconnect
                        </button>
                      </div>
                    )}
                  </>
                ) : readOnly ? (
                  <span className="text-xs text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25">Not connected</span>
                ) : authMode === "oauth_shopify" ? (
                  <button
                    onClick={() => setShopifyModal(true)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#3A3A3A] transition-opacity hover:opacity-80"
                    style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
                  >
                    Connect
                  </button>
                ) : (
                  <button
                    onClick={() => setCredentialsFor(id)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#3A3A3A] transition-opacity hover:opacity-80"
                    style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
                  >
                    Connect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
