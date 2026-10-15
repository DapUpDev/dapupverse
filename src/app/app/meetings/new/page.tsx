import { requireAuth } from "@/lib/auth/guards";
import { RequestMeeting } from "@/components/meetings/request-meeting";

export default async function NewMeetingPage() {
  await requireAuth("/app/meetings/new");
  return (
    <main className="page">
      <div className="flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="page-title">Request a meeting</h1>
          <p className="text-muted-foreground">
            Pick who and how long, then a time when everyone is free. Everyone
            else gets an email to accept.
          </p>
        </div>
        <RequestMeeting />
      </div>
    </main>
  );
}
