import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessTokenGetter } from "@/lib/api/client";
import { createHttpConnectionRepository } from "@/lib/repositories/http-connection";
import { BlockedPairError, DuplicateRequestError } from "@/lib/repositories/types";

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: String(status), json: async () => body };
}

const pending = {
  id: "11111111-1111-1111-1111-111111111111",
  mentorId: "user_jae",
  studentId: "user_maya",
  purpose: "Essay review",
  message: "I'm applying to CS programs this year and would love essay feedback.",
  state: "pending",
  archivedByMentor: false,
  createdAt: "2026-09-12T00:00:00Z",
  updatedAt: "2026-09-12T00:00:00Z",
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

describe("http connection repository", () => {
  it("creates a request without sending the student id", async () => {
    fetchMock.mockResolvedValueOnce(reply(201, pending));
    const repo = createHttpConnectionRepository();
    const created = await repo.createRequest({
      mentorId: "user_jae", studentId: "user_maya", purpose: "Essay review", message: pending.message,
    });
    expect(created.state).toBe("pending");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/connections");
    expect(JSON.parse(init.body)).toEqual({ mentorId: "user_jae", purpose: "Essay review", message: pending.message });
  });

  it("maps the API's error codes onto the UI's error classes", async () => {
    const repo = createHttpConnectionRepository();
    const input = { mentorId: "user_jae", studentId: "user_maya", purpose: "Essay review" as const, message: pending.message };
    fetchMock.mockResolvedValueOnce(reply(409, { detail: { code: "duplicate_request", message: "dup" } }));
    await expect(repo.createRequest(input)).rejects.toBeInstanceOf(DuplicateRequestError);
    fetchMock.mockResolvedValueOnce(reply(403, { detail: { code: "blocked_pair", message: "no" } }));
    await expect(repo.createRequest(input)).rejects.toBeInstanceOf(BlockedPairError);
    fetchMock.mockResolvedValueOnce(reply(500, { detail: "boom" }));
    await expect(repo.createRequest(input)).rejects.toMatchObject({ status: 500 });
  });

  it("lists my connections for either side from the same endpoint", async () => {
    const repo = createHttpConnectionRepository();
    fetchMock.mockResolvedValue(reply(200, [pending]));
    expect(await repo.listForStudent("user_maya")).toEqual([pending]);
    expect(await repo.listForMentor("user_jae")).toEqual([pending]);
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["https://api.test/connections", "https://api.test/connections"]);
  });

  it("posts lifecycle actions to their endpoints", async () => {
    const repo = createHttpConnectionRepository();
    fetchMock.mockResolvedValue(reply(200, { ...pending, state: "accepted" }));
    await repo.acceptRequest(pending.id);
    await repo.archiveForMentor(pending.id);
    await repo.disconnect(pending.id);
    await repo.block(pending.id);
    expect(fetchMock.mock.calls.map((c) => c[0].replace("https://api.test", ""))).toEqual([
      `/connections/${pending.id}/accept`,
      `/connections/${pending.id}/archive`,
      `/connections/${pending.id}/disconnect`,
      `/connections/${pending.id}/block`,
    ]);
    expect(fetchMock.mock.calls.every((c) => c[1].method === "POST")).toBe(true);
  });

  it("active lookup uses the mentor id and turns 404 into null", async () => {
    const repo = createHttpConnectionRepository();
    fetchMock.mockResolvedValueOnce(reply(404, { detail: "No active request." }));
    expect(await repo.findActiveForPair("user_maya", "user_jae")).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/connections/active?mentorId=user_jae");
  });
});
