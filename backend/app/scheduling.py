"""Meetings: find a time that works for everyone, propose it, confirm it.

Two ways a meeting starts:

triage (the worker, after the triage agent decides; after_triage()):
    The student's Premier Fellowship team (up to 3 mentors) gets a summary
    email: what the student finished, missed and changed since last week,
    blockers, next deadline, the decision, reason and agenda. For a meeting,
    the earliest slot in the next 7 days inside the shared meeting hours
    (set on /admin) where every connected calendar is free is proposed;
    the first mentor to press Confirm books it. If nothing fits this week,
    the student is offered the next options (weeks 2-3) to pick from, and
    the mentors are told. NO_MEETING and needs_mentor get the summary only.

manual (/app/meetings/new, any student or mentor):
    Pick people you work with and a length; DapUp lists times everyone is
    free (any day, 08:00-21:00 in your time zone); pick one; everyone else
    gets an email and must accept. Booked when all have accepted.

Booked = a Google Calendar event on the organiser's calendar with everyone
invited (Google sends the invites), plus a DapUp email to everyone. If
nobody involved has connected Google, the booking is still confirmed and
the email carries the time.
"""

from __future__ import annotations

import logging
import math
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.auth import Principal, current_user
from app.db import get_session
from app.google_calendar import Calendar, CalendarError, get_calendar
from app.mentors import _Camel, upsert_user
from app.models import (
    AccountType, Booking, BookingPerson, CheckIn, ConnectionRequest, ConsultingMentor, GoogleConnection,
    MentorProfile, ProgramSettings, StudentProfile, Task, TriageDecision, User,
)
from app.notifications import Email, Mailer, _render, app_url, deliver, get_mailer

log = logging.getLogger("dapup.scheduling")

STEP_SECONDS = 15 * 60
LENGTHS = (15, 30, 45, 60)
MAX_PEOPLE = 5


# ---- finding a time --------------------------------------------------------

@dataclass(frozen=True)
class Hours:
    days: frozenset[int]  # Monday = 0
    start: time
    end: time
    tz: ZoneInfo


DEFAULT_HOURS = Hours(frozenset({5, 6}), time(9), time(17), ZoneInfo("America/Los_Angeles"))


def load_hours(session: Session) -> Hours:
    row = session.get(ProgramSettings, 1)
    if row is None:
        return DEFAULT_HOURS
    return Hours(frozenset(row.meeting_days), row.meeting_start, row.meeting_end, ZoneInfo(row.timezone))


def _ceil(t: datetime) -> datetime:
    """Round up to the next quarter hour."""
    return datetime.fromtimestamp(math.ceil(t.timestamp() / STEP_SECONDS) * STEP_SECONDS, t.tzinfo)


def free_slots(busy: list[tuple[datetime, datetime]], start: datetime, end: datetime, minutes: int,
               hours: Hours, limit: int = 10) -> list[datetime]:
    """Earliest-first starts (UTC) of back-to-back free slots of `minutes`,
    inside `hours`, between start and end, clear of every busy block."""
    length = timedelta(minutes=minutes)
    slots: list[datetime] = []
    day, last = start.astimezone(hours.tz).date(), end.astimezone(hours.tz).date()
    while day <= last and len(slots) < limit:
        if day.weekday() in hours.days:
            t = _ceil(max(datetime.combine(day, hours.start, hours.tz), start))
            close = min(datetime.combine(day, hours.end, hours.tz), end)
            while t + length <= close and len(slots) < limit:
                clash = max((e for s, e in busy if s < t + length and e > t), default=None)
                if clash:
                    t = _ceil(clash)
                else:
                    slots.append(t.astimezone(UTC))
                    t += length
        day += timedelta(days=1)
    return slots


def when(t: datetime, tz: ZoneInfo) -> str:
    """e.g. "Saturday 18 October, 10:00 AM PDT" (by hand: Windows strftime has no %-d)."""
    t = t.astimezone(tz)
    return f"{t:%A} {t.day} {t:%B}, {t.hour % 12 or 12}:{t:%M} {'AM' if t.hour < 12 else 'PM'} {t:%Z}"


# ---- who's who --------------------------------------------------------------

