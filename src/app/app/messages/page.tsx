import { requireAuth } from "@/lib/auth/guards";
import { MessagesInbox } from "@/components/messages/messages-inbox";

export default async function MessagesPage() {
  const identity = await requireAuth("/app/messages");
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        Messages
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Demo data: conversations are stored in this browser only and
        don&rsquo;t sync between devices or accounts yet.
      </p>
      <div className="mt-6">
        <MessagesInbox
          userId={identity.dataUserId!}
          accountType={identity.accountType ?? "student"}
        />
      </div>
    </main>
  );
}
