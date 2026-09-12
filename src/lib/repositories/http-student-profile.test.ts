import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessTokenGetter } from "@/lib/api/client";
import { createHttpStudentProfileRepository } from "@/lib/repositories/http-student-profile";

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, statusText: String(status), json: async () => body };
}

const maya = {
  id: "user_stu1",
  fullName: "Maya Lin",
  school: "Lincoln High",
  yearLevel: "Grade 12",
  educationSystem: "AP",
  subjects: ["Mathematics"],
  biography: "",
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

describe("http student profile repository", () => {
  it("reads a student by id and treats 403/404 as nothing to show", async () => {
    const repo = createHttpStudentProfileRepository();
    fetchMock.mockResolvedValueOnce(reply(200, maya));
    expect(await repo.get("user_stu1")).toEqual(maya);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/students/user_stu1/profile");
    fetchMock.mockResolvedValueOnce(reply(403, { detail: "Not allowed." }));
    expect(await repo.get("user_other")).toBeNull();
  });

  it("updates the caller's own profile without sending the id", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, maya));
    const repo = createHttpStudentProfileRepository();
    await repo.update({ studentId: "user_stu1", fullName: "Maya Lin", educationSystem: "AP" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/me/student-profile");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ fullName: "Maya Lin", educationSystem: "AP" });
  });

  it("ensure creates only when the profile is missing", async () => {
    const repo = createHttpStudentProfileRepository();
    fetchMock
      .mockResolvedValueOnce(reply(404, { detail: "No student profile yet." }))
      .mockResolvedValueOnce(reply(200, { ...maya, fullName: "" }));
    const created = await repo.ensure("user_stu1");
    expect(created.fullName).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
  });
});
