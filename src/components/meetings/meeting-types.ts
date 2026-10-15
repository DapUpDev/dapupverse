import type { ConnectionState } from "@/lib/domain/types";

/** Shapes of the API's /meetings routes (backend/app/scheduling.py). */

export type MeetingPerson = {
  id: string;
  name: string;
  role: "student" | "mentor";
  filledIn: boolean;
  calendarConnected: boolean;
};

export type MeetingStatus =
  | "collecting"
  | "proposed"
  | "confirmed"
  | "declined"
  | "no_slot"
  | "no_meeting"
  | "needs_mentor";

export type Meeting = {
  id: string;
  kind: "triage" | "manual";
  status: MeetingStatus;
  title: string;
  note: string;
  minutes: number | null;
  startsAt: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  reason: string;
  agenda: string[];
  requestedBy: string | null;
  myRole: MeetingPerson["role"] | null;
  myFilledIn: boolean | null;
  people: MeetingPerson[];
};

export type Availability = {
  /** My free cells (ISO, UTC). Pre-filled from Google when `suggested`. */
  mine: string[];
  suggested: boolean;
  /** Every cell at least one person marked, with who. */
  cells: { start: string; free: string[] }[];
  /** Starts of all-green runs as long as the meeting, best first. */
  bookable: string[];
  /** Cells someone here already has a DapUp meeting in. */
  blocked: string[];
};

export const STATUS: Record<MeetingStatus, [ConnectionState, string]> = {
  collecting: ["pending", "Finding a time"],
  proposed: ["pending", "Waiting for answers"],
  no_slot: ["pending", "Picking a time"],
  needs_mentor: ["pending", "Mentor to decide"],
  confirmed: ["accepted", "Booked"],
  declined: ["disconnected", "Called off"],
  no_meeting: ["disconnected", "No meeting needed"],
};

/** Waiting on me: I haven't marked my times yet. */
export function needsMe(meeting: Meeting): boolean {
  return meeting.status === "collecting" && meeting.myFilledIn === false;
}

const DAY = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const SHORT_DAY = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
});
const TIME = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

/** "Saturday 17 October, 10:00 AM" in the viewer's own time zone. */
export function formatWhen(iso: string): string {
  const date = new Date(iso);
  return `${DAY.format(date)}, ${TIME.format(date)}`;
}

export function formatShortDay(date: Date): string {
  return SHORT_DAY.format(date);
}

export function formatTime(date: Date | string): string {
  return TIME.format(typeof date === "string" ? new Date(date) : date);
}
