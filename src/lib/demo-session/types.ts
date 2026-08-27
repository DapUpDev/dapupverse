import type { AccountType, UserCapabilities } from "@/lib/domain/types";
import {
  DEMO_ADMIN_MENTOR_ID,
  DEMO_MENTOR_ID,
  DEMO_STUDENT_ID,
} from "@/lib/data/seed";

/**
 * Demo-session identities for milestone 2.
 *
 * This is an explicitly labeled preview mechanism, not authentication or
 * authorization. It exists only in local development and Vercel preview
 * deployments and will be replaced by Clerk in a later milestone.
 */
export type DemoRole = "visitor" | "student" | "mentor" | "mentor-admin";

export type DemoSession = {
  role: DemoRole;
  /** Null for visitors. */
  userId: string | null;
  accountType: AccountType | null;
  capabilities: UserCapabilities;
};

export const DEMO_ROLES: { value: DemoRole; label: string }[] = [
  { value: "visitor", label: "Visitor" },
  { value: "student", label: "Student" },
  { value: "mentor", label: "Mentor" },
  { value: "mentor-admin", label: "Mentor + admin" },
];

export function sessionForRole(role: DemoRole): DemoSession {
  switch (role) {
    case "visitor":
      return {
        role,
        userId: null,
        accountType: null,
        capabilities: { isAdmin: false },
      };
    case "student":
      return {
        role,
        userId: DEMO_STUDENT_ID,
        accountType: "student",
        capabilities: { isAdmin: false },
      };
    case "mentor":
      return {
        role,
        userId: DEMO_MENTOR_ID,
        accountType: "mentor",
        capabilities: { isAdmin: false },
      };
    case "mentor-admin":
      // Admin is a capability layered on an account type — this identity is
      // a mentor who additionally holds admin capability.
      return {
        role,
        userId: DEMO_ADMIN_MENTOR_ID,
        accountType: "mentor",
        capabilities: { isAdmin: true },
      };
  }
}

export function isDemoRole(value: unknown): value is DemoRole {
  return (
    value === "visitor" ||
    value === "student" ||
    value === "mentor" ||
    value === "mentor-admin"
  );
}
