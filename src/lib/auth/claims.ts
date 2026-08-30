/**
 * Parsing and validation of DapUp's Clerk metadata (RBAC model).
 *
 * Pure and framework-free so it is unit-testable without Clerk. Every
 * unknown, missing, or malformed shape fails safely to the least-privileged
 * identity: student with no admin capability. Elevated values are only
 * honored when they are exactly the expected literals — never coerced.
 */

import type { AccountType, UserCapabilities } from "@/lib/domain/types";

/**
 * The server-managed Clerk `publicMetadata` schema. Users can never write
 * this from the browser; DapUp staff set it in the Clerk Dashboard.
 *
 * - `accountType`: "mentor" only for manually promoted mentors.
 * - `capabilities.isAdmin`: independent capability, never inferred from
 *   account type.
 * - `mentorProfileId`: optional bridge from a promoted mentor account to a
 *   seeded browser-local mock mentor profile (backend-free milestone only).
 */
export type DapUpMetadata = {
  accountType: AccountType;
  capabilities: UserCapabilities;
  mentorProfileId: string | null;
};

export const LEAST_PRIVILEGE: DapUpMetadata = {
  accountType: "student",
  capabilities: { isAdmin: false },
  mentorProfileId: null,
};

export function parseDapUpMetadata(raw: unknown): DapUpMetadata {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return LEAST_PRIVILEGE;
  }
  const record = raw as Record<string, unknown>;

  const accountType: AccountType =
    record.accountType === "mentor" ? "mentor" : "student";

  let isAdmin = false;
  const capabilities = record.capabilities;
  if (
    capabilities !== null &&
    typeof capabilities === "object" &&
    !Array.isArray(capabilities) &&
    (capabilities as Record<string, unknown>).isAdmin === true
  ) {
    isAdmin = true;
  }

  const mentorProfileId =
    accountType === "mentor" &&
    typeof record.mentorProfileId === "string" &&
    record.mentorProfileId.trim() !== ""
      ? record.mentorProfileId
      : null;

  return { accountType, capabilities: { isAdmin }, mentorProfileId };
}
