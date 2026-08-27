import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_MENTOR_ID, DEMO_STUDENT_ID } from "@/lib/data/seed";
import { MockDataStore } from "@/lib/mock/store";
import { createMockRepositories } from "@/lib/repositories/mock";
import {
  BlockedPairError,
  DuplicateRequestError,
  MessagingUnavailableError,
} from "@/lib/repositories/types";

let store: MockDataStore;
let repos: ReturnType<typeof createMockRepositories>;

beforeEach(() => {
  store = new MockDataStore();
  repos = createMockRepositories(store);
});

async function createPendingRequest() {
  return repos.connectionRepository.createRequest({
    mentorId: "mentor-ana",
    studentId: DEMO_STUDENT_ID,
    purpose: "Essay review",
    message: "Please review my personal statement draft when you have time.",
  });
}

describe("mentor repository — public price invisibility", () => {
  it("never exposes pricing in the public list", async () => {
    const mentors = await repos.mentorRepository.list();
    expect(mentors.length).toBeGreaterThan(0);
    for (const mentor of mentors) {
      expect(mentor).not.toHaveProperty("privatePriceUsd");
      expect(Object.keys(mentor).join(" ")).not.toMatch(/price/i);
    }
  });

  it("never exposes pricing on the public detail lookup", async () => {
    const mentor = await repos.mentorRepository.getBySlug("jae-park");
    expect(mentor).not.toBeNull();
    expect(mentor).not.toHaveProperty("privatePriceUsd");
  });

  it("exposes the price only through the explicitly private profile", async () => {
    const profile =
      await repos.mentorRepository.getPrivateProfile(DEMO_MENTOR_ID);
    expect(profile?.privatePriceUsd).toBe(40);
  });
});

describe("connection lifecycle", () => {
  it("creates a pending request", async () => {
    const request = await createPendingRequest();
    expect(request.state).toBe("pending");
    expect(request.archivedByMentor).toBe(false);
  });

  it("prevents duplicate active requests to the same mentor", async () => {
    await createPendingRequest();
    await expect(createPendingRequest()).rejects.toBeInstanceOf(
      DuplicateRequestError,
    );
  });

  it("still prevents a new request while one is accepted", async () => {
    const request = await createPendingRequest();
    await repos.connectionRepository.acceptRequest(request.id);
    await expect(createPendingRequest()).rejects.toBeInstanceOf(
      DuplicateRequestError,
    );
  });

  it("accepts a pending request and creates a message thread", async () => {
    const request = await createPendingRequest();
    const connection = await repos.connectionRepository.acceptRequest(
      request.id,
    );
    expect(connection.state).toBe("accepted");
    const threads = await repos.messageRepository.listThreads(DEMO_STUDENT_ID);
    expect(threads.some((t) => t.connectionId === request.id)).toBe(true);
  });

  it("has no rejected state and no reject/decline operation", async () => {
    const methodNames = Object.keys(repos.connectionRepository);
    expect(methodNames.join(" ")).not.toMatch(/reject|decline/i);
    const request = await createPendingRequest();
    // The full set of reachable states from a request:
    expect(["pending", "accepted", "disconnected", "blocked"]).toContain(
      request.state,
    );
  });

  it("mentor archiving does not change the student-visible pending state", async () => {
    const request = await createPendingRequest();
    await repos.connectionRepository.archiveForMentor(request.id);

    const studentView =
      await repos.connectionRepository.listForStudent(DEMO_STUDENT_ID);
    const studentCopy = studentView.find((r) => r.id === request.id);
    expect(studentCopy?.state).toBe("pending");

    const mentorView =
      await repos.connectionRepository.listForMentor("mentor-ana");
    const mentorCopy = mentorView.find((r) => r.id === request.id);
    expect(mentorCopy?.archivedByMentor).toBe(true);
    expect(mentorCopy?.state).toBe("pending");
  });

  it("supports unarchiving", async () => {
    const request = await createPendingRequest();
    await repos.connectionRepository.archiveForMentor(request.id);
    await repos.connectionRepository.unarchiveForMentor(request.id);
    const mentorView =
      await repos.connectionRepository.listForMentor("mentor-ana");
    expect(
      mentorView.find((r) => r.id === request.id)?.archivedByMentor,
    ).toBe(false);
  });

  it("blocks new requests after a block", async () => {
    const request = await createPendingRequest();
    await repos.connectionRepository.acceptRequest(request.id);
    await repos.connectionRepository.block(request.id);
    await expect(createPendingRequest()).rejects.toBeInstanceOf(
      BlockedPairError,
    );
  });
});

