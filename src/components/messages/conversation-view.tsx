"use client";

import { Conversation } from "@/components/messages/conversation";
import { ThreadList, useThreadList } from "@/components/messages/thread-list";

/**
 * Two-pane conversation view. Note: thread-participant authorization is a
 * mock-data limitation — real cross-user enforcement arrives with the
 * permanent backend.
 */
export function ConversationView({
  threadId,
  userId,
}: {
  threadId: string;
  userId: string;
}) {
  const { data: items, ready } = useThreadList(userId);

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="hidden lg:block">
        <ThreadList
          items={items}
          ready={ready}
          activeThreadId={threadId}
          hasPendingRequests={false}
        />
      </div>
      <Conversation threadId={threadId} userId={userId} />
    </div>
  );
}
