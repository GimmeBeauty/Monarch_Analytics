import { useState, useEffect, useCallback } from "react";
import { Plus, Save, Check, ChevronDown, Store, Calendar, AlertCircle, Trash2 } from "lucide-react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const STORAGE_KEY = "monarch-forecast-settings";

interface StoreRow { id: number; name: string; type: string; }
interface YearRow { id: number; year: number; }

type MonthData = { retail: string; wholesale: string; };
type Grid = Record<number, MonthData>; // month 1–12

interface ForecastStore {
  stores: StoreRow[];
  years: YearRow[];
  forecasts: Record<string, Grid>; // key: `${storeId}-${year}`
}

const DEFAULT_STORES: StoreRow[] = [
  { id: 1, name: "Amazon", type: "retail" },
  { id: 2, name: "CVS", type: "retail" },
  { id: 3, name: "Kroger", type: "retail" },
  { id: 4, name: "Publix", type: "retail" },
  { id: 5, name: "Shopify", type: "shopify" },
  { id: 6, name: "Target", type: "retail" },
  { id: 7, name: "Ulta Beauty", type: "retail" },
  { id: 8, name: "Walgreens", type: "retail" },
  { id: 9, name: "Walmart", type: "retail" },
];

const DEFAULT_YEARS: YearRow[] = [
  { id: 1, year: 2025 },
  { id: 2, year: 2026 },
];

function emptyGrid(): Grid {
  const g: Grid = {};
  for (let m = 1; m <= 12; m++) g[m] = { retail: "", wholesale: "" };
  return g;
}

function loadData(): ForecastStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { stores: DEFAULT_STORES, years: DEFAULT_YEARS, forecasts: {} };
}

function saveData(data: ForecastStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function ForecastSettings({ readOnly = false }: { readOnly?: boolean }) {
  const [data, setData] = useState<ForecastStore>(() => loadData());
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [grid, setGrid] = useState<Grid>(emptyGrid());
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add store modal state
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreType, setNewStoreType] = useState("retail");

  // Add year state
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYear, setNewYear] = useState("");

  // Init selection
  useEffect(() => {
    if (!selectedStore && data.stores.length) setSelectedStore(data.stores[0].id);
    if (!selectedYear && data.years.length) setSelectedYear(data.years[data.years.length - 1].year);
  }, [data.stores, data.years]);

  // Load grid when store or year changes
  const loadGrid = useCallback(() => {
    if (!selectedStore || !selectedYear) return;
    const key = `${selectedStore}-${selectedYear}`;
    setGrid(data.forecasts[key] ? { ...data.forecasts[key] } : emptyGrid());
  }, [selectedStore, selectedYear, data.forecasts]);

  useEffect(() => { loadGrid(); }, [loadGrid]);

  const isShopify = data.stores.find((s) => s.id === selectedStore)?.type === "shopify";

  const setCell = (month: number, field: "retail" | "wholesale", value: string) => {
    setGrid((g) => ({ ...g, [month]: { ...g[month], [field]: value } }));
  };

  const handleSave = () => {
    if (!selectedStore || !selectedYear) return;

    for (let m = 1; m <= 12; m++) {
      if (grid[m].retail && isNaN(Number(grid[m].retail))) {
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
    const key = `${selectedStore}-${selectedYear}`;
    const savedGrid: Grid = {};
    for (let m = 1; m <= 12; m++) {
      savedGrid[m] = {
        retail: grid[m].retail,
        wholesale: isShopify ? "" : grid[m].wholesale,
      };
    }
    const updated = { ...data, forecasts: { ...data.forecasts, [key]: savedGrid } };
    setData(updated);
    saveData(updated);
    setSaving(false);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2500);
  };

  const handleAddStore = () => {
    if (!newStoreName.trim()) return;
    const nextId = data.stores.length ? Math.max(...data.stores.map((s) => s.id)) + 1 : 1;
    const s: StoreRow = { id: nextId, name: newStoreName.trim(), type: newStoreType };
    const updated = { ...data, stores: [...data.stores, s] };
    setData(updated);
    saveData(updated);
    setSelectedStore(s.id);
    setNewStoreName("");
    setShowAddStore(false);
  };

  const handleDeleteStore = (id: number) => {
    const updated = { ...data, stores: data.stores.filter((s) => s.id !== id) };
    setData(updated);
    saveData(updated);
    if (selectedStore === id) {
      setSelectedStore(updated.stores.length ? updated.stores[0].id : null);
    }
  };

  const handleAddYear = () => {
    const y = parseInt(newYear, 10);
    if (!y) return;
    if (data.years.some((yr) => yr.year === y)) {
      setError(`Year ${y} already exists.`);
      return;
    }
    const nextId = data.years.length ? Math.max(...data.years.map((yr) => yr.id)) + 1 : 1;
    const yr: YearRow = { id: nextId, year: y };
    const updated = { ...data, years: [...data.years, yr].sort((a, b) => a.year - b.year) };
    setData(updated);
    saveData(updated);
    setSelectedYear(yr.year);
    setNewYear("");
    setShowAddYear(false);
  };

  const inputCls = "w-full px-2 py-1.5 rounded-lg text-xs bg-[#FFF9F2] dark:bg-[#1a1208] text-[#3A3A3A] dark:text-[#FFF9F2] border border-[#FFBC80]/40 focus:border-[#FFBC80] outline-none transition-colors text-right";
  const labelCls = "block text-[10px] font-medium text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40 mb-0.5";

  return (
    <div className={`space-y-5 ${readOnly ? "pointer-events-none select-none opacity-75" : ""}`}>
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
              {data.stores.map((s) => (
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
              {data.years.map((y) => (
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
              <button onClick={handleAddYear}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-[#3A3A3A] hover:opacity-85 transition-opacity"
                style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
                Add
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
            <button onClick={handleAddStore} disabled={!newStoreName.trim()}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-[#3A3A3A] hover:opacity-85 transition-opacity disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)" }}>
              Add Store
            </button>
            <button onClick={() => setShowAddStore(false)} className="text-xs text-[#3A3A3A]/40 hover:text-[#3A3A3A] dark:text-[#FFF9F2]/40 px-1">✕</button>
          </div>
        </div>
      )}

      {/* Store list with delete */}
      {data.stores.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.stores.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all cursor-pointer ${
                s.id === selectedStore
                  ? "border-[#FFBC80] bg-[#FFBC80]/15 text-[#3A3A3A] dark:text-[#FFF9F2] font-semibold"
                  : "border-[#FFBC80]/30 text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:border-[#FFBC80]/60"
              }`}
              onClick={() => setSelectedStore(s.id)}
            >
              <Store size={10} />
              {s.name}
              <span className="text-[9px] opacity-60 ml-0.5">{s.type === "shopify" ? "DTC" : "Retail"}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteStore(s.id); }}
                className="ml-1 opacity-40 hover:opacity-80 transition-opacity"
              >
                <Trash2 size={9} />
              </button>
            </div>
          ))}
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

        {data.stores.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
            Add a store to get started.
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
          disabled={saving || data.stores.length === 0}
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
