import type { DemoSession } from "@/lib/demo-session/types";

export type NavItem = {
  href: string;
  label: string;
};

/**
 * Role-aware primary navigation. One shared shell consumes this for every
 * identity; there are no duplicated student/mentor sites.
 *
 * The Admin item is gated on the explicit `isAdmin` capability — never on
 * the mentor account type.
 */
export function navItemsForSession(session: DemoSession): NavItem[] {
  if (session.accountType === "student") {
    return [
      { href: "/mentors", label: "Find Mentors" },
      { href: "/app/connections", label: "Connections" },
      { href: "/app/messages", label: "Messages" },
      { href: "/app/profile", label: "Profile" },
    ];
  }
  if (session.accountType === "mentor") {
    const items: NavItem[] = [
      { href: "/app/requests", label: "Requests" },
      { href: "/app/connections", label: "Connections" },
      { href: "/app/messages", label: "Messages" },
      { href: "/app/profile", label: "Profile" },
    ];
    if (session.capabilities.isAdmin) {
      items.push({ href: "/admin", label: "Admin" });
    }
    return items;
  }
  // Visitor
  return [
    { href: "/", label: "Home" },
    { href: "/mentors", label: "Find Mentors" },
    { href: "/#mission", label: "Mission" },
    { href: "/terms", label: "Terms" },
  ];
}
