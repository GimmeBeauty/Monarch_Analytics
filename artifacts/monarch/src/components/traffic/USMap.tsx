import { useState, useCallback, useMemo } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { MapPin } from "lucide-react";
import type { StateRevenue, StoreLocation } from "@/lib/trafficData";
// Bundled at build time — no network fetch, renders immediately
import statesTopojson from "us-atlas/states-10m.json";

// FIPS numeric code → 2-letter state abbreviation
const FIPS_TO_STATE: Record<string, string> = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE",
  "11":"DC","12":"FL","13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA",
  "20":"KS","21":"KY","22":"LA","23":"ME","24":"MD","25":"MA","26":"MI","27":"MN",
  "28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH","34":"NJ","35":"NM",
  "36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
  "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA",
  "54":"WV","55":"WI","56":"WY",
};

// ─── Color Bands (green=high → red=low revenue) ──────────────────────────────
const BAND_FILL       = ["#16A34A","#65A30D","#CA8A04","#D97706","#EA580C","#DC2626"];
const BAND_FILL_HOVER = ["#15803D","#4D7C0F","#A16207","#B45309","#C2410C","#B91C1C"];
const BAND_LABELS     = ["Very High","High","Mid-High","Mid","Low-Mid","Low"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

const cardStyle = {
  border: "1px solid transparent",
  backgroundImage: "linear-gradient(#fff, #fff), linear-gradient(135deg, #FFBC80 0%, #FFE29A 100%)",
  backgroundOrigin: "border-box",
  backgroundClip: "padding-box, border-box",
};

// ─── Component ────────────────────────────────────────────────────────────────
interface Props {
  stateRevenue: StateRevenue[];
  storeLocations: StoreLocation[];
}

export default function USMap({ stateRevenue, storeLocations }: Props) {
  const [hoveredState, setHoveredState]   = useState<string | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [selectedPin, setSelectedPin]     = useState<string | null>(null);
  const [tooltip, setTooltip]             = useState<{ x: number; y: number } | null>(null);

  const revenueByCode = useMemo(() => {
    const m: Record<string, StateRevenue> = {};
    stateRevenue.forEach(s => { m[s.code] = s; });
    return m;
  }, [stateRevenue]);

  const locsByState = useMemo(() => {
    const m: Record<string, StoreLocation[]> = {};
    storeLocations.forEach(l => {
      if (!m[l.stateCode]) m[l.stateCode] = [];
      m[l.stateCode].push(l);
    });
    return m;
  }, [storeLocations]);

  const selectedStateLocs = selectedState ? (locsByState[selectedState] ?? []) : [];
  const selectedStateData = selectedState ? revenueByCode[selectedState] : null;

  const handleStateClick = useCallback((code: string) => {
    setSelectedState(prev => prev === code ? null : code);
    setSelectedPin(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#1a1208]" style={cardStyle}>

        {/* ── Header ── */}
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Geographic Revenue Distribution</h2>
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
            {selectedStateData
              ? `${selectedStateData.name} · $${(selectedStateData.revenue / 1_000_000).toFixed(1)}M revenue (${selectedStateData.contribution.toFixed(1)}% of total)`
              : "Click any state to drill down"}
          </p>
        </div>

        {/* ── Map ── */}
        <div className="relative px-4 pb-4">
          <ComposableMap
            projection="geoAlbersUsa"
            projectionConfig={{ scale: 1000 }}
            style={{ width: "100%", height: "auto" }}
            className="rounded-xl bg-[#EAF2F8]/60 dark:bg-[#0a0d12]/60"
          >
              <Geographies geography={statesTopojson as object}>
                {({ geographies }: { geographies: import("react-simple-maps").Geography[] }) =>
                  geographies.map((geo: import("react-simple-maps").Geography) => {
                    // us-atlas FIPS ids are numeric; pad to 2 digits for lookup
                    const fips = String(geo.id).padStart(2, "0");
                    const code = FIPS_TO_STATE[fips];
                    if (!code) return null;

                    const sr        = revenueByCode[code];
                    const band      = sr?.band ?? 5;
                    const isHovered  = hoveredState === code;
                    const isSelected = selectedState === code;
                    const isDimmed   = !!selectedState && !isSelected;

                    let fill: string;
                    if (isDimmed) {
                      fill = "#CBD5E1";
                    } else if (isSelected || isHovered) {
                      fill = BAND_FILL_HOVER[band];
                    } else {
                      fill = BAND_FILL[band];
                    }

                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={fill}
                        stroke={isSelected ? "#78350f" : "#ffffff"}
                        strokeWidth={isSelected ? 1.5 : 0.5}
                        style={{
                          default: {
                            outline: "none",
                            cursor: "pointer",
                            opacity: isDimmed ? 0.35 : 1,
                            transition: "fill 0.15s ease, opacity 0.2s ease",
                          },
                          hover:   { outline: "none", cursor: "pointer" },
                          pressed: { outline: "none" },
                        }}
                        onMouseEnter={(e: React.MouseEvent<SVGPathElement>) => {
                          setHoveredState(code);
                          setTooltip({ x: e.clientX, y: e.clientY });
                        }}
                        onMouseLeave={() => {
                          setHoveredState(null);
                          setTooltip(null);
                        }}
                        onMouseMove={(e: React.MouseEvent<SVGPathElement>) => setTooltip({ x: e.clientX, y: e.clientY })}
                        onClick={() => handleStateClick(code)}
                      />
                    );
                  })
                }
              </Geographies>

              {/* ── Store pin markers (shown for selected state) ── */}
              {selectedStateLocs.map(loc => {
                const isActive = selectedPin === loc.id;
                return (
                  <Marker key={loc.id} coordinates={[loc.lon, loc.lat]}>
                    <circle
                      r={isActive ? 7 : 5}
                      fill={isActive ? "#1D4ED8" : "#3B82F6"}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      style={{ cursor: "pointer", transition: "all 0.15s ease" }}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        setSelectedPin(isActive ? null : loc.id);
                      }}
                    />
                    {isActive && (
                      <circle r={2.5} fill="#ffffff" style={{ pointerEvents: "none" }} />
                    )}
                  </Marker>
                );
              })}
          </ComposableMap>

          {/* ── Tooltip ── */}
          {hoveredState && tooltip && (() => {
            const sr = revenueByCode[hoveredState];
            if (!sr) return null;
            return (
              <div
                className="fixed z-50 pointer-events-none px-3 py-2 rounded-lg shadow-lg text-xs bg-[#1a1208] text-[#FFF9F2] border border-[#FFBC80]/30"
                style={{ left: tooltip.x + 14, top: tooltip.y - 10, minWidth: 168 }}
              >
                <div className="font-semibold mb-1.5">{sr.name}</div>
                <div className="flex justify-between gap-4">
                  <span className="opacity-60">Revenue</span>
                  <span className="font-mono">${(sr.revenue / 1_000_000).toFixed(1)}M</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="opacity-60">Share</span>
                  <span className="font-mono">{sr.contribution.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="opacity-60">Units</span>
                  <span className="font-mono">{fmtNum(sr.units)}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Legend ── */}
        <div className="px-5 pb-4 flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 mr-2 font-medium uppercase tracking-wider">Revenue</span>
          {BAND_LABELS.map((label, i) => (
            <div key={i} className="flex items-center gap-1 mr-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BAND_FILL[i] }} />
              <span className="text-[10px] text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── State drill-down table ── */}
      {selectedState && selectedStateData && (
        <div className="rounded-2xl overflow-hidden bg-white dark:bg-[#1a1208]" style={cardStyle}>
          <div className="px-5 pt-4 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#FFBC80]" />
                Store Locations — {selectedStateData.name}
              </h3>
              <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">
                {selectedStateLocs.length} location{selectedStateLocs.length !== 1 ? "s" : ""} ·{" "}
                State revenue ${(selectedStateData.revenue / 1_000_000).toFixed(1)}M ({selectedStateData.contribution.toFixed(1)}% of total)
              </p>
            </div>
          </div>

          {selectedStateLocs.length === 0 ? (
            <div className="px-5 pb-6 text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 italic">
              No tracked store locations in this state for the selected filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead>
                  <tr className="border-b border-[#FFBC80]/15 bg-[#FFBC80]/5">
                    {["Store Location","Store Name","Sales","Units","Address","City","State","Zip Code"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedStateLocs.map((loc, idx) => {
                    const isActive = selectedPin === loc.id;
                    return (
                      <tr
                        key={loc.id}
                        onClick={() => setSelectedPin(isActive ? null : loc.id)}
                        className={`border-b border-[#FFBC80]/8 cursor-pointer transition-colors hover:bg-[#FFBC80]/5 ${
                          isActive ? "bg-blue-50 dark:bg-blue-900/20" : ""
                        }`}
                      >
                        {/* Store Location (number + pin indicator) */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              isActive
                                ? "bg-blue-500 text-white"
                                : "bg-[#FFBC80]/20 text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50"
                            }`}>
                              {idx + 1}
                            </div>
                            {isActive && (
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                            )}
                          </div>
                        </td>
                        {/* Store Name */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: loc.storeColor }} />
                            <span className="text-xs font-medium text-[#3A3A3A] dark:text-[#FFF9F2]">{loc.storeName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-xs font-semibold tabular-nums text-[#3A3A3A] dark:text-[#FFF9F2]">
                          {loc.formattedSales}
                        </td>
                        <td className="px-3 py-2.5 text-xs tabular-nums text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">
                          {loc.units.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50">
                          {loc.address}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">
                          {loc.city}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50">
                          {loc.stateCode}
                        </td>
                        <td className="px-3 py-2.5 text-xs font-mono text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50">
                          {loc.zipCode}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
