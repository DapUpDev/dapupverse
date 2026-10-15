"""Meetings, scheduled the when2meet way.

Every meeting that needs a time starts 'collecting': a 7-day window of
15-minute cells. Each person marks the cells they're free (the page shows
07:00-22:00 in their own time zone, pre-filled from Google Calendar when
it's connected: busy times off, the rest on). The group view colours each
cell by how many are free; a run of all-green cells as long as the meeting
is bookable, and any mentor in the meeting books one. Booking puts it on
Google Calendar with everyone invited (Google sends the invites) and emails
everyone.

Two ways a meeting starts:
  triage  (worker, after_triage()): the student's Premier Fellowship team
          gets the summary email (finished, missed, changed, blockers, next
          deadline, decision, reason, agenda) and, for a meeting, everyone
          gets a "mark when you're free" link. NO_MEETING and needs_mentor
          send the summary only.
  manual  (/app/meetings/new): anyone picks people they work with and a
          length; everyone gets the link.

The hourly check-in tick also runs remind_unfilled(): one reminder a day
after the meeting started, to anyone who hasn't marked their times.
"""

from __future__ import annotations

import logging
import math
import uuid
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

CELL = timedelta(minutes=15)
WINDOW = timedelta(days=7)
DAY_START, DAY_END = time(7), time(22)  # the grid's hours, in each viewer's own time zone
LENGTHS = (15, 30, 45, 60)
MAX_PEOPLE = 5
REMIND_AFTER = timedelta(days=1)
PACIFIC = ZoneInfo("America/Los_Angeles")


# ---- the grid ------------------------------------------------------------------

def _ceil(t: datetime) -> datetime:
    """Round up to the next quarter hour (UTC)."""
    step = CELL.total_seconds()
    return datetime.fromtimestamp(math.ceil(t.timestamp() / step) * step, UTC)


def new_window(now: datetime) -> tuple[datetime, datetime]:
    start = _ceil(now + timedelta(hours=1))
    return start, start + WINDOW


def grid_cells(window_start: datetime, window_end: datetime, tz: ZoneInfo) -> list[datetime]:
    """Cell starts (UTC) inside the window that fall 07:00-22:00 in `tz`."""
    cells, t = [], window_start
    while t < window_end:
        if DAY_START <= t.astimezone(tz).time() < DAY_END:
            cells.append(t)
        t += CELL
    return cells


def free_cells(busy: list[tuple[datetime, datetime]], cells: list[datetime]) -> list[datetime]:
    """The cells no busy block touches: the pre-filled guess."""
    return [c for c in cells if not any(s < c + CELL and e > c for s, e in busy)]


def bookable(slot_sets: list[set[datetime] | None], window_end: datetime, minutes: int,
             blocked: set[datetime] = frozenset()) -> list[datetime]:
    """Starts where everyone is free for the whole meeting (all-green runs).
    Nothing is bookable until everyone has filled in. `blocked` cells (an
    existing DapUp meeting for someone here) never count as free."""
    if not slot_sets or any(s is None for s in slot_sets):
        return []
    common = set.intersection(*slot_sets) - blocked
    need = minutes // 15
    return sorted(c for c in common
                  if all(c + i * CELL in common for i in range(need)) and c + timedelta(minutes=minutes) <= window_end)


def cells_touching(busy: list[tuple[datetime, datetime]], window_start: datetime,
                   window_end: datetime) -> set[datetime]:
    """Every cell in the window that a busy block overlaps."""
    out, t = set(), window_start
    while t < window_end:
        if any(s < t + CELL and e > t for s, e in busy):
            out.add(t)
        t += CELL
    return out


