import {
  createContext, useContext, useState, useCallback, useMemo,
  type ReactNode,
} from "react";
import { useTeam } from "./TeamContext";
import { STORES, STORE_GROUPS, combinedWeight } from "@/lib/storeData";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoreFilterState {
  /** IDs of selected stores. Empty array = all stores selected. */
  selectedIds: string[];
}

export interface StoreFilterContextValue {
  selectedIds:   string[];
  storeWeight:   number;   // 0–1; 1.0 when all stores are selected
  isAllSelected: boolean;
  label:         string;   // human-readable summary for the trigger button
  toggleStore:   (id: string) => void;
  toggleGroup:   (groupId: string) => void;
  selectAll:     () => void;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "monarch-store-filter";

function loadState(userId: string): StoreFilterState {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    if (raw) return JSON.parse(raw) as StoreFilterState;
  } catch {}
  return { selectedIds: [] };
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

  /** Normalise: if all stores are selected, store as empty array. */
  const normalise = (ids: string[]): string[] =>
    ids.length === STORES.length ? [] : ids;

  const toggleStore = useCallback(
    (id: string) => {
      setState((prev) => {
        // Treat empty as "all selected"
        const current =
          prev.selectedIds.length === 0
            ? STORES.map((s) => s.id)
            : prev.selectedIds;

        const next = current.includes(id)
          ? current.filter((s) => s !== id)
          : [...current, id];

        // Prevent deselecting the last store
        if (next.length === 0) return prev;

        const nextState = { selectedIds: normalise(next) };
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
        const current =
          prev.selectedIds.length === 0
            ? STORES.map((s) => s.id)
            : prev.selectedIds;

        const allInGroup = groupIds.every((id) => current.includes(id));

        let next: string[];
        if (allInGroup) {
          const remaining = current.filter((id) => !groupIds.includes(id));
          if (remaining.length === 0) return prev; // Prevent empty selection
          next = remaining;
        } else {
          next = [...new Set([...current, ...groupIds])];
        }

        const nextState = { selectedIds: normalise(next) };
        saveState(currentUserId, nextState);
        return nextState;
      });
    },
    [currentUserId],
  );

  const selectAll = useCallback(() => commit({ selectedIds: [] }), [commit]);

  const value = useMemo<StoreFilterContextValue>(() => {
    const { selectedIds } = state;
    const isAllSelected = selectedIds.length === 0;
    const storeWeight   = combinedWeight(selectedIds);

    let label: string;
    if (isAllSelected) {
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

    return { selectedIds, storeWeight, isAllSelected, label, toggleStore, toggleGroup, selectAll };
  }, [state, toggleStore, toggleGroup, selectAll]);

  return <StoreFilterCtx.Provider value={value}>{children}</StoreFilterCtx.Provider>;
}

export function useStoreFilter(): StoreFilterContextValue {
  return useContext(StoreFilterCtx);
}
