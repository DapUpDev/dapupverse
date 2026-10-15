"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatShortDay,
  formatTime,
  formatWhen,
  type Availability,
  type Meeting,
} from "@/components/meetings/meeting-types";
import { useApiGet } from "@/components/meetings/use-api";
import { ApiError, apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/**
 * when2meet-style: mark the 15-minute cells you're free (left), see how
 * many people are free in each (right: red = nobody, lighter green = some,
 * green = everyone, with "2/3" counts so it doesn't rely on colour alone).
 * Any mentor in the meeting books a run of all-green cells as long as the
 * meeting. Days run 7 am to 10 pm in the viewer's own time zone.
 */

const CELL = 15 * 60 * 1000;
const FIRST_HOUR = 7;
const ROWS = (22 - FIRST_HOUR) * 4;
const GREEN = "#2f9e5b";
const RED = "#f4d5d3";
/** Already booked in DapUp: striped, never selectable. */
const BOOKED =
  "repeating-linear-gradient(135deg, transparent 0 3px, rgb(0 0 0 / 0.12) 3px 4px)";

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Local calendar days the window touches, and each cell's start (ms). */
function layout(windowStart: string, windowEnd: string) {
  const start = Date.parse(windowStart);
  const end = Date.parse(windowEnd);
  const first = new Date(start);
  const days: Date[] = [];
  for (
    let d = new Date(first.getFullYear(), first.getMonth(), first.getDate());
    d.getTime() < end;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  ) {
    days.push(d);
  }
  const cell = (day: Date, row: number) =>
    new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      FIRST_HOUR + Math.floor(row / 4),
      (row % 4) * 15,
    ).getTime();
  const inWindow = (t: number) => t >= start && t < end;
  return { days, cell, inWindow };
}

