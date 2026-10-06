"use client";

import Link from "next/link";
import { ChevronRight, CircleOff, MessageCircleDashed } from "lucide-react";
import { studentName } from "@/components/connections/mentor-requests-inbox";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { ConnectionState, MessageThread } from "@/lib/domain/types";
import {
  connectionRepository,
  mentorRepository,
  messageRepository,
  studentProfileRepository,
} from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

export type ThreadListItem = {
  threadId: string;
  otherPartyName: string;
  otherPartyAvatarUrl: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  connectionState: ConnectionState;
};

/** Name and picture of the other participant, seen from `userId`'s side. */
export async function otherParty(
  thread: MessageThread,
  userId: string,
): Promise<{ name: string; avatarUrl: string | null }> {
  if (thread.mentorId === userId) {
    const student = await studentProfileRepository.get(thread.studentId);
    return {
      name: studentName(student),
      avatarUrl: student?.avatarUrl ?? null,
    };
  }
  const mentors = await mentorRepository.list();
  const mentor = mentors.find((m) => m.id === thread.mentorId);
  return { name: mentor?.name ?? "Mentor", avatarUrl: mentor?.avatarUrl ?? null };
}

export function useThreadList(userId: string | null) {
  return useRepositoryQuery<ThreadListItem[]>(async () => {
    if (!userId) return [];
    const threads = await messageRepository.listThreads(userId);
    const items = await Promise.all(
      threads.map(async (thread) => {
        const [connection, messages, unreadCount, other] = await Promise.all([
          connectionRepository.get(thread.connectionId),
          messageRepository.listMessages(thread.id),
          messageRepository.unreadCount(thread.id, userId),
          otherParty(thread, userId),
        ]);
        const last = messages.at(-1) ?? null;
        return {
          threadId: thread.id,
          otherPartyName: other.name,
          otherPartyAvatarUrl: other.avatarUrl,
          lastMessageText: last?.text ?? null,
          lastMessageAt: last?.sentAt ?? null,
          unreadCount,
          connectionState: connection?.state ?? "accepted",
        };
      }),
    );
    return items.sort((a, b) =>
      (b.lastMessageAt ?? "").localeCompare(a.lastMessageAt ?? ""),
    );
  }, [userId], 10_000);
}

export function ThreadList({
  items,
  ready,
  activeThreadId,
  hasPendingRequests,
}: {
  items: ThreadListItem[] | undefined;
  ready: boolean;
  activeThreadId?: string;
  hasPendingRequests: boolean;
}) {
  if (!ready) {
    return (
      <div aria-busy="true" className="sheet divide-y">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-2 h-3.5 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="sheet p-6 sm:p-8">
        <MessageCircleDashed
          aria-hidden="true"
          size={34}
          strokeWidth={1.75}
          absoluteStrokeWidth
        />
        <h2 className="mt-5 font-display text-xl font-semibold tracking-tight">
          No conversations yet
        </h2>
        <p className="mt-2 text-pretty text-muted-foreground">
          {hasPendingRequests
            ? "Messaging unlocks once a request is accepted. Your request is still pending."
            : "Conversations appear here after a connection request is accepted."}
        </p>
      </div>
    );
  }

  return (
    <nav
      aria-label="Conversations"
      className="sheet overflow-hidden [scrollbar-color:--alpha(var(--foreground)/25%)_transparent] [scrollbar-width:thin] lg:max-h-[calc(100dvh-9rem)] lg:overflow-y-auto"
    >
      <ul className="divide-y">
        {items.map((item) => {
          const readOnly = item.connectionState !== "accepted";
          const active = item.threadId === activeThreadId;
          const unread = item.unreadCount > 0;
          return (
            <li key={item.threadId}>
              <Link
                href={`/app/messages/${item.threadId}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset active:bg-accent",
                  active && "bg-accent hover:bg-accent",
                )}
              >
                <ProfileAvatar
                  name={item.otherPartyName}
                  avatarUrl={item.otherPartyAvatarUrl}
                  className="size-10"
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline gap-3">
                    <span
                      className={cn(
                        "min-w-0 truncate",
                        unread ? "font-semibold" : "font-medium",
                      )}
                    >
                      {item.otherPartyName}
                    </span>
                    {item.lastMessageAt ? (
                      <span className="ml-auto shrink-0 text-xs text-subtle tabular-nums">
                        {formatDate(item.lastMessageAt)}
                      </span>
                    ) : null}
                  </span>
                  {item.lastMessageText || readOnly || unread ? (
                    <span className="flex items-center gap-3">
                      {item.lastMessageText ? (
                        <span
                          className={cn(
                            "min-w-0 truncate text-sm",
                            unread
                              ? "font-medium text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {item.lastMessageText}
                        </span>
                      ) : null}
                      <span className="ml-auto flex shrink-0 items-center gap-2">
                        {readOnly ? (
                          <span className="inline-flex items-center gap-1 text-xs text-subtle">
                            <CircleOff
                              aria-hidden="true"
                              strokeWidth={1.75}
                              className="size-3.5"
                            />
                            Read-only
                          </span>
                        ) : null}
                        {unread ? (
                          <span
                            aria-label={`${item.unreadCount} unread`}
                            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-white tabular-nums"
                          >
                            {item.unreadCount}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  ) : null}
                </span>
                {active ? (
                  <ChevronRight
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4 shrink-0"
                  />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
