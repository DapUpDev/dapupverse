"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
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

/** Mentor view of accepted (and ended) connections. */
export function MentorConnections({ mentorId }: { mentorId: string }) {
  const { data, ready } = useRepositoryQuery<RequestWithStudent[]>(async () => {
    const requests = await connectionRepository.listForMentor(mentorId);
    const students = await Promise.all(
      requests.map((r) => studentProfileRepository.get(r.studentId)),
    );
    return requests
      .map((request, index) => ({ request, student: students[index] }))
      .sort((a, b) => b.request.updatedAt.localeCompare(a.request.updatedAt));
  }, [mentorId]);

  if (!ready) return <Skeleton className="h-64 rounded-xl" />;

  const accepted = (data ?? []).filter((r) => r.request.state === "accepted");
  const ended = (data ?? []).filter(
    (r) => r.request.state === "disconnected" || r.request.state === "blocked",
  );

  const handleDisconnect = async (id: string, name: string) => {
    await connectionRepository.disconnect(id);
    toast("Disconnected", {
      description: `Your connection with ${name} has ended. The conversation is now read-only.`,
    });
  };

  const handleBlock = async (id: string, name: string) => {
    await connectionRepository.block(id);
    toast("User blocked", {
      description: `${name} can no longer message you or send new requests.`,
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="mentor-connected-heading">
        <h2 id="mentor-connected-heading" className="text-lg font-semibold">
          Connected students
        </h2>
        {accepted.length === 0 ? (
          <Card className="mt-3">
            <CardHeader>
              <CardTitle className="text-base">No connections yet</CardTitle>
              <CardDescription>
                Accept a request from your{" "}
                <Link
                  href="/app/requests"
                  className="underline underline-offset-4"
                >
                  Requests inbox
                </Link>{" "}
                to start a connection.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {accepted.map(({ request, student }) => (
              <li key={request.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{studentName(student)}</p>
                      <p className="text-sm text-muted-foreground">
                        {request.purpose} · Connected{" "}
                        {formatDate(request.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>Connected</Badge>
                      <ButtonLink
                        size="sm"
                        variant="outline"
                        href="/app/messages"
                      >
                        Message
                      </ButtonLink>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleDisconnect(request.id, studentName(student))
                        }
                      >
                        Disconnect
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          handleBlock(request.id, studentName(student))
                        }
                      >
                        Block
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ended.length > 0 ? (
        <section aria-labelledby="mentor-ended-heading">
          <h2 id="mentor-ended-heading" className="text-lg font-semibold">
            Past connections
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {ended.map(({ request, student }) => (
              <li key={request.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-muted-foreground">
                      {studentName(student)}
                    </p>
                    <Badge variant="outline">
                      {request.state === "blocked" ? "Blocked" : "Disconnected"}
                    </Badge>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
