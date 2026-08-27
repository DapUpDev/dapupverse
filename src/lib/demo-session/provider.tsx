"use client";

/**
 * Demo-session provider. Holds the current preview identity for local
 * development and Vercel preview deployments.
 *
 * `previewEnabled` is decided on the server (see `preview.ts`) and passed in
 * as a prop. When it is false — i.e. in production — the session is always
 * the visitor session and no role switching is possible, regardless of any
 * browser state.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { mockDataStore } from "@/lib/mock/store";
import {
  isDemoRole,
  sessionForRole,
  type DemoRole,
  type DemoSession,
} from "@/lib/demo-session/types";

const ROLE_STORAGE_KEY = "dapup.demo-role.v1";

/**
 * Tiny external store for the persisted preview role. useSyncExternalStore
 * keeps hydration consistent: the server snapshot is always "visitor" and the
 * client snapshot (which may restore a persisted role) is applied after
 * hydration.
 */
function readStoredRole(): DemoRole {
  try {
    const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
    return isDemoRole(stored) ? stored : "visitor";
  } catch {
    return "visitor";
  }
}

let currentRole: DemoRole =
  typeof window === "undefined" ? "visitor" : readStoredRole();
const roleListeners = new Set<() => void>();

function subscribeRole(listener: () => void): () => void {
  roleListeners.add(listener);
  return () => roleListeners.delete(listener);
}

function getRoleSnapshot(): DemoRole {
  return currentRole;
}

function getServerRoleSnapshot(): DemoRole {
  return "visitor";
}

function writeRole(next: DemoRole): void {
  currentRole = next;
  try {
    if (next === "visitor") {
      window.localStorage.removeItem(ROLE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(ROLE_STORAGE_KEY, next);
    }
  } catch {
    // Ignore storage failures in the demo.
  }
  for (const listener of roleListeners) listener();
}

/** Test-only: reset the module-level role store between tests. */
export function resetDemoRoleForTests(): void {
  currentRole = "visitor";
  for (const listener of roleListeners) listener();
}

type DemoSessionContextValue = {
  session: DemoSession;
  /** True only in local development and Vercel preview deployments. */
  previewEnabled: boolean;
  setRole: (role: DemoRole) => void;
  resetDemoData: () => void;
};

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({
  previewEnabled,
  children,
}: {
  previewEnabled: boolean;
  children: ReactNode;
}) {
  const role = useSyncExternalStore(
    subscribeRole,
    getRoleSnapshot,
    getServerRoleSnapshot,
  );

  // Load persisted mock data after mount (client only, preview only).
  useEffect(() => {
    if (previewEnabled) mockDataStore.hydrateFromLocalStorage();
  }, [previewEnabled]);

  const setRole = useCallback(
    (next: DemoRole) => {
      if (!previewEnabled) return;
      writeRole(next);
    },
    [previewEnabled],
  );

  const resetDemoData = useCallback(() => {
    if (!previewEnabled) return;
    mockDataStore.reset();
    writeRole("visitor");
  }, [previewEnabled]);

  const value = useMemo<DemoSessionContextValue>(
    () => ({
      session: previewEnabled ? sessionForRole(role) : sessionForRole("visitor"),
      previewEnabled,
      setRole,
      resetDemoData,
    }),
    [previewEnabled, role, setRole, resetDemoData],
  );

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  );
}

export function useDemoSession(): DemoSessionContextValue {
  const context = useContext(DemoSessionContext);
  if (!context) {
    throw new Error("useDemoSession must be used within DemoSessionProvider");
  }
  return context;
}
