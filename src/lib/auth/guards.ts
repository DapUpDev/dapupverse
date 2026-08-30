/**
 * Server-enforced route guards. Use these in layouts, pages, and (later)
 * data mutations — client-side hiding is presentation only.
 */

import { redirect } from "next/navigation";
import type { AccountType } from "@/lib/domain/types";
import { getAuthIdentity } from "@/lib/auth/identity";
import { safeInternalPath } from "@/lib/auth/redirects";
import type { AuthIdentity } from "@/lib/auth/types";

export function signInPathFor(returnTo?: string): string {
  const dest = safeInternalPath(returnTo);
  return dest
    ? `/sign-in?redirect_url=${encodeURIComponent(dest)}`
    : "/sign-in";
}

/** Require a signed-in user; otherwise redirect through Clerk sign-in. */
export async function requireAuth(returnTo?: string): Promise<AuthIdentity> {
  const identity = await getAuthIdentity();
  if (!identity.isAuthenticated) {
    redirect(signInPathFor(returnTo));
  }
  return identity;
}

/** Require a specific account type; unauthorized users see /forbidden. */
export async function requireAccountType(
  accountType: AccountType,
  returnTo?: string,
): Promise<AuthIdentity> {
  const identity = await requireAuth(returnTo);
  if (identity.accountType !== accountType) {
    redirect("/forbidden");
  }
  return identity;
}

/** Require the explicit admin capability — never inferred from account type. */
export async function requireAdmin(returnTo?: string): Promise<AuthIdentity> {
  const identity = await requireAuth(returnTo);
  if (!identity.capabilities.isAdmin) {
    redirect("/forbidden");
  }
  return identity;
}
