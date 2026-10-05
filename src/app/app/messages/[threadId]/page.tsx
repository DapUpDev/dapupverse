import { requireAuth } from "@/lib/auth/guards";
import { ConversationView } from "@/components/messages/conversation-view";

export default async function ConversationPage({
  params,
}: PageProps<"/app/messages/[threadId]">) {
  const { threadId } = await params;
  const identity = await requireAuth(`/app/messages/${threadId}`);
  return (
    <main className="page">
      <ConversationView threadId={threadId} userId={identity.dataUserId!} />
    </main>
  );
}
