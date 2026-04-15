import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { PricingMode } from "@/lib/wholesaleData";

interface PricingModeContextType {
  mode: PricingMode;
  setMode: (mode: PricingMode) => void;
  isWholesale: boolean;
}

const PricingModeContext = createContext<PricingModeContextType | null>(null);

const STORAGE_KEY = "monarch-pricing-mode";

export function PricingModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<PricingMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "wholesale" ? "wholesale" : "msrp";
    } catch {
      return "msrp";
    }
  });

  const setMode = useCallback((next: PricingMode) => {
    setModeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
  }, []);

  return (
    <PricingModeContext.Provider value={{ mode, setMode, isWholesale: mode === "wholesale" }}>
      {children}
    </PricingModeContext.Provider>
  );
}

export function usePricingMode(): PricingModeContextType {
  const ctx = useContext(PricingModeContext);
  if (!ctx) throw new Error("usePricingMode must be used within PricingModeProvider");
  return ctx;
}
