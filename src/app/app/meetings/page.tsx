import { requireAuth } from "@/lib/auth/guards";
import { MeetingsList } from "@/components/meetings/meetings-list";

export default async function MeetingsPage() {
  await requireAuth("/app/meetings");
  return (
    <main className="page">
      <div className="max-w-3xl">
        <MeetingsList />
      </div>
    </main>
  );
}
