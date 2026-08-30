"use client";

/**
 * Client-side identity for navigation and presentation ONLY. Authorization
 * decisions are made on the server (see guards.ts); this hook exists so the
 * shared shell can render role-aware UI.
 */

import { useUser } from "@clerk/nextjs";
import {
  identityFromClaims,
  VISITOR_IDENTITY,
  type AuthIdentity,
} from "@/lib/auth/types";

export function useAuthIdentity(): {
  identity: AuthIdentity;
  isLoaded: boolean;
} {
  const { user, isLoaded, isSignedIn } = useUser();
  if (!isLoaded || !isSignedIn || !user) {
    return { identity: VISITOR_IDENTITY, isLoaded };
  }
  return {
    identity: identityFromClaims(user.id, user.publicMetadata),
    isLoaded,
  };
}
