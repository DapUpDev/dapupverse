import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessTokenGetter } from "@/lib/api/client";
import { repositoryChangeVersion } from "@/lib/repositories/change-signal";
import { createHttpMessageRepository } from "@/lib/repositories/http-message";

const fetchMock = vi.fn();

function reply(status: number, body?: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: String(status), json: async () => body };
}

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

describe("http message repository: unread badge support", () => {
  it("reads the total from /me/unread", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { count: 4 }));
    expect(await createHttpMessageRepository().unreadTotal("user_1")).toBe(4);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/me/unread");
  });

  it("marking a thread read announces a change so the badge refreshes", async () => {
    fetchMock.mockResolvedValueOnce(reply(204));
    const before = repositoryChangeVersion();
    await createHttpMessageRepository().markThreadRead("t1", "user_1");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/threads/t1/read");
    expect(repositoryChangeVersion()).toBe(before + 1);
  });
});
