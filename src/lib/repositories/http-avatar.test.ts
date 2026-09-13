import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessTokenGetter } from "@/lib/api/client";
import { createHttpAvatarRepository } from "@/lib/repositories/http-avatar";

const fetchMock = vi.fn();

function reply(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    json: async () => body,
  };
}

const file = new File([new Uint8Array([1, 2, 3])], "me.png", { type: "image/png" });

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

describe("http avatar repository", () => {
  it("asks for a ticket, PUTs the file to S3 without the session token, then confirms", async () => {
    fetchMock
      .mockResolvedValueOnce(
        reply(200, { uploadUrl: "https://bucket.s3.test/avatars/u1/a.png?sig", key: "avatars/u1/a.png", expiresInSeconds: 300 }),
      )
      .mockResolvedValueOnce(reply(200))
      .mockResolvedValueOnce(reply(200, { avatarUrl: "https://bucket.s3.test/avatars/u1/a.png?read" }));

    const url = await createHttpAvatarRepository().upload("u1", file);

    expect(url).toBe("https://bucket.s3.test/avatars/u1/a.png?read");
    const [ticket, put, confirm] = fetchMock.mock.calls;
    expect(ticket[0]).toBe("https://api.test/me/avatar/upload-url");
    expect(JSON.parse(ticket[1].body)).toEqual({ contentType: "image/png", sizeBytes: 3 });
    expect(put[0]).toBe("https://bucket.s3.test/avatars/u1/a.png?sig");
    expect(put[1].method).toBe("PUT");
    expect(put[1].headers).toEqual({ "Content-Type": "image/png" });
    expect(put[1].body).toBe(file);
    expect(confirm[0]).toBe("https://api.test/me/avatar");
    expect(JSON.parse(confirm[1].body)).toEqual({ key: "avatars/u1/a.png" });
  });

  it("stops when S3 refuses the upload and never confirms", async () => {
    fetchMock
      .mockResolvedValueOnce(reply(200, { uploadUrl: "https://bucket.s3.test/x", key: "avatars/u1/x.png", expiresInSeconds: 300 }))
      .mockResolvedValueOnce(reply(403));
    await expect(createHttpAvatarRepository().upload("u1", file)).rejects.toThrow("upload to storage failed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("removes through the API", async () => {
    fetchMock.mockResolvedValueOnce(reply(204));
    await createHttpAvatarRepository().remove("u1");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/me/avatar");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });
});