def names(session: Session, ids: list[str]) -> dict[str, str]:
    rows = session.execute(
        select(User.id, User.email, MentorProfile.name, StudentProfile.full_name)
        .outerjoin(MentorProfile, MentorProfile.user_id == User.id)
        .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
        .where(User.id.in_(ids))
    )
    return {r.id: r.name or r.full_name or (r.email or "").split("@")[0] or "Someone" for r in rows}


def invite_emails(session: Session, ids: list[str]) -> dict[str, str | None]:
    """Where to send invites: the linked Google address if there is one."""
    rows = session.execute(
        select(User.id, User.email, GoogleConnection.google_email)
        .outerjoin(GoogleConnection, GoogleConnection.user_id == User.id).where(User.id.in_(ids))
    )
    return {r.id: r.google_email or r.email for r in rows}


def connected(session: Session, ids: list[str]) -> set[str]:
    return set(session.scalars(select(GoogleConnection.user_id).where(GoogleConnection.user_id.in_(ids))))


def people_i_can_invite(session: Session, user: Principal) -> list[str]:
    """Students: mentors they're connected with + their Fellowship team.
    Mentors: students they're connected with or on the team of, plus the
    other mentors on those teams."""
    me = user.user_id
    accepted = ConnectionRequest.state == "accepted"
    if user.account_type == "mentor":
        students = set(session.scalars(select(ConnectionRequest.student_id).where(ConnectionRequest.mentor_id == me, accepted)))
        team_students = set(session.scalars(select(ConsultingMentor.student_id).where(ConsultingMentor.mentor_id == me)))
        co_mentors = set(session.scalars(select(ConsultingMentor.mentor_id).where(
            ConsultingMentor.student_id.in_(team_students), ConsultingMentor.mentor_id != me)))
        ids = students | team_students | co_mentors
    else:
        ids = set(session.scalars(select(ConnectionRequest.mentor_id).where(ConnectionRequest.student_id == me, accepted)))
        ids |= set(session.scalars(select(ConsultingMentor.mentor_id).where(ConsultingMentor.student_id == me)))
    return sorted(ids)


# ---- emails -----------------------------------------------------------------

def _email(to: str | None, greeting_name: str, subject: str, lines: list[str], button: str, booking_id) -> Email | None:
    if not to:
        return None
    text, body = _render(f"Hi {greeting_name},", lines, button, app_url(f"/app/meetings/{booking_id}"))
    return Email(to=to, subject=subject, text=text, html=body)


def triage_summary(session: Session, check_in: CheckIn, decision: TriageDecision, today: date) -> list[str]:
    tasks = session.scalars(select(Task).where(Task.student_id == check_in.student_id, Task.done.is_(False))).all()
    missed = [t.title for t in tasks if t.due_on and t.due_on < today]
    upcoming = sorted((t for t in tasks if t.due_on and t.due_on >= today), key=lambda t: t.due_on)
    previous = session.scalars(
        select(CheckIn).where(CheckIn.student_id == check_in.student_id, CheckIn.answered_at.is_not(None),
                              CheckIn.week_start < check_in.week_start).order_by(CheckIn.week_start.desc()).limit(1)
    ).first()
    if previous is None:
        changed = "This is their first check-in."
    else:
        bits = []
        if previous.confidence != check_in.confidence:
            bits.append(f"Confidence went from {previous.confidence}/5 to {check_in.confidence}/5.")
        if (previous.blockers or "") != (check_in.blockers or ""):
            bits.append(f"Last week's blocker was: {previous.blockers or 'nothing'}.")
        changed = " ".join(bits) or "Same confidence and blockers as last week."
    lines = [
        f"Finished: {check_in.progress}",
        f"Missed: {', '.join(missed) if missed else 'Nothing overdue.'}",
        f"Changed since last check-in: {changed}",
        f"Blockers: {decision.blockers or check_in.blockers or 'None'}",
        f"Next deadline: {upcoming[0].title} on {upcoming[0].due_on:%d %b}" if upcoming else "Next deadline: none recorded.",
    ]
    if decision.status != "decided":
        return lines + ["Meeting: the assistant couldn't decide, so it's your call."]
    length = "No meeting needed" if decision.decision == "NO_MEETING" else f"{decision.decision} minutes"
    return lines + [f"Meeting: {length}", f"Why: {decision.reason}",
                    *(f"Agenda: {item}" for item in decision.agenda)]


