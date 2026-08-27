"use client";

import { RequireDemoAccount } from "@/components/app/require-demo-account";
import { MentorConnections } from "@/components/connections/mentor-connections";
import { StudentConnections } from "@/components/connections/student-connections";
import { useDemoSession } from "@/lib/demo-session/provider";

function ConnectionsContent() {
  const { session } = useDemoSession();
  if (!session.userId) return null;
  return session.accountType === "mentor" ? (
    <MentorConnections mentorId={session.userId} />
  ) : (
    <StudentConnections studentId={session.userId} />
  );
}

export default function ConnectionsPage() {
  return (
    <RequireDemoAccount>
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
        <div className="mt-6">
          <ConnectionsContent />
        </div>
      </main>
    </RequireDemoAccount>
  );
}
