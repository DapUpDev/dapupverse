"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleDashed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Badge } from "@/components/ui/badge";
import { AuthRequiredDialog } from "@/components/connect/auth-required-dialog";
import { ConnectRequestDialog } from "@/components/connect/connect-request-dialog";
import { StateChip } from "@/components/connections/mentor-requests-inbox";
import {
  clearConnectionIntent,
  loadConnectionIntent,
  saveConnectionIntent,
} from "@/lib/connection-intent";
import { useAuthIdentity } from "@/lib/auth/use-auth-identity";
import { isStudentProfileComplete, type Mentor } from "@/lib/domain/types";
import {
  connectionRepository,
  studentProfileRepository,
} from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

/**
 * The `Connect with this mentor` call to action.
 *
 * - Visitor: auth-required dialog linking to the real Clerk sign-up/sign-in,
 *   with the typed connection intent preserved across authentication.
 * - Student with incomplete profile: detours through profile setup, keeping
 *   the intent so the flow resumes here.
 * - Student with complete profile: the request form.
 * - Existing pending/accepted/blocked request: status instead of a new form.
 * - Mentors cannot send student connection requests.
 */
export function ConnectCta({ mentor }: { mentor: Mentor }) {
  const router = useRouter();
  const { identity } = useAuthIdentity();
  const [authOpen, setAuthOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const studentId =
    identity.accountType === "student" ? identity.dataUserId : null;
  const returnTo = `/mentors/${mentor.slug}`;

  const { data: studentRequests } = useRepositoryQuery(
    () =>
      studentId
        ? connectionRepository.listForStudent(studentId)
        : Promise.resolve([]),
    [studentId],
  );

  const requestsForMentor = (studentRequests ?? []).filter(
    (r) => r.mentorId === mentor.id,
  );
  const pending = requestsForMentor.find((r) => r.state === "pending");
  const accepted = requestsForMentor.find((r) => r.state === "accepted");
  const blocked = requestsForMentor.find((r) => r.state === "blocked");

  const startStudentFlow = async () => {
    // Read the profile now. A lookup held in state can still be the answer
    // for the signed-out render that came before this student was known.
    const profile = studentId
      ? await studentProfileRepository.get(studentId)
      : null;
    if (!profile || !isStudentProfileComplete(profile)) {
      saveConnectionIntent({
        kind: "connect-with-mentor",
        mentorSlug: mentor.slug,
        returnTo,
      });
      toast("Finish your profile first", {
        description:
          "Complete your student profile and we'll bring you back to this mentor.",
      });
      router.push("/app/profile?setup=connect");
      return;
    }
    setRequestOpen(true);
  };

  // Continue a stored connection intent for this mentor (e.g. after
  // returning from sign-in or profile setup): open the request form when the
  // profile is complete, or detour through profile setup keeping the intent.
  useEffect(() => {
    if (!studentId) return;
    const intent = loadConnectionIntent();
    if (!intent || intent.mentorSlug !== mentor.slug) return;
    let cancelled = false;
    studentProfileRepository.get(studentId).then((profile) => {
      if (cancelled) return;
      if (profile && isStudentProfileComplete(profile)) {
        clearConnectionIntent();
        setRequestOpen(true);
      } else {
        router.push("/app/profile?setup=connect");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [studentId, mentor.slug, router]);

  // Mentors don't send student connection requests.
  if (identity.accountType === "mentor") {
    return (
      <p className="text-sm text-muted-foreground">
        You&rsquo;re signed in as a mentor. Students send connection requests;
        yours arrive in{" "}
        <Link href="/app/requests" className="text-foreground underline">
          Requests
        </Link>
        .
      </p>
    );
  }

  if (!identity.isAuthenticated) {
    return (
      <>
        <Button
          size="lg"
          className="w-full"
          onClick={() => {
            saveConnectionIntent({
              kind: "connect-with-mentor",
              mentorSlug: mentor.slug,
              returnTo,
            });
            setAuthOpen(true);
          }}
        >
          Connect with this mentor
        </Button>
        <AuthRequiredDialog
          open={authOpen}
          onOpenChange={setAuthOpen}
          mentorName={mentor.name}
          returnTo={returnTo}
        />
      </>
    );
  }

  // Student states
  if (blocked && !pending && !accepted) {
    return (
      <p className="text-sm text-muted-foreground">
        A new request cannot be sent to this mentor.
      </p>
    );
  }

  if (accepted) {
    return (
      <div className="flex flex-col items-start gap-3">
        <StateChip state="accepted">Connected</StateChip>
        <ButtonLink variant="outline" href="/app/messages">
          Message {mentor.name}
        </ButtonLink>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Badge variant="outline" className="border-dashed border-foreground/40">
          <CircleDashed aria-hidden="true" strokeWidth={1.75} />
          Request pending
        </Badge>
        <p className="text-sm text-muted-foreground">
          {mentor.name} hasn&rsquo;t responded yet. Track it in{" "}
          <Link href="/app/connections" className="text-foreground underline">
            Connections
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      <Button size="lg" className="w-full" onClick={startStudentFlow}>
        Connect with this mentor
      </Button>
      {studentId ? (
        <ConnectRequestDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          mentor={mentor}
          studentId={studentId}
        />
      ) : null}
    </>
  );
}