# ---- after the triage agent decides (worker) --------------------------------

def after_triage(sessions: sessionmaker[Session], check_in_id, calendar: Calendar | None, mailer: Mailer | None,
                 now: datetime) -> Booking | None:
    """Summary to the team, and a proposed slot when there's a meeting. Runs
    once per check-in (bookings.check_in_id is unique)."""
    emails: list[Email | None] = []
    with sessions.begin() as s:
        if s.scalar(select(Booking.id).where(Booking.check_in_id == check_in_id)):
            return None
        decision = s.scalars(select(TriageDecision).where(TriageDecision.check_in_id == check_in_id)).first()
        check_in = s.get(CheckIn, check_in_id)
        if decision is None or check_in is None:
            return None
        team = list(s.scalars(select(ConsultingMentor.mentor_id).where(ConsultingMentor.student_id == check_in.student_id)))
        if not team:
            log.warning("booking %s: student %s has no mentors on their team; nothing sent", check_in_id, check_in.student_id)
            return None
        hours, student = load_hours(s), check_in.student_id
        who, inbox = names(s, team + [student]), invite_emails(s, team + [student])
        summary = triage_summary(s, check_in, decision, now.astimezone(hours.tz).date())
        booking = Booking(kind="triage", check_in_id=check_in_id, student_id=student, title=f"{who[student]} and mentors",
                          reason=decision.reason, agenda=decision.agenda)
        unread: list[str] = []
        if decision.status != "decided":
            booking.status, headline = "needs_mentor", "needs your decision"
        elif decision.decision == "NO_MEETING":
            booking.status, headline = "no_meeting", "no meeting needed this week"
        else:
            booking.minutes = minutes = int(decision.decision)
            busy, unread = calendar.busy(s, team + [student], now, now + timedelta(days=21)) if calendar else ([], team + [student])
            first = free_slots(busy, now + timedelta(hours=2), now + timedelta(days=7), minutes, hours, limit=1)
            if first:
                booking.status, booking.starts_at = "proposed", first[0]
                headline = f"{minutes}-minute meeting proposed for {when(first[0], hours.tz)}"
            else:
                booking.status = "no_slot"
                booking.options = free_slots(busy, now + timedelta(days=7), now + timedelta(days=21), minutes, hours, limit=3)
                headline = f"no {minutes}-minute slot fits this week"
        s.add(booking)
        s.flush()
        s.add_all(BookingPerson(booking_id=booking.id, user_id=m, role="mentor") for m in team)
        s.add(BookingPerson(booking_id=booking.id, user_id=student, role="student", response="accepted"))

        extra = []
        if booking.status == "proposed":
            extra = [f"Proposed time: {when(booking.starts_at, hours.tz)}, {booking.minutes} minutes.",
                     "Press Confirm to book it on everyone's calendar."]
        elif booking.status == "no_slot":
            extra = ([f"Nothing fits this week. {who[student]} has been asked to pick one of: "
                      + "; ".join(when(t, hours.tz) for t in booking.options) + "."]
                     if booking.options else ["Nothing fits in the next three weeks. Please arrange a time directly."])
            emails.append(_email(inbox[student], who[student], "Pick a time for your DapUp meeting",
                                 [f"Your mentors want a {booking.minutes}-minute meeting, but nothing fits this week.",
                                  "Pick one of the next available times and they'll confirm it."],
                                 "Pick a time", booking.id) if booking.options else None)
        if unread:
            extra.append("Not checked (calendar not connected): " + ", ".join(who.get(u, u) for u in unread) + ".")
        button = "Review and confirm" if booking.status == "proposed" else "Open in DapUp"
        emails += [_email(inbox[m], who[m], f"{who[student]}: {headline}", summary + extra, button, booking.id)
                   for m in team]
        log.info("booking %s for check-in %s: %s", booking.id, check_in_id, booking.status)
    for email in emails:
        if email and mailer:
            deliver(mailer, email)
    return booking


