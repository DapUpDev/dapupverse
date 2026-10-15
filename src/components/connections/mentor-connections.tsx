"use client";

import Link from "next/link";
import { toast } from "sonner";
import {
  RequestGroup,
  RequestSheet,
  SheetsSkeleton,
  StateChip,
  studentName,
  studentOf,
  useMentorRequests,
} from "@/components/connections/mentor-requests-inbox";
import { ConnectionList } from "@/components/connections/connection-list";
import { useChatLinks } from "@/components/connections/use-chat-links";
import { connectionRepository } from "@/lib/repositories";

/** Mentor view of accepted (and ended) connections. */
export function MentorConnections({ mentorId }: { mentorId: string }) {
  const { data, ready } = useMentorRequests(mentorId);
  const chatLink = useChatLinks(mentorId);

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
            <h3 className="font-display text-xl font-semibold">
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
          <ConnectionList
            rows={accepted.map(({ request, student }) => {
              const name = studentName(student);
              return {
                ...studentOf(student),
                id: request.id,
                since: request.updatedAt,
                chatHref: chatLink(request.id),
                menu: [
                  {
                    label: "Disconnect",
                    onSelect: () => handleDisconnect(request.id, name),
                  },
                  {
                    label: "Block",
                    onSelect: () => handleBlock(request.id, name),
                  },
                ],
              };
            })}
          />
        )}
      </RequestGroup>

      {ended.length > 0 ? (
        <RequestGroup id="mentor-ended-heading" title="Past connections">
          <ul className="grid gap-3 lg:grid-cols-2">
            {ended.map(({ request, student }) => (
              <RequestSheet
                key={request.id}
                compact
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
