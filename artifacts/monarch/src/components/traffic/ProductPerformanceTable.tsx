import { useState, useMemo, useCallback } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, Settings2, Search, SlidersHorizontal, Star, ChevronRight } from "lucide-react";
import type { ProductRow } from "@/lib/trafficData";
import { STORES } from "@/lib/storeData";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = "productName"|"storeName"|"sales"|"units"|"storeCount"|"avgSellPrice"|"pctSalesOnline";
type SortDir = "asc"|"desc";

interface Filters {
  search: string;
  storeId: string;
  minSales: string;
  maxSales: string;
  minUnits: string;
  maxUnits: string;
  growthMin: string;
}

const defaultFilters: Filters = {
  search:"", storeId:"", minSales:"", maxSales:"", minUnits:"", maxUnits:"", growthMin:"",
};


// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n>=1_000_000) return `$${(n/1_000_000).toFixed(2)}M`;
  if (n>=1_000)     return `$${(n/1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtNum(n: number): string {
  if (n>=1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n>=1_000)     return `${(n/1_000).toFixed(1)}K`;
  return Math.round(n).toLocaleString();
}

function ChangePill({ v, positive=true }: { v: number; positive?: boolean }) {
  const good = positive ? v>=0 : v<=0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${
      good ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400"
           : "bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400"
    }`}>
      {v>=0 ? <ChevronUp className="w-3 h-3"/> : <ChevronDown className="w-3 h-3"/>}
      {Math.abs(v).toFixed(1)}%
    </span>
  );
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col!==sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-30"/>;
  return sortDir==="asc"
    ? <ChevronUp className="w-3 h-3 text-[#FFBC80]"/>
    : <ChevronDown className="w-3 h-3 text-[#FFBC80]"/>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

interface Props {
  products: ProductRow[];
  selectedStoreIds: string[];
  isWholesale?: boolean;
}

