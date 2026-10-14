import { requireAuth } from "@/lib/auth/guards";
import { CheckInForm } from "@/components/check-ins/check-in-form";

export default async function CheckInPage({
  params,
}: PageProps<"/app/check-ins/[checkInId]">) {
  const { checkInId } = await params;
  await requireAuth(`/app/check-ins/${checkInId}`);
  return (
    <main className="page">
      <div className="max-w-2xl">
        <CheckInForm checkInId={checkInId} />
      </div>
    </main>
  );
}
