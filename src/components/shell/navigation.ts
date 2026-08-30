import type { AccountType, UserCapabilities } from "@/lib/domain/types";

export type NavItem = {
  href: string;
  label: string;
};

/** The slice of an identity that navigation depends on. */
export type NavIdentity = {
  accountType: AccountType | null;
  capabilities: UserCapabilities;
};

/**
 * Role-aware primary navigation. One shared shell consumes this for every
 * identity; there are no duplicated student/mentor sites.
 *
 * The Admin item is gated on the explicit `isAdmin` capability — never on
 * the mentor account type. Navigation is presentation only; real
 * authorization happens on the server (src/lib/auth/guards.ts).
 */
export function navItemsForIdentity(identity: NavIdentity): NavItem[] {
  if (identity.accountType === "student") {
    return [
      { href: "/mentors", label: "Find Mentors" },
      { href: "/app/connections", label: "Connections" },
      { href: "/app/messages", label: "Messages" },
      { href: "/app/profile", label: "Profile" },
    ];
  }
  if (identity.accountType === "mentor") {
    const items: NavItem[] = [
      { href: "/app/requests", label: "Requests" },
      { href: "/app/connections", label: "Connections" },
      { href: "/app/messages", label: "Messages" },
      { href: "/app/profile", label: "Profile" },
    ];
    if (identity.capabilities.isAdmin) {
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
