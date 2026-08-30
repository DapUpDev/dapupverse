import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/guards";

/**
 * Server-enforced admin gate. Access requires the explicit isAdmin
 * capability — being a mentor is never enough on its own.
 */
export default async function AdminAreaLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdmin("/admin");
  return <>{children}</>;
}
