"use client";

import { CircleCheck } from "lucide-react";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { ButtonLink } from "@/components/ui/button-link";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectCta } from "@/components/connect/connect-cta";
import { useAuthIdentity } from "@/lib/auth/use-auth-identity";
import {
  connectionRepository,
  mentorRepository,
} from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

/**
 * Private details panel for a student with an ACCEPTED connection to this
 * mentor. This is the only place a student ever sees the mentor's price.
 */
export function ConnectedStudentPanel({
  mentorId,
  mentorName,
}: {
  mentorId: string;
  mentorName: string;
}) {
  const { data: profile } = useRepositoryQuery(
    () => mentorRepository.getPrivateProfile(mentorId),
    [mentorId],
  );

  if (!profile) return null;

  return (
    <div data-testid="connected-panel" className="flex flex-col gap-4">
      <p className="flex items-center gap-2 font-display text-xl font-semibold">
        <CircleCheck
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-6 shrink-0 fill-mark"
        />
        You&rsquo;re connected
      </p>
      <p className="text-sm text-muted-foreground">
        {mentorName} accepted your request. You can message them any time.
      </p>
      <p className="text-sm">
        <span className="font-medium">Session rate:</span>{" "}
        <span className="tabular-nums">{`$${profile.privatePriceUsd} USD`}</span>
        <span className="block text-subtle">
          Shared with connected students only.
        </span>
      </p>
      <div className="flex flex-col items-start gap-2.5">
        <ButtonLink href="/app/messages" size="lg" className="w-full">
          Message {mentorName}
        </ButtonLink>
        <span className="text-sm text-subtle">Scheduling — coming soon</span>
      </div>
    </div>
  );
}

// One line of the mentor's sheet: a quiet term and what the mentor filled in.
function Fact({
  id,
  term,
  values,
}: {
  id: string;
  term: string;
  values: string[];
}) {
  if (values.length === 0) return null;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-sm text-subtle">
        {term}
      </h2>
      <p className="mt-1 leading-snug">{values.join(", ")}</p>
    </section>
  );
}

export function MentorProfileView({ slug }: { slug: string }) {
  const { identity } = useAuthIdentity();
  const { data: mentor, ready } = useRepositoryQuery(
    () => mentorRepository.getBySlug(slug),
    [slug],
  );

  const studentId =
    identity.accountType === "student" ? identity.dataUserId : null;
  const { data: activeRequest } = useRepositoryQuery(
    () =>
      studentId && mentor
        ? connectionRepository.findActiveForPair(studentId, mentor.id)
        : Promise.resolve(null),
    [studentId, mentor?.id],
  );

  if (!ready) {
    return (
      <div className="page">
        <div className="sheet p-6 shadow-sheet sm:p-10 lg:p-14">
          <Skeleton className="size-24 rounded-[4px] sm:size-28" />
          <Skeleton className="mt-6 h-10 w-64 max-w-full" />
          <Skeleton className="mt-3 h-5 w-80 max-w-full" />
          <Skeleton className="mt-10 h-28 w-full max-w-xl" />
        </div>
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className="page">
        <h1 className="page-title">Mentor not found</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          This mentor may no longer be available.
        </p>
        <ButtonLink
          variant="outline"
          size="lg"
          className="mt-7"
          href="/mentors"
        >
          Back to all mentors
        </ButtonLink>
      </div>
    );
  }

  const isConnected = activeRequest?.state === "accepted";

  // The mentor's own sheet. Past the perforation is the part a student acts
  // on: the request, and what this mentor can be asked for. On a narrow
  // screen that part sits between the name and the biography.
  return (
    <div className="page">
      <article className="sheet grid shadow-sheet lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-[auto_1fr]">
        <header className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start sm:gap-6 sm:p-10 lg:p-14 lg:pb-10">
          <ProfileAvatar
            name={mentor.name}
            avatarUrl={mentor.avatarUrl}
            className="size-24 rounded-[4px] sm:size-28 [&_[data-slot=avatar-fallback]]:text-3xl"
          />
          <div className="min-w-0">
            <h1 className="page-title wrap-anywhere">{mentor.name}</h1>
            <p className="mt-3 text-lg leading-snug text-muted-foreground">
              {mentor.major} · {mentor.university}
            </p>
            <p className="mt-1 text-sm text-subtle">{mentor.countryRegion}</p>
          </div>
        </header>

        <div className="border-dashed border-foreground/25 p-6 max-lg:border-y sm:p-10 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:border-l lg:px-8 lg:py-14">
          <aside className="sm:max-lg:max-w-xs">
            {isConnected ? (
              <ConnectedStudentPanel
                mentorId={mentor.id}
                mentorName={mentor.name}
              />
            ) : (
              <ConnectCta mentor={mentor} />
            )}
          </aside>
          <div className="mt-8 grid gap-5 sm:max-lg:grid-cols-3">
            <Fact
              id="mentor-services"
              term="Services"
              values={mentor.services}
            />
            <Fact
              id="mentor-subjects"
              term="Subjects & specialties"
              values={mentor.subjects}
            />
            <Fact
              id="mentor-systems"
              term="Education systems"
              values={mentor.educationSystems}
            />
          </div>
        </div>

        <section
          aria-labelledby="mentor-about"
          className="p-6 sm:p-10 lg:px-14 lg:pt-0 lg:pb-14"
        >
          <h2
            id="mentor-about"
            className="font-display text-2xl font-semibold tracking-tight"
          >
            About
          </h2>
          <p className="mt-3 max-w-xl text-lg text-pretty whitespace-pre-line text-muted-foreground">
            {mentor.biography}
          </p>
        </section>
      </article>
    </div>
  );
}
