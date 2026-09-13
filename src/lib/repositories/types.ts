/**
 * Repository boundaries for DapUp data access.
 *
 * UI code depends on these interfaces only. Milestone 2 binds them to
 * browser-local mock adapters; a later milestone will bind them to the real
 * backend without changing consumers.
 */

import type {
  ConnectionRequest,
  Connection,
  CreateConnectionRequestInput,
  Mentor,
  MentorFilters,
  MentorProfile,
  Message,
  MessageThread,
  StudentProfile,
  UpdateMentorProfileInput,
  UpdateStudentProfileInput,
} from "@/lib/domain/types";

export interface MentorRepository {
  /** Public mentor listing. Results never contain pricing. */
  list(filters?: MentorFilters): Promise<Mentor[]>;
  /** Public mentor lookup. Result never contains pricing. */
  getBySlug(slug: string): Promise<Mentor | null>;
  /**
   * Private mentor profile including the private price. Callers must gate
   * access: the mentor themselves, a student with an accepted connection to
   * this mentor, or a user with explicit admin capability.
   */
  getPrivateProfile(mentorId: string): Promise<MentorProfile | null>;
  updateProfile(input: UpdateMentorProfileInput): Promise<MentorProfile>;
  /**
   * Create an incomplete browser-local mentor profile if none exists (no-op
   * otherwise). Used for promoted mentors without a seeded-profile mapping —
   * they must never borrow another mentor's identity.
   */
  ensureProfile(mentorId: string): Promise<MentorProfile>;
}

export interface StudentProfileRepository {
  get(studentId: string): Promise<StudentProfile | null>;
  update(input: UpdateStudentProfileInput): Promise<StudentProfile>;
  /** Create an incomplete browser-local profile if none exists (no-op otherwise). */
  ensure(studentId: string): Promise<StudentProfile>;
}

export interface AvatarRepository {
  /**
   * Upload a profile picture for the signed-in user and attach it to their
   * profile (mentor or student, decided by the account). Resolves to the
   * new read URL. The mock stores a data URL; the HTTP adapter uploads to
   * S3 through a presigned URL minted by the API.
   */
  upload(userId: string, file: File): Promise<string | null>;
  remove(userId: string): Promise<void>;
}

export interface ConnectionRepository {
  createRequest(input: CreateConnectionRequestInput): Promise<ConnectionRequest>;
  acceptRequest(id: string): Promise<Connection>;
  archiveForMentor(id: string): Promise<void>;
  unarchiveForMentor(id: string): Promise<void>;
  disconnect(connectionId: string): Promise<void>;
  block(connectionId: string): Promise<void>;
  listForStudent(studentId: string): Promise<ConnectionRequest[]>;
  listForMentor(mentorId: string): Promise<ConnectionRequest[]>;
  get(id: string): Promise<ConnectionRequest | null>;
  /** The student's active (pending or accepted) request to a mentor, if any. */
  findActiveForPair(
    studentId: string,
    mentorId: string,
  ): Promise<ConnectionRequest | null>;
}

export interface MessageRepository {
  listThreads(userId: string): Promise<MessageThread[]>;
  getThread(threadId: string): Promise<MessageThread | null>;
  listMessages(threadId: string): Promise<Message[]>;
  sendMessage(threadId: string, senderId: string, text: string): Promise<Message>;
  markThreadRead(threadId: string, userId: string): Promise<void>;
  unreadCount(threadId: string, userId: string): Promise<number>;
}

/** Thrown when a student already has an active request to the same mentor. */
export class DuplicateRequestError extends Error {
  constructor() {
    super("You already have an active request with this mentor.");
    this.name = "DuplicateRequestError";
  }
}

/** Thrown when a blocked pairing tries to create a new request. */
export class BlockedPairError extends Error {
  constructor() {
    super("A new request cannot be sent to this mentor.");
    this.name = "BlockedPairError";
  }
}

/** Thrown when messaging is attempted on a thread that is not writable. */
export class MessagingUnavailableError extends Error {
  constructor(message = "Messaging is not available for this conversation.") {
    super(message);
    this.name = "MessagingUnavailableError";
  }
}
