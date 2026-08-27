"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { RequireDemoAccount } from "@/components/app/require-demo-account";
import { MentorProfileForm } from "@/components/profile/mentor-profile-form";
import { StudentProfileForm } from "@/components/profile/student-profile-form";
import { useDemoSession } from "@/lib/demo-session/provider";
import {
  mentorRepository,
  studentProfileRepository,
} from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

function ProfileContent() {
  const { session } = useDemoSession();
  const userId = session.userId;
  const isMentor = session.accountType === "mentor";

  const { data: studentProfile, ready: studentReady } = useRepositoryQuery(
    () =>
      !isMentor && userId
        ? studentProfileRepository.get(userId)
        : Promise.resolve(null),
    [userId, isMentor],
  );
  const { data: mentorProfile, ready: mentorReady } = useRepositoryQuery(
    () =>
      isMentor && userId
        ? mentorRepository.getPrivateProfile(userId)
        : Promise.resolve(null),
    [userId, isMentor],
  );

  if ((isMentor && !mentorReady) || (!isMentor && !studentReady)) {
    return <Skeleton className="h-72 rounded-xl" />;
  }

  if (isMentor && mentorProfile) {
    return <MentorProfileForm key={mentorProfile.id} profile={mentorProfile} />;
  }
  if (!isMentor && studentProfile) {
    return (
      <StudentProfileForm key={studentProfile.id} profile={studentProfile} />
    );
  }
  return null;
}

export default function ProfilePage() {
  return (
    <RequireDemoAccount>
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <ProfileContent />
      </main>
    </RequireDemoAccount>
  );
}
