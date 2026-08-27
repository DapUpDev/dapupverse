"use client";

import Link from "next/link";
import { CircleOff, Clock3, Link2 } from "lucide-react";
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
import type { ConnectionRequest, Mentor } from "@/lib/domain/types";
import {
  connectionRepository,
  mentorRepository,
} from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

type RequestWithMentor = { request: ConnectionRequest; mentor: Mentor | null };

/**
 * Student view of connections. A mentor-side archived request still shows
 * here as pending — archiving is invisible to students and is never a
 * rejection.
 */
export function StudentConnections({ studentId }: { studentId: string }) {
  const { data, ready } = useRepositoryQuery<RequestWithMentor[]>(async () => {
    const requests = await connectionRepository.listForStudent(studentId);
    const mentors = await mentorRepository.list();
    return requests
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((request) => ({
        request,
        mentor: mentors.find((m) => m.id === request.mentorId) ?? null,
      }));
  }, [studentId]);

  if (!ready) return <Skeleton className="h-64 rounded-xl" />;

  const pending = (data ?? []).filter((r) => r.request.state === "pending");
  const accepted = (data ?? []).filter((r) => r.request.state === "accepted");
  const ended = (data ?? []).filter(
    (r) =>
      r.request.state === "disconnected" || r.request.state === "blocked",
  );

  const handleDisconnect = async (id: string, mentorName: string) => {
    await connectionRepository.disconnect(id);
    toast("Disconnected", {
      description: `Your connection with ${mentorName} has ended. The conversation is now read-only.`,
    });
  };

  if ((data ?? []).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No connections yet</CardTitle>
          <CardDescription>
            Find a mentor and send your first connection request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ButtonLink href="/mentors">Find a mentor</ButtonLink>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="connected-heading">
        <h2 id="connected-heading" className="text-lg font-semibold">
          Connected mentors
        </h2>
        {accepted.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No accepted connections yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {accepted.map(({ request, mentor }) => (
              <li key={request.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {mentor ? (
                          <Link
                            href={`/mentors/${mentor.slug}`}
                            className="hover:underline"
                          >
                            {mentor.name}
                          </Link>
                        ) : (
                          "Mentor"
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {request.purpose} · Connected{" "}
                        {formatDate(request.updatedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>
                        <Link2 aria-hidden="true" /> Connected
                      </Badge>
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
                          handleDisconnect(
                            request.id,
                            mentor?.name ?? "this mentor",
                          )
                        }
                      >
                        Disconnect
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="text-lg font-semibold">
          Pending requests
        </h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No pending requests.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {pending.map(({ request, mentor }) => (
              <li key={request.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {mentor ? (
                          <Link
                            href={`/mentors/${mentor.slug}`}
                            className="hover:underline"
                          >
                            {mentor.name}
                          </Link>
                        ) : (
                          "Mentor"
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {request.purpose} · Sent {formatDate(request.createdAt)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="border-dashed border-fog/60">
                      <Clock3 aria-hidden="true" /> Pending
                    </Badge>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ended.length > 0 ? (
        <section aria-labelledby="ended-heading">
          <h2 id="ended-heading" className="text-lg font-semibold">
            Past connections
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {ended.map(({ request, mentor }) => (
              <li key={request.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-muted-foreground">
                      {mentor?.name ?? "Mentor"}
                    </p>
                    <Badge variant="outline">
                      <CircleOff aria-hidden="true" /> Ended
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
