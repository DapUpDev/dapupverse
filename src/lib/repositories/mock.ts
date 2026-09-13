/**
 * Mock repository adapters bound to the browser-local MockDataStore.
 * Demo persistence only — see `@/lib/mock/store`.
 */

import type {
  Connection,
  ConnectionRequest,
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
import { filterMentors } from "@/lib/domain/filter-mentors";
import type { MockDataStore } from "@/lib/mock/store";
import {
  BlockedPairError,
  DuplicateRequestError,
  MessagingUnavailableError,
  type ConnectionRepository,
  type MentorRepository,
  type MessageRepository,
  type StudentProfileRepository,
} from "@/lib/repositories/types";

/** Strip private fields from a mentor profile for public consumption. */
export function toPublicMentor(profile: MentorProfile): Mentor {
  const { privatePriceUsd, ...publicMentor } = profile;
  void privatePriceUsd;
  return publicMentor;
}

export function createMockRepositories(store: MockDataStore): {
  mentorRepository: MentorRepository;
  studentProfileRepository: StudentProfileRepository;
  connectionRepository: ConnectionRepository;
  messageRepository: MessageRepository;
} {
  // Incomplete profiles (no name yet — e.g. a newly promoted mentor still
  // setting up) are excluded from the public directory.
  const isPubliclyListed = (profile: MentorProfile) =>
    profile.name.trim() !== "";

  const mentorRepository: MentorRepository = {
    async list(filters?: MentorFilters): Promise<Mentor[]> {
      const publicMentors = store
        .getSnapshot()
        .mentorProfiles.filter(isPubliclyListed)
        .map(toPublicMentor);
      return filterMentors(publicMentors, filters);
    },

    async getBySlug(slug: string): Promise<Mentor | null> {
      const profile = store
        .getSnapshot()
        .mentorProfiles.find((m) => m.slug === slug && isPubliclyListed(m));
      return profile ? toPublicMentor(profile) : null;
    },

    async getPrivateProfile(mentorId: string): Promise<MentorProfile | null> {
      const profile = store
        .getSnapshot()
        .mentorProfiles.find((m) => m.id === mentorId);
      return profile ? structuredClone(profile) : null;
    },

    async updateProfile(input: UpdateMentorProfileInput): Promise<MentorProfile> {
      const { mentorId, ...changes } = input;
      let updated: MentorProfile | null = null;
      store.mutate((draft) => {
        const profile = draft.mentorProfiles.find((m) => m.id === mentorId);
        if (!profile) throw new Error(`Unknown mentor: ${mentorId}`);
        Object.assign(profile, changes);
        updated = structuredClone(profile);
      });
      if (!updated) throw new Error(`Unknown mentor: ${mentorId}`);
      return updated;
    },

    async ensureProfile(mentorId: string): Promise<MentorProfile> {
      const existing = store
        .getSnapshot()
        .mentorProfiles.find((m) => m.id === mentorId);
      if (existing) return structuredClone(existing);
      const profile: MentorProfile = {
        id: mentorId,
        slug: mentorId,
        name: "",
        university: "",
        major: "",
        countryRegion: "",
        biography: "",
        services: [],
        subjects: [],
        educationSystems: [],
        privatePriceUsd: 0,
      };
      store.mutate((draft) => {
        draft.mentorProfiles.push(profile);
      });
      return structuredClone(profile);
    },
  };

  const studentProfileRepository: StudentProfileRepository = {
    async get(studentId: string): Promise<StudentProfile | null> {
      const profile = store
        .getSnapshot()
        .studentProfiles.find((s) => s.id === studentId);
      return profile ? structuredClone(profile) : null;
    },

    async update(input: UpdateStudentProfileInput): Promise<StudentProfile> {
      const { studentId, ...changes } = input;
      let updated: StudentProfile | null = null;
      store.mutate((draft) => {
        const profile = draft.studentProfiles.find((s) => s.id === studentId);
        if (!profile) throw new Error(`Unknown student: ${studentId}`);
        Object.assign(profile, changes);
        updated = structuredClone(profile);
      });
      if (!updated) throw new Error(`Unknown student: ${studentId}`);
      return updated;
    },

    async ensure(studentId: string): Promise<StudentProfile> {
      const existing = store
        .getSnapshot()
        .studentProfiles.find((s) => s.id === studentId);
      if (existing) return structuredClone(existing);
      const profile: StudentProfile = {
        id: studentId,
        fullName: "",
        school: "",
        yearLevel: "",
        educationSystem: null,
        subjects: [],
        biography: "",
      };
      store.mutate((draft) => {
        draft.studentProfiles.push(profile);
      });
      return structuredClone(profile);
    },
  };

  const connectionRepository: ConnectionRepository = {
    async createRequest(
      input: CreateConnectionRequestInput,
    ): Promise<ConnectionRequest> {
      const existing = store
        .getSnapshot()
        .requests.filter(
          (r) => r.studentId === input.studentId && r.mentorId === input.mentorId,
        );
      if (existing.some((r) => r.state === "blocked")) {
        throw new BlockedPairError();
      }
      if (
        existing.some((r) => r.state === "pending" || r.state === "accepted")
      ) {
        throw new DuplicateRequestError();
      }
      const now = new Date().toISOString();
      const request: ConnectionRequest = {
        id: store.newId("request"),
        mentorId: input.mentorId,
        studentId: input.studentId,
        purpose: input.purpose,
        message: input.message,
        state: "pending",
        archivedByMentor: false,
        createdAt: now,
        updatedAt: now,
      };
      store.mutate((draft) => {
        draft.requests.push(request);
      });
      return structuredClone(request);
    },

    async acceptRequest(id: string): Promise<Connection> {
      let accepted: Connection | null = null;
      store.mutate((draft) => {
        const request = draft.requests.find((r) => r.id === id);
        if (!request) throw new Error(`Unknown request: ${id}`);
        if (request.state !== "pending") {
          throw new Error("Only pending requests can be accepted.");
        }
        request.state = "accepted";
        request.archivedByMentor = false;
        request.updatedAt = new Date().toISOString();
        draft.threads.push({
          id: store.newId("thread"),
          connectionId: request.id,
          mentorId: request.mentorId,
          studentId: request.studentId,
          lastReadAt: {},
        });
        accepted = structuredClone(request) as Connection;
      });
      if (!accepted) throw new Error(`Unknown request: ${id}`);
      return accepted;
    },

    async archiveForMentor(id: string): Promise<void> {
      store.mutate((draft) => {
        const request = draft.requests.find((r) => r.id === id);
        if (!request) throw new Error(`Unknown request: ${id}`);
        // Archiving is mentor-side inbox tidying only: the lifecycle state is
        // deliberately untouched, so the student still sees "pending".
        request.archivedByMentor = true;
      });
    },

    async unarchiveForMentor(id: string): Promise<void> {
      store.mutate((draft) => {
        const request = draft.requests.find((r) => r.id === id);
        if (!request) throw new Error(`Unknown request: ${id}`);
        request.archivedByMentor = false;
      });
    },

    async disconnect(connectionId: string): Promise<void> {
      store.mutate((draft) => {
        const request = draft.requests.find((r) => r.id === connectionId);
        if (!request) throw new Error(`Unknown connection: ${connectionId}`);
        if (request.state !== "accepted") {
          throw new Error("Only accepted connections can be disconnected.");
        }
        request.state = "disconnected";
        request.updatedAt = new Date().toISOString();
      });
    },

    async block(connectionId: string): Promise<void> {
      store.mutate((draft) => {
        const request = draft.requests.find((r) => r.id === connectionId);
        if (!request) throw new Error(`Unknown connection: ${connectionId}`);
        request.state = "blocked";
        request.updatedAt = new Date().toISOString();
      });
    },

    async listForStudent(studentId: string): Promise<ConnectionRequest[]> {
      return structuredClone(
        store.getSnapshot().requests.filter((r) => r.studentId === studentId),
      );
    },

    async listForMentor(mentorId: string): Promise<ConnectionRequest[]> {
      return structuredClone(
        store.getSnapshot().requests.filter((r) => r.mentorId === mentorId),
      );
    },

    async get(id: string): Promise<ConnectionRequest | null> {
      const request = store.getSnapshot().requests.find((r) => r.id === id);
      return request ? structuredClone(request) : null;
    },

    async findActiveForPair(
      studentId: string,
      mentorId: string,
    ): Promise<ConnectionRequest | null> {
      const request = store
        .getSnapshot()
        .requests.find(
          (r) =>
            r.studentId === studentId &&
            r.mentorId === mentorId &&
            (r.state === "pending" || r.state === "accepted"),
        );
      return request ? structuredClone(request) : null;
    },
  };

  const messageRepository: MessageRepository = {
    async listThreads(userId: string): Promise<MessageThread[]> {
      return structuredClone(
        store
          .getSnapshot()
          .threads.filter(
            (t) => t.mentorId === userId || t.studentId === userId,
          ),
      );
    },

    async getThread(threadId: string): Promise<MessageThread | null> {
      const thread = store.getSnapshot().threads.find((t) => t.id === threadId);
      return thread ? structuredClone(thread) : null;
    },

    async listMessages(threadId: string): Promise<Message[]> {
      return structuredClone(
        store
          .getSnapshot()
          .messages.filter((m) => m.threadId === threadId)
          .sort((a, b) => a.sentAt.localeCompare(b.sentAt)),
      );
    },

    async sendMessage(
      threadId: string,
      senderId: string,
      text: string,
    ): Promise<Message> {
      const snapshot = store.getSnapshot();
      const thread = snapshot.threads.find((t) => t.id === threadId);
      if (!thread) throw new MessagingUnavailableError("Unknown conversation.");
      const connection = snapshot.requests.find(
        (r) => r.id === thread.connectionId,
      );
      if (!connection || connection.state !== "accepted") {
        throw new MessagingUnavailableError(
          "This conversation is read-only because the connection has ended.",
        );
      }
      const message: Message = {
        id: store.newId("message"),
        threadId,
        senderId,
        text,
        sentAt: new Date().toISOString(),
      };
      store.mutate((draft) => {
        draft.messages.push(message);
        const draftThread = draft.threads.find((t) => t.id === threadId);
        if (draftThread) {
          draftThread.lastReadAt[senderId] = message.sentAt;
        }
      });
      return structuredClone(message);
    },

    async markThreadRead(threadId: string, userId: string): Promise<void> {
      store.mutate((draft) => {
        const thread = draft.threads.find((t) => t.id === threadId);
        if (!thread) return;
        thread.lastReadAt[userId] = new Date().toISOString();
      });
    },

    async unreadCount(threadId: string, userId: string): Promise<number> {
      const snapshot = store.getSnapshot();
      const thread = snapshot.threads.find((t) => t.id === threadId);
      if (!thread) return 0;
      const lastRead = thread.lastReadAt[userId] ?? "";
      return snapshot.messages.filter(
        (m) =>
          m.threadId === threadId &&
          m.senderId !== userId &&
          m.sentAt > lastRead,
      ).length;
    },

    async unreadTotal(userId: string): Promise<number> {
      const mine = store
        .getSnapshot()
        .threads.filter((t) => t.mentorId === userId || t.studentId === userId);
      const counts = await Promise.all(
        mine.map((t) => messageRepository.unreadCount(t.id, userId)),
      );
      return counts.reduce((sum, n) => sum + n, 0);
    },
  };

  return {
    mentorRepository,
    studentProfileRepository,
    connectionRepository,
    messageRepository,
  };
}
