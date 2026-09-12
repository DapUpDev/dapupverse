import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessTokenGetter } from "@/lib/api/client";
import { repositoryChangeVersion } from "@/lib/repositories/change-signal";
import { createHttpMentorRepository } from "@/lib/repositories/http-mentor";

const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  };
}

const jae = {
  id: "user_jae",
  slug: "jae-park",
  name: "Jae Park",
  university: "Stanford University",
  major: "Computer Science",
  countryRegion: "United States",
  biography: "IB grad.",
  services: ["Essay review"],
  subjects: ["Computer Science"],
  educationSystems: ["IB"],
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.test/");
  vi.stubGlobal("fetch", fetchMock);
  setAccessTokenGetter(async () => "session-token");
});

afterEach(() => {
  fetchMock.mockReset();
  setAccessTokenGetter(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("http mentor repository", () => {
  it("lists with only the filters that are set, as query parameters", async () => {
    fetchMock.mockResolvedValueOnce(reply(200, [jae]));
    const repo = createHttpMentorRepository();
    const mentors = await repo.list({ query: "cam", subject: "Chemistry", university: undefined });
    expect(mentors).toEqual([jae]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/mentors?query=cam&subject=Chemistry");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer session-token");
  });

  it("turns a 404 on a slug into null and rethrows anything else", async () => {
    const repo = createHttpMentorRepository();
    fetchMock.mockResolvedValueOnce(reply(404, { detail: "Mentor not found." }));
    expect(await repo.getBySlug("nobody")).toBeNull();
    fetchMock.mockResolvedValueOnce(reply(500, { detail: "boom" }));
    await expect(repo.getBySlug("jae-park")).rejects.toMatchObject({ status: 500 });
  });

  it("treats 'not allowed' on the private profile as nothing to show", async () => {
    const repo = createHttpMentorRepository();
    fetchMock.mockResolvedValueOnce(reply(403, { detail: "Not allowed." }));
    expect(await repo.getPrivateProfile("user_jae")).toBeNull();
  });

  it("updates through PUT /me/mentor-profile without sending the mentor id, and notifies", async () => {
    const before = repositoryChangeVersion();
    fetchMock.mockResolvedValueOnce(reply(200, { ...jae, privatePriceUsd: "40.00" }));
    const repo = createHttpMentorRepository();
    const profile = await repo.updateProfile({ mentorId: "user_jae", name: "Jae Park", privatePriceUsd: 40 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/me/mentor-profile");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ name: "Jae Park", privatePriceUsd: 40 });
    expect(profile.privatePriceUsd).toBe(40); // decimal string on the wire, number in the domain
    expect(repositoryChangeVersion()).toBe(before + 1);
  });

  it("ensureProfile reads first and only creates when there is no profile yet", async () => {
    const repo = createHttpMentorRepository();
    fetchMock.mockResolvedValueOnce(reply(200, { ...jae, privatePriceUsd: "0.00" }));
    await repo.ensureProfile("user_jae");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset();
    fetchMock
      .mockResolvedValueOnce(reply(404, { detail: "No mentor profile yet." }))
      .mockResolvedValueOnce(reply(200, { ...jae, name: "", privatePriceUsd: "0.00" }));
    const created = await repo.ensureProfile("user_jae");
    expect(created.name).toBe("");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBe("PUT");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({});
  });

  it("sends no Authorization header when there is no session", async () => {
    setAccessTokenGetter(async () => null);
    fetchMock.mockResolvedValueOnce(reply(200, []));
    await createHttpMentorRepository().list();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});
