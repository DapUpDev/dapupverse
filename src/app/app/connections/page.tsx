import { requireAuth } from "@/lib/auth/guards";
import { MentorConnections } from "@/components/connections/mentor-connections";
import { StudentConnections } from "@/components/connections/student-connections";

export default async function ConnectionsPage() {
  const identity = await requireAuth("/app/connections");
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        Connections
      </h1>
      <div className="mt-6">
        {identity.accountType === "mentor" ? (
          <MentorConnections mentorId={identity.dataUserId!} />
        ) : (
          <StudentConnections studentId={identity.dataUserId!} />
        )}
      </div>
    </main>
  );
}
