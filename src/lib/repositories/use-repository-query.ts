"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  repositoryChangeVersion,
  subscribeRepositoryChanges,
} from "@/lib/repositories/change-signal";

/**
 * Run an async repository query and re-run it whenever the underlying data
 * may have changed: a mock-store mutation, or a write through an HTTP
 * repository (see change-signal.ts). Presentational components stay
 * decoupled from both: they pass repository calls in and receive plain
 * data out.
 *
 * Nothing pushes another user's writes to this browser, so a query that
 * must notice them (messages) passes `refreshMs` and is re-run on that
 * interval while the tab is visible.
 * ponytail: polling. Swap for a pushed signal (WebSocket or SSE calling
 * notifyRepositoryChange) when chats are busy enough to feel the delay.
 *
 * Returns `ready: false` until the first result resolves on the client, so
 * server rendering and hydration stay consistent.
 */
export function useRepositoryQuery<T>(
  query: () => Promise<T>,
  deps: readonly unknown[],
  refreshMs?: number,
): { data: T | undefined; ready: boolean } {
  const version = useSyncExternalStore(
    subscribeRepositoryChanges,
    repositoryChangeVersion,
    () => 0,
  );
  const [state, setState] = useState<{ data: T | undefined; ready: boolean }>({
    data: undefined,
    ready: false,
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!refreshMs) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setTick((t) => t + 1);
    }, refreshMs);
    return () => window.clearInterval(id);
  }, [refreshMs]);

  useEffect(() => {
    let cancelled = false;
    query().then((data) => {
      if (!cancelled) setState({ data, ready: true });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, tick, ...deps]);

  return state;
}
