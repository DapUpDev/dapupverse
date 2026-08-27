/**
 * App-wide repository bindings. Milestone 2 binds every repository to the
 * browser-local mock adapters; a later milestone replaces this module's
 * exports with real backend adapters without touching consumers.
 */

import { mockDataStore } from "@/lib/mock/store";
import { createMockRepositories } from "@/lib/repositories/mock";

export const {
  mentorRepository,
  studentProfileRepository,
  connectionRepository,
  messageRepository,
} = createMockRepositories(mockDataStore);

export * from "@/lib/repositories/types";
