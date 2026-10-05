import { requireAccountType } from "@/lib/auth/guards";
import { MentorRequestsInbox } from "@/components/connections/mentor-requests-inbox";

/** Mentor-only: server-enforced account-type check. */
export default async function RequestsPage() {
  const identity = await requireAccountType("mentor", "/app/requests");
  return (
    <main className="page">
      <div className="max-w-3xl">
        <h1 className="page-title">
          Requests
        </h1>
        <p className="mt-4 max-w-xl text-lg text-pretty text-muted-foreground">
          Accept a request to connect and unlock messaging, or archive it to
          tidy your inbox.
        </p>
        <div className="mt-10">
          <MentorRequestsInbox mentorId={identity.dataUserId!} />
        </div>
      </div>
    </main>
  );
}
