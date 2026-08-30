import { requireAuth } from "@/lib/auth/guards";
import { ProfileContent } from "@/components/profile/profile-content";

export default async function ProfilePage() {
  const identity = await requireAuth("/app/profile");
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <ProfileContent
        accountType={identity.accountType ?? "student"}
        dataUserId={identity.dataUserId!}
      />
    </main>
  );
}
