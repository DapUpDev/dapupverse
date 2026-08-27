"use client";

import { Archive as ArchiveIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import type { ConnectionRequest, StudentProfile } from "@/lib/domain/types";
import {
  connectionRepository,
  studentProfileRepository,
} from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

type RequestWithStudent = {
  request: ConnectionRequest;
  student: StudentProfile | null;
};

function studentName(student: StudentProfile | null): string {
  return student?.fullName.trim() ? student.fullName : "Student";
}

function RequestCard({
  item,
  actions,
}: {
  item: RequestWithStudent;
  actions: React.ReactNode;
}) {
  const { request, student } = item;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{studentName(student)}</CardTitle>
          <Badge variant="secondary">{request.purpose}</Badge>
        </div>
        <CardDescription>
          {student?.school ? `${student.school} · ` : ""}
          {student?.educationSystem ? `${student.educationSystem} · ` : ""}
          Sent {formatDate(request.createdAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">{request.message}</p>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Mentor request inbox. Requests can be accepted or archived — there is
 * deliberately no reject action anywhere. Archiving is invisible to the
 * student, who continues to see the request as pending.
 */
export function MentorRequestsInbox({ mentorId }: { mentorId: string }) {
  const { data, ready } = useRepositoryQuery<RequestWithStudent[]>(async () => {
    const requests = await connectionRepository.listForMentor(mentorId);
    const students = await Promise.all(
      requests.map((r) => studentProfileRepository.get(r.studentId)),
    );
    return requests
      .map((request, index) => ({ request, student: students[index] }))
      .sort((a, b) => b.request.createdAt.localeCompare(a.request.createdAt));
  }, [mentorId]);

  if (!ready) return <Skeleton className="h-64 rounded-xl" />;

  const pending = (data ?? []).filter(
    (r) => r.request.state === "pending" && !r.request.archivedByMentor,
  );
  const archived = (data ?? []).filter(
    (r) => r.request.state === "pending" && r.request.archivedByMentor,
  );

  const handleAccept = async (id: string, name: string) => {
    await connectionRepository.acceptRequest(id);
    toast.success("Request accepted", {
      description: `You're now connected with ${name}. Messaging is unlocked.`,
    });
  };

  const handleArchive = async (id: string) => {
    await connectionRepository.archiveForMentor(id);
    toast("Request archived", {
      description:
        "Moved to your archive. The student still sees it as pending.",
    });
  };

  const handleUnarchive = async (id: string) => {
    await connectionRepository.unarchiveForMentor(id);
    toast("Request unarchived");
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="inbox-heading">
        <h2 id="inbox-heading" className="text-lg font-semibold">
          Incoming requests
        </h2>
        {pending.length === 0 ? (
          <Card className="mt-3">
            <CardHeader>
              <CardTitle className="text-base">Inbox zero</CardTitle>
              <CardDescription>
                New student requests will appear here.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {pending.map((item) => (
              <li key={item.request.id}>
                <RequestCard
                  item={item}
                  actions={
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleAccept(
                            item.request.id,
                            studentName(item.student),
                          )
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleArchive(item.request.id)}
                      >
                        Archive
                      </Button>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 ? (
        <section aria-labelledby="archived-heading">
          <h2
            id="archived-heading"
            className="flex items-center gap-2 text-lg font-semibold"
          >
            <ArchiveIcon aria-hidden="true" className="size-4 text-fog" />
            Archived
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Archived requests are hidden from your inbox only — students still
            see them as pending.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {archived.map((item) => (
              <li key={item.request.id}>
                <RequestCard
                  item={item}
                  actions={
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleAccept(
                            item.request.id,
                            studentName(item.student),
                          )
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUnarchive(item.request.id)}
                      >
                        Unarchive
                      </Button>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
