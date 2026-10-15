import { requireAuth } from "@/lib/auth/guards";
import { Suspense } from "react";
import { CalendarConnection } from "@/components/profile/calendar-connection";
import { ProfileContent } from "@/components/profile/profile-content";

export default async function ProfilePage() {
  const identity = await requireAuth("/app/profile");
  return (
    <main className="page">
      <div className="max-w-2xl">
        <ProfileContent
          accountType={identity.accountType ?? "student"}
          dataUserId={identity.dataUserId!}
        />
        {/* Suspense: it reads ?calendar= from the URL after Google's redirect. */}
        <Suspense>
          <CalendarConnection />
        </Suspense>
      </div>
    </main>
  );
}
