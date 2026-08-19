import { useState, useEffect, useCallback } from "react";
import { Plus, Save, Check, ChevronDown, Store, Calendar, AlertCircle, Trash2 } from "lucide-react";
import { API_BASE } from "@/lib/apiBase";
import { useTheme } from "@/context/ThemeContext";
import { brandGradient } from "@/lib/brandGradient";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface StoreRow { id: number; name: string; type: string; }
interface YearRow { id: number; year: number; }

type MonthData = { retail: string; wholesale: string; };
type Grid = Record<number, MonthData>; // month 1–12

// Seed values used only to populate the shared store/year list on first run
// (when the database has none yet). Once seeded, every user reads the same
// server-side list via /api/forecast/stores and /api/forecast/years.
const DEFAULT_STORES: { name: string; type: string }[] = [
  { name: "Amazon", type: "retail" },
  { name: "CVS", type: "retail" },
  { name: "Kroger", type: "retail" },
  { name: "Publix", type: "retail" },
  { name: "Shopify", type: "shopify" },
  { name: "Target", type: "retail" },
  { name: "Ulta Beauty", type: "retail" },
  { name: "Walgreens", type: "retail" },
  { name: "Walmart", type: "retail" },
];

const DEFAULT_YEARS = [2025, 2026];

function emptyGrid(): Grid {
  const g: Grid = {};
  for (let m = 1; m <= 12; m++) g[m] = { retail: "", wholesale: "" };
  return g;
}

// Fetches the shared store list from the database; if it's empty (first run),
// seeds it with the defaults so every user starts from the same list.
async function fetchOrSeedStores(): Promise<StoreRow[]> {
  const res = await fetch(`${API_BASE}/api/forecast/stores`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load stores (HTTP ${res.status})`);
  let rows: StoreRow[] = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    await Promise.allSettled(
      DEFAULT_STORES.map(s => fetch(`${API_BASE}/api/forecast/stores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(s),
      }))
    );
    const res2 = await fetch(`${API_BASE}/api/forecast/stores`, { credentials: "include" });
    rows = res2.ok ? await res2.json() : [];
  }
  return rows;
}

