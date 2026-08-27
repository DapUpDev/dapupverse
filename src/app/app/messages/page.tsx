"use client";

import { RequireDemoAccount } from "@/components/app/require-demo-account";
import {
  ThreadList,
  useThreadList,
} from "@/components/messages/thread-list";
import { useDemoSession } from "@/lib/demo-session/provider";
import { connectionRepository } from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

function MessagesInbox() {
  const { session } = useDemoSession();
  const userId = session.userId;
  const { data: items, ready } = useThreadList(userId);
  const { data: requests } = useRepositoryQuery(
    () =>
      userId && session.accountType === "student"
        ? connectionRepository.listForStudent(userId)
        : Promise.resolve([]),
    [userId, session.accountType],
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

export default function MessagesPage() {
  return (
    <RequireDemoAccount>
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Messages</h1>
        <div className="mt-6">
          <MessagesInbox />
        </div>
      </main>
    </RequireDemoAccount>
  );
}