# ---- confirming --------------------------------------------------------------

def book(session: Session, booking: Booking, organizer_hint: str, calendar: Calendar | None) -> list[Email | None]:
    """Make it real: the Google event (if anyone can host it) and the
    'booked' emails. Raises CalendarError and leaves the booking proposed
    if Google refuses."""
    people = session.scalars(select(BookingPerson).where(BookingPerson.booking_id == booking.id)).all()
    ids = [p.user_id for p in people]
    who, inbox, hours = names(session, ids), invite_emails(session, ids), load_hours(session)
    end = booking.starts_at + timedelta(minutes=booking.minutes)
    hosts = connected(session, ids)
    organizer = next((u for u in [organizer_hint, booking.requested_by, *ids] if u in hosts), None)
    if calendar and organizer:
        description = "\n".join([booking.reason, *(f"- {a}" for a in booking.agenda), booking.note,
                                 app_url(f"/app/meetings/{booking.id}")]).strip()
        booking.google_event_id = calendar.create_event(session, organizer, booking.starts_at, end,
                                                        f"DapUp: {booking.title}", description,
                                                        [inbox[u] for u in ids if inbox.get(u)])
    booking.status = "confirmed"
    line = (f"{booking.title}: {when(booking.starts_at, hours.tz)}, {booking.minutes} minutes, with "
            + ", ".join(who[u] for u in ids) + ".")
    invite = ("A Google Calendar invite is on its way." if booking.google_event_id
              else "Add it to your calendar: nobody in this meeting has connected Google Calendar to DapUp.")
    return [_email(inbox[u], who[u], f"Booked: {booking.title}", [line, invite], "See the meeting", booking.id)
            for u in ids]


# ---- routes ----------------------------------------------------------------
router = APIRouter()
Db = Annotated[Session, Depends(get_session)]
Me = Annotated[Principal, Depends(current_user)]
Cal = Annotated[Calendar | None, Depends(get_calendar)]
Mail = Annotated[Mailer | None, Depends(get_mailer)]


class PersonOut(_Camel):
    id: str
    name: str
    role: str
    response: str | None = None
    calendar_connected: bool


class MeetingOut(_Camel):
    id: str
    kind: str
    status: str
    title: str
    note: str
    minutes: int | None
    starts_at: datetime | None
    options: list[datetime]
    reason: str
    agenda: list[str]
    requested_by: str | None
    my_response: str | None
    my_role: str | None
    people: list[PersonOut]


class SlotsIn(_Camel):
    people_ids: list[str] = Field(min_length=1, max_length=MAX_PEOPLE)
    minutes: int
    timezone: str = "America/Los_Angeles"


class SlotsOut(_Camel):
    slots: list[datetime]
    not_connected: list[str]  # names whose calendar couldn't be checked


class MeetingIn(SlotsIn):
    starts_at: datetime
    title: str = Field(default="", max_length=120)
    note: str = Field(default="", max_length=1000)


class RespondIn(_Camel):
    accept: bool


class PickIn(_Camel):
    starts_at: datetime


def _manual_hours(timezone: str) -> Hours:
    try:
        tz = ZoneInfo(timezone)
    except (ZoneInfoNotFoundError, ValueError):
        tz = ZoneInfo("America/Los_Angeles")
    return Hours(frozenset(range(7)), time(8), time(21), tz)


def _out(session: Session, booking: Booking, user: Principal) -> MeetingOut:
    people = session.scalars(select(BookingPerson).where(BookingPerson.booking_id == booking.id)).all()
    ids = [p.user_id for p in people]
    who, linked = names(session, ids), connected(session, ids)
    mine = next((p for p in people if p.user_id == user.user_id), None)
    return MeetingOut(
        id=str(booking.id), kind=booking.kind, status=booking.status, title=booking.title, note=booking.note,
        minutes=booking.minutes, starts_at=booking.starts_at, options=booking.options, reason=booking.reason,
        agenda=booking.agenda, requested_by=booking.requested_by,
        my_response=mine.response if mine else None, my_role=mine.role if mine else None,
        people=[PersonOut(id=p.user_id, name=who.get(p.user_id, "Someone"), role=p.role, response=p.response,
                          calendar_connected=p.user_id in linked) for p in people],
    )