export default function ProductPerformanceTable({ products, selectedStoreIds, isWholesale = false }: Props) {
  const [sortKey, setSortKey]         = useState<SortKey>("sales");
  const [sortDir, setSortDir]         = useState<SortDir>("desc");
  const [filters, setFilters]         = useState<Filters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [showCols, setShowCols]       = useState(false);
  const [limit, setLimit]             = useState(PAGE_SIZE);
  const [visibleCols, setVisibleCols] = useState({
    avgSellPrice: true,
    pctSalesOnline: false,
  });

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev===key) setSortDir(d => d==="asc"?"desc":"asc");
      else { setSortDir("desc"); }
      return key;
    });
  }, []);

  const hasStoreCount = useMemo(() => products.some(p => p.storeCount !== undefined), [products]);

  // Derive store options from data (only stores present in current products)
  const storeOptions = useMemo(() => {
    const ids = [...new Set(products.map(p=>p.storeId))];
    return ids.map(id => products.find(p=>p.storeId===id)!).map(p=>({ id:p.storeId, label:p.storeName, color:p.storeColor }));
  }, [products]);

  const filtered = useMemo(() => {
    let rows = [...products];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(r => r.productName.toLowerCase().includes(q) || r.storeName.toLowerCase().includes(q));
    }
    if (filters.storeId) rows = rows.filter(r => r.storeId===filters.storeId);
    if (filters.minSales) rows = rows.filter(r => r.sales >= Number(filters.minSales));
    if (filters.maxSales) rows = rows.filter(r => r.sales <= Number(filters.maxSales));
    if (filters.minUnits) rows = rows.filter(r => r.units >= Number(filters.minUnits));
    if (filters.maxUnits) rows = rows.filter(r => r.units <= Number(filters.maxUnits));
    if (filters.growthMin) rows = rows.filter(r => r.changeInSales >= Number(filters.growthMin));

    // Sort
    rows.sort((a,b) => {
      let av = a[sortKey as keyof ProductRow] as number|string;
      let bv = b[sortKey as keyof ProductRow] as number|string;
      if (typeof av==="string") av=av.toLowerCase();
      if (typeof bv==="string") bv=bv.toLowerCase();
      if (av<bv) return sortDir==="asc"?-1:1;
      if (av>bv) return sortDir==="asc"?1:-1;
      return 0;
    });
    return rows;
  }, [products, filters, sortKey, sortDir]);

  const visible = filtered.slice(0, limit);
  const hasMore = filtered.length > limit;

  function Th({ col, label }: { col: SortKey; label: string }) {
    return (
      <th
        onClick={() => toggleSort(col)}
        className="px-3 py-2.5 text-left cursor-pointer select-none group"
      >
        <span className="flex items-center gap-1 text-xs font-semibold text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 uppercase tracking-wider group-hover:text-[#3A3A3A]/70 dark:group-hover:text-[#FFF9F2]/60 transition-colors whitespace-nowrap">
          {label} <SortIcon col={col} sortKey={sortKey} sortDir={sortDir}/>
        </span>
      </th>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden monarch-card">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#3A3A3A] dark:text-[#FFF9F2]">Product Performance</h2>
          <p className="text-xs text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 mt-0.5">{filtered.length} products</p>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#3A3A3A]/35 dark:text-[#FFF9F2]/30 pointer-events-none"/>
            <input
              value={filters.search}
              onChange={e => setFilters(f=>({...f, search:e.target.value}))}
              placeholder="Search product or store…"
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#FFBC80]/30 bg-[#FFBC80]/5 text-[#3A3A3A] dark:text-[#FFF9F2] placeholder-[#3A3A3A]/30 dark:placeholder-[#FFF9F2]/25 focus:outline-none focus:border-[#FFBC80]/60 w-52"
            />
          </div>

          {/* Filters toggle */}
          <button
            onClick={() => setShowFilters(v=>!v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              showFilters || Object.values(filters).some((v,i)=>i>0&&v!=="")
                ? "border-[#FFBC80]/60 bg-[#FFBC80]/20 text-[#3A3A3A] dark:text-[#FFF9F2]"
                : "border-[#FFBC80]/30 bg-[#FFBC80]/5 text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:border-[#FFBC80]/50"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5"/>Filters
          </button>

          {/* Column picker */}
          <div className="relative">
            <button
              onClick={() => setShowCols(v=>!v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#FFBC80]/30 bg-[#FFBC80]/5 text-xs font-medium text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:border-[#FFBC80]/50 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5"/>Columns
            </button>
            {showCols && (
              <div className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-[#FFBC80]/35 bg-[#FFF9F2] dark:bg-[#1c1408] shadow-xl z-50 py-1.5">
                {(Object.keys(visibleCols) as (keyof typeof visibleCols)[]).map(key => {
                  const labels: Record<string,string> = {
                    avgSellPrice:"Avg Sell Price",
                    pctSalesOnline:"% of Sales Online",
                  };
                  return (
                    <label key={key} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#FFBC80]/10 cursor-pointer">
                      <div
                        onClick={() => setVisibleCols(v=>({...v,[key]:!v[key]}))}
                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
                          visibleCols[key] ? "border-[#FFBC80] bg-[#FFBC80]" : "border-[#3A3A3A]/25 dark:border-[#FFF9F2]/20"
                        }`}
                      >
                        {visibleCols[key] && <svg viewBox="0 0 10 8" className="w-2 h-2 fill-[#3A3A3A]"><path d="M1 4l2.5 2.5L9 1"/></svg>}
                      </div>
                      <span className="text-xs text-[#3A3A3A] dark:text-[#FFF9F2]">{labels[key]}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter row */}
      {showFilters && (
        <div className="px-5 pb-4 flex flex-wrap gap-3 border-b border-[#FFBC80]/15">
          {/* Store filter */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">Store</label>
            <select
              value={filters.storeId}
              onChange={e=>setFilters(f=>({...f,storeId:e.target.value}))}
              className="text-xs rounded-lg border border-[#FFBC80]/30 bg-[#FFBC80]/5 text-[#3A3A3A] dark:text-[#FFF9F2] px-2 py-1.5 focus:outline-none focus:border-[#FFBC80]/60"
            >
              <option value="">All Stores</option>
              {storeOptions.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          {/* Sales range */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">Min Sales ($)</label>
            <input type="number" value={filters.minSales} onChange={e=>setFilters(f=>({...f,minSales:e.target.value}))}
              placeholder="0" className="text-xs rounded-lg border border-[#FFBC80]/30 bg-[#FFBC80]/5 text-[#3A3A3A] dark:text-[#FFF9F2] px-2 py-1.5 w-24 focus:outline-none focus:border-[#FFBC80]/60"/>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">Max Sales ($)</label>
            <input type="number" value={filters.maxSales} onChange={e=>setFilters(f=>({...f,maxSales:e.target.value}))}
              placeholder="∞" className="text-xs rounded-lg border border-[#FFBC80]/30 bg-[#FFBC80]/5 text-[#3A3A3A] dark:text-[#FFF9F2] px-2 py-1.5 w-24 focus:outline-none focus:border-[#FFBC80]/60"/>
          </div>

          {/* Units range */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">Min Units</label>
            <input type="number" value={filters.minUnits} onChange={e=>setFilters(f=>({...f,minUnits:e.target.value}))}
              placeholder="0" className="text-xs rounded-lg border border-[#FFBC80]/30 bg-[#FFBC80]/5 text-[#3A3A3A] dark:text-[#FFF9F2] px-2 py-1.5 w-24 focus:outline-none focus:border-[#FFBC80]/60"/>
          </div>

          {/* Growth min */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">Min Growth %</label>
            <input type="number" value={filters.growthMin} onChange={e=>setFilters(f=>({...f,growthMin:e.target.value}))}
              placeholder="-100" className="text-xs rounded-lg border border-[#FFBC80]/30 bg-[#FFBC80]/5 text-[#3A3A3A] dark:text-[#FFF9F2] px-2 py-1.5 w-24 focus:outline-none focus:border-[#FFBC80]/60"/>
          </div>

          <div className="flex items-end">
            <button onClick={()=>setFilters(defaultFilters)}
              className="text-xs text-[#FFBC80] hover:text-[#F5A56A] transition-colors py-1.5">
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-[#FFBC80]/15 bg-[#FFBC80]/5 dark:bg-[#FFBC80]/5">
              <th className="px-3 py-2.5 w-8"></th>
              <Th col="productName" label="Product"/>
              <th className="px-3 py-2.5 text-left">
                <span className="text-xs font-semibold text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 uppercase tracking-wider whitespace-nowrap">SKU</span>
              </th>
              {isWholesale && (
                <th className="px-3 py-2.5 text-left">
                  <span className="text-xs font-semibold text-[#3A3A3A]/45 dark:text-[#FFF9F2]/35 uppercase tracking-wider whitespace-nowrap">UPC</span>
                </th>
              )}
              <Th col="storeName"   label="Store"/>
              <Th col="sales"       label="Sales"/>
              <Th col="units"       label="Units"/>
              {hasStoreCount && !isWholesale && <Th col="storeCount" label="Store Count"/>}
              {visibleCols.avgSellPrice  && <Th col="avgSellPrice"   label="Avg Price"/>}
              {visibleCols.pctSalesOnline && <Th col="pctSalesOnline" label="Online %"/>}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => {
              const unitsChange = row.unitsPrior>0 ? ((row.units-row.unitsPrior)/row.unitsPrior)*100 : 0;
              return (
                <tr
                  key={row.id}
                  className={`border-b border-[#FFBC80]/8 transition-colors hover:bg-[#FFBC80]/5 ${
                    row.isTop10 ? "bg-[#FFBC80]/6 dark:bg-[#FFBC80]/5" : ""
                  }`}
                >
                  {/* Rank / Top-10 indicator */}
                  <td className="px-3 py-2.5">
                    {row.isTop10 ? (
                      <Star className="w-3.5 h-3.5 fill-[#FFBC80] text-[#FFBC80]"/>
                    ) : (
                      <span className="text-[11px] tabular-nums text-[#3A3A3A]/25 dark:text-[#FFF9F2]/20">{i+1}</span>
                    )}
                  </td>

                  {/* Product Name */}
                  <td className="px-3 py-2.5 max-w-[220px]">
                    <span className="text-xs font-medium text-[#3A3A3A] dark:text-[#FFF9F2] line-clamp-1">{row.productName}</span>
                  </td>

                  {/* SKU */}
                  <td className="px-3 py-2.5">
                    <span className="text-xs font-mono text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50">{row.sku || "—"}</span>
                  </td>

                  {/* UPC — wholesale mode only */}
                  {isWholesale && (
                    <td className="px-3 py-2.5">
                      <span className="text-xs font-mono text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50">{row.upc || "—"}</span>
                    </td>
                  )}

                  {/* Store */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:row.storeColor}}/>
                      <span className="text-xs text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60 whitespace-nowrap">{row.storeName}</span>
                    </div>
                  </td>

                  {/* Sales */}
                  <td className="px-3 py-2.5">
                    <div>
                      <span className="text-xs font-semibold tabular-nums text-[#3A3A3A] dark:text-[#FFF9F2]">{row.formattedSales}</span>
                      <div className="mt-0.5">
                        <ChangePill v={row.changeInSales}/>
                      </div>
                    </div>
                  </td>

                  {/* Units */}
                  <td className="px-3 py-2.5">
                    <div>
                      <span className="text-xs font-semibold tabular-nums text-[#3A3A3A] dark:text-[#FFF9F2]">{fmtNum(row.units)}</span>
                      <div className="mt-0.5">
                        <ChangePill v={unitsChange}/>
                      </div>
                    </div>
                  </td>

                  {/* Store Count — hidden in wholesale mode */}
                  {hasStoreCount && !isWholesale && (
                    <td className="px-3 py-2.5 text-xs tabular-nums text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">
                      {row.storeCount !== undefined ? fmtNum(row.storeCount) : "—"}
                    </td>
                  )}

                  {/* Optional columns */}
                  {visibleCols.avgSellPrice && (
                    <td className="px-3 py-2.5 text-xs tabular-nums text-[#3A3A3A]/70 dark:text-[#FFF9F2]/60">
                      ${row.avgSellPrice.toFixed(2)}
                    </td>
                  )}
                  {visibleCols.pctSalesOnline && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 rounded-full bg-[#FFBC80]/20 overflow-hidden">
                          <div className="h-full rounded-full" style={{width:`${row.pctSalesOnline}%`,background:"linear-gradient(90deg,#FFBC80,#FFE29A)"}}/>
                        </div>
                        <span className="text-xs tabular-nums text-[#3A3A3A]/65 dark:text-[#FFF9F2]/50">{row.pctSalesOnline.toFixed(0)}%</span>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {visible.length === 0 && (
          <div className="py-12 text-center text-sm text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
            No products match your filters.
          </div>
        )}
      </div>

      {/* See More */}
      {hasMore && (
        <div className="px-5 py-3 border-t border-[#FFBC80]/15 flex items-center justify-between">
          <span className="text-xs text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
            Showing {visible.length} of {filtered.length} products
          </span>
          <button
            onClick={() => setLimit(l=>l+PAGE_SIZE)}
            className="flex items-center gap-1 text-xs font-medium text-[#FFBC80] hover:text-[#F5A56A] transition-colors"
          >
            See More Products <ChevronRight className="w-3.5 h-3.5"/>
          </button>
        </div>
      )}
    </div>
  );
}
