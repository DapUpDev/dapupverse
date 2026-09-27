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
 * Returns `ready: false` until the first result resolves on the client, so
 * server rendering and hydration stay consistent.
 */
export function useRepositoryQuery<T>(
  query: () => Promise<T>,
  deps: readonly unknown[],
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

  useEffect(() => {
    let cancelled = false;
    query().then((data) => {
      if (!cancelled) setState({ data, ready: true });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  return state;
}