def rank(starts: list[datetime], zones: list[ZoneInfo], now: datetime,
         last: datetime | None = None) -> list[datetime]:
    """Best first, by soft preferences (lower score wins):
      +1 per day from now                  sooner is better
      +2 per person outside 09:00-20:00    sensible hours where each person is
      -3 near the last meeting's slot      same weekday, within an hour (UTC)
    Ties keep the earliest."""
    def score(t: datetime) -> float:
        value = (t - now).total_seconds() / 86400
        value += sum(2 for z in zones if not 9 <= t.astimezone(z).hour < 20)
        if last is not None and t.weekday() == last.weekday():
            apart = abs((t.hour * 60 + t.minute) - (last.hour * 60 + last.minute))
            value -= 3 if apart <= 60 else 0
        return value
    return sorted(starts, key=lambda t: (score(t), t))


def dapup_busy(session: Session, user_ids: list[str], start: datetime, end: datetime,
               exclude: uuid.UUID | None = None) -> list[tuple[datetime, datetime]]:
    """Meetings already booked in DapUp for any of these people, so the same
    time can't be booked twice (Google Calendar connected or not)."""
    rows = session.execute(
        select(Booking.starts_at, Booking.minutes).join(BookingPerson, BookingPerson.booking_id == Booking.id)
        .where(BookingPerson.user_id.in_(user_ids), Booking.status == "confirmed", Booking.id != exclude,
               Booking.starts_at < end, Booking.starts_at > start - timedelta(hours=2))
    ).all()
    return [(s, s + timedelta(minutes=m)) for s, m in rows if s + timedelta(minutes=m) > start]


def last_slot(session: Session, booking: Booking) -> datetime | None:
    """When this student's previous DapUp meeting was, to favour the same slot."""
    if not booking.student_id:
        return None
    return session.scalar(
        select(Booking.starts_at).where(Booking.student_id == booking.student_id, Booking.status == "confirmed",
                                        Booking.id != booking.id).order_by(Booking.starts_at.desc()).limit(1)
    )


def _utc(values) -> set[datetime]:
    return {v.astimezone(UTC) for v in values}


def _zone(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or "America/Los_Angeles")
    except (ZoneInfoNotFoundError, ValueError):
        return PACIFIC


def when(t: datetime, tz: ZoneInfo) -> str:
    """e.g. "Saturday 17 October, 10:00 AM PDT" (by hand: Windows strftime has no %-d)."""
    t = t.astimezone(tz)
    return f"{t:%A} {t.day} {t:%B}, {t.hour % 12 or 12}:{t:%M} {'AM' if t.hour < 12 else 'PM'} {t:%Z}"


def program_zone(session: Session) -> ZoneInfo:
    row = session.get(ProgramSettings, 1)
    return _zone(row.timezone if row else None)


# ---- who's who ------------------------------------------------------------------

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


def _people(session: Session, booking: Booking) -> list[BookingPerson]:
    return list(session.scalars(select(BookingPerson).where(BookingPerson.booking_id == booking.id)))


# ---- emails -----------------------------------------------------------------------

def _email(to: str | None, greeting_name: str, subject: str, lines: list[str], button: str, booking_id) -> Email | None:
    if not to:
        return None
    text, body = _render(f"Hi {greeting_name},", lines, button, app_url(f"/app/meetings/{booking_id}"))
    return Email(to=to, subject=subject, text=text, html=body)


MARK = "Mark when you're free on the grid; DapUp fills in what it can from your Google Calendar."


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


# ---- after the triage agent decides (worker) ------------------------------------

