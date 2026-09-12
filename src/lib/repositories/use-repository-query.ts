"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { mockDataStore } from "@/lib/mock/store";
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

function subscribe(listener: () => void): () => void {
  const unsubscribeMock = mockDataStore.subscribe(listener);
  const unsubscribeApi = subscribeRepositoryChanges(listener);
  return () => {
    unsubscribeMock();
    unsubscribeApi();
  };
}

// A number that changes whenever either source changes; useSyncExternalStore
// needs a stable, comparable snapshot.
let last = { mock: null as unknown, api: -1, key: 0 };
function getSnapshot(): number {
  const mock = mockDataStore.getSnapshot();
  const api = repositoryChangeVersion();
  if (mock !== last.mock || api !== last.api) {
    last = { mock, api, key: last.key + 1 };
  }
  return last.key;
}

export function useRepositoryQuery<T>(
  query: () => Promise<T>,
  deps: readonly unknown[],
): { data: T | undefined; ready: boolean } {
  const version = useSyncExternalStore(subscribe, getSnapshot, () => 0);
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