def _load(session: Session, booking_id: str, user: Principal) -> Booking:
    try:
        booking = session.get(Booking, uuid.UUID(booking_id))
    except ValueError:
        booking = None
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found.")
    member = session.get(BookingPerson, (booking.id, user.user_id))
    if member is None and not user.is_admin:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found.")
    return booking


def _conflict(code: str, message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, {"code": code, "message": message})


def _send_all(background: BackgroundTasks, mailer: Mailer | None, emails: list[Email | None]) -> None:
    for email in emails:
        if email and mailer:
            background.add_task(deliver, mailer, email)


@router.get("/meetings", response_model=list[MeetingOut], response_model_by_alias=True)
def my_meetings(user: Me, session: Db) -> list[MeetingOut]:
    ids = session.scalars(select(BookingPerson.booking_id).where(BookingPerson.user_id == user.user_id))
    bookings = session.scalars(
        select(Booking).where(Booking.id.in_(list(ids))).order_by(Booking.starts_at.desc().nulls_first(),
                                                                  Booking.created_at.desc()).limit(50)
    ).all()
    return [_out(session, b, user) for b in bookings]


@router.get("/meetings/people", response_model=list[PersonOut], response_model_by_alias=True)
def invitable(user: Me, session: Db) -> list[PersonOut]:
    ids = people_i_can_invite(session, user)
    who, linked = names(session, ids), connected(session, ids)
    roles = dict(session.execute(select(User.id, User.account_type).where(User.id.in_(ids))).all())
    return sorted((PersonOut(id=i, name=who.get(i, "Someone"), role=str(roles.get(i, "student")),
                             calendar_connected=i in linked) for i in ids), key=lambda p: (p.role, p.name))


def _check_people(session: Session, user: Principal, people_ids: list[str], minutes: int) -> list[str]:
    if minutes not in LENGTHS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Length must be 15, 30, 45 or 60 minutes.")
    allowed = set(people_i_can_invite(session, user))
    chosen = list(dict.fromkeys(p for p in people_ids if p != user.user_id))
    if not chosen or not set(chosen) <= allowed:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "You can only invite people you work with.")
    return chosen


@router.post("/meetings/slots", response_model=SlotsOut, response_model_by_alias=True)
def find_slots(body: SlotsIn, user: Me, session: Db, calendar: Cal) -> SlotsOut:
    chosen = _check_people(session, user, body.people_ids, body.minutes)
    everyone = [user.user_id, *chosen]
    now = datetime.now(UTC)
    busy, unread = calendar.busy(session, everyone, now, now + timedelta(days=14)) if calendar else ([], everyone)
    slots = free_slots(busy, now + timedelta(hours=1), now + timedelta(days=14), body.minutes,
                       _manual_hours(body.timezone), limit=12)
    who = names(session, unread)
    return SlotsOut(slots=slots, not_connected=[who.get(u, "Someone") for u in unread])


@router.post("/meetings", response_model=MeetingOut, response_model_by_alias=True, status_code=201)
def request_meeting(body: MeetingIn, user: Me, session: Db, calendar: Cal, mailer: Mail,
                    background: BackgroundTasks) -> MeetingOut:
    upsert_user(session, user)
    chosen = _check_people(session, user, body.people_ids, body.minutes)
    start = body.starts_at.astimezone(UTC)
    if start < datetime.now(UTC):
        raise _conflict("in_the_past", "That time has already passed.")
    everyone = [user.user_id, *chosen]
    if calendar:
        busy, _ = calendar.busy(session, everyone, start, start + timedelta(minutes=body.minutes))
        if busy:
            raise _conflict("taken", "Someone just became busy at that time. Pick another.")
    who = names(session, everyone)
    roles = dict(session.execute(select(User.id, User.account_type).where(User.id.in_(everyone))).all())
    student = next((u for u in everyone if roles.get(u) == AccountType.student), None)
    booking = Booking(kind="manual", requested_by=user.user_id, student_id=student, status="proposed",
                      minutes=body.minutes, starts_at=start, title=body.title or f"Meeting with {who[user.user_id]}",
                      note=body.note)
    session.add(booking)
    session.flush()
    session.add_all(BookingPerson(booking_id=booking.id, user_id=u, role=str(roles.get(u, "student")),
                                  response="accepted" if u == user.user_id else "pending") for u in everyone)
    session.flush()
    hours, inbox = _manual_hours(body.timezone), invite_emails(session, chosen)
    _send_all(background, mailer, [
        _email(inbox[u], who[u], f"{who[user.user_id]} asked for a meeting",
               [f"{who[user.user_id]} would like to meet: {when(start, hours.tz)}, {body.minutes} minutes.",
                *([f"Note: {body.note}"] if body.note else []), "Accept or decline in DapUp."],
               "Accept or decline", booking.id)
        for u in chosen])
    return _out(session, booking, user)


