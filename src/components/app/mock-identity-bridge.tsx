"use client";

/**
 * Bridges real Clerk identities to the browser-local mock data layer.
 *
 * - Hydrates the mock store from localStorage on the client.
 * - Ensures a signed-in user has a browser-local profile for their
 *   `dataUserId` (an incomplete student profile by default; a promoted
 *   mentor without a seeded mapping gets a fresh incomplete mentor profile).
 *
 * Authentication is real; this data is not — it lives in this browser only
 * and never syncs between devices or accounts. Clearing browser storage
 * erases the demo data but never affects the Clerk account.
 */

import { useEffect, type ReactNode } from "react";
import { useAuthIdentity } from "@/lib/auth/use-auth-identity";
import { mockDataStore } from "@/lib/mock/store";
import {
  mentorRepository,
  studentProfileRepository,
} from "@/lib/repositories";

export function MockIdentityBridge({ children }: { children: ReactNode }) {
  const { identity, isLoaded } = useAuthIdentity();

  useEffect(() => {
    mockDataStore.hydrateFromLocalStorage();
  }, []);

  useEffect(() => {
    if (!isLoaded || !identity.isAuthenticated || !identity.dataUserId) return;
    if (identity.accountType === "mentor") {
      mentorRepository.ensureProfile(identity.dataUserId);
    } else {
      studentProfileRepository.ensure(identity.dataUserId);
    }
  }, [
    isLoaded,
    identity.isAuthenticated,
    identity.accountType,
    identity.dataUserId,
  ]);

  return <>{children}</>;
}
