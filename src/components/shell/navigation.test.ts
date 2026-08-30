import { describe, expect, it } from "vitest";
import { navItemsForIdentity } from "@/components/shell/navigation";
import { identityForRole } from "@/test/auth-fixtures";

describe("navItemsForIdentity", () => {
  it("gives visitors the public navigation", () => {
    const labels = navItemsForIdentity(identityForRole("visitor")).map(
      (i) => i.label,
    );
    expect(labels).toEqual(["Home", "Find Mentors", "Mission", "Terms"]);
  });

  it("gives students their navigation without Requests or Admin", () => {
    const items = navItemsForIdentity(identityForRole("student"));
    expect(items.map((i) => i.label)).toEqual([
      "Find Mentors",
      "Connections",
      "Messages",
      "Profile",
    ]);
  });

  it("does not give a plain mentor the Admin item", () => {
    const items = navItemsForIdentity(identityForRole("mentor"));
    expect(items.map((i) => i.href)).not.toContain("/admin");
    expect(items.map((i) => i.href)).toContain("/app/requests");
  });

  it("gates Admin on the isAdmin capability, not the mentor account type", () => {
    const mentorAdmin = navItemsForIdentity(identityForRole("mentor-admin"));
    expect(mentorAdmin.map((i) => i.href)).toContain("/admin");

    // A mentor with the capability stripped must lose the item even though
    // the account type is unchanged.
    const strippedCapability = {
      ...identityForRole("mentor-admin"),
      capabilities: { isAdmin: false },
    };
    expect(
      navItemsForIdentity(strippedCapability).map((i) => i.href),
    ).not.toContain("/admin");
  });
});
