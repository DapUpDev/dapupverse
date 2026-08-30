import { requireAccountType } from "@/lib/auth/guards";
import { MentorRequestsInbox } from "@/components/connections/mentor-requests-inbox";

/** Mentor-only: server-enforced account-type check. */
export default async function RequestsPage() {
  const identity = await requireAccountType("mentor", "/app/requests");
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        Requests
      </h1>
      <p className="mt-1 text-muted-foreground">
        Accept a request to connect and unlock messaging, or archive it to
        tidy your inbox.
      </p>
      <div className="mt-6">
        <MentorRequestsInbox mentorId={identity.dataUserId!} />
      </div>
    </main>
  );
}
