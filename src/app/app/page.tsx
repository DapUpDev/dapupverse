import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/guards";

/**
 * Role-aware authenticated entry point: students land in mentor discovery,
 * mentors land in their request inbox. A mentor with admin capability still
 * enters the mentor experience; admin tools stay separate under /admin.
 */
export default async function AppEntryPage() {
  const identity = await requireAuth("/app");
  if (identity.accountType === "mentor") {
    redirect("/app/requests");
  }
  redirect("/mentors");
}
