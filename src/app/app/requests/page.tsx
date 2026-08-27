"use client";

import { RequireDemoAccount } from "@/components/app/require-demo-account";
import { MentorRequestsInbox } from "@/components/connections/mentor-requests-inbox";
import { useDemoSession } from "@/lib/demo-session/provider";

function RequestsContent() {
  const { session } = useDemoSession();
  if (!session.userId) return null;
  return <MentorRequestsInbox mentorId={session.userId} />;
}

export default function RequestsPage() {
  return (
    <RequireDemoAccount accountType="mentor">
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Requests</h1>
        <p className="mt-1 text-muted-foreground">
          Accept a request to connect and unlock messaging, or archive it to
          tidy your inbox.
        </p>
        <div className="mt-6">
          <RequestsContent />
        </div>
      </main>
    </RequireDemoAccount>
  );
}