export function AvailabilityGrid({
  meeting,
  onChanged,
}: {
  meeting: Meeting;
  onChanged: (meeting: Meeting) => void;
}) {
  const [tz] = useState(zone);
  const path = `/meetings/${encodeURIComponent(meeting.id)}/availability?timezone=${encodeURIComponent(tz)}`;
  const [loaded, setAvailability] = useApiGet<Availability>(path);
  const [edited, setEdited] = useState<Set<number> | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const drag = useRef<"add" | "remove" | null>(null);
  const lastPointer = useRef<string>("mouse");

  useEffect(() => {
    const stop = () => (drag.current = null);
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  if (loaded.state !== "ready" || !meeting.windowStart || !meeting.windowEnd) {
    return loaded.state === "loading" ? (
      <Skeleton className="h-96 w-full" />
    ) : (
      <p className="text-muted-foreground">
        Couldn&rsquo;t load the times. Refresh to try again.
      </p>
    );
  }

  const availability = loaded.data;
  const { days, cell, inWindow } = layout(
    meeting.windowStart,
    meeting.windowEnd,
  );
  const saved = new Set(availability.mine.map((iso) => Date.parse(iso)));
  const mine = edited ?? saved;
  const dirty = edited !== null || availability.suggested;
  const total = meeting.people.length;
  const who = new Map(meeting.people.map((p) => [p.id, p.name]));
  const free = new Map(
    availability.cells.map((c) => [Date.parse(c.start), c.free]),
  );
  const bookable = new Set(availability.bookable.map((iso) => Date.parse(iso)));
  const booked = new Set(availability.blocked.map((iso) => Date.parse(iso)));
  const runCells = (meeting.minutes ?? 15) / 15;
  const isMentor = meeting.myRole === "mentor";
  const waitingFor = meeting.people.filter((p) => !p.filledIn);

  const apply = (t: number, mode: "add" | "remove") =>
    setEdited((prev) => {
      const next = new Set(prev ?? saved);
      if (mode === "add") next.add(t);
      else next.delete(t);
      return next;
    });

  const save = async () => {
    setBusy(true);
    try {
      const fresh = await apiFetch<Availability>(path, {
        method: "PUT",
        body: {
          slots: [...mine]
            .filter(inWindow)
            .sort((a, b) => a - b)
            .map((t) => new Date(t).toISOString()),
        },
      });
      setAvailability(fresh);
      setEdited(null);
      onChanged(
        await apiFetch<Meeting>(`/meetings/${encodeURIComponent(meeting.id)}`),
      );
      toast.success("Your times are saved");
    } catch {
      toast.error("Couldn't save your times. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const book = async () => {
    if (picked === null) return;
    setBusy(true);
    try {
      onChanged(
        await apiFetch<Meeting>(
          `/meetings/${encodeURIComponent(meeting.id)}/book`,
          {
            method: "POST",
            body: { startsAt: new Date(picked).toISOString() },
          },
        ),
      );
      toast.success("Booked. Invites are on their way.");
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.status !== 500
          ? error.message
          : "Couldn't book it. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const groupColour = (count: number) =>
    count === 0
      ? RED
      : count >= total
        ? GREEN
        : `color-mix(in oklab, ${GREEN} ${25 + Math.round((45 * count) / total)}%, white)`;

  const header = (
    <>
      <div />
      {days.map((day) => (
        <div
          key={day.getTime()}
          className="pb-1 text-center text-[0.6875rem] leading-tight text-muted-foreground"
        >
          {formatShortDay(day)}
        </div>
      ))}
    </>
  );
  const columns = {
    gridTemplateColumns: `2.75rem repeat(${days.length}, minmax(0, 1fr))`,
  };
  const label = (row: number) =>
    row % 4 === 0 ? (
      <div className="-mt-1.5 pr-1.5 text-right text-[0.625rem] leading-none text-subtle">
        {formatTime(new Date(2026, 0, 1, FIRST_HOUR + row / 4)).replace(
          ":00",
          "",
        )}
      </div>
    ) : (
      <div />
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-2">
          <h2 className="label-caps text-subtle">Your times</h2>
          <p className="text-sm text-muted-foreground">
            {availability.suggested
              ? "Pre-filled from your Google Calendar. Adjust, then save."
              : "Drag (or tap) the times you're free."}
          </p>
          <div
            className="grid select-none"
            style={columns}
            role="group"
            aria-label="Your free times"
          >
            {header}
            {Array.from({ length: ROWS }, (_, row) => (
              <Row key={row}>
                {label(row)}
                {days.map((day) => {
                  const t = cell(day, row);
                  const open = inWindow(t) && !booked.has(t);
                  const on = mine.has(t) && open;
                  return (
                    <button
                      key={t}
                      type="button"
                      disabled={!open}
                      aria-pressed={on}
                      aria-label={`${formatWhen(new Date(t).toISOString())}${on ? ", free" : ""}${booked.has(t) ? ", already booked in DapUp" : ""}`}
                      title={
                        booked.has(t)
                          ? "Someone here already has a DapUp meeting then"
                          : undefined
                      }
                      style={booked.has(t) ? { background: BOOKED } : undefined}
                      onPointerDown={(e) => {
                        lastPointer.current = e.pointerType;
                        if (e.pointerType !== "mouse" || !open) return;
                        e.preventDefault();
                        drag.current = on ? "remove" : "add";
                        apply(t, drag.current);
                      }}
                      onPointerEnter={() => {
                        if (drag.current && open) apply(t, drag.current);
                      }}
                      onClick={(e) => {
                        // Mouse is handled on pointer-down (drag); touch and
                        // keyboard toggle one cell.
                        if (e.detail > 0 && lastPointer.current === "mouse")
                          return;
                        apply(t, on ? "remove" : "add");
                      }}
                      className={cn(
                        "h-3.5 border-t border-l border-foreground/[0.07] outline-none focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
                        row % 4 === 0 && "border-t-foreground/20",
                        !open && "cursor-default bg-foreground/[0.04]",
                        open && (on ? "bg-mark" : "bg-card hover:bg-mark/40"),
                      )}
                    />
                  );
                })}
              </Row>
            ))}
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={save} disabled={!dirty || busy}>
              {busy ? "Saving…" : "Save my times"}
            </Button>
            {meeting.myFilledIn && edited === null ? (
              <span className="text-sm text-subtle">Saved</span>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="label-caps text-subtle">Everyone</h2>
          <p className="text-sm text-muted-foreground">
            {waitingFor.length > 0
              ? `Waiting for ${waitingFor.map((p) => p.name).join(", ")}.`
              : isMentor
                ? `Pick a green time with ${meeting.minutes} minutes free to book it.`
                : "A mentor will book a green time."}
          </p>
          <div
            className="grid"
            style={columns}
            role="group"
            aria-label="Who is free when"
          >
            {header}
            {Array.from({ length: ROWS }, (_, row) => (
              <Row key={row}>
                {label(row)}
                {days.map((day) => {
                  const t = cell(day, row);
                  if (!inWindow(t)) {
                    return (
                      <div
                        key={t}
                        className="h-3.5 border-t border-l border-foreground/[0.07] bg-foreground/[0.04]"
                      />
                    );
                  }
                  if (booked.has(t)) {
                    return (
                      <div
                        key={t}
                        title="Already booked in DapUp"
                        className="h-3.5 border-t border-l border-foreground/[0.07]"
                        style={{ background: BOOKED }}
                      />
                    );
                  }
                  const names = (free.get(t) ?? []).map(
                    (id) => who.get(id) ?? "Someone",
                  );
                  const all = names.length >= total;
                  const chosen =
                    picked !== null &&
                    t >= picked &&
                    t < picked + runCells * CELL;
                  return (
                    <button
                      key={t}
                      type="button"
                      title={
                        names.length
                          ? `Free: ${names.join(", ")}`
                          : "Nobody is free"
                      }
                      aria-label={`${formatWhen(new Date(t).toISOString())}: ${names.length} of ${total} free`}
                      onClick={() => {
                        if (!isMentor) return;
                        if (bookable.has(t)) setPicked(t);
                        else if (all)
                          toast.message(
                            `Not everyone is free for ${meeting.minutes} minutes from here.`,
                          );
                      }}
                      style={{ backgroundColor: groupColour(names.length) }}
                      className={cn(
                        "flex h-3.5 items-center justify-center border-t border-l border-foreground/[0.07] text-[0.5625rem] leading-none tabular-nums outline-none focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
                        row % 4 === 0 && "border-t-foreground/20",
                        all ? "text-white" : "text-foreground/70",
                        isMentor && bookable.has(t) && "cursor-pointer",
                        !isMentor && "cursor-default",
                        chosen &&
                          "relative z-10 ring-2 ring-foreground ring-inset",
                      )}
                    >
                      {names.length > 0 ? `${names.length}/${total}` : ""}
                    </button>
                  );
                })}
              </Row>
            ))}
          </div>
          <Legend />
        </section>
      </div>

      {availability.bookable.length > 0 ? (
        <section className="sheet flex flex-col gap-3 p-5 shadow-sheet">
          <h2 className="font-medium">
            Times that work for everyone{" "}
            <span className="text-sm font-normal text-subtle">best first</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {availability.bookable.slice(0, 8).map((iso, index) => {
              const t = Date.parse(iso);
              const text = (
                <>
                  {formatWhen(iso)}
                  {index === 0 ? (
                    <span className="ml-2 label-caps text-subtle">
                      Recommended
                    </span>
                  ) : null}
                </>
              );
              return isMentor ? (
                <button
                  key={iso}
                  type="button"
                  aria-pressed={picked === t}
                  onClick={() => setPicked(t)}
                  className={cn(
                    "rounded-full border border-foreground/15 px-3.5 py-1.5 text-sm transition-[background-color,border-color] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    picked === t
                      ? "border-transparent bg-mark"
                      : "hover:border-foreground/40",
                  )}
                >
                  {text}
                </button>
              ) : (
                <span
                  key={iso}
                  className="rounded-full border border-foreground/15 px-3.5 py-1.5 text-sm"
                >
                  {text}
                </span>
              );
            })}
          </div>
          {isMentor ? (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Button onClick={book} disabled={picked === null || busy}>
                {picked === null
                  ? "Pick a time to book"
                  : busy
                    ? "Booking…"
                    : `Book ${formatShortDay(new Date(picked))}, ${formatTime(new Date(picked))}`}
              </Button>
              <span className="text-sm text-subtle">
                It goes on everyone&rsquo;s Google Calendar.
              </span>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="contents">{children}</div>;
}

function Legend() {
  const swatch = (colour: string, text: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="size-3 rounded-[2px] border border-foreground/10"
        style={{ background: colour }}
      />
      {text}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
      {swatch(RED, "Nobody free")}
      {swatch(`color-mix(in oklab, ${GREEN} 45%, white)`, "Some free")}
      {swatch(GREEN, "Everyone free")}
      {swatch(BOOKED, "Already booked")}
    </div>
  );
}