def after_triage(sessions: sessionmaker[Session], check_in_id, calendar: Calendar | None, mailer: Mailer | None,
                 now: datetime) -> Booking | None:
    """Summary to the team and, for a meeting, a grid for everyone. Runs
    once per check-in (bookings.check_in_id is unique). `calendar` is
    unused here (pre-filling happens when each person opens the grid) and
    kept so the worker's call stays the same."""
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
        student = check_in.student_id
        who, inbox = names(s, team + [student]), invite_emails(s, team + [student])
        summary = triage_summary(s, check_in, decision, now.astimezone(program_zone(s)).date())
        booking = Booking(kind="triage", check_in_id=check_in_id, student_id=student, title=f"{who[student]} and mentors",
                          reason=decision.reason, agenda=decision.agenda)
        if decision.status != "decided":
            booking.status, headline = "needs_mentor", "needs your decision"
        elif decision.decision == "NO_MEETING":
            booking.status, headline = "no_meeting", "no meeting needed this week"
        else:
            booking.status, booking.minutes = "collecting", int(decision.decision)
            booking.window_start, booking.window_end = new_window(now)
            headline = f"{booking.minutes}-minute meeting: mark when you're free"
        s.add(booking)
        s.flush()
        s.add_all(BookingPerson(booking_id=booking.id, user_id=m, role="mentor") for m in team)
        s.add(BookingPerson(booking_id=booking.id, user_id=student, role="student"))

        collecting = booking.status == "collecting"
        emails += [_email(inbox[m], who[m], f"{who[student]}: {headline}",
                          summary + ([MARK, "Once everyone has, any mentor can book a time that works for all."]
                                     if collecting else []),
                          "Mark your times" if collecting else "Open in DapUp", booking.id)
                   for m in team]
        if collecting:
            emails.append(_email(inbox[student], who[student], "When are you free to meet your mentors?",
                                 [f"Your mentors want a {booking.minutes}-minute meeting this week.", MARK],
                                 "Mark your times", booking.id))
        log.info("booking %s for check-in %s: %s", booking.id, check_in_id, booking.status)
    for email in emails:
        if email and mailer:
            deliver(mailer, email)
    return booking


def remind_unfilled(sessions: sessionmaker[Session], mailer: Mailer | None, now: datetime) -> int:
    """One reminder, a day in, to anyone who hasn't marked their times."""
    emails: list[Email | None] = []
    with sessions.begin() as s:
        rows = s.execute(
            select(BookingPerson, Booking).join(Booking, Booking.id == BookingPerson.booking_id).where(
                Booking.status == "collecting", Booking.window_end > now, Booking.created_at <= now - REMIND_AFTER,
                BookingPerson.slots.is_(None), BookingPerson.reminded_at.is_(None))
        ).all()
        ids = [p.user_id for p, _ in rows]
        who, inbox = names(s, ids), invite_emails(s, ids)
        for person, booking in rows:
            person.reminded_at = now
            emails.append(_email(inbox.get(person.user_id), who.get(person.user_id, "there"),
                                 f"Reminder: mark your times for {booking.title}",
                                 ["Everyone else is waiting on your times before the meeting can be booked.", MARK],
                                 "Mark your times", booking.id))
    for email in emails:
        if email and mailer:
            deliver(mailer, email)
    if rows:
        log.info("availability reminders: %d sent", len(rows))
    return len(rows)


# ---- booking ------------------------------------------------------------------------

def book(session: Session, booking: Booking, start: datetime, organizer_hint: str,
         calendar: Calendar | None) -> list[Email | None]:
    """Make it real: the Google event (if anyone can host it) and the
    'booked' emails. Raises CalendarError, leaving the booking collecting,
    if Google refuses."""
    ids = [p.user_id for p in _people(session, booking)]
    who, inbox, tz = names(session, ids), invite_emails(session, ids), program_zone(session)
    end = start + timedelta(minutes=booking.minutes)
    hosts = connected(session, ids)
    organizer = next((u for u in [organizer_hint, booking.requested_by, *ids] if u in hosts), None)
    if calendar and organizer:
        description = "\n".join([booking.reason, *(f"- {a}" for a in booking.agenda), booking.note,
                                 app_url(f"/app/meetings/{booking.id}")]).strip()
        booking.google_event_id = calendar.create_event(session, organizer, start, end, f"DapUp: {booking.title}",
                                                        description, [inbox[u] for u in ids if inbox.get(u)])
    booking.status, booking.starts_at = "confirmed", start
    line = (f"{booking.title}: {when(start, tz)}, {booking.minutes} minutes, with "
            + ", ".join(who[u] for u in ids) + ".")
    invite = ("A Google Calendar invite is on its way." if booking.google_event_id
              else "Add it to your calendar: nobody in this meeting has connected Google Calendar to DapUp.")
    return [_email(inbox[u], who[u], f"Booked: {booking.title}", [line, invite], "See the meeting", booking.id)
            for u in ids]


