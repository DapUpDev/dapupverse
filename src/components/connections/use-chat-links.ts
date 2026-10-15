"use client";

import { messageRepository } from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

/**
 * Where each connection's Message button goes: straight into that
 * conversation. A thread is created when a request is accepted, so every
 * active connection has one; the inbox is the fallback while threads load.
 */
export function useChatLinks(userId: string): (connectionId: string) => string {
  const { data } = useRepositoryQuery(
    () => messageRepository.listThreads(userId),
    [userId],
  );
  const byConnection = new Map(
    (data ?? []).map((thread) => [thread.connectionId, thread.id]),
  );
  return (connectionId) => {
    const threadId = byConnection.get(connectionId);
    return threadId ? `/app/messages/${threadId}` : "/app/messages";
  };
}
