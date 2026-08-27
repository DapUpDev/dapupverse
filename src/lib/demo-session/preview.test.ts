import { describe, expect, it } from "vitest";
import { resolvePreviewEnabled } from "@/lib/demo-session/preview";

describe("resolvePreviewEnabled", () => {
  it("is enabled in local development", () => {
    expect(resolvePreviewEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is enabled on Vercel preview deployments", () => {
    expect(
      resolvePreviewEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" }),
    ).toBe(true);
  });

  it("is disabled on Vercel production", () => {
    expect(
      resolvePreviewEnabled({
        NODE_ENV: "production",
        VERCEL_ENV: "production",
      }),
    ).toBe(false);
  });

  it("is disabled for a plain production build with no Vercel env", () => {
    expect(resolvePreviewEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(resolvePreviewEnabled({})).toBe(false);
  });
});
