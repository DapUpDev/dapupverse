"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  RequestGroup,
  RequestSheet,
  SheetsSkeleton,
  StateChip,
} from "@/components/connections/mentor-requests-inbox";
import { formatDate } from "@/lib/format";
import type { ConnectionRequest, Mentor } from "@/lib/domain/types";
import {
  connectionRepository,
  mentorRepository,
} from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

type RequestWithMentor = { request: ConnectionRequest; mentor: Mentor | null };

/** Who a mentor is, as a request sheet shows them. */
function mentorOf(mentor: Mentor | null) {
  return {
    name: mentor?.name ?? "Mentor",
    avatarUrl: mentor?.avatarUrl,
    detail: mentor ? `${mentor.major} · ${mentor.university}` : undefined,
    title: mentor ? (
      <Link href={`/mentors/${mentor.slug}`} className="hover:underline">
        {mentor.name}
      </Link>
    ) : undefined,
  };
}

// Where a sheet will lie once there is one.
const emptySlot =
  "rounded-[6px] border border-dashed border-foreground/25 px-5 py-4 text-muted-foreground";

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

  if (!ready) return <SheetsSkeleton />;

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
      <div className="sheet p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold tracking-tight">
          No connections yet
        </h2>
        <p className="mt-1.5 text-muted-foreground">
          Find a mentor and send your first connection request.
        </p>
        <ButtonLink href="/mentors" className="mt-5">
          Find a mentor
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-14">
      <RequestGroup id="connected-heading" title="Connected mentors">
        {accepted.length === 0 ? (
          <p className={emptySlot}>No accepted connections yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {accepted.map(({ request, mentor }) => (
              <RequestSheet
                key={request.id}
                {...mentorOf(mentor)}
                chip={<StateChip state="accepted">Connected</StateChip>}
                request={request}
                when={`Connected ${formatDate(request.updatedAt)}`}
                actions={
                  <>
                    <ButtonLink href="/app/messages">Message</ButtonLink>
                    <Button
                      variant="destructive"
                      className="ml-auto"
                      onClick={() =>
                        handleDisconnect(
                          request.id,
                          mentor?.name ?? "this mentor",
                        )
                      }
                    >
                      Disconnect
                    </Button>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </RequestGroup>

      <RequestGroup id="pending-heading" title="Pending requests">
        {pending.length === 0 ? (
          <p className={emptySlot}>
            No pending requests.{" "}
            <Link href="/mentors" className="text-foreground underline">
              Find a mentor
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map(({ request, mentor }) => (
              <RequestSheet
                key={request.id}
                {...mentorOf(mentor)}
                chip={<StateChip state="pending">Pending</StateChip>}
                request={request}
                when={`Sent ${formatDate(request.createdAt)}`}
              />
            ))}
          </ul>
        )}
      </RequestGroup>

      {ended.length > 0 ? (
        <RequestGroup id="ended-heading" title="Past connections">
          <ul className="flex flex-col gap-3">
            {ended.map(({ request, mentor }) => (
              <RequestSheet
                key={request.id}
                name={mentor?.name ?? "Mentor"}
                avatarUrl={mentor?.avatarUrl}
                chip={<StateChip state="disconnected">Ended</StateChip>}
                request={request}
              />
            ))}
          </ul>
        </RequestGroup>
      ) : null}
    </div>
  );
}