# ---- routes ---------------------------------------------------------------------------
router = APIRouter()
Db = Annotated[Session, Depends(get_session)]
Me = Annotated[Principal, Depends(current_user)]
Cal = Annotated[Calendar | None, Depends(get_calendar)]
Mail = Annotated[Mailer | None, Depends(get_mailer)]


class PersonOut(_Camel):
    id: str
    name: str
    role: str
    filled_in: bool = False
    calendar_connected: bool


class MeetingOut(_Camel):
    id: str
    kind: str
    status: str
    title: str
    note: str
    minutes: int | None
    starts_at: datetime | None
    window_start: datetime | None
    window_end: datetime | None
    reason: str
    agenda: list[str]
    requested_by: str | None
    my_role: str | None
    my_filled_in: bool | None
    people: list[PersonOut]


class CellOut(_Camel):
    start: datetime
    free: list[str]  # ids of who's free in this cell


class AvailabilityOut(_Camel):
    mine: list[datetime]
    suggested: bool  # True = pre-filled from Google Calendar, not saved yet
    cells: list[CellOut]
    bookable: list[datetime]  # best first (rank())
    blocked: list[datetime]  # cells someone here already has a DapUp meeting in


class AvailabilityIn(_Camel):
    slots: list[datetime] = Field(max_length=7 * 24 * 4)


class MeetingIn(_Camel):
    people_ids: list[str] = Field(min_length=1, max_length=MAX_PEOPLE)
    minutes: int
    title: str = Field(default="", max_length=120)
    note: str = Field(default="", max_length=1000)


class BookIn(_Camel):
    starts_at: datetime


def _out(session: Session, booking: Booking, user: Principal) -> MeetingOut:
    people = _people(session, booking)
    ids = [p.user_id for p in people]
    who, linked = names(session, ids), connected(session, ids)
    mine = next((p for p in people if p.user_id == user.user_id), None)
    return MeetingOut(
        id=str(booking.id), kind=booking.kind, status=booking.status, title=booking.title, note=booking.note,
        minutes=booking.minutes, starts_at=booking.starts_at, window_start=booking.window_start,
        window_end=booking.window_end, reason=booking.reason, agenda=booking.agenda,
        requested_by=booking.requested_by, my_role=mine.role if mine else None,
        my_filled_in=(mine.slots is not None) if mine else None,
        people=[PersonOut(id=p.user_id, name=who.get(p.user_id, "Someone"), role=p.role,
                          filled_in=p.slots is not None, calendar_connected=p.user_id in linked) for p in people],
    )


def _load(session: Session, booking_id: str, user: Principal) -> Booking:
    try:
        booking = session.get(Booking, uuid.UUID(booking_id))
    except ValueError:
        booking = None
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found.")
    if session.get(BookingPerson, (booking.id, user.user_id)) is None and not user.is_admin:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found.")
    return booking


def _conflict(code: str, message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, {"code": code, "message": message})


def _send_all(background: BackgroundTasks, mailer: Mailer | None, emails: list[Email | None]) -> None:
    for email in emails:
        if email and mailer:
            background.add_task(deliver, mailer, email)


def _green(session: Session, booking: Booking, people: list[BookingPerson]) -> tuple[list[datetime], set[datetime]]:
    """(bookable starts, best first; cells blocked by other DapUp meetings)."""
    ids = [p.user_id for p in people]
    blocked = cells_touching(dapup_busy(session, ids, booking.window_start, booking.window_end, booking.id),
                             booking.window_start, booking.window_end)
    sets = [_utc(p.slots) if p.slots is not None else None for p in people]
    starts = bookable(sets, booking.window_end, booking.minutes, blocked)
    fallback = program_zone(session)
    zones = [_zone(p.timezone) if p.timezone else fallback for p in people]
    return rank(starts, zones, datetime.now(UTC), last_slot(session, booking)), blocked


