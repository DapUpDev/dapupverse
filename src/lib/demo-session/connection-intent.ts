"use client";

/**
 * Typed navigation intent storage.
 *
 * Preserves what the user was trying to do (connect with a specific mentor)
 * across the auth-required dialog and profile-setup detours. This is plain
 * navigation state, never authorization.
 */

import { useSyncExternalStore } from "react";
import type { ConnectionIntent } from "@/lib/domain/types";

const INTENT_STORAGE_KEY = "dapup.connection-intent.v1";

const intentListeners = new Set<() => void>();

function notifyIntentListeners(): void {
  for (const listener of intentListeners) listener();
}

export function saveConnectionIntent(intent: ConnectionIntent): void {
  try {
    window.sessionStorage.setItem(INTENT_STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // Storage unavailable: the user can restart the flow from the mentor page.
  }
  notifyIntentListeners();
}

export function loadConnectionIntent(): ConnectionIntent | null {
  try {
    const raw = window.sessionStorage.getItem(INTENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConnectionIntent;
    if (
      parsed &&
      parsed.kind === "connect-with-mentor" &&
      typeof parsed.mentorSlug === "string" &&
      typeof parsed.returnTo === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearConnectionIntent(): void {
  try {
    window.sessionStorage.removeItem(INTENT_STORAGE_KEY);
  } catch {
    // Ignore.
  }
  notifyIntentListeners();
}

function subscribeIntent(listener: () => void): () => void {
  intentListeners.add(listener);
  return () => intentListeners.delete(listener);
}

/** Hydration-safe: false on the server, live value on the client. */
export function useHasConnectionIntent(): boolean {
  return useSyncExternalStore(
    subscribeIntent,
    () => loadConnectionIntent() !== null,
    () => false,
  );
}
