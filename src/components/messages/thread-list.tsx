"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { ConnectionState } from "@/lib/domain/types";
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
  lastMessageText: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  connectionState: ConnectionState;
};

export function useThreadList(userId: string | null) {
  return useRepositoryQuery<ThreadListItem[]>(async () => {
    if (!userId) return [];
    const threads = await messageRepository.listThreads(userId);
    const items = await Promise.all(
      threads.map(async (thread) => {
        const isMentorSide = thread.mentorId === userId;
        const [connection, messages, unreadCount] = await Promise.all([
          connectionRepository.get(thread.connectionId),
          messageRepository.listMessages(thread.id),
          messageRepository.unreadCount(thread.id, userId),
        ]);
        let otherPartyName = isMentorSide ? "Student" : "Mentor";
        if (isMentorSide) {
          const student = await studentProfileRepository.get(thread.studentId);
          if (student?.fullName.trim()) otherPartyName = student.fullName;
        } else {
          const mentors = await mentorRepository.list();
          const mentor = mentors.find((m) => m.id === thread.mentorId);
          if (mentor) otherPartyName = mentor.name;
        }
        const last = messages.at(-1) ?? null;
        return {
          threadId: thread.id,
          otherPartyName,
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
  }, [userId]);
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
  if (!ready) return <Skeleton className="h-48 rounded-xl" />;

  if (!items || items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No conversations yet</CardTitle>
          <CardDescription>
            {hasPendingRequests
              ? "Messaging unlocks once a request is accepted. Your request is still pending."
              : "Conversations appear here after a connection request is accepted."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <nav aria-label="Conversations">
      <ul className="flex flex-col gap-2">
        {items.map((item) => {
          const readOnly = item.connectionState !== "accepted";
          const active = item.threadId === activeThreadId;
          return (
            <li key={item.threadId}>
              <Link
                href={`/app/messages/${item.threadId}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-3 transition-colors hover:bg-accent",
                  active && "border-ring bg-accent",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{item.otherPartyName}</span>
                  <span className="flex items-center gap-2">
                    {readOnly ? (
                      <Badge variant="outline">Read-only</Badge>
                    ) : null}
                    {item.unreadCount > 0 ? (
                      <Badge aria-label={`${item.unreadCount} unread`}>
                        {item.unreadCount}
                      </Badge>
                    ) : null}
                  </span>
                </span>
                {item.lastMessageText ? (
                  <span className="line-clamp-1 text-sm text-muted-foreground">
                    {item.lastMessageText}
                  </span>
                ) : null}
                {item.lastMessageAt ? (
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDate(item.lastMessageAt)}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
