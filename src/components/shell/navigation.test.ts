import { describe, expect, it } from "vitest";
import { navItemsForSession } from "@/components/shell/navigation";
import { sessionForRole } from "@/lib/demo-session/types";
import type { DemoSession } from "@/lib/demo-session/types";

describe("navItemsForSession", () => {
  it("gives visitors the public navigation", () => {
    const labels = navItemsForSession(sessionForRole("visitor")).map(
      (i) => i.label,
    );
    expect(labels).toEqual(["Home", "Find Mentors", "Mission", "Terms"]);
  });

  it("gives students their navigation without Requests or Admin", () => {
    const items = navItemsForSession(sessionForRole("student"));
    expect(items.map((i) => i.label)).toEqual([
      "Find Mentors",
      "Connections",
      "Messages",
      "Profile",
    ]);
  });

  it("does not give a plain mentor the Admin item", () => {
    const items = navItemsForSession(sessionForRole("mentor"));
    expect(items.map((i) => i.href)).not.toContain("/admin");
  });

  it("gates Admin on the isAdmin capability, not the mentor account type", () => {
    const mentorAdmin = navItemsForSession(sessionForRole("mentor-admin"));
    expect(mentorAdmin.map((i) => i.href)).toContain("/admin");

    // A mentor session with the capability stripped must lose the item even
    // though the account type is unchanged.
    const strippedCapability: DemoSession = {
      ...sessionForRole("mentor-admin"),
      capabilities: { isAdmin: false },
    };
    expect(navItemsForSession(strippedCapability).map((i) => i.href)).not.toContain(
      "/admin",
    );
  });
});
