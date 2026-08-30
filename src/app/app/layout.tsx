import type { ReactNode } from "react";
import { requireAuth } from "@/lib/auth/guards";

/**
 * Server-enforced gate for the authenticated area. Individual pages add
 * their own account-type/capability checks; this layout guarantees no
 * signed-out visitor ever sees /app content.
 */
export default async function AppAreaLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAuth("/app");
  return <>{children}</>;
}
