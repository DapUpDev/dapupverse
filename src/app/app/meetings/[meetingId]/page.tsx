import { requireAuth } from "@/lib/auth/guards";
import { MeetingDetail } from "@/components/meetings/meeting-detail";

export default async function MeetingPage({
  params,
}: PageProps<"/app/meetings/[meetingId]">) {
  const { meetingId } = await params;
  await requireAuth(`/app/meetings/${meetingId}`);
  return (
    <main className="page">
      <div className="max-w-2xl">
        <MeetingDetail meetingId={meetingId} />
      </div>
    </main>
  );
}
