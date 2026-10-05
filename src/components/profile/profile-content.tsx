"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { MentorProfileForm } from "@/components/profile/mentor-profile-form";
import { StudentProfileForm } from "@/components/profile/student-profile-form";
import type { AccountType } from "@/lib/domain/types";
import {
  mentorRepository,
  studentProfileRepository,
} from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

/**
 * Role-aware profile view/edit. The browser-local profile for a newly
 * authenticated user is initialized by the mock-identity bridge; until it
 * appears we show a loading state.
 */
export function ProfileContent({
  accountType,
  dataUserId,
}: {
  accountType: AccountType;
  dataUserId: string;
}) {
  const isMentor = accountType === "mentor";

  const { data: studentProfile, ready: studentReady } = useRepositoryQuery(
    () =>
      !isMentor
        ? studentProfileRepository.get(dataUserId)
        : Promise.resolve(null),
    [dataUserId, isMentor],
  );
  const { data: mentorProfile, ready: mentorReady } = useRepositoryQuery(
    () =>
      isMentor
        ? mentorRepository.getPrivateProfile(dataUserId)
        : Promise.resolve(null),
    [dataUserId, isMentor],
  );

  if (isMentor && mentorProfile) {
    return <MentorProfileForm key={mentorProfile.id} profile={mentorProfile} />;
  }
  if (!isMentor && studentProfile) {
    return (
      <StudentProfileForm key={studentProfile.id} profile={studentProfile} />
    );
  }
  // Not ready yet, or the local profile is still being initialized.
  void studentReady;
  void mentorReady;
  return (
    <div
      role="status"
      aria-label="Loading your profile"
      className="flex flex-col gap-6"
    >
      <Skeleton className="h-10 w-56 sm:h-12" />
      <div className="sheet p-6 shadow-sheet sm:p-8">
        <Skeleton className="size-20 rounded-[4px]" />
        <Skeleton className="mt-6 h-5 w-2/3" />
        <Skeleton className="mt-6 h-32 w-full" />
      </div>
    </div>
  );
}
