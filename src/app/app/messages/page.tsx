import { requireAuth } from "@/lib/auth/guards";
import { MessagesInbox } from "@/components/messages/messages-inbox";
import { apiBaseUrl } from "@/lib/api/client";

export default async function MessagesPage() {
  const identity = await requireAuth("/app/messages");
  return (
    <main className="page">
      <h1 className="page-title">
        Messages
      </h1>
      {apiBaseUrl() ? null : (
        <p className="mt-3 max-w-2xl text-sm text-pretty text-subtle">
          Demo data: conversations are stored in this browser only and
          don&rsquo;t sync between devices or accounts yet.
        </p>
      )}
      <div className="mt-8">
        <MessagesInbox
          userId={identity.dataUserId!}
          accountType={identity.accountType ?? "student"}
        />
      </div>
    </main>
  );
}