@router.get("/meetings/{booking_id}", response_model=MeetingOut, response_model_by_alias=True)
def get_meeting(booking_id: str, user: Me, session: Db) -> MeetingOut:
    return _out(session, _load(session, booking_id, user), user)


@router.post("/meetings/{booking_id}/respond", response_model=MeetingOut, response_model_by_alias=True)
def respond(booking_id: str, body: RespondIn, user: Me, session: Db, calendar: Cal, mailer: Mail,
            background: BackgroundTasks) -> MeetingOut:
    booking = _load(session, booking_id, user)
    me = session.get(BookingPerson, (booking.id, user.user_id))
    if me is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found.")
    if booking.status != "proposed":
        raise _conflict("not_open", "This meeting is no longer waiting for answers.")
    me.response = "accepted" if body.accept else "declined"
    session.flush()
    people = session.scalars(select(BookingPerson).where(BookingPerson.booking_id == booking.id)).all()
    ids = [p.user_id for p in people]
    if not body.accept:
        booking.status = "declined"
        who, inbox = names(session, ids), invite_emails(session, ids)
        _send_all(background, mailer, [
            _email(inbox[u], who[u], f"Declined: {booking.title}",
                   [f"{who[user.user_id]} can't make it, so this meeting is off. Request a new time in DapUp."],
                   "Find another time", booking.id)
            for u in ids if u != user.user_id])
    elif (booking.kind == "triage" and me.role == "mentor") or all(p.response == "accepted" for p in people):
        try:
            emails = book(session, booking, user.user_id, calendar)
        except CalendarError as exc:
            log.warning("booking %s: calendar event failed: %s", booking.id, exc)
            raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                                "Google Calendar didn't accept the event. Try again in a minute.") from None
        _send_all(background, mailer, emails)
    session.flush()
    return _out(session, booking, user)


@router.post("/meetings/{booking_id}/pick", response_model=MeetingOut, response_model_by_alias=True)
def pick_option(booking_id: str, body: PickIn, user: Me, session: Db, mailer: Mail,
                background: BackgroundTasks) -> MeetingOut:
    """The student chooses one of the offered times when nothing fit."""
    booking = _load(session, booking_id, user)
    if booking.status != "no_slot" or booking.student_id != user.user_id:
        raise _conflict("not_open", "There's no time to pick for this meeting.")
    choice = body.starts_at.astimezone(UTC)
    if choice not in [o.astimezone(UTC) for o in booking.options]:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Pick one of the offered times.")
    booking.status, booking.starts_at = "proposed", choice
    mentors = session.scalars(select(BookingPerson).where(BookingPerson.booking_id == booking.id,
                                                          BookingPerson.role == "mentor")).all()
    ids = [m.user_id for m in mentors]
    who, inbox, hours = names(session, ids + [user.user_id]), invite_emails(session, ids), load_hours(session)
    _send_all(background, mailer, [
        _email(inbox[u], who[u], f"{who[user.user_id]} picked a time",
               [f"{who[user.user_id]} picked {when(choice, hours.tz)} for a {booking.minutes}-minute meeting.",
                "Press Confirm to book it on everyone's calendar."], "Review and confirm", booking.id)
        for u in ids])
    session.flush()
    return _out(session, booking, user)

