import { requireAuth } from "@/lib/auth/guards";
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
      </div>
    </main>
  );
}
