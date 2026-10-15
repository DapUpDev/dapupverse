"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Skeleton } from "@/components/ui/skeleton";
import { StateChip } from "@/components/connections/mentor-requests-inbox";
import {
  formatWhen,
  STATUS,
  type Meeting,
} from "@/components/meetings/meeting-types";
import { useApiGet } from "@/components/meetings/use-api";
import { ApiError, apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

const RESPONSE = {
  accepted: "Accepted",
  pending: "Hasn't answered",
  declined: "Declined",
} as const;

/** One meeting: when, who, why, and my Confirm / Decline / pick a time. */
export function MeetingDetail({ meetingId }: { meetingId: string }) {
  const [loaded, setMeeting] = useApiGet<Meeting>(
    `/meetings/${encodeURIComponent(meetingId)}`,
  );
  const [busy, setBusy] = useState(false);

  if (loaded.state === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (loaded.state !== "ready") {
    return (
      <div className="sheet flex flex-col items-start gap-3 p-6 shadow-sheet sm:p-8">
        <h1 className="font-display text-xl font-semibold">
          {loaded.state === "missing"
            ? "Meeting not found"
            : "Something went wrong"}
        </h1>
        <p className="text-muted-foreground">
          {loaded.state === "missing"
            ? "It may belong to a different account."
            : "Refresh the page to try again."}
        </p>
        <ButtonLink href="/app/meetings" variant="outline" size="sm">
          All meetings
        </ButtonLink>
      </div>
    );
  }

  const meeting = loaded.data;
  const [chip, label] = STATUS[meeting.status];

  const act = async (path: string, body: object, done: string) => {
    setBusy(true);
    try {
      setMeeting(
        await apiFetch<Meeting>(
          `/meetings/${encodeURIComponent(meeting.id)}/${path}`,
          { method: "POST", body },
        ),
      );
      toast.success(done);
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.status !== 500
          ? error.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="label-caps text-subtle">
          {meeting.kind === "triage" ? "From the weekly check-in" : "Requested"}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="page-title">{meeting.title}</h1>
          <StateChip state={chip}>{label}</StateChip>
        </div>
        {meeting.startsAt ? (
          <p className="text-lg">
            {formatWhen(meeting.startsAt)} · {meeting.minutes} minutes
          </p>
        ) : null}
      </header>

      {meeting.status === "proposed" && meeting.myResponse === "pending" ? (
        <div className="sheet flex flex-wrap items-center justify-between gap-4 p-5 shadow-sheet">
          <p className="font-medium">Does this time work for you?</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => act("respond", { accept: false }, "You declined.")}
            >
              Decline
            </Button>
            <Button
              disabled={busy}
              onClick={() =>
                act("respond", { accept: true }, "Confirmed. Thank you.")
              }
            >
              Confirm
            </Button>
          </div>
        </div>
      ) : null}

      {meeting.status === "no_slot" && meeting.myRole === "student" ? (
        <div className="sheet flex flex-col gap-3 p-5 shadow-sheet">
          <p className="font-medium">
            Nothing fit this week. Pick a time and your mentors will confirm it.
          </p>
          <div className="flex flex-wrap gap-2">
            {meeting.options.map((option) => (
              <Button
                key={option}
                variant="outline"
                disabled={busy}
                onClick={() =>
                  act("pick", { startsAt: option }, "Sent to your mentors.")
                }
              >
                {formatWhen(option)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="sheet flex flex-col gap-6 p-6 shadow-sheet sm:p-8">
        <section className="flex flex-col gap-2">
          <h2 className="label-caps text-subtle">Who</h2>
          <ul className="flex flex-col gap-1.5">
            {meeting.people.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4"
              >
                <span>
                  {p.name}{" "}
                  <span className="text-sm text-muted-foreground">
                    {p.role === "mentor" ? "Mentor" : "Student"}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-sm",
                    p.response === "accepted"
                      ? "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {p.response ? RESPONSE[p.response] : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
        {meeting.reason ? (
          <section className="flex flex-col gap-2">
            <h2 className="label-caps text-subtle">Why</h2>
            <p className="text-pretty">{meeting.reason}</p>
          </section>
        ) : null}
        {meeting.agenda.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="label-caps text-subtle">Agenda</h2>
            <ul className="list-disc pl-5">
              {meeting.agenda.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {meeting.note ? (
          <section className="flex flex-col gap-2">
            <h2 className="label-caps text-subtle">Note</h2>
            <p className="text-pretty whitespace-pre-line">{meeting.note}</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}
