import type { ConnectionState } from "@/lib/domain/types";

/** Shapes of the API's /meetings routes (backend/app/scheduling.py). */

export type MeetingPerson = {
  id: string;
  name: string;
  role: "student" | "mentor";
  response: "pending" | "accepted" | "declined" | null;
  calendarConnected: boolean;
};

export type MeetingStatus =
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
  options: string[];
  reason: string;
  agenda: string[];
  requestedBy: string | null;
  myResponse: MeetingPerson["response"];
  myRole: MeetingPerson["role"] | null;
  people: MeetingPerson[];
};

export const STATUS: Record<MeetingStatus, [ConnectionState, string]> = {
  proposed: ["pending", "Waiting for answers"],
  no_slot: ["pending", "Picking a time"],
  needs_mentor: ["pending", "Mentor to decide"],
  confirmed: ["accepted", "Booked"],
  declined: ["disconnected", "Called off"],
  no_meeting: ["disconnected", "No meeting needed"],
};

/** Waiting on me: answer a proposal, or (student) pick an offered time. */
export function needsMe(meeting: Meeting): boolean {
  return (
    (meeting.status === "proposed" && meeting.myResponse === "pending") ||
    (meeting.status === "no_slot" && meeting.myRole === "student")
  );
}

const DAY = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
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

export function formatDay(iso: string): string {
  return DAY.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return TIME.format(new Date(iso));
}