def _availability(session: Session, booking: Booking, user: Principal, tz: ZoneInfo,
                  calendar: Calendar | None) -> AvailabilityOut:
    people = _people(session, booking)
    sets = [_utc(p.slots) if p.slots is not None else None for p in people]
    free: dict[datetime, list[str]] = {}
    for person, slots in zip(people, sets):
        for cell in slots or ():
            free.setdefault(cell, []).append(person.user_id)
    me = next((p for p in people if p.user_id == user.user_id), None)
    mine, suggested = sorted(_utc(me.slots)) if me and me.slots is not None else [], False
    collecting = booking.status == "collecting"
    starts, blocked = _green(session, booking, people) if collecting else ([], set())
    if me and me.slots is None and calendar and collecting:
        cells = grid_cells(booking.window_start, booking.window_end, tz)
        busy, unread = calendar.busy(session, [user.user_id], booking.window_start, booking.window_end)
        if user.user_id not in unread:
            mine = [c for c in free_cells(busy, cells) if c not in blocked]
            suggested = True
    return AvailabilityOut(
        mine=mine, suggested=suggested,
        cells=[CellOut(start=c, free=ids) for c, ids in sorted(free.items())],
        bookable=starts, blocked=sorted(blocked),
    )


@router.get("/meetings", response_model=list[MeetingOut], response_model_by_alias=True)
def my_meetings(user: Me, session: Db) -> list[MeetingOut]:
    ids = list(session.scalars(select(BookingPerson.booking_id).where(BookingPerson.user_id == user.user_id)))
    bookings = session.scalars(
        select(Booking).where(Booking.id.in_(ids)).order_by(Booking.created_at.desc()).limit(50)
    ).all()
    return [_out(session, b, user) for b in bookings]


@router.get("/meetings/people", response_model=list[PersonOut], response_model_by_alias=True)
def invitable(user: Me, session: Db) -> list[PersonOut]:
    ids = people_i_can_invite(session, user)
    who, linked = names(session, ids), connected(session, ids)
    roles = dict(session.execute(select(User.id, User.account_type).where(User.id.in_(ids))).all())
    return sorted((PersonOut(id=i, name=who.get(i, "Someone"), role=str(roles.get(i, "student")),
                             calendar_connected=i in linked) for i in ids), key=lambda p: (p.role, p.name))


@router.post("/meetings", response_model=MeetingOut, response_model_by_alias=True, status_code=201)
def request_meeting(body: MeetingIn, user: Me, session: Db, mailer: Mail, background: BackgroundTasks) -> MeetingOut:
    upsert_user(session, user)
    if body.minutes not in LENGTHS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Length must be 15, 30, 45 or 60 minutes.")
    chosen = list(dict.fromkeys(p for p in body.people_ids if p != user.user_id))
    if not chosen or not set(chosen) <= set(people_i_can_invite(session, user)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "You can only invite people you work with.")
    everyone = [user.user_id, *chosen]
    who, inbox = names(session, everyone), invite_emails(session, chosen)
    roles = dict(session.execute(select(User.id, User.account_type).where(User.id.in_(everyone))).all())
    start, end = new_window(datetime.now(UTC))
    booking = Booking(kind="manual", requested_by=user.user_id, status="collecting", minutes=body.minutes,
                      student_id=next((u for u in everyone if roles.get(u) == AccountType.student), None),
                      title=body.title or f"Meeting with {who[user.user_id]}", note=body.note,
                      window_start=start, window_end=end)
    session.add(booking)
    session.flush()
    session.add_all(BookingPerson(booking_id=booking.id, user_id=u, role=str(roles.get(u, "student")))
                    for u in everyone)
    session.flush()
    _send_all(background, mailer, [
        _email(inbox[u], who[u], f"{who[user.user_id]} wants to meet",
               [f"{who[user.user_id]} would like a {body.minutes}-minute meeting in the next week.",
                *([f"Note: {body.note}"] if body.note else []), MARK],
               "Mark your times", booking.id)
        for u in chosen])
    return _out(session, booking, user)


