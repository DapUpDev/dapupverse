/**
 * Server-side identity resolution. The only place server code talks to
 * Clerk's auth APIs directly.
 */

import { auth, currentUser } from "@clerk/nextjs/server";
import {
  identityFromClaims,
  VISITOR_IDENTITY,
  type AuthIdentity,
} from "@/lib/auth/types";

/**
 * Resolve the current application identity on the server.
 *
 * Prefers the custom session claim (`sessionClaims.metadata`, configured in
 * the Clerk Dashboard). When the claim is not configured yet, falls back to
 * the user's `publicMetadata` via Clerk's request-cached `currentUser()`, so
 * promoted mentors/admins work before the claim exists. Anything missing or
 * malformed resolves to least privilege.
 */
export async function getAuthIdentity(): Promise<AuthIdentity> {
  const { userId, sessionClaims } = await auth();
  if (!userId) return VISITOR_IDENTITY;

  let rawMetadata: unknown = (
    sessionClaims as Record<string, unknown> | null
  )?.metadata;

  if (rawMetadata === undefined) {
    const user = await currentUser();
    rawMetadata = user?.publicMetadata;
  }

  return identityFromClaims(userId, rawMetadata);
}
