/**
 * App-wide repository bindings.
 *
 * The switch to the real backend happens here, one repository at a time,
 * without touching consumers. A repository is bound to its HTTP adapter
 * when NEXT_PUBLIC_API_BASE_URL is set (Vercel), and to the browser-local
 * mock otherwise (local development, unit tests, e2e).
 *
 * Moved to the API: mentors (directory, detail, the mentor's own profile).
 * Still browser-local: student profiles, connections, messages.
 */

import { apiBaseUrl } from "@/lib/api/client";
import { mockDataStore } from "@/lib/mock/store";
import { createHttpMentorRepository } from "@/lib/repositories/http-mentor";
import { createMockRepositories } from "@/lib/repositories/mock";
import type { MentorRepository } from "@/lib/repositories/types";

const mock = createMockRepositories(mockDataStore);

export const mentorRepository: MentorRepository = apiBaseUrl()
  ? createHttpMentorRepository()
  : mock.mentorRepository;

export const { studentProfileRepository, connectionRepository, messageRepository } = mock;

export * from "@/lib/repositories/types";
