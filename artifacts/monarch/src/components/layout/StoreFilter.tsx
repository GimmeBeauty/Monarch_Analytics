import { useRef, useEffect, useState } from "react";
import { ChevronDown, Store, Check } from "lucide-react";
import { useStoreFilter } from "@/context/StoreFilterContext";
import { STORES, STORE_GROUPS } from "@/lib/storeData";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isStoreSelected(selectedIds: string[], id: string): boolean {
  return selectedIds.length === 0 || selectedIds.includes(id);
}

function isGroupSelected(selectedIds: string[], groupId: string): boolean {
  const groupStores = STORES.filter((s) => s.group === groupId);
  if (selectedIds.length === 0) return true;
  return groupStores.every((s) => selectedIds.includes(s.id));
}

function isGroupPartial(selectedIds: string[], groupId: string): boolean {
  if (selectedIds.length === 0) return false;
  const groupStores = STORES.filter((s) => s.group === groupId);
  const selected = groupStores.filter((s) => selectedIds.includes(s.id));
  return selected.length > 0 && selected.length < groupStores.length;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StoreFilter() {
  const { selectedIds, isAllSelected, label, storeWeight, toggleStore, toggleGroup, selectAll } =
    useStoreFilter();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const isFiltered = !isAllSelected;
  const pct = Math.round(storeWeight * 100);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
          isFiltered
            ? "border-[#FFBC80]/60 bg-[#FFBC80]/20 text-[#3A3A3A] dark:text-[#FFF9F2]"
            : "border-[#FFBC80]/30 bg-[#FFBC80]/8 text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 hover:border-[#FFBC80]/50 hover:bg-[#FFBC80]/15"
        }`}
        style={isFiltered ? {} : { backgroundColor: "rgba(255,188,128,0.06)" }}
      >
        <Store size={13} className="shrink-0" />
        <span>{label}</span>
        {isFiltered && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold leading-none"
            style={{ background: "linear-gradient(135deg, #FFBC80, #FFE29A)", color: "#3A3A3A" }}>
            {pct}%
          </span>
        )}
        <ChevronDown
          size={12}
          className={`shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-[#FFBC80]/35 bg-[#FFF9F2] dark:bg-[#1c1408] shadow-xl shadow-black/10 z-50 overflow-hidden"
          style={{ backdropFilter: "blur(12px)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#FFBC80]/20">
            <span className="text-xs font-semibold text-[#3A3A3A]/60 dark:text-[#FFF9F2]/50 uppercase tracking-wider">
              Stores
            </span>
            <button
              onClick={selectAll}
              className="text-xs font-medium text-[#FFBC80] hover:text-[#F5A56A] transition-colors"
            >
              {isAllSelected ? "All selected" : "Select all"}
            </button>
          </div>

          {/* Store groups */}
          <div className="py-1.5 max-h-80 overflow-y-auto">
            {STORE_GROUPS.map((group) => {
              const groupStores = STORES.filter((s) => s.group === group.id);
              const groupChecked  = isGroupSelected(selectedIds, group.id);
              const groupPartial  = isGroupPartial(selectedIds, group.id);

              return (
                <div key={group.id}>
                  {/* Group header row */}
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#FFBC80]/10 transition-colors group"
                  >
                    {/* Group checkbox */}
                    <div
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                        groupChecked
                          ? "border-[#FFBC80] bg-[#FFBC80]"
                          : groupPartial
                          ? "border-[#FFBC80] bg-[#FFBC80]/40"
                          : "border-[#3A3A3A]/25 dark:border-[#FFF9F2]/20 group-hover:border-[#FFBC80]/60"
                      }`}
                    >
                      {(groupChecked || groupPartial) && (
                        <Check size={9} strokeWidth={3} className="text-[#3A3A3A]" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#3A3A3A]/40 dark:text-[#FFF9F2]/35">
                      {group.label}
                    </span>
                  </button>

                  {/* Individual stores */}
                  {groupStores.map((store) => {
                    const checked = isStoreSelected(selectedIds, store.id);
                    return (
                      <button
                        key={store.id}
                        onClick={() => toggleStore(store.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 pl-6 hover:bg-[#FFBC80]/10 transition-colors group"
                      >
                        {/* Store checkbox */}
                        <div
                          className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                            checked
                              ? "border-[#FFBC80] bg-[#FFBC80]"
                              : "border-[#3A3A3A]/25 dark:border-[#FFF9F2]/20 group-hover:border-[#FFBC80]/60"
                          }`}
                        >
                          {checked && <Check size={9} strokeWidth={3} className="text-[#3A3A3A]" />}
                        </div>

                        {/* Store color dot */}
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: store.color }}
                        />

                        {/* Store label */}
                        <span
                          className={`text-xs transition-colors truncate ${
                            checked
                              ? "text-[#3A3A3A] dark:text-[#FFF9F2] font-medium"
                              : "text-[#3A3A3A]/50 dark:text-[#FFF9F2]/40"
                          }`}
                        >
                          {store.label}
                        </span>

                        {/* Weight pill */}
                        <span className="ml-auto text-[10px] tabular-nums text-[#3A3A3A]/35 dark:text-[#FFF9F2]/25 shrink-0">
                          {Math.round(store.weight * 100)}%
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer — shows active coverage */}
          <div className="border-t border-[#FFBC80]/20 px-3 py-2 flex items-center justify-between">
            <span className="text-[10px] text-[#3A3A3A]/40 dark:text-[#FFF9F2]/30">
              Data coverage
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 rounded-full bg-[#FFBC80]/20 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    background: "linear-gradient(90deg, #FFBC80, #FFE29A)",
                  }}
                />
              </div>
              <span className="text-[10px] font-semibold tabular-nums text-[#3A3A3A]/55 dark:text-[#FFF9F2]/45">
                {pct}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
