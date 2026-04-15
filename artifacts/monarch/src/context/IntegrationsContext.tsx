import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useTeam } from "./TeamContext";
import type { ConnectionState, GoogleSheetConfig, SyncSchedule } from "@/lib/integrations/types";
import { INTEGRATION_REGISTRY } from "@/lib/integrations/registry";

// ─── Context Value ────────────────────────────────────────────────────────────

interface IntegrationsContextValue {
  connections: Record<string, ConnectionState>;
  sheets: GoogleSheetConfig[];
  connect: (integrationId: string, credentials: Record<string, string>) => void;
  disconnect: (integrationId: string) => void;
  updateCredentials: (integrationId: string, credentials: Record<string, string>) => void;
  setError: (integrationId: string, message: string) => void;
  setSyncing: (integrationId: string) => void;
  completeSyncNow: (integrationId: string) => void;
  toggleSync: (integrationId: string) => void;
  setSchedule: (integrationId: string, schedule: SyncSchedule) => void;
  addSheet: (sheet: Omit<GoogleSheetConfig, "id" | "connectedAt" | "lastSyncAt" | "status" | "errorMessage">) => void;
  updateSheet: (id: string, patch: Partial<GoogleSheetConfig>) => void;
  removeSheet: (id: string) => void;
  setSyncingSheet: (id: string) => void;
  completeSyncSheet: (id: string) => void;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "monarch-integrations";

interface StoredState {
  connections: Record<string, ConnectionState>;
  sheets: GoogleSheetConfig[];
}

/**
 * Encode credentials to base64 for basic obfuscation.
 * Production: replace with proper encryption (e.g. AES-GCM via SubtleCrypto).
 */
function encodeCredentials(creds: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(creds).map(([k, v]) => [k, v ? btoa(unescape(encodeURIComponent(v))) : ""]),
  );
}

function decodeCredentials(creds: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(creds).map(([k, v]) => {
      try { return [k, v ? decodeURIComponent(escape(atob(v))) : ""]; } catch { return [k, ""]; }
    }),
  );
}

function load(userId: string): StoredState {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    if (raw) {
      const parsed: StoredState = JSON.parse(raw);
      // Decode all credentials on load
      const connections = Object.fromEntries(
        Object.entries(parsed.connections ?? {}).map(([id, conn]) => [
          id,
          { ...conn, credentials: decodeCredentials(conn.credentials ?? {}) },
        ]),
      );
      return { connections, sheets: parsed.sheets ?? [] };
    }
  } catch {}
  return { connections: {}, sheets: [] };
}

function save(userId: string, state: StoredState) {
  try {
    const encoded: StoredState = {
      ...state,
      connections: Object.fromEntries(
        Object.entries(state.connections).map(([id, conn]) => [
          id,
          { ...conn, credentials: encodeCredentials(conn.credentials) },
        ]),
      ),
    };
    localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(encoded));
  } catch {}
}

// ─── Context ──────────────────────────────────────────────────────────────────

const Ctx = createContext<IntegrationsContextValue | null>(null);

