import {
  createContext, useContext, useState, useCallback, useMemo,
  type ReactNode,
} from "react";
import { useTeam } from "./TeamContext";
import { STORES, STORE_GROUPS, combinedWeight } from "@/lib/storeData";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreFilterState {
  /** IDs of selected stores. Empty array = no stores selected (shows no data). */
  selectedIds: string[];
}

export interface StoreFilterContextValue {
  selectedIds:   string[];
  storeWeight:   number;   // 0–1; 1.0 when all stores are selected, 0 when none are
  isAllSelected: boolean;
  label:         string;   // human-readable summary for the trigger button
  toggleStore:   (id: string) => void;
  toggleGroup:   (groupId: string) => void;
  selectAll:     () => void;
  deselectAll:   () => void;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

// v2: empty array now means "no stores selected" instead of "all stores selected".
// A new key is used so old persisted `[]` values (which meant "all") aren't
// silently reinterpreted as "none" for existing users.
const STORAGE_KEY = "monarch-store-filter-v2";

function loadState(userId: string): StoreFilterState {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    if (raw) return JSON.parse(raw) as StoreFilterState;
  } catch {}
  // Default for new/unmigrated users: all stores explicitly selected.
  return { selectedIds: STORES.map((s) => s.id) };
}

function saveState(userId: string, state: StoreFilterState): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(state));
  } catch {}
}

// ─── Context ──────────────────────────────────────────────────────────────────

const StoreFilterCtx = createContext<StoreFilterContextValue>({
  selectedIds:   [],
  storeWeight:   1,
  isAllSelected: true,
  label:         "All Stores",
  toggleStore:   () => {},
  toggleGroup:   () => {},
  selectAll:     () => {},
  deselectAll:   () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function StoreFilterProvider({ children }: { children: ReactNode }) {
  const { currentUserId } = useTeam();
  const [state, setState] = useState<StoreFilterState>(() => loadState(currentUserId));

  const commit = useCallback(
    (next: StoreFilterState) => {
      setState(next);
      saveState(currentUserId, next);
    },
    [currentUserId],
  );

  const toggleStore = useCallback(
    (id: string) => {
      setState((prev) => {
        const current = prev.selectedIds;
        const next = current.includes(id)
          ? current.filter((s) => s !== id)
          : [...current, id];

        // Empty selection is allowed — it means "no stores selected".
        const nextState = { selectedIds: next };
        saveState(currentUserId, nextState);
        return nextState;
      });
    },
    [currentUserId],
  );

  const toggleGroup = useCallback(
    (groupId: string) => {
      const groupIds = STORES.filter((s) => s.group === groupId).map((s) => s.id);
      setState((prev) => {
        const current = prev.selectedIds;
        const allInGroup = groupIds.every((id) => current.includes(id));

        const next = allInGroup
          ? current.filter((id) => !groupIds.includes(id))
          : [...new Set([...current, ...groupIds])];

        const nextState = { selectedIds: next };
        saveState(currentUserId, nextState);
        return nextState;
      });
    },
    [currentUserId],
  );

  const selectAll   = useCallback(() => commit({ selectedIds: STORES.map((s) => s.id) }), [commit]);
  const deselectAll = useCallback(() => commit({ selectedIds: [] }), [commit]);

  const value = useMemo<StoreFilterContextValue>(() => {
    const { selectedIds } = state;
    const isAllSelected = selectedIds.length === STORES.length;
    const storeWeight   = combinedWeight(selectedIds);

    let label: string;
    if (selectedIds.length === 0) {
      label = "No Stores Selected";
    } else if (isAllSelected) {
      label = "All Stores";
    } else if (selectedIds.length === 1) {
      label = STORES.find((s) => s.id === selectedIds[0])?.label ?? "1 Store";
    } else {
      // Summarise by group if all stores in a group are selected
      const groups = STORE_GROUPS.filter((g) =>
        STORES.filter((s) => s.group === g.id).every((s) => selectedIds.includes(s.id)),
      );
      if (groups.length === 1 && STORES.filter((s) => s.group === groups[0].id).length === selectedIds.length) {
        label = groups[0].label;
      } else {
        label = `${selectedIds.length} Stores`;
      }
    }

    return { selectedIds, storeWeight, isAllSelected, label, toggleStore, toggleGroup, selectAll, deselectAll };
  }, [state, toggleStore, toggleGroup, selectAll, deselectAll]);

  return <StoreFilterCtx.Provider value={value}>{children}</StoreFilterCtx.Provider>;
}

export function useStoreFilter(): StoreFilterContextValue {
  return useContext(StoreFilterCtx);
}
