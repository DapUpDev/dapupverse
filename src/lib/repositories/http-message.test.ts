import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessTokenGetter } from "@/lib/api/client";
import { createHttpMessageRepository } from "@/lib/repositories/http-message";
import { MessagingUnavailableError } from "@/lib/repositories/types";

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: String(status), json: async () => body };
}

const thread = {
  id: "22222222-2222-2222-2222-222222222222",
  connectionId: "11111111-1111-1111-1111-111111111111",
  mentorId: "user_jae",
  studentId: "user_maya",
  lastReadAt: { user_maya: "2026-09-12T00:00:00Z" },
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.test");
  vi.stubGlobal("fetch", fetchMock);
  setAccessTokenGetter(async () => "session-token");
});

afterEach(() => {
  fetchMock.mockReset();
  setAccessTokenGetter(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("http message repository", () => {
  it("lists my threads and reads one, with 403 as null", async () => {
    const repo = createHttpMessageRepository();
    fetchMock.mockResolvedValueOnce(reply(200, [thread]));
    expect(await repo.listThreads("user_maya")).toEqual([thread]);
    fetchMock.mockResolvedValueOnce(reply(403, { detail: "Not allowed." }));
    expect(await repo.getThread(thread.id)).toBeNull();
  });

  it("sends a message and maps the read-only conflict onto MessagingUnavailableError", async () => {
    const repo = createHttpMessageRepository();
    fetchMock.mockResolvedValueOnce(reply(201, { id: "m1", threadId: thread.id, senderId: "user_maya", text: "hi", sentAt: "2026-09-12T00:00:01Z" }));
    const sent = await repo.sendMessage(thread.id, "user_maya", "hi");
    expect(sent.text).toBe("hi");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ text: "hi" });
    fetchMock.mockResolvedValueOnce(reply(409, { detail: { code: "messaging_unavailable", message: "read-only" } }));
    await expect(repo.sendMessage(thread.id, "user_maya", "again")).rejects.toBeInstanceOf(MessagingUnavailableError);
  });

  it("marks read and reports unread counts", async () => {
    const repo = createHttpMessageRepository();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, statusText: "204", json: async () => undefined });
    await repo.markThreadRead(thread.id, "user_maya");
    expect(fetchMock.mock.calls[0][0]).toBe(`https://api.test/threads/${thread.id}/read`);
    fetchMock.mockResolvedValueOnce(reply(200, { count: 3 }));
    expect(await repo.unreadCount(thread.id, "user_maya")).toBe(3);
  });
});