@router.get("/meetings/{booking_id}", response_model=MeetingOut, response_model_by_alias=True)
def get_meeting(booking_id: str, user: Me, session: Db) -> MeetingOut:
    return _out(session, _load(session, booking_id, user), user)


@router.get("/meetings/{booking_id}/availability", response_model=AvailabilityOut, response_model_by_alias=True)
def get_availability(booking_id: str, user: Me, session: Db, calendar: Cal,
                     timezone: str = "America/Los_Angeles") -> AvailabilityOut:
    return _availability(session, _load(session, booking_id, user), user, _zone(timezone), calendar)


@router.put("/meetings/{booking_id}/availability", response_model=AvailabilityOut, response_model_by_alias=True)
def save_availability(booking_id: str, body: AvailabilityIn, user: Me, session: Db, mailer: Mail,
                      background: BackgroundTasks, timezone: str = "America/Los_Angeles") -> AvailabilityOut:
    booking = _load(session, booking_id, user)
    me = session.get(BookingPerson, (booking.id, user.user_id))
    if me is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting not found.")
    if booking.status != "collecting":
        raise _conflict("not_open", "This meeting isn't collecting times any more.")
    slots = sorted(_utc(body.slots))
    if any(s < booking.window_start or s >= booking.window_end or s.second or s.microsecond or s.minute % 15
           for s in slots):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Times must be 15-minute cells inside the week shown.")
    people = _people(session, booking)
    was_complete = all(p.slots is not None for p in people)
    me.slots, me.filled_at, me.timezone = slots, datetime.now(UTC), _zone(timezone).key
    session.flush()
    if not was_complete and all(p.slots is not None for p in people):
        found, _ = _green(session, booking, people)
        mentors = [p.user_id for p in people if p.role == "mentor"]
        who, inbox, tz = names(session, mentors), invite_emails(session, mentors), program_zone(session)
        lines = ([f"Everyone has marked their times. The best time that works for all is {when(found[0], tz)}.",
                  "Pick a green time to book it on everyone's calendar."] if found else
                 ["Everyone has marked their times, but no time works for everyone yet.",
                  "Ask people to add a few more times, or choose a shorter meeting."])
        _send_all(background, mailer, [_email(inbox[m], who[m], f"Ready to book: {booking.title}", lines,
                                              "Pick a time", booking.id) for m in mentors])
    return _availability(session, booking, user, _zone(timezone), None)


@router.post("/meetings/{booking_id}/book", response_model=MeetingOut, response_model_by_alias=True)
def book_time(booking_id: str, body: BookIn, user: Me, session: Db, calendar: Cal, mailer: Mail,
              background: BackgroundTasks) -> MeetingOut:
    booking = _load(session, booking_id, user)
    me = session.get(BookingPerson, (booking.id, user.user_id))
    if me is None or me.role != "mentor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only a mentor in this meeting can book it.")
    if booking.status != "collecting":
        raise _conflict("not_open", "This meeting is already booked or closed.")
    start = body.starts_at.astimezone(UTC)
    green, _ = _green(session, booking, _people(session, booking))
    if start not in green or start < datetime.now(UTC):
        raise _conflict("not_green", "Not everyone is free for the whole meeting at that time.")
    try:
        emails = book(session, booking, start, user.user_id, calendar)
    except CalendarError as exc:
        log.warning("booking %s: calendar event failed: %s", booking.id, exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY,
                            "Google Calendar didn't accept the event. Try again in a minute.") from None
    session.flush()
    _send_all(background, mailer, emails)
    return _out(session, booking, user)
