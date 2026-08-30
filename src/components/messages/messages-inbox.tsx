"use client";

import { ThreadList, useThreadList } from "@/components/messages/thread-list";
import type { AccountType } from "@/lib/domain/types";
import { connectionRepository } from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

export function MessagesInbox({
  userId,
  accountType,
}: {
  userId: string;
  accountType: AccountType;
}) {
  const { data: items, ready } = useThreadList(userId);
  const { data: requests } = useRepositoryQuery(
    () =>
      accountType === "student"
        ? connectionRepository.listForStudent(userId)
        : Promise.resolve([]),
    [userId, accountType],
  );
  const hasPendingRequests = (requests ?? []).some(
    (r) => r.state === "pending",
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <ThreadList
        items={items}
        ready={ready}
        hasPendingRequests={hasPendingRequests}
      />
      <div className="hidden items-center justify-center rounded-lg border border-dashed p-8 lg:flex">
        <p className="text-sm text-muted-foreground">
          {items && items.length > 0
            ? "Select a conversation to start reading."
            : "Your conversations will appear here."}
        </p>
      </div>
    </div>
  );
}
