import { describe, expect, it } from "vitest";
import { LEAST_PRIVILEGE, parseDapUpMetadata } from "@/lib/auth/claims";
import { identityFromClaims } from "@/lib/auth/types";
import { safeInternalPath } from "@/lib/auth/redirects";

describe("parseDapUpMetadata — least-privilege fallback", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a string", "mentor"],
    ["a number", 42],
    ["an array", ["mentor"]],
    ["an empty object", {}],
  ])("falls back to student/non-admin for %s", (_label, raw) => {
    expect(parseDapUpMetadata(raw)).toEqual(LEAST_PRIVILEGE);
  });

  it("ignores unrecognized account types", () => {
    expect(parseDapUpMetadata({ accountType: "admin" }).accountType).toBe(
      "student",
    );
    expect(parseDapUpMetadata({ accountType: "MENTOR" }).accountType).toBe(
      "student",
    );
  });

  it("only honors isAdmin when it is exactly boolean true", () => {
    expect(
      parseDapUpMetadata({ capabilities: { isAdmin: true } }).capabilities
        .isAdmin,
    ).toBe(true);
    for (const value of ["true", 1, {}, [], null]) {
      expect(
        parseDapUpMetadata({ capabilities: { isAdmin: value } }).capabilities
          .isAdmin,
      ).toBe(false);
    }
    expect(
      parseDapUpMetadata({ capabilities: "isAdmin" }).capabilities.isAdmin,
    ).toBe(false);
  });

  it("keeps admin independent from account type", () => {
    const studentAdmin = parseDapUpMetadata({
      accountType: "student",
      capabilities: { isAdmin: true },
    });
    expect(studentAdmin.accountType).toBe("student");
    expect(studentAdmin.capabilities.isAdmin).toBe(true);

    const plainMentor = parseDapUpMetadata({ accountType: "mentor" });
    expect(plainMentor.capabilities.isAdmin).toBe(false);
  });

  it("honors mentorProfileId only for mentors and only as a non-empty string", () => {
    expect(
      parseDapUpMetadata({ accountType: "mentor", mentorProfileId: "mentor-jae" })
        .mentorProfileId,
    ).toBe("mentor-jae");
    expect(
      parseDapUpMetadata({ accountType: "student", mentorProfileId: "mentor-jae" })
        .mentorProfileId,
    ).toBeNull();
    expect(
      parseDapUpMetadata({ accountType: "mentor", mentorProfileId: "  " })
        .mentorProfileId,
    ).toBeNull();
    expect(
      parseDapUpMetadata({ accountType: "mentor", mentorProfileId: 5 })
        .mentorProfileId,
    ).toBeNull();
  });
});

describe("identityFromClaims — dataUserId mapping", () => {
  it("students use their Clerk user id", () => {
    const identity = identityFromClaims("user_abc", { accountType: "student" });
    expect(identity.dataUserId).toBe("user_abc");
  });

  it("mapped mentors use the seeded mentor profile id", () => {
    const identity = identityFromClaims("user_abc", {
      accountType: "mentor",
      mentorProfileId: "mentor-jae",
    });
    expect(identity.dataUserId).toBe("mentor-jae");
  });

  it("unmapped mentors fall back to their Clerk user id (never another mentor)", () => {
    const identity = identityFromClaims("user_abc", { accountType: "mentor" });
    expect(identity.dataUserId).toBe("user_abc");
  });
});

describe("safeInternalPath — open-redirect protection", () => {
  it("accepts plain internal paths", () => {
    expect(safeInternalPath("/app/profile?setup=connect")).toBe(
      "/app/profile?setup=connect",
    );
    expect(safeInternalPath("/mentors/jae-park")).toBe("/mentors/jae-park");
  });

  it("rejects everything else", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/..\\evil",
      "javascript:alert(1)",
      "mentors/no-leading-slash",
      "",
      undefined,
      null,
      42,
    ]) {
      expect(safeInternalPath(bad)).toBeNull();
    }
  });
});
