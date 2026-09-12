/**
 * App-wide repository bindings.
 *
 * The switch to the real backend happens here, one repository at a time,
 * without touching consumers. A repository is bound to its HTTP adapter
 * when NEXT_PUBLIC_API_BASE_URL is set (Vercel), and to the browser-local
 * mock otherwise (local development, unit tests, e2e).
 *
 * Every repository now has an HTTP adapter; the mock remains the binding
 * for local development, unit tests, and e2e.
 */

import { apiBaseUrl } from "@/lib/api/client";
import { mockDataStore } from "@/lib/mock/store";
import { createHttpConnectionRepository } from "@/lib/repositories/http-connection";
import { createHttpMentorRepository } from "@/lib/repositories/http-mentor";
import { createHttpMessageRepository } from "@/lib/repositories/http-message";
import { createHttpStudentProfileRepository } from "@/lib/repositories/http-student-profile";
import { createMockRepositories } from "@/lib/repositories/mock";
import type {
  ConnectionRepository,
  MentorRepository,
  MessageRepository,
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

export const connectionRepository: ConnectionRepository = useApi
  ? createHttpConnectionRepository()
  : mock.connectionRepository;

export const messageRepository: MessageRepository = useApi
  ? createHttpMessageRepository()
  : mock.messageRepository;

export * from "@/lib/repositories/types";