describe("messaging availability", () => {
  it("has no thread while a request is pending", async () => {
    const request = await createPendingRequest();
    const threads = await repos.messageRepository.listThreads(DEMO_STUDENT_ID);
    expect(threads.some((t) => t.connectionId === request.id)).toBe(false);
  });

  it("enables messaging after acceptance", async () => {
    const request = await createPendingRequest();
    await repos.connectionRepository.acceptRequest(request.id);
    const threads = await repos.messageRepository.listThreads(DEMO_STUDENT_ID);
    const thread = threads.find((t) => t.connectionId === request.id);
    expect(thread).toBeDefined();
    const message = await repos.messageRepository.sendMessage(
      thread!.id,
      DEMO_STUDENT_ID,
      "Hello!",
    );
    expect(message.text).toBe("Hello!");
  });

  it("makes the thread read-only after disconnect", async () => {
    const request = await createPendingRequest();
    await repos.connectionRepository.acceptRequest(request.id);
    const threads = await repos.messageRepository.listThreads(DEMO_STUDENT_ID);
    const thread = threads.find((t) => t.connectionId === request.id)!;
    await repos.connectionRepository.disconnect(request.id);
    await expect(
      repos.messageRepository.sendMessage(thread.id, DEMO_STUDENT_ID, "Hi"),
    ).rejects.toBeInstanceOf(MessagingUnavailableError);
  });

  it("makes the thread read-only after a block", async () => {
    const request = await createPendingRequest();
    await repos.connectionRepository.acceptRequest(request.id);
    const threads = await repos.messageRepository.listThreads(DEMO_STUDENT_ID);
    const thread = threads.find((t) => t.connectionId === request.id)!;
    await repos.connectionRepository.block(request.id);
    await expect(
      repos.messageRepository.sendMessage(thread.id, DEMO_STUDENT_ID, "Hi"),
    ).rejects.toBeInstanceOf(MessagingUnavailableError);
  });

  it("tracks unread counts per participant", async () => {
    const request = await createPendingRequest();
    await repos.connectionRepository.acceptRequest(request.id);
    const threads = await repos.messageRepository.listThreads(DEMO_STUDENT_ID);
    const thread = threads.find((t) => t.connectionId === request.id)!;
    await repos.messageRepository.sendMessage(
      thread.id,
      DEMO_STUDENT_ID,
      "First message",
    );
    expect(
      await repos.messageRepository.unreadCount(thread.id, "mentor-ana"),
    ).toBe(1);
    expect(
      await repos.messageRepository.unreadCount(thread.id, DEMO_STUDENT_ID),
    ).toBe(0);
    await repos.messageRepository.markThreadRead(thread.id, "mentor-ana");
    expect(
      await repos.messageRepository.unreadCount(thread.id, "mentor-ana"),
    ).toBe(0);
  });
});

describe("price visibility with an accepted connection", () => {
  it("keeps the private profile price available for the connected view", async () => {
    const request = await createPendingRequest();
    await repos.connectionRepository.acceptRequest(request.id);
    // UI gates on an accepted connection, then reads the private profile.
    const active = await repos.connectionRepository.findActiveForPair(
      DEMO_STUDENT_ID,
      "mentor-ana",
    );
    expect(active?.state).toBe("accepted");
    const profile =
      await repos.mentorRepository.getPrivateProfile("mentor-ana");
    expect(profile?.privatePriceUsd).toBe(20);
  });
});
