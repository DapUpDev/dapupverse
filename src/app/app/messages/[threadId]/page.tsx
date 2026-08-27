"use client";

import { use } from "react";
import { RequireDemoAccount } from "@/components/app/require-demo-account";
import { Conversation } from "@/components/messages/conversation";
import {
  ThreadList,
  useThreadList,
} from "@/components/messages/thread-list";
import { useDemoSession } from "@/lib/demo-session/provider";

function ConversationView({ threadId }: { threadId: string }) {
  const { session } = useDemoSession();
  const userId = session.userId;
  const { data: items, ready } = useThreadList(userId);

  if (!userId) return null;

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

export default function ConversationPage({
  params,
}: PageProps<"/app/messages/[threadId]">) {
  const { threadId } = use(params);
  return (
    <RequireDemoAccount>
      <main className="mx-auto w-full max-w-5xl px-4 py-10">
        <ConversationView threadId={threadId} />
      </main>
    </RequireDemoAccount>
  );
}
