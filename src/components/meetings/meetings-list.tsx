"use client";

import { useState } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button-link";
import { Skeleton } from "@/components/ui/skeleton";
import { StateChip } from "@/components/connections/mentor-requests-inbox";
import {
  formatWhen,
  needsMe,
  STATUS,
  type Meeting,
} from "@/components/meetings/meeting-types";
import { useApiGet } from "@/components/meetings/use-api";

/** Everything I'm in: what needs my answer first, then what's coming up. */
export function MeetingsList() {
  const [loaded] = useApiGet<Meeting[]>("/meetings");
  // Read the clock once (render must stay pure); fine for a list page.
  const [now] = useState(() => Date.now());

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="page-title">Meetings</h1>
      <ButtonLink href="/app/meetings/new">Request a meeting</ButtonLink>
    </div>
  );

  if (loaded.state === "loading") {
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  const meetings = loaded.state === "ready" ? loaded.data : [];
  const waiting = meetings.filter(needsMe);
  const upcoming = meetings.filter(
    (m) =>
      !needsMe(m) &&
      (m.status === "proposed" ||
        (m.status === "confirmed" &&
          m.startsAt &&
          new Date(m.startsAt).getTime() > now)),
  );
  const rest = meetings.filter(
    (m) => !waiting.includes(m) && !upcoming.includes(m),
  );

  return (
    <div className="flex flex-col gap-10">
      {header}
      {loaded.state === "error" ? (
        <p className="text-muted-foreground">
          Couldn&rsquo;t load your meetings. Refresh to try again.
        </p>
      ) : meetings.length === 0 ? (
        <p className="sheet p-6 text-muted-foreground">
          No meetings yet. Request one, or wait for your weekly check-in.
        </p>
      ) : null}
      <Group title="Needs your answer" meetings={waiting} />
      <Group title="Coming up" meetings={upcoming} />
      <Group title="Earlier" meetings={rest} />
    </div>
  );
}

function Group({ title, meetings }: { title: string; meetings: Meeting[] }) {
  if (meetings.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="label-caps text-subtle">{title}</h2>
      <ul className="sheet divide-y">
        {meetings.map((m) => {
          const [chip, label] = STATUS[m.status];
          return (
            <li key={m.id}>
              <Link
                href={`/app/meetings/${m.id}`}
                className="flex flex-col gap-1.5 p-5 transition-colors duration-150 hover:bg-accent/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">{m.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {m.startsAt
                      ? `${formatWhen(m.startsAt)} · ${m.minutes} min`
                      : m.status === "no_slot"
                        ? `${m.minutes} min · pick a time`
                        : "Summary only"}
                    {" · "}
                    {m.people.map((p) => p.name).join(", ")}
                  </p>
                </div>
                <StateChip state={chip}>{label}</StateChip>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
