"use client";

import type { ReactNode } from "react";
import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleOff,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ProfileAvatar } from "@/components/profile/profile-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import type {
  ConnectionRequest,
  ConnectionState,
  StudentProfile,
} from "@/lib/domain/types";
import {
  connectionRepository,
  studentProfileRepository,
} from "@/lib/repositories";
import { useRepositoryQuery } from "@/lib/repositories/use-repository-query";
import { cn } from "@/lib/utils";

type RequestWithStudent = {
  request: ConnectionRequest;
  student: StudentProfile | null;
};

export function studentName(student: StudentProfile | null): string {
  return student?.fullName.trim() ? student.fullName : "Student";
}

/** Who a student is, as a request sheet shows them. */
export function studentOf(student: StudentProfile | null) {
  return {
    name: studentName(student),
    avatarUrl: student?.avatarUrl,
    detail: [student?.school, student?.educationSystem]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Every request sent to this mentor, paired with the student's profile. */
export function useMentorRequests(mentorId: string) {
  return useRepositoryQuery<RequestWithStudent[]>(async () => {
    const requests = await connectionRepository.listForMentor(mentorId);
    const students = await Promise.all(
      requests.map((r) => studentProfileRepository.get(r.studentId)),
    );
    return requests.map((request, index) => ({
      request,
      student: students[index],
    }));
  }, [mentorId]);
}

const CHIP: Record<
  ConnectionState,
  [LucideIcon, "default" | "secondary" | "outline", string?]
> = {
  pending: [
    CircleDashed,
    "outline",
    "border-dashed border-foreground/40 text-muted-foreground",
  ],
  accepted: [CircleCheck, "default"],
  disconnected: [CircleOff, "secondary", "text-muted-foreground"],
  blocked: [Ban, "outline", "border-destructive/40 text-destructive"],
};

/** A request's state: always a drawn mark and a label, never colour alone. */
export function StateChip({
  state,
  children,
}: {
  state: ConnectionState;
  children: ReactNode;
}) {
  const [Icon, variant, look] = CHIP[state];
  return (
    <Badge variant={variant} className={look}>
      <Icon aria-hidden="true" strokeWidth={1.75} />
      {children}
    </Badge>
  );
}

/** A group of sheets under one plain heading. */
export function RequestGroup({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        className="font-display text-2xl font-semibold tracking-tight"
      >
        {title}
      </h2>
      {note ? (
        <p className="mt-1.5 max-w-[65ch] text-sm text-muted-foreground">
          {note}
        </p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * One request or connection on one sheet: who, its state, what it is about,
 * the message, when, and what can be done with it. Leave `when` out for a
 * connection that has ended; only who and the state remain.
 */
export function RequestSheet({
  name,
  title = name,
  avatarUrl,
  detail,
  chip,
  request,
  when,
  actions,
}: {
  name: string;
  /** The name as shown; a link when the person has a public page. */
  title?: ReactNode;
  avatarUrl: string | null | undefined;
  detail?: string;
  chip: ReactNode;
  request: ConnectionRequest;
  when?: string;
  actions?: ReactNode;
}) {
  return (
    <li className="sheet p-5 sm:p-6">
      {/* The chip drops under the name when a narrow sheet has no room. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-4">
          {/* A square ID photo, as on the mentor card. */}
          <ProfileAvatar
            name={name}
            avatarUrl={avatarUrl}
            className="size-12 rounded-[4px]"
          />
          <div className="min-w-0">
            <h3
              className={cn(
                "font-display text-xl leading-tight font-semibold tracking-tight break-words",
                !when && "text-muted-foreground",
              )}
            >
              {title}
            </h3>
            {detail ? (
              <p className="mt-1 text-sm leading-snug text-muted-foreground">
                {detail}
              </p>
            ) : null}
          </div>
        </div>
        {chip}
      </div>
      {when ? (
        <>
          <p className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4">
            <span className="font-medium">{request.purpose}</span>
            <span className="text-sm text-subtle tabular-nums">{when}</span>
          </p>
          <p className="mt-1.5 max-w-[65ch] text-pretty break-words whitespace-pre-line">
            {request.message}
          </p>
        </>
      ) : null}
      {actions ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-dashed border-foreground/25 pt-4">
          {actions}
        </div>
      ) : null}
    </li>
  );
}

/** Sheets lying where the real ones will, while they load. */
export function SheetsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {[0, 1].map((i) => (
        <div key={i} className="sheet flex items-center gap-4 p-5 sm:p-6">
          <Skeleton className="size-12 rounded-[4px]" />
          <div className="flex-1">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-4 w-56 max-w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Mentor request inbox. Requests can be accepted or archived — there is
 * deliberately no reject action anywhere. Archiving is invisible to the
 * student, who continues to see the request as pending.
 */
export function MentorRequestsInbox({ mentorId }: { mentorId: string }) {
  const { data, ready } = useMentorRequests(mentorId);

  if (!ready) return <SheetsSkeleton />;

  const sorted = [...(data ?? [])].sort((a, b) =>
    b.request.createdAt.localeCompare(a.request.createdAt),
  );
  const pending = sorted.filter(
    (r) => r.request.state === "pending" && !r.request.archivedByMentor,
  );
  const archived = sorted.filter(
    (r) => r.request.state === "pending" && r.request.archivedByMentor,
  );

  const handleAccept = async (id: string, name: string) => {
    await connectionRepository.acceptRequest(id);
    toast.success("Request accepted", {
      description: `You're now connected with ${name}. Messaging is unlocked.`,
    });
  };

  const handleArchive = async (id: string) => {
    await connectionRepository.archiveForMentor(id);
    toast("Request archived", {
      description:
        "Moved to your archive. The student still sees it as pending.",
    });
  };

  const handleUnarchive = async (id: string) => {
    await connectionRepository.unarchiveForMentor(id);
    toast("Request unarchived");
  };

  // Archived requests are still pending: only the second action differs.
  const sheet = (
    { request, student }: RequestWithStudent,
    second: ReactNode,
  ) => (
    <RequestSheet
      key={request.id}
      {...studentOf(student)}
      chip={<StateChip state="pending">Pending</StateChip>}
      request={request}
      when={`Sent ${formatDate(request.createdAt)}`}
      actions={
        <>
          <Button onClick={() => handleAccept(request.id, studentName(student))}>
            Accept
          </Button>
          {second}
        </>
      }
    />
  );

  return (
    <div className="flex flex-col gap-14">
      <RequestGroup id="inbox-heading" title="Incoming requests">
        {pending.length === 0 ? (
          <div className="sheet p-6 sm:p-8">
            {/* The highlighter's one job here: everything is answered. */}
            <svg
              width="34"
              height="34"
              viewBox="0 0 34 34"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="17" cy="17" r="12" className="fill-mark" />
              <path d="m11.5 17.5 3.8 3.8 7.2-8" />
            </svg>
            <h3 className="mt-4 font-display text-xl font-semibold tracking-tight">
              Inbox zero
            </h3>
            <p className="mt-1.5 text-muted-foreground">
              New student requests will appear here.
            </p>
            <ButtonLink
              variant="outline"
              href="/app/connections"
              className="mt-5"
            >
              See your connections
            </ButtonLink>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((item) =>
              sheet(
                item,
                <Button
                  variant="outline"
                  onClick={() => handleArchive(item.request.id)}
                >
                  Archive
                </Button>,
              ),
            )}
          </ul>
        )}
      </RequestGroup>

      {archived.length > 0 ? (
        <RequestGroup
          id="archived-heading"
          title="Archived"
          note="Archived requests are hidden from your inbox only — students still see them as pending."
        >
          <ul className="flex flex-col gap-3">
            {archived.map((item) =>
              sheet(
                item,
                <Button
                  variant="outline"
                  onClick={() => handleUnarchive(item.request.id)}
                >
                  Unarchive
                </Button>,
              ),
            )}
          </ul>
        </RequestGroup>
      ) : null}
    </div>
  );
}
