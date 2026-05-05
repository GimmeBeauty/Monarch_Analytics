import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Tag, Store, Package, RefreshCw, Clock, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { usePricingMode } from "@/context/PricingModeContext";
import {
  WHOLESALE_RATES,
  WHOLESALE_ELIGIBLE_STORE_IDS,
  DEFAULT_STORE_MAPPINGS,
  DEFAULT_PRODUCT_MAPPINGS,
} from "@/lib/wholesaleData";
import type { NetSuiteSalesResponse } from "@/lib/wholesaleData";
import { STORES } from "@/lib/storeData";
import { API_BASE } from "@/lib/apiBase";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(rate: number) {
  return `${Math.round(rate * 100)}%`;
}

function fmtCurrency(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

function fmtSyncTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

const STATUS_COLORS: Record<string, string> = {
  synced:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  delayed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30">
      <div className="mb-4">
        <p className="text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider">{title}</p>
        {subtitle && <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Pricing Toggle Card ──────────────────────────────────────────────────────

function ModeCard({
  selected, label, description, badge, onClick,
}: { selected: boolean; label: string; description: string; badge?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? "border-amber-400 bg-amber-400/8 dark:bg-amber-400/6"
          : "border-[#FFBC80]/30 hover:border-[#FFBC80]/60 bg-white dark:bg-[#231a0e]"
      }`}
    >
      {selected && (
        <span className="absolute top-3 right-3 flex items-center justify-center w-5 h-5 rounded-full bg-amber-400">
          <Check size={11} className="text-white" />
        </span>
      )}
      <p className="text-sm font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">{label}</p>
      <p className="text-xs text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 mt-1 leading-relaxed">{description}</p>
      {badge && (
        <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PricingSettings() {
  const { mode, setMode } = usePricingMode();
  const [storeMappingOpen, setStoreMappingOpen] = useState(false);
  const [productMappingOpen, setProductMappingOpen] = useState(false);

  const { data: netsuiteData, isLoading: netsuiteLoading } = useQuery<NetSuiteSalesResponse>({
    queryKey: ["netsuite-sync-status"],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/data/netsuite/sync-status`,
        { credentials: "include" },
      );
      if (!res.ok) return { totals: { revenue: 0, units: 0 }, byStore: [], products: [], dailySeries: [], lastSync: "", isEmpty: true, source: "error" } as NetSuiteSalesResponse;
      return res.json() as Promise<NetSuiteSalesResponse>;
    },
    staleTime: 1000 * 60 * 30,
    retry: false,
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Pricing & Valuation</h2>
        <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">
          Control how revenue is valued across the platform — MSRP (consumer price) or Wholesale (NetSuite cost).
        </p>
      </div>

      {/* ── Mode Toggle ─────────────────────────────────────────────────── */}
      <Section title="Pricing Mode" subtitle="Applies globally to Revenue, AOV, MER, and ROAS across all tabs. Ad Spend, Impressions, and Clicks are never affected.">
        <div className="flex gap-3">
          <ModeCard
            selected={mode === "msrp"}
            label="MSRP"
            description="Consumer retail price — the full price paid by end customers. Default for DTC reporting."
            badge="Default"
            onClick={() => setMode("msrp")}
          />
          <ModeCard
            selected={mode === "wholesale"}
            label="Wholesale"
            description="Actual cost invoiced to retail partners via NetSuite. Use for true margin and sell-in analysis."
            badge="NetSuite"
            onClick={() => setMode("wholesale")}
          />
        </div>

        {mode === "wholesale" && (
          <div className="mt-4 flex items-start gap-2.5 p-3.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <span className="font-semibold">Wholesale mode active.</span> Revenue figures across Overview, Traffic, Spend, Performance, and Attribution now reflect wholesale cost. Shopify always displays actual DTC revenue regardless of this setting.
            </p>
          </div>
        )}
      </Section>

      {/* ── Store Coverage & Rates ───────────────────────────────────────── */}
      <Section title="Store Wholesale Rates" subtitle="Per-store wholesale rates as a fraction of MSRP. Shopify is always 100% (actual DTC revenue).">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#FFBC80]/20">
                <th className="text-left py-2 pr-4 font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Store</th>
                <th className="text-left py-2 pr-4 font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Type</th>
                <th className="text-right py-2 font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Wholesale Rate</th>
              </tr>
            </thead>
            <tbody>
              {STORES.map((store) => {
                const rate = WHOLESALE_RATES[store.id] ?? 1.0;
                const isEligible = WHOLESALE_ELIGIBLE_STORE_IDS.has(store.id);
                return (
                  <tr key={store.id} className="border-b border-[#FFBC80]/10 last:border-0">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: store.color }} />
                        <span className="font-medium text-[#3A3A3A] dark:text-[#FFF9F2]">{store.label}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">
                      {store.id === "shopify" ? "DTC" : "Retail"}
                    </td>
                    <td className="py-2.5 text-right">
                      {store.id === "shopify" ? (
                        <span className="text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">Always 100%</span>
                      ) : isEligible ? (
                        <span className="font-semibold text-amber-700 dark:text-amber-400">{fmtPct(rate)}</span>
                      ) : (
                        <span className="text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ── NetSuite Sync Status ─────────────────────────────────────────── */}
      <Section title="NetSuite Data Sync" subtitle="Latest ingestion status by store. Wholesale revenue data flows from NetSuite into the platform.">
        {netsuiteLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 rounded-lg bg-[#FFBC80]/8 animate-pulse" />
            ))}
          </div>
        ) : netsuiteData && !netsuiteData.isEmpty ? (
          <>
            <div className="flex items-center gap-2 mb-3 text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">
              <RefreshCw size={11} />
              <span>Last sync: {netsuiteData.lastSync ? netsuiteData.lastSync.slice(0, 10) : "—"}</span>
            </div>
            <div className="space-y-2">
              {netsuiteData.byStore.map((rec) => {
                const store = STORES.find(s => s.label.toLowerCase() === rec.storeName.toLowerCase() || s.id === rec.storeName.toLowerCase().replace(/\s+/g, ""));
                return (
                  <div key={rec.storeName} className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#FFF9F2]/60 dark:bg-[#1a1208]/60 border border-[#FFBC80]/15">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: store?.color ?? "#9CA3AF" }} />
                      <div>
                        <span className="font-medium text-xs text-[#3A3A3A] dark:text-[#FFF9F2]">{rec.storeName}</span>
                        <span className="ml-2 text-[10px] text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">{rec.storeType}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <p className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">{fmtCurrency(rec.revenue)}</p>
                        <p className="text-[10px] text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35">{rec.units.toLocaleString()} units · last {rec.lastDate}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full capitalize ${STATUS_COLORS[rec.status]}`}>
                        {rec.status === "delayed" && <Clock size={9} className="inline mr-1" />}
                        {rec.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 py-3 text-center">
            No NetSuite data found.
          </p>
        )}
      </Section>

      {/* ── Store Name Mapping ───────────────────────────────────────────── */}
      <Section title="NetSuite Store Mapping" subtitle="Maps NetSuite entity names to platform store IDs.">
        <button
          onClick={() => setStoreMappingOpen(o => !o)}
          className="flex items-center justify-between w-full text-xs font-medium text-[#3A3A3A] dark:text-[#FFF9F2] hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
        >
          <span className="flex items-center gap-1.5"><Store size={13} />{DEFAULT_STORE_MAPPINGS.length} mappings configured</span>
          {storeMappingOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {storeMappingOpen && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#FFBC80]/20">
                  <th className="text-left py-2 pr-4 font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">NetSuite Entity</th>
                  <th className="text-left py-2 pr-4 font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Platform Store</th>
                  <th className="text-right py-2 font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Status</th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_STORE_MAPPINGS.map((m) => {
                  const store = STORES.find(s => s.id === m.platformStoreId);
                  return (
                    <tr key={m.id} className="border-b border-[#FFBC80]/10 last:border-0">
                      <td className="py-2 pr-4 font-mono text-[11px] text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">{m.netSuiteEntity}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1.5">
                          {store && <div className="w-1.5 h-1.5 rounded-full" style={{ background: store.color }} />}
                          <span className="text-[#3A3A3A] dark:text-[#FFF9F2]">{store?.label ?? m.platformStoreId}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${m.confirmed ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                          {m.confirmed ? "Confirmed" : "Unconfirmed"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* ── Product Mapping ──────────────────────────────────────────────── */}
      <Section title="Product SKU Mapping" subtitle="Maps NetSuite SKUs to platform SKUs with wholesale and MSRP prices.">
        <button
          onClick={() => setProductMappingOpen(o => !o)}
          className="flex items-center justify-between w-full text-xs font-medium text-[#3A3A3A] dark:text-[#FFF9F2] hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
        >
          <span className="flex items-center gap-1.5"><Package size={13} />{DEFAULT_PRODUCT_MAPPINGS.length} products mapped</span>
          {productMappingOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {productMappingOpen && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#FFBC80]/20">
                  <th className="text-left py-2 pr-3 font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Product</th>
                  <th className="text-left py-2 pr-3 font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">NS SKU → Platform</th>
                  <th className="text-right py-2 pr-3 font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Wholesale</th>
                  <th className="text-right py-2 pr-3 font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">MSRP</th>
                  <th className="text-right py-2 font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">Status</th>
                </tr>
              </thead>
              <tbody>
                {DEFAULT_PRODUCT_MAPPINGS.map((p) => (
                  <tr key={p.id} className="border-b border-[#FFBC80]/10 last:border-0">
                    <td className="py-2 pr-3 text-[#3A3A3A] dark:text-[#FFF9F2] max-w-[180px]">
                      <span className="block truncate" title={p.productName}>{p.productName}</span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-[11px] text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50">
                      {p.netSuiteSku} → {p.platformSku}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium text-amber-700 dark:text-amber-400">${p.wholesalePrice.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">${p.msrpPrice.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${p.confirmed ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                        {p.confirmed ? "Confirmed" : "Review"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