// Same pattern for forecast years.
async function fetchOrSeedYears(): Promise<YearRow[]> {
  const res = await fetch(`${API_BASE}/api/forecast/years`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load years (HTTP ${res.status})`);
  let rows: YearRow[] = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    await Promise.allSettled(
      DEFAULT_YEARS.map(year => fetch(`${API_BASE}/api/forecast/years`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ year }),
      }))
    );
    const res2 = await fetch(`${API_BASE}/api/forecast/years`, { credentials: "include" });
    rows = res2.ok ? await res2.json() : [];
  }
  return rows.sort((a, b) => a.year - b.year);
}

export default function ForecastSettings({ readOnly = false }: { readOnly?: boolean }) {
  const { theme } = useTheme();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [years, setYears] = useState<YearRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedStore, setSelectedStore] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [grid, setGrid] = useState<Grid>(emptyGrid());
  const [gridLoading, setGridLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [annualGoalInput, setAnnualGoalInput] = useState("");

  // Add store modal state
  const [showAddStore, setShowAddStore] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreType, setNewStoreType] = useState("retail");
  const [addingStore, setAddingStore] = useState(false);

  // Add year state
  const [showAddYear, setShowAddYear] = useState(false);
  const [newYear, setNewYear] = useState("");
  const [addingYear, setAddingYear] = useState(false);

  // Load the shared store/year list from the server on mount. This list is
  // the same for every user — no per-browser fallback, so any load failure
  // is surfaced instead of silently substituting local-only defaults.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [storeRows, yearRows] = await Promise.all([fetchOrSeedStores(), fetchOrSeedYears()]);
        if (cancelled) return;
        setStores(storeRows);
        setYears(yearRows);
      } catch {
        if (cancelled) return;
        setError("Couldn't load the shared store/year list. Retry or check your connection — changes can't be saved until this loads.");
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Init selection once lists arrive
  useEffect(() => {
    if (!selectedStore && stores.length) setSelectedStore(stores[0].id);
    if (!selectedYear && years.length) setSelectedYear(years[years.length - 1].year);
  }, [stores, years]);

  // Load grid and annual goal when store or year changes. Goals live only in
  // the shared database — a failed load surfaces an error instead of
  // silently falling back to this browser's local data.
  const loadGrid = useCallback(() => {
    if (!selectedStore || !selectedYear) return;

    const storeName = stores.find(s => s.id === selectedStore)?.name ?? String(selectedStore);
    setGridLoading(true);

    fetch(`${API_BASE}/api/data/forecast/settings?year=${selectedYear}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((resp: { stores: Record<string, { months: Record<number, { retailGoal: number; wholesaleGoal: number }>; annualGoal: number }> }) => {
        const entry = resp.stores[storeName];
        if (entry) {
          const g = emptyGrid();
          for (let m = 1; m <= 12; m++) {
            const mo = entry.months[m];
            if (mo) {
              g[m] = {
                retail:    mo.retailGoal    > 0 ? String(mo.retailGoal)    : "",
                wholesale: mo.wholesaleGoal > 0 ? String(mo.wholesaleGoal) : "",
              };
            }
          }
          setGrid(g);
          setAnnualGoalInput(entry.annualGoal > 0 ? entry.annualGoal.toLocaleString("en-US") : "");
        } else {
          setGrid(emptyGrid());
          setAnnualGoalInput("");
        }
        setError(null);
      })
      .catch(() => {
        setGrid(emptyGrid());
        setAnnualGoalInput("");
        setError("Couldn't load saved goals for this store/year. Retry — showing a blank grid so it isn't mistaken for zero goals.");
      })
      .finally(() => setGridLoading(false));
  }, [selectedStore, selectedYear, stores]);

  useEffect(() => { loadGrid(); }, [loadGrid]);

  const isShopify = stores.find((s) => s.id === selectedStore)?.type === "shopify";

  const setCell = (month: number, field: "retail" | "wholesale", value: string) => {
    setGrid((g) => ({ ...g, [month]: { ...g[month], [field]: value } }));
  };

  const handleSave = async () => {
    if (!selectedStore || !selectedYear) return;

    for (let m = 1; m <= 12; m++) {
      if (grid[m].retail && isNaN(Number(grid[m].retail.replace(/,/g, "")))) {
        setError(`Retail price for ${MONTHS[m - 1]} must be a number.`);
        return;
      }
      if (grid[m].wholesale && isNaN(Number(grid[m].wholesale.replace(/,/g, "")))) {
        setError(`Wholesale price for ${MONTHS[m - 1]} must be a number.`);
        return;
      }
    }

    setError(null);
    setSaving(true);

    const storeName     = stores.find(s => s.id === selectedStore)?.name ?? String(selectedStore);
    const annualGoalVal = parseFloat(annualGoalInput.replace(/,/g, "")) || 0;

    // Build monthly POST payloads
    const monthPayloads = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return {
        year:          selectedYear,
        storeId:       storeName,
        month:         m,
        retailGoal:    parseFloat(grid[m].retail.replace(/,/g, ""))    || 0,
        wholesaleGoal: isShopify ? 0 : parseFloat(grid[m].wholesale.replace(/,/g, "")) || 0,
        annualGoal:    0,
        updatedBy:     "user",
      };
    });
    // Annual goal row (month = 0)
    const annualPayload = { year: selectedYear, storeId: storeName, month: 0, retailGoal: 0, wholesaleGoal: 0, annualGoal: annualGoalVal, updatedBy: "user" };

    try {
      await Promise.all(
        [...monthPayloads, annualPayload].map(payload =>
          fetch(`${API_BASE}/api/data/forecast/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); })
        )
      );
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch {
      // Goals are shared via the database only — surface the failure instead
      // of silently stashing it in this browser's localStorage, where other
      // users would never see it.
      setError("Failed to save — these goals were NOT stored and other users will not see them. Please retry.");
    }

    setSaving(false);
  };

  const handleAnnualGoalBlur = () => {
    if (!selectedYear || !selectedStore) return;
    const val = parseFloat(annualGoalInput.replace(/,/g, "")) || 0;
    setAnnualGoalInput(val > 0 ? val.toLocaleString("en-US") : "");

    const storeName = stores.find(s => s.id === selectedStore)?.name ?? String(selectedStore);

    fetch(`${API_BASE}/api/data/forecast/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ year: selectedYear, storeId: storeName, month: 0, retailGoal: 0, wholesaleGoal: 0, annualGoal: val, updatedBy: "user" }),
    }).then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }).catch(() => {
      setError("Failed to save the annual goal — it was NOT stored and other users will not see it. Please retry.");
    });
  };

  const handleAddStore = async () => {
    if (!newStoreName.trim()) return;
    setAddingStore(true);
    try {
      const res = await fetch(`${API_BASE}/api/forecast/stores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newStoreName.trim(), type: newStoreType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const created: StoreRow = await res.json();
      setStores(prev => [...prev, created]);
      setSelectedStore(created.id);
      setNewStoreName("");
      setShowAddStore(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add store — it was not saved for other users.");
    } finally {
      setAddingStore(false);
    }
  };

  // No backend delete endpoint exists for stores yet, so this only hides the
  // store from this browser's view — it still exists for other users.
  const handleDeleteStore = (id: number) => {
    setStores(prev => prev.filter((s) => s.id !== id));
    if (selectedStore === id) {
      setSelectedStore(stores.length > 1 ? stores.find(s => s.id !== id)!.id : null);
    }
  };

  const handleAddYear = async () => {
    const y = parseInt(newYear, 10);
    if (!y) return;
    if (years.some((yr) => yr.year === y)) {
      setError(`Year ${y} already exists.`);
      return;
    }
    setAddingYear(true);
    try {
      const res = await fetch(`${API_BASE}/api/forecast/years`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ year: y }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const created: YearRow = await res.json();
      setYears(prev => [...prev, created].sort((a, b) => a.year - b.year));
      setSelectedYear(created.year);
      setNewYear("");
      setShowAddYear(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add year — it was not saved for other users.");
    } finally {
      setAddingYear(false);
    }
  };

  const inputCls = "w-full px-2 py-1.5 rounded-lg text-xs bg-[#FFF9F2] dark:bg-[#FFFFFF] text-[#3A3A3A] dark:text-[#003349] border border-[#FFBC80]/40 dark:border-[#9BDBF3]/40 focus:border-[#FFBC80] dark:focus:border-[#9BDBF3] outline-none transition-colors text-right";
  const labelCls = "block text-[10px] font-medium text-[#3A3A3A]/50 dark:text-[#003349]/40 mb-0.5";

  const formatWithCommas = (val: string): string => {
    const n = parseFloat(val.replace(/,/g, ""));
    return isNaN(n) || val === "" ? val : n.toLocaleString("en-US");
  };

  const handleCellBlur = (month: number, field: "retail" | "wholesale") => {
    const raw = grid[month][field].replace(/,/g, "");
    setCell(month, field, formatWithCommas(raw));
  };

  return (
    <div className={`space-y-5 ${readOnly ? "pointer-events-none select-none opacity-75" : ""}`}>
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-[#3A3A3A] dark:text-[#003349]">Forecast Settings</h2>
        <p className="text-xs text-[#3A3A3A]/50 dark:text-[#003349]/40 mt-0.5">
          Set monthly retail and wholesale price forecasts per store and year.
        </p>
      </div>

      {/* Annual Revenue Goal */}
      <div className="rounded-xl p-4 bg-white dark:bg-[#FFFFFF] border border-[#FFBC80]/30 dark:border-[#9BDBF3]/30">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#003349]/45 uppercase tracking-wider mb-1.5">
              Annual Revenue Goal{selectedYear ? ` — ${selectedYear}` : ""}
            </label>
            <p className="text-[10px] text-[#3A3A3A]/40 dark:text-[#003349]/30 mb-2">
              Used for % to Annual Goal KPI and scenario comparison on the Forecast page.
            </p>
            <div className="relative max-w-[220px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#3A3A3A]/40 dark:text-[#003349]/30">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={annualGoalInput}
                onChange={(e) => setAnnualGoalInput(e.target.value)}
                onBlur={handleAnnualGoalBlur}
                placeholder="e.g. 2000000"
                className="w-full pl-6 pr-3 py-2 rounded-lg text-sm bg-[#FFF9F2] dark:bg-[#FFFFFF] text-[#3A3A3A] dark:text-[#003349] border border-[#FFBC80]/40 dark:border-[#9BDBF3]/40 focus:border-[#FFBC80] dark:focus:border-[#9BDBF3] outline-none transition-colors"
              />
            </div>
          </div>
          {annualGoalInput && parseFloat(annualGoalInput.replace(/,/g, "")) > 0 && (
            <div className="text-xs text-[#3A3A3A]/50 dark:text-[#003349]/40 pb-2 space-y-0.5">
              <p>Conservative: <span className="font-semibold">${Math.round(parseFloat(annualGoalInput.replace(/,/g, "")) * 0.90 / 1000)}k</span></p>
              <p>BHAG: <span className="font-semibold">${Math.round(parseFloat(annualGoalInput.replace(/,/g, "")) * 1.15 / 1000)}k</span></p>
            </div>
          )}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-100 border border-red-200 dark:border-red-300/30">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600 dark:text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600 text-xs">✕</button>
        </div>
      )}

      {/* Controls row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Store selector */}
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#003349]/45 uppercase tracking-wider mb-1.5">
            <Store size={11} className="inline mr-1" />Store
          </label>
          <div className="relative">
            <select
              value={selectedStore ?? ""}
              onChange={(e) => setSelectedStore(Number(e.target.value))}
              className="w-full appearance-none px-3 py-2 pr-8 rounded-lg text-sm bg-white dark:bg-[#FFFFFF] text-[#3A3A3A] dark:text-[#003349] border border-[#FFBC80]/40 dark:border-[#9BDBF3]/40 focus:border-[#FFBC80] dark:focus:border-[#9BDBF3] outline-none cursor-pointer"
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
          <label className="block text-xs font-semibold text-[#3A3A3A]/55 dark:text-[#003349]/45 uppercase tracking-wider mb-1.5">
            <Calendar size={11} className="inline mr-1" />Year
          </label>
          <div className="relative">
            <select
              value={selectedYear ?? ""}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full appearance-none px-3 py-2 pr-8 rounded-lg text-sm bg-white dark:bg-[#FFFFFF] text-[#3A3A3A] dark:text-[#003349] border border-[#FFBC80]/40 dark:border-[#9BDBF3]/40 focus:border-[#FFBC80] dark:focus:border-[#9BDBF3] outline-none cursor-pointer"
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
                type="text"
                inputMode="numeric"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                placeholder="2027"
                className="w-20 px-2 py-2 rounded-lg text-sm border border-[#FFBC80]/50 dark:border-[#9BDBF3]/50 focus:border-[#FFBC80] dark:focus:border-[#9BDBF3] outline-none bg-white dark:bg-[#FFFFFF] text-[#3A3A3A] dark:text-[#003349]"
                onKeyDown={(e) => e.key === "Enter" && handleAddYear()}
              />
              <button onClick={handleAddYear}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-[#3A3A3A] hover:opacity-85 transition-opacity"
                style={{ background: brandGradient(theme) }}>
                Add
              </button>
              <button onClick={() => setShowAddYear(false)} className="text-xs text-[#3A3A3A]/40 hover:text-[#3A3A3A] dark:text-[#003349]/40 px-1">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowAddYear(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[#3A3A3A]/60 dark:text-[#003349]/50 border border-[#FFBC80]/30 dark:border-[#9BDBF3]/30 hover:border-[#FFBC80]/60 dark:hover:border-[#9BDBF3]/60 hover:bg-[#FFBC80]/8 dark:hover:bg-[#EFBAE1]/8 transition-all">
              <Plus size={12} /> Add Year
            </button>
          )}
        </div>

        {/* Add store */}
        <div>
          <button onClick={() => setShowAddStore(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[#3A3A3A]/60 dark:text-[#003349]/50 border border-[#FFBC80]/30 hover:border-[#FFBC80]/60 hover:bg-[#FFBC80]/8 transition-all">
            <Plus size={12} /> Add Store
          </button>
        </div>
      </div>

      {/* Add store modal */}
      {showAddStore && (
        <div className="p-4 rounded-xl bg-white dark:bg-[#FFFFFF] border border-[#FFBC80]/40 dark:border-[#9BDBF3]/40">
          <p className="text-xs font-semibold text-[#3A3A3A] dark:text-[#003349] mb-3">New Store</p>
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <label className={labelCls}>Store Name</label>
              <input
                type="text"
                value={newStoreName}
                onChange={(e) => setNewStoreName(e.target.value)}
                placeholder="e.g. Costco"
                className="w-full px-3 py-1.5 rounded-lg text-sm border border-[#FFBC80]/50 dark:border-[#9BDBF3]/50 focus:border-[#FFBC80] dark:focus:border-[#9BDBF3] outline-none bg-[#FFF9F2] dark:bg-[#FFFFFF] text-[#3A3A3A] dark:text-[#003349]"
                onKeyDown={(e) => e.key === "Enter" && handleAddStore()}
              />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select value={newStoreType} onChange={(e) => setNewStoreType(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm border border-[#FFBC80]/50 dark:border-[#9BDBF3]/50 focus:border-[#FFBC80] dark:focus:border-[#9BDBF3] outline-none bg-[#FFF9F2] dark:bg-[#FFFFFF] text-[#3A3A3A] dark:text-[#003349]">
                <option value="retail">Retail</option>
                <option value="shopify">Shopify (DTC)</option>
              </select>
            </div>
            <button onClick={handleAddStore} disabled={!newStoreName.trim() || addingStore}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-[#3A3A3A] hover:opacity-85 transition-opacity disabled:opacity-40"
              style={{ background: brandGradient(theme) }}>
              {addingStore ? "Adding…" : "Add Store"}
            </button>
            <button onClick={() => setShowAddStore(false)} className="text-xs text-[#3A3A3A]/40 hover:text-[#3A3A3A] dark:text-[#003349]/40 px-1">✕</button>
          </div>
        </div>
      )}

      {/* Store list with delete */}
      {stores.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stores.map((s) => (
            <div
              key={s.id}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-all cursor-pointer ${
                s.id === selectedStore
                  ? "border-[#FFBC80] dark:border-[#BFA1E3] bg-[#FFBC80]/15 dark:bg-[#BFA1E3]/15 text-[#3A3A3A] dark:text-[#003349] font-semibold"
                  : "border-[#FFBC80]/30 dark:border-[#9BDBF3]/30 text-[#3A3A3A]/60 dark:text-[#003349]/50 hover:border-[#FFBC80]/60 dark:hover:border-[#9BDBF3]/60"
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
      <div className="rounded-xl bg-white dark:bg-[#FFFFFF] border border-[#FFBC80]/30 dark:border-[#9BDBF3]/30 overflow-hidden">
        {/* Column headers */}
        <div
          className={`grid text-[10px] font-bold uppercase tracking-wider text-[#3A3A3A]/55 dark:text-[#003349]/45 px-4 py-2.5 border-b border-[#FFBC80]/15 dark:border-[#9BDBF3]/15 ${isShopify ? "grid-cols-[80px_1fr]" : "grid-cols-[80px_1fr_1fr]"}`}
        >
          <span>Month</span>
          <span className="text-right">Retail Price</span>
          {!isShopify && <span className="text-right">Wholesale Price</span>}
        </div>

        {listLoading ? (
          <div className="py-10 text-center text-xs text-[#3A3A3A]/40 dark:text-[#003349]/30">
            Loading shared store list…
          </div>
        ) : stores.length === 0 ? (
          <div className="py-10 text-center text-xs text-[#3A3A3A]/40 dark:text-[#003349]/30">
            Add a store to get started.
          </div>
        ) : (
          MONTHS.map((label, idx) => {
            const month = idx + 1;
            const isEven = idx % 2 === 0;
            return (
              <div
                key={month}
                className={`grid items-center gap-3 px-4 py-2.5 ${isShopify ? "grid-cols-[80px_1fr]" : "grid-cols-[80px_1fr_1fr]"} ${isEven ? "bg-transparent" : "bg-[#FFBC80]/3 dark:bg-[#BFA1E3]/5"}`}
              >
                <span className="text-xs font-semibold text-[#3A3A3A]/70 dark:text-[#003349]/60">{label}</span>

                <div>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#3A3A3A]/40 dark:text-[#003349]/30">$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={grid[month].retail}
                      onChange={(e) => setCell(month, "retail", e.target.value.replace(/,/g, ""))}
                      onBlur={() => handleCellBlur(month, "retail")}
                      placeholder="0.00"
                      className={inputCls + " pl-5"}
                    />
                  </div>
                </div>

                {!isShopify && (
                  <div>
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#3A3A3A]/40 dark:text-[#003349]/30">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={grid[month].wholesale}
                        onChange={(e) => setCell(month, "wholesale", e.target.value.replace(/,/g, ""))}
                        onBlur={() => handleCellBlur(month, "wholesale")}
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
        <p className="text-xs text-[#3A3A3A]/40 dark:text-[#003349]/30">
          {isShopify ? "Shopify is direct-to-consumer — wholesale price not applicable." : "All prices in USD."}
        </p>
        <button
          onClick={handleSave}
          disabled={saving || stores.length === 0}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-[#3A3A3A] hover:opacity-90 transition-all disabled:opacity-50"
          style={{ background: brandGradient(theme) }}
        >
          {savedOk ? <Check size={14} /> : <Save size={14} />}
          {saving ? "Saving…" : savedOk ? "Saved!" : "Save Forecast"}
        </button>
      </div>
    </div>
  );
}
