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
  studentName,
  studentOf,
  useMentorRequests,
} from "@/components/connections/mentor-requests-inbox";
import { formatDate } from "@/lib/format";
import { connectionRepository } from "@/lib/repositories";

/** Mentor view of accepted (and ended) connections. */
export function MentorConnections({ mentorId }: { mentorId: string }) {
  const { data, ready } = useMentorRequests(mentorId);

  if (!ready) return <SheetsSkeleton />;

  const sorted = [...(data ?? [])].sort((a, b) =>
    b.request.updatedAt.localeCompare(a.request.updatedAt),
  );
  const accepted = sorted.filter((r) => r.request.state === "accepted");
  const ended = sorted.filter(
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
    <div className="flex flex-col gap-14">
      <RequestGroup id="mentor-connected-heading" title="Connected students">
        {accepted.length === 0 ? (
          <div className="sheet p-6 sm:p-8">
            <h3 className="font-display text-xl font-semibold tracking-tight">
              No connections yet
            </h3>
            <p className="mt-1.5 text-muted-foreground">
              Accept a request from your{" "}
              <Link href="/app/requests" className="text-foreground underline">
                Requests inbox
              </Link>{" "}
              to start a connection.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {accepted.map(({ request, student }) => (
              <RequestSheet
                key={request.id}
                {...studentOf(student)}
                chip={<StateChip state="accepted">Connected</StateChip>}
                request={request}
                when={`Connected ${formatDate(request.updatedAt)}`}
                actions={
                  <>
                    <ButtonLink href="/app/messages">Message</ButtonLink>
                    {/* Kept apart from Message: neither asks to be confirmed. */}
                    <div className="ml-auto flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={() =>
                          handleDisconnect(request.id, studentName(student))
                        }
                      >
                        Disconnect
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() =>
                          handleBlock(request.id, studentName(student))
                        }
                      >
                        Block
                      </Button>
                    </div>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </RequestGroup>

      {ended.length > 0 ? (
        <RequestGroup id="mentor-ended-heading" title="Past connections">
          <ul className="flex flex-col gap-3">
            {ended.map(({ request, student }) => (
              <RequestSheet
                key={request.id}
                name={studentName(student)}
                avatarUrl={student?.avatarUrl}
                chip={
                  <StateChip state={request.state}>
                    {request.state === "blocked" ? "Blocked" : "Disconnected"}
                  </StateChip>
                }
                request={request}
              />
            ))}
          </ul>
        </RequestGroup>
      ) : null}
    </div>
  );
}
