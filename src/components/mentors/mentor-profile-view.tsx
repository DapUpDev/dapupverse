"use client";

import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
    <Card data-testid="connected-panel" className="metal-border">
      <CardHeader>
        <span aria-hidden="true" className="tech-label">
          CONNECTED
        </span>
        <CardTitle className="font-display text-lg">
          You&rsquo;re connected
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {mentorName} accepted your request. You can message them any time.
        </p>
        <p className="text-sm">
          <span className="font-medium">Session rate:</span>{" "}
          {`$${profile.privatePriceUsd} USD`}
          <span className="block text-xs text-muted-foreground">
            Shared with connected students only.
          </span>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/app/messages">Message {mentorName}</ButtonLink>
          <span className="text-xs text-muted-foreground">
            Scheduling — coming soon
          </span>
        </div>
      </CardContent>
    </Card>
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
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!mentor) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Mentor not found</h1>
        <p className="mt-2 text-muted-foreground">
          This mentor may no longer be available.
        </p>
        <ButtonLink variant="outline" className="mt-6" href="/mentors">
          Back to all mentors
        </ButtonLink>
      </div>
    );
  }

  const isConnected = activeRequest?.state === "accepted";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-col gap-8 md:flex-row md:items-start">
        <div className="flex flex-1 flex-col gap-6">
          <div className="flex items-center gap-5">
            <ProfileAvatar
              name={mentor.name}
              avatarUrl={mentor.avatarUrl}
              className="size-24 border-2 border-chrome/40"
              fallbackClassName="text-2xl font-semibold"
            />
            <div className="flex flex-col gap-1">
              <span aria-hidden="true" className="tech-label">
                MENTOR PROFILE
              </span>
              <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
                {mentor.name}
              </h1>
              <p className="text-muted-foreground">
                {mentor.major} · {mentor.university}
              </p>
              <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
                {mentor.countryRegion}
              </p>
            </div>
          </div>

          <section aria-labelledby="mentor-about">
            <h2 id="mentor-about" className="font-display text-lg font-bold">
              About
            </h2>
            <p className="mt-2 text-muted-foreground">{mentor.biography}</p>
          </section>

          <Separator />

          <section aria-labelledby="mentor-services">
            <h2 id="mentor-services" className="font-mono text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Services
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {mentor.services.map((service) => (
                <Badge key={service} variant="secondary">
                  {service}
                </Badge>
              ))}
            </div>
          </section>

          <section aria-labelledby="mentor-subjects">
            <h2 id="mentor-subjects" className="font-mono text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Subjects &amp; specialties
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {mentor.subjects.map((subject) => (
                <Badge key={subject} variant="outline">
                  {subject}
                </Badge>
              ))}
            </div>
          </section>

          <section aria-labelledby="mentor-systems">
            <h2 id="mentor-systems" className="font-mono text-xs font-medium tracking-widest text-muted-foreground uppercase">
              Education systems
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {mentor.educationSystems.map((system) => (
                <Badge key={system} variant="secondary">
                  {system}
                </Badge>
              ))}
            </div>
          </section>
        </div>

        <aside className="flex w-full flex-col gap-4 md:w-72">
          {isConnected ? (
            <ConnectedStudentPanel
              mentorId={mentor.id}
              mentorName={mentor.name}
            />
          ) : (
            <Card className="metal-border">
              <CardContent className="flex flex-col gap-3 pt-2">
                <span aria-hidden="true" className="tech-label">
                  START HERE
                </span>
                <ConnectCta mentor={mentor} />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
