"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Badge } from "@/components/ui/badge";
import { AuthRequiredDialog } from "@/components/connect/auth-required-dialog";
import { ConnectRequestDialog } from "@/components/connect/connect-request-dialog";
import {
  clearConnectionIntent,
  loadConnectionIntent,
  saveConnectionIntent,
} from "@/lib/demo-session/connection-intent";
import { useDemoSession } from "@/lib/demo-session/provider";
import { isStudentProfileComplete, type Mentor } from "@/lib/domain/types";
import {
  connectionRepository,
  studentProfileRepository,
} from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";

/**
 * The `Connect with this mentor` call to action. Behavior depends on the
 * current demo session:
 *
 * - Visitor: auth-required dialog (future-auth UI), with a preview-only
 *   "Preview as student" continuation.
 * - Student with incomplete profile: detours through profile setup, keeping a
 *   typed connection intent so the flow resumes here.
 * - Student with complete profile: the request form.
 * - Existing pending/accepted/blocked request: status instead of a new form.
 */
export function ConnectCta({ mentor }: { mentor: Mentor }) {
  const router = useRouter();
  const { session, previewEnabled, setRole } = useDemoSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const studentId = session.accountType === "student" ? session.userId : null;

  const { data: studentProfile } = useRepositoryQuery(
    () =>
      studentId
        ? studentProfileRepository.get(studentId)
        : Promise.resolve(null),
    [studentId],
  );
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

  const profileComplete =
    studentProfile != null && isStudentProfileComplete(studentProfile);

  const startStudentFlow = () => {
    if (!profileComplete) {
      saveConnectionIntent({
        kind: "connect-with-mentor",
        mentorSlug: mentor.slug,
        returnTo: `/mentors/${mentor.slug}`,
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

  // Continue a stored connection intent for this mentor: open the request
  // form when the student profile is complete, or detour through profile
  // setup (keeping the intent) when it isn't.
  useEffect(() => {
    if (!studentId || studentProfile === undefined) return;
    const intent = loadConnectionIntent();
    if (!intent || intent.mentorSlug !== mentor.slug) return;
    if (studentProfile && isStudentProfileComplete(studentProfile)) {
      clearConnectionIntent();
      // Deferred so the dialog opens as a follow-up task, not during the
      // effect itself (react-hooks/set-state-in-effect).
      const timer = setTimeout(() => setRequestOpen(true), 0);
      return () => clearTimeout(timer);
    }
    router.push("/app/profile?setup=connect");
  }, [studentId, studentProfile, mentor.slug, router]);

  // Mentors don't send connection requests in this demo.
  if (session.accountType === "mentor") {
    return previewEnabled ? (
      <p className="text-sm text-muted-foreground">
        You&rsquo;re previewing as a mentor. Switch the preview role to
        Student to try connecting.
      </p>
    ) : null;
  }

  if (session.role === "visitor") {
    return (
      <>
        <Button
          size="lg"
          onClick={() => {
            saveConnectionIntent({
              kind: "connect-with-mentor",
              mentorSlug: mentor.slug,
              returnTo: `/mentors/${mentor.slug}`,
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
          onPreviewAsStudent={() => {
            setAuthOpen(false);
            setRole("student");
            toast("Previewing as student", {
              description: "Demo session only — continuing your request.",
            });
          }}
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
      <div className="flex flex-wrap items-center gap-3">
        <Badge>Connected</Badge>
        <ButtonLink variant="outline" href="/app/messages">
          Message {mentor.name}
        </ButtonLink>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">Request pending</Badge>
        <p className="text-sm text-muted-foreground">
          {mentor.name} hasn&rsquo;t responded yet. Track it in{" "}
          <Link href="/app/connections" className="underline underline-offset-4">
            Connections
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <>
      <Button size="lg" onClick={startStudentFlow}>
        Connect with this mentor
      </Button>
      {studentId ? (
        <ConnectRequestDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          mentor={mentor}
          studentId={studentId}
          onSubmitted={() => {}}
        />
      ) : null}
    </>
  );
}
