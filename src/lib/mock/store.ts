/**
 * Browser-local MOCK data store for the milestone 2 functional prototype.
 *
 * This is demo persistence only: state lives in memory and is mirrored to
 * localStorage so a refresh keeps the demo coherent. It is not a database,
 * offers no security, and will be replaced by a real backend behind the same
 * repository interfaces in a later milestone.
 *
 * Presentational components must not touch this module (or localStorage)
 * directly — they go through the repositories in `@/lib/repositories`.
 */

import type {
  ConnectionRequest,
  MentorProfile,
  Message,
  MessageThread,
  StudentProfile,
} from "@/lib/domain/types";
import {
  SEED_CONNECTION_REQUESTS,
  SEED_MENTOR_PROFILES,
  SEED_MESSAGES,
  SEED_STUDENT_PROFILES,
  SEED_THREADS,
} from "@/lib/data/seed";

export type MockData = {
  mentorProfiles: MentorProfile[];
  studentProfiles: StudentProfile[];
  requests: ConnectionRequest[];
  threads: MessageThread[];
  messages: Message[];
};

const STORAGE_KEY = "dapup.demo-data.v1";

function seedData(): MockData {
  return structuredClone({
    mentorProfiles: SEED_MENTOR_PROFILES,
    studentProfiles: SEED_STUDENT_PROFILES,
    requests: SEED_CONNECTION_REQUESTS,
    threads: SEED_THREADS,
    messages: SEED_MESSAGES,
  });
}

export class MockDataStore {
  private data: MockData = seedData();
  private listeners = new Set<() => void>();
  private hydrated = false;
  private idCounter = 0;

  /** Stable snapshot for useSyncExternalStore; reference changes on every mutation. */
  getSnapshot = (): MockData => this.data;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /**
   * Load persisted demo state from localStorage. Safe to call repeatedly;
   * no-ops on the server and after the first successful hydration.
   */
  hydrateFromLocalStorage(): void {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as MockData;
      if (parsed && Array.isArray(parsed.mentorProfiles)) {
        this.data = parsed;
        this.notify();
      }
    } catch {
      // Corrupt or unavailable storage: keep the seed state.
    }
  }

  /** Apply a mutation to a draft copy, persist it, and notify subscribers. */
  mutate(mutator: (draft: MockData) => void): void {
    const draft = structuredClone(this.data);
    mutator(draft);
    this.data = draft;
    this.persist();
    this.notify();
  }

  /** Reset all demo data back to the deterministic seed. */
  reset(): void {
    this.data = seedData();
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures in the demo.
    }
    this.notify();
  }

  newId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${this.idCounter}`;
  }

  private persist(): void {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      }
    } catch {
      // Ignore storage failures in the demo.
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

/** App-wide singleton store. Tests should construct their own `MockDataStore`. */
export const mockDataStore = new MockDataStore();
