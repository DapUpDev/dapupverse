import { requireAuth } from "@/lib/auth/guards";
import { MentorConnections } from "@/components/connections/mentor-connections";
import { StudentConnections } from "@/components/connections/student-connections";

export default async function ConnectionsPage() {
  const identity = await requireAuth("/app/connections");
  return (
    <main className="page">
      <div className="max-w-3xl">
        <h1 className="page-title">
          Connections
        </h1>
        <div className="mt-10">
          {identity.accountType === "mentor" ? (
            <MentorConnections mentorId={identity.dataUserId!} />
          ) : (
            <StudentConnections studentId={identity.dataUserId!} />
          )}
        </div>
      </div>
    </main>
  );
}
