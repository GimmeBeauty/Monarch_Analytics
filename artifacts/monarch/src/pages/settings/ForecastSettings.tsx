import { useState, useEffect, useCallback } from "react";
import { Plus, Save, Check, ChevronDown, Store, Calendar, AlertCircle } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface StoreRow { id: number; name: string; type: string; }
interface YearRow { id: number; year: number; }
interface ForecastRow {
  id: number;
  storeId: number;
  forecastYearId: number;
  month: number;
  wholesalePrice: string | null;
  retailPrice: string;
}

type MonthData = { retail: string; wholesale: string; };
type Grid = Record<number, MonthData>; // month 1–12

const API = "/api/forecast";

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function emptyGrid(): Grid {
  const g: Grid = {};
  for (let m = 1; m <= 12; m++) g[m] = { retail: "", wholesale: "" };
  return g;
}

function rowsToGrid(rows: ForecastRow[]): Grid {
  const g = emptyGrid();
  for (const r of rows) {
    g[r.month] = { retail: r.retailPrice ?? "", wholesale: r.wholesalePrice ?? "" };
  }
  return g;
}

export default function ForecastSettings() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [years, setYears] = useState<YearRow[]>([]);
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [grid, setGrid] = useState<Grid>(emptyGrid());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add store modal state
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreType, setNewStoreType] = useState("retail");
  const [addingStore, setAddingStore] = useState(false);

  // Add year state
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYear, setNewYear] = useState("");
  const [addingYear, setAddingYear] = useState(false);

  // Load stores + years on mount
  useEffect(() => {
    Promise.all([apiFetch("/stores"), apiFetch("/years")])
      .then(([s, y]) => {
        setStores(s);
        setYears(y);
        if (s.length) setSelectedStore(s[0].id);
        if (y.length) setSelectedYear(y[y.length - 1].year);
      })
      .catch((e) => setError(e.message));
  }, []);

  // Load forecast when store or year changes
  const loadForecast = useCallback(async () => {
    if (!selectedStore || !selectedYear) return;
    setLoading(true);
    setError(null);
    try {
      const rows: ForecastRow[] = await apiFetch(
        `/forecasts?store_id=${selectedStore}&year=${selectedYear}`,
      );
      setGrid(rowsToGrid(rows));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedStore, selectedYear]);

  useEffect(() => { loadForecast(); }, [loadForecast]);

  const isShopify = stores.find((s) => s.id === selectedStore)?.type === "shopify";

  // Update a single cell
  const setCell = (month: number, field: "retail" | "wholesale", value: string) => {
    setGrid((g) => ({ ...g, [month]: { ...g[month], [field]: value } }));
  };

  // Bulk save via upsert
  const handleSave = async () => {
    if (!selectedStore || !selectedYear) return;

    // Validate retail prices
    for (let m = 1; m <= 12; m++) {
      if (!grid[m].retail.trim()) {
        setError(`Retail price for ${MONTHS[m - 1]} is required.`);
        return;
      }
      if (isNaN(Number(grid[m].retail))) {
        setError(`Retail price for ${MONTHS[m - 1]} must be a number.`);
        return;
      }
      if (grid[m].wholesale && isNaN(Number(grid[m].wholesale))) {
        setError(`Wholesale price for ${MONTHS[m - 1]} must be a number.`);
        return;
      }
    }

    setError(null);
    setSaving(true);
    try {
      const months = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        retail_price: grid[i + 1].retail,
        wholesale_price: isShopify ? null : grid[i + 1].wholesale || null,
      }));
      await apiFetch("/forecasts/upsert", {
        method: "PATCH",
        body: JSON.stringify({ store_id: selectedStore, year: selectedYear, months }),
      });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Add store
  const handleAddStore = async () => {
    if (!newStoreName.trim()) return;
    setAddingStore(true);
    try {
      const s: StoreRow = await apiFetch("/stores", {
        method: "POST",
        body: JSON.stringify({ name: newStoreName.trim(), type: newStoreType }),
      });
      setStores((prev) => [...prev, s]);
      setSelectedStore(s.id);
      setNewStoreName("");
      setShowAddStore(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAddingStore(false);
    }
  };

  // Add year
  const handleAddYear = async () => {
    const y = parseInt(newYear, 10);
    if (!y) return;
    setAddingYear(true);
    try {
      const yr: YearRow = await apiFetch("/years", {
        method: "POST",
        body: JSON.stringify({ year: y }),
      });
      setYears((prev) => [...prev, yr].sort((a, b) => a.year - b.year));
      setSelectedYear(yr.year);
      setNewYear("");
      setShowAddYear(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAddingYear(false);
    }
  };

  const inputCls = "w-full px-2 py-1.5 rounded-lg text-xs bg-[#FFF9F2] dark:bg-[#1a1208] text-[#3A3A3A] dark:text-[#FFF9F2] border border-[#FFBC80]/40 focus:border-[#FFBC80] outline-none transition-colors text-right";
  const labelCls = "block text-[10px] font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-0.5";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#FFF9F2]">Forecast Settings</h2>
        <p className="text-xs text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mt-0.5">
          Set monthly retail and wholesale price forecasts per store and year.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      )}

      {/* Controls row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Store selector */}
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-1.5">
            <Store size={11} className="inline mr-1" />Store
          </label>
          <div className="relative">
            <select
              value={selectedStore ?? ""}
              onChange={(e) => setSelectedStore(Number(e.target.value))}
              className="w-full appearance-none px-3 py-2 pr-8 rounded-lg text-sm bg-white dark:bg-[#231a0e] text-[#3A3A3A] dark:text-[#FFF9F2] border border-[#FFBC80]/40 focus:border-[#FFBC80] outline-none cursor-pointer"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3A3A3A]/40 pointer-events-none" />
          </div>
        </div>

        {/* Year selector */}
        <div className="flex-1 min-w-[120px]">
          <label className="block text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 uppercase tracking-wider mb-1.5">
            <Calendar size={11} className="inline mr-1" />Year
          </label>
          <div className="relative">
            <select
              value={selectedYear ?? ""}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full appearance-none px-3 py-2 pr-8 rounded-lg text-sm bg-white dark:bg-[#231a0e] text-[#3A3A3A] dark:text-[#FFF9F2] border border-[#FFBC80]/40 focus:border-[#FFBC80] outline-none cursor-pointer"
            >
              {years.map((y) => (
                <option key={y.id} value={y.year}>{y.year}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#3A3A3A]/40 pointer-events-none" />
          </div>
        </div>

        {/* Add year */}
        <div>
          {showAddYear ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                placeholder="2027"
                className="w-20 px-2 py-2 rounded-lg text-sm border border-[#FFBC80]/50 focus:border-[#FFBC80] outline-none bg-white dark:bg-[#231a0e] text-[#3A3A3A] dark:text-[#FFF9F2]"
                onKeyDown={(e) => e.key === "Enter" && handleAddYear()}
              />
              <button onClick={handleAddYear} disabled={addingYear}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-[#3A3A3A] hover:opacity-85 transition-opacity"
                style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
                {addingYear ? "…" : "Add"}
              </button>
              <button onClick={() => setShowAddYear(false)} className="text-xs text-[#3A3A3A]/40 hover:text-[#3A3A3A] dark:text-[#FFF9F2]/40 px-1">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowAddYear(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 border border-[#FFBC80]/30 hover:border-[#FFBC80]/60 hover:bg-[#FFBC80]/8 transition-all">
              <Plus size={12} /> Add Year
            </button>
          )}
        </div>

        {/* Add store */}
        <div>
          <button onClick={() => setShowAddStore(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 border border-[#FFBC80]/30 hover:border-[#FFBC80]/60 hover:bg-[#FFBC80]/8 transition-all">
            <Plus size={12} /> Add Store
          </button>
        </div>
      </div>

      {/* Add store modal */}
      {showAddStore && (
        <div className="p-4 rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/40">
          <p className="text-xs font-semibold text-[#3A3A3A] dark:text-[#FFF9F2] mb-3">New Store</p>
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className={labelCls}>Store Name</label>
              <input
                type="text"
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                placeholder="e.g. Costco"
                className="w-full px-3 py-1.5 rounded-lg text-sm border border-[#FFBC80]/50 focus:border-[#FFBC80] outline-none bg-[#FFF9F2] dark:bg-[#1a1208] text-[#3A3A3A] dark:text-[#FFF9F2]"
                onKeyDown={(e) => e.key === "Enter" && handleAddStore()}
              />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={newStoreType} onChange={(e) => setNewStoreType(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm border border-[#FFBC80]/50 focus:border-[#FFBC80] outline-none bg-[#FFF9F2] dark:bg-[#1a1208] text-[#3A3A3A] dark:text-[#FFF9F2]">
                <option value="retail">Retail</option>
                <option value="shopify">Shopify (DTC)</option>
              </select>
            </div>
            <button onClick={handleAddStore} disabled={addingStore || !newStoreName.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-[#3A3A3A] hover:opacity-85 transition-opacity disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
              {addingStore ? "Adding…" : "Add Store"}
            </button>
            <button onClick={() => setShowAddStore(false)} className="text-xs text-[#3A3A3A]/40 hover:text-[#3A3A3A] dark:text-[#FFF9F2]/40 px-1">✕</button>
          </div>
        </div>
      )}

      {/* Monthly grid */}
      <div className="rounded-xl bg-white dark:bg-[#231a0e] border border-[#FFBC80]/30 overflow-hidden">
        {/* Column headers */}
        <div
          className={`grid text-[10px] font-bold uppercase tracking-wider text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45 px-4 py-2.5 border-b border-[#FFBC80]/15 ${isShopify ? "grid-cols-[80px_1fr]" : "grid-cols-[80px_1fr_1fr]"}`}
        >
          <span>Month</span>
          <span className="text-right">Retail Price</span>
          {!isShopify && <span className="text-right">Wholesale Price</span>}
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30 animate-pulse">
            Loading forecast data…
          </div>
        ) : (
          MONTHS.map((label, idx) => {
            const month = idx + 1;
            const isEven = idx % 2 === 0;
            return (
              <div
                key={month}
                className={`grid items-center gap-3 px-4 py-2.5 ${isShopify ? "grid-cols-[80px_1fr]" : "grid-cols-[80px_1fr_1fr]"} ${isEven ? "bg-transparent" : "bg-[#FFBC80]/3 dark:bg-[#FFBC80]/5"}`}
              >
                <span className="text-xs font-semibold text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">{label}</span>

                {/* Retail price — required for all stores */}
                <div>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={grid[month].retail}
                      onChange={(e) => setCell(month, "retail", e.target.value)}
                      placeholder="0.00"
                      className={inputCls + " pl-5"}
                    />
                  </div>
                </div>

                {/* Wholesale price — hidden for Shopify */}
                {!isShopify && (
                  <div>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={grid[month].wholesale}
                        onChange={(e) => setCell(month, "wholesale", e.target.value)}
                        placeholder="0.00"
                        className={inputCls + " pl-5"}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Save row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
          {isShopify ? "Shopify is direct-to-consumer — wholesale price not applicable." : "All prices in USD."}
        </p>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-[#3A3A3A] hover:opacity-90 transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}
        >
          {savedOk ? <Check size={14} /> : <Save size={14} />}
          {saving ? "Saving…" : savedOk ? "Saved!" : "Save Forecast"}
        </button>
      </div>
    </div>
  );
}
