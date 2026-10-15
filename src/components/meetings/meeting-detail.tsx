"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ButtonLink } from "@/components/ui/button-link";
import { StateChip } from "@/components/connections/mentor-requests-inbox";
import { AvailabilityGrid } from "@/components/meetings/availability-grid";
import {
  formatWhen,
  STATUS,
  type Meeting,
} from "@/components/meetings/meeting-types";
import { useApiGet } from "@/components/meetings/use-api";

/**
 * One meeting. While it's finding a time, the when2meet grid; once booked,
 * when and who. Either way: why, the agenda and any note.
 */
export function MeetingDetail({ meetingId }: { meetingId: string }) {
  const [loaded, setMeeting] = useApiGet<Meeting>(
    `/meetings/${encodeURIComponent(meetingId)}`,
  );
  const [now] = useState(() => Date.now()); // render stays pure

  if (loaded.state === "loading") {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (loaded.state !== "ready") {
    return (
      <div className="sheet flex max-w-2xl flex-col items-start gap-3 p-6 shadow-sheet sm:p-8">
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
  const closed =
    meeting.status === "collecting" &&
    meeting.windowEnd !== null &&
    Date.parse(meeting.windowEnd) < now; // a finished week can't be booked

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="label-caps text-subtle">
          {meeting.kind === "triage" ? "From the weekly check-in" : "Requested"}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="page-title">{meeting.title}</h1>
          <StateChip state={chip}>{label}</StateChip>
        </div>
        <p className="text-lg">
          {meeting.startsAt
            ? `${formatWhen(meeting.startsAt)} · ${meeting.minutes} minutes`
            : meeting.minutes
              ? `${meeting.minutes} minutes · ${meeting.people.map((p) => p.name).join(", ")}`
              : null}
        </p>
      </header>

      {meeting.status === "collecting" && !closed ? (
        <AvailabilityGrid meeting={meeting} onChanged={setMeeting} />
      ) : null}
      {closed ? (
        <p className="sheet max-w-2xl p-5 text-muted-foreground">
          The week for this meeting has passed without a booking. Request a new
          meeting to pick another time.
        </p>
      ) : null}

      <div className="sheet flex max-w-2xl flex-col gap-6 p-6 shadow-sheet sm:p-8">
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
                {meeting.status === "collecting" ? (
                  <span className="text-sm text-muted-foreground">
                    {p.filledIn ? "Marked their times" : "Hasn't marked times"}
                  </span>
                ) : null}
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