export function IntegrationsProvider({ children }: { children: ReactNode }) {
  const { currentUserId } = useTeam();
  const [state, setState] = useState<StoredState>(() => load(currentUserId));

  const update = useCallback(
    (fn: (s: StoredState) => StoredState) => {
      setState((prev) => {
        const next = fn(prev);
        save(currentUserId, next);
        return next;
      });
    },
    [currentUserId],
  );

  // ── Integration Connections ────────────────────────────────────────────────

  const connect = useCallback(
    (integrationId: string, credentials: Record<string, string>) => {
      const def = INTEGRATION_REGISTRY.find((d) => d.id === integrationId);
      const tokenExpiresAt =
        def?.authType === "oauth"
          ? new Date(Date.now() + 3600 * 1000).toISOString() // 1h default
          : null;

      update((s) => ({
        ...s,
        connections: {
          ...s.connections,
          [integrationId]: {
            integrationId,
            status: "connected",
            credentials,
            syncEnabled: true,
            syncSchedule: def?.defaultSyncSchedule ?? "daily",
            lastSyncAt: null,
            connectedAt: new Date().toISOString(),
            errorMessage: null,
            tokenExpiresAt,
          },
        },
      }));
    },
    [update],
  );

  const disconnect = useCallback(
    (integrationId: string) => {
      update((s) => {
        const connections = { ...s.connections };
        delete connections[integrationId];
        return { ...s, connections };
      });
    },
    [update],
  );

  const updateCredentials = useCallback(
    (integrationId: string, credentials: Record<string, string>) => {
      update((s) => ({
        ...s,
        connections: {
          ...s.connections,
          [integrationId]: { ...s.connections[integrationId], credentials, errorMessage: null, status: "connected" },
        },
      }));
    },
    [update],
  );

  const setError = useCallback(
    (integrationId: string, message: string) => {
      update((s) => ({
        ...s,
        connections: {
          ...s.connections,
          [integrationId]: { ...s.connections[integrationId], status: "error", errorMessage: message },
        },
      }));
    },
    [update],
  );

  const setSyncing = useCallback(
    (integrationId: string) => {
      update((s) => ({
        ...s,
        connections: {
          ...s.connections,
          [integrationId]: { ...s.connections[integrationId], status: "syncing" },
        },
      }));
    },
    [update],
  );

  const completeSyncNow = useCallback(
    (integrationId: string) => {
      update((s) => ({
        ...s,
        connections: {
          ...s.connections,
          [integrationId]: {
            ...s.connections[integrationId],
            status: "connected",
            lastSyncAt: new Date().toISOString(),
            errorMessage: null,
          },
        },
      }));
    },
    [update],
  );

  const toggleSync = useCallback(
    (integrationId: string) => {
      update((s) => ({
        ...s,
        connections: {
          ...s.connections,
          [integrationId]: {
            ...s.connections[integrationId],
            syncEnabled: !s.connections[integrationId]?.syncEnabled,
          },
        },
      }));
    },
    [update],
  );

  const setSchedule = useCallback(
    (integrationId: string, schedule: SyncSchedule) => {
      update((s) => ({
        ...s,
        connections: {
          ...s.connections,
          [integrationId]: { ...s.connections[integrationId], syncSchedule: schedule },
        },
      }));
    },
    [update],
  );

  // ── Google Sheets ──────────────────────────────────────────────────────────

  const addSheet = useCallback(
    (sheet: Omit<GoogleSheetConfig, "id" | "connectedAt" | "lastSyncAt" | "status" | "errorMessage">) => {
      const newSheet: GoogleSheetConfig = {
        ...sheet,
        id: `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        status: "connected",
        connectedAt: new Date().toISOString(),
        lastSyncAt: null,
        errorMessage: null,
      };
      update((s) => ({ ...s, sheets: [...s.sheets, newSheet] }));
    },
    [update],
  );

  const updateSheet = useCallback(
    (id: string, patch: Partial<GoogleSheetConfig>) => {
      update((s) => ({
        ...s,
        sheets: s.sheets.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)),
      }));
    },
    [update],
  );

  const removeSheet = useCallback(
    (id: string) => {
      update((s) => ({ ...s, sheets: s.sheets.filter((sh) => sh.id !== id) }));
    },
    [update],
  );

  const setSyncingSheet = useCallback(
    (id: string) => {
      update((s) => ({
        ...s,
        sheets: s.sheets.map((sh) => (sh.id === id ? { ...sh, status: "syncing" } : sh)),
      }));
    },
    [update],
  );

  const completeSyncSheet = useCallback(
    (id: string) => {
      update((s) => ({
        ...s,
        sheets: s.sheets.map((sh) =>
          sh.id === id
            ? { ...sh, status: "connected", lastSyncAt: new Date().toISOString(), errorMessage: null }
            : sh,
        ),
      }));
    },
    [update],
  );

  return (
    <Ctx.Provider
      value={{
        ...state,
        connect, disconnect, updateCredentials,
        setError, setSyncing, completeSyncNow,
        toggleSync, setSchedule,
        addSheet, updateSheet, removeSheet, setSyncingSheet, completeSyncSheet,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useIntegrations() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useIntegrations must be used inside IntegrationsProvider");
  return ctx;
}
