/**
 * Test-only identity fixtures. These model visitor/student/mentor/admin
 * identities for unit and component tests — they are NOT runtime-selectable
 * identities; production identity comes exclusively from Clerk.
 */

import {
  DEMO_ADMIN_MENTOR_ID,
  DEMO_MENTOR_ID,
  DEMO_STUDENT_ID,
} from "@/lib/data/seed";
import { VISITOR_IDENTITY, type AuthIdentity } from "@/lib/auth/types";

export type TestRole = "visitor" | "student" | "mentor" | "mentor-admin";

export function identityForRole(role: TestRole): AuthIdentity {
  switch (role) {
    case "visitor":
      return VISITOR_IDENTITY;
    case "student":
      return {
        isAuthenticated: true,
        clerkUserId: "user_test_student",
        dataUserId: DEMO_STUDENT_ID,
        accountType: "student",
        capabilities: { isAdmin: false },
      };
    case "mentor":
      return {
        isAuthenticated: true,
        clerkUserId: "user_test_mentor",
        dataUserId: DEMO_MENTOR_ID,
        accountType: "mentor",
        capabilities: { isAdmin: false },
      };
    case "mentor-admin":
      return {
        isAuthenticated: true,
        clerkUserId: "user_test_mentor_admin",
        dataUserId: DEMO_ADMIN_MENTOR_ID,
        accountType: "mentor",
        capabilities: { isAdmin: true },
      };
  }
}

let currentIdentity: AuthIdentity = VISITOR_IDENTITY;

export function setTestIdentity(role: TestRole): void {
  currentIdentity = identityForRole(role);
}

export function resetTestIdentity(): void {
  currentIdentity = VISITOR_IDENTITY;
}

export function getTestIdentity(): AuthIdentity {
  return currentIdentity;
}
