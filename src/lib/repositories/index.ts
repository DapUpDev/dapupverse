/**
 * App-wide repository bindings.
 *
 * The switch to the real backend happens here, one repository at a time,
 * without touching consumers. A repository is bound to its HTTP adapter
 * when NEXT_PUBLIC_API_BASE_URL is set (Vercel), and to the browser-local
 * mock otherwise (local development, unit tests, e2e).
 *
 * Moved to the API: mentors, student profiles.
 * Still browser-local: connections, messages.
 */

import { apiBaseUrl } from "@/lib/api/client";
import { mockDataStore } from "@/lib/mock/store";
import { createHttpMentorRepository } from "@/lib/repositories/http-mentor";
import { createHttpStudentProfileRepository } from "@/lib/repositories/http-student-profile";
import { createMockRepositories } from "@/lib/repositories/mock";
import type {
  MentorRepository,
  StudentProfileRepository,
} from "@/lib/repositories/types";

const mock = createMockRepositories(mockDataStore);
const useApi = apiBaseUrl() !== null;

export const mentorRepository: MentorRepository = useApi
  ? createHttpMentorRepository()
  : mock.mentorRepository;

export const studentProfileRepository: StudentProfileRepository = useApi
  ? createHttpStudentProfileRepository()
  : mock.studentProfileRepository;

export const { connectionRepository, messageRepository } = mock;

export * from "@/lib/repositories/types";
