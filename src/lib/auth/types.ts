/**
 * The stable, application-facing identity shape. Components and pages
 * consume this — never raw Clerk objects — so the auth provider stays
 * swappable and role logic stays centralized.
 */

import type { AccountType, UserCapabilities } from "@/lib/domain/types";
import { parseDapUpMetadata } from "@/lib/auth/claims";

export type AuthIdentity = {
  isAuthenticated: boolean;
  /** Clerk authentication identity; null for visitors. */
  clerkUserId: string | null;
  /**
   * Identifier passed into the browser-local mock repositories. Students use
   * their Clerk user id; promoted mentors may map to a seeded mock mentor
   * profile via server-managed `mentorProfileId` metadata.
   */
  dataUserId: string | null;
  accountType: AccountType | null;
  capabilities: UserCapabilities;
};

export const VISITOR_IDENTITY: AuthIdentity = {
  isAuthenticated: false,
  clerkUserId: null,
  dataUserId: null,
  accountType: null,
  capabilities: { isAdmin: false },
};

/** Build an identity from a Clerk user id plus raw (untrusted) metadata. */
export function identityFromClaims(
  clerkUserId: string,
  rawMetadata: unknown,
): AuthIdentity {
  const metadata = parseDapUpMetadata(rawMetadata);
  return {
    isAuthenticated: true,
    clerkUserId,
    dataUserId:
      metadata.accountType === "mentor" && metadata.mentorProfileId
        ? metadata.mentorProfileId
        : clerkUserId,
    accountType: metadata.accountType,
    capabilities: metadata.capabilities,
  };
}
