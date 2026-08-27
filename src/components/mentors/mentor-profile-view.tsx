"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { mentorInitials } from "@/components/mentors/mentor-card";
import { useDemoSession } from "@/lib/demo-session/provider";
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
    <Card data-testid="connected-panel">
      <CardHeader>
        <CardTitle className="text-lg">You&rsquo;re connected</CardTitle>
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
  const { session } = useDemoSession();
  const { data: mentor, ready } = useRepositoryQuery(
    () => mentorRepository.getBySlug(slug),
    [slug],
  );

  const studentId = session.accountType === "student" ? session.userId : null;
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
          <div className="flex items-center gap-4">
            <Avatar className="size-20">
              <AvatarFallback
                aria-hidden="true"
                className="text-xl font-semibold"
              >
                {mentorInitials(mentor.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {mentor.name}
              </h1>
              <p className="text-muted-foreground">
                {mentor.major} · {mentor.university}
              </p>
              <p className="text-sm text-muted-foreground">
                {mentor.countryRegion}
              </p>
            </div>
          </div>

          <section aria-labelledby="mentor-about">
            <h2 id="mentor-about" className="text-lg font-semibold">
              About
            </h2>
            <p className="mt-2 text-muted-foreground">{mentor.biography}</p>
          </section>

          <Separator />

          <section aria-labelledby="mentor-services">
            <h2 id="mentor-services" className="text-lg font-semibold">
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
            <h2 id="mentor-subjects" className="text-lg font-semibold">
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
            <h2 id="mentor-systems" className="text-lg font-semibold">
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
            <Card>
              <CardContent className="flex flex-col gap-3 pt-2">
                <ConnectCta mentor={mentor} />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
