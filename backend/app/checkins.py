"""The weekly check-in cycle, run by the worker (app/worker.py).

checkin-tick (hourly, see infra/schedule.tf):
    1. Once this week's send time has passed (program_settings: weekday,
       time and time zone, edited on /admin; default Thursday 08:00
       Pacific), every CONSULTING student gets one check-in record for the
       week, then an email linking to it. The record is written FIRST and
       its unique (student_id, week_start) pair means later ticks find
       nothing to do, so a retried or hand-run job never emails anyone twice.
    2. Check-ins open for a day get one reminder (reminded_at is set before
       the email goes out, for the same reason); check-ins open past the
       reply window are marked expired.

weekly-checkin (by hand, for testing) sends now, whatever the schedule.

Routes (the check-in page, /app/check-ins/<id>):
    GET /me/check-ins/<id>   the student's own check-in
    PUT /me/check-ins/<id>   answer it once, while the window is open. The
        answer is saved, written to the student's history in S3, and the
        worker is sent {"job": "triage", "student_id", "check_in_id"} and
        {"job": "ingest-history"}.

A failed email (logged by notifications.deliver) is undone: the check-in
row is deleted, or reminded_at cleared, so the next run tries that student
again. Only an email SES accepted counts as sent.
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field
from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, sessionmaker

from app import history, jobs
from app.auth import Principal
from app.db import get_session
from app.mentors import _Camel
from app.models import AccountType, CheckIn, ProgramSettings, StudentProfile, User
from app.notifications import Mailer, checkin_email, checkin_reminder_email, deliver
from app.storage import Storage, get_storage
from app.students import require_student

log = logging.getLogger("dapup.checkins")

# Relative to when the check-in went out. With the default Thursday 08:00
# send: reminder Friday 08:00, closed Saturday 08:00, ahead of weekend meetings.
REMIND_AFTER = timedelta(days=1)
REPLY_WINDOW = timedelta(days=2)


@dataclass(frozen=True)
class Schedule:
    weekday: int  # Monday = 0
    at: time
    tz: ZoneInfo


DEFAULT_SCHEDULE = Schedule(weekday=3, at=time(8, 0), tz=ZoneInfo("America/Los_Angeles"))


def load_schedule(session: Session) -> Schedule:
    row = session.get(ProgramSettings, 1)
    if row is None:
        return DEFAULT_SCHEDULE
    return Schedule(weekday=row.checkin_weekday, at=row.checkin_time, tz=ZoneInfo(row.timezone))


def week_start(now: datetime, schedule: Schedule = DEFAULT_SCHEDULE) -> date:
    """The Monday, in the schedule's time zone, of the week `now` falls in."""
    local = now.astimezone(schedule.tz).date()
    return local - timedelta(days=local.weekday())


def send_time(now: datetime, schedule: Schedule) -> datetime:
    """When this week's check-in goes out."""
    day = week_start(now, schedule) + timedelta(days=schedule.weekday)
    return datetime.combine(day, schedule.at, tzinfo=schedule.tz)


def closes_text(sent_at: datetime, schedule: Schedule) -> str:
    """e.g. "Saturday 18 October at 8:00 AM PDT" (built by hand: Windows
    strftime has no %-d)."""
    t = (sent_at + REPLY_WINDOW).astimezone(schedule.tz)
    return f"{t:%A} {t.day} {t:%B} at {t.hour % 12 or 12}:{t:%M} {'AM' if t.hour < 12 else 'PM'} {t:%Z}"


def checkin_tick(sessions: sessionmaker[Session], mailer: Mailer, now: datetime) -> int:
    """The hourly job: send this week's check-ins once their time has come,
    then remind and expire. Returns check-in emails sent."""
    with sessions() as session:
        schedule = load_schedule(session)
    sent = send_weekly(sessions, mailer, now, schedule) if now >= send_time(now, schedule) else 0
    run_daily(sessions, mailer, now, schedule)
    return sent


def send_weekly(sessions: sessionmaker[Session], mailer: Mailer, now: datetime,
                schedule: Schedule = DEFAULT_SCHEDULE, only: str | None = None) -> int:
    """Create this week's check-in and email it, per consulting student.
    `only` limits the run to one email address (for testing by hand).
    Returns emails sent."""
    with sessions() as session:
        students = session.execute(
            select(User.id, User.email, StudentProfile.full_name)
            .join(StudentProfile, StudentProfile.user_id == User.id)
            .where(User.account_type == AccountType.student, User.email.is_not(None),
                   StudentProfile.consulting.is_(True))
        ).all()

    week, sent, closes = week_start(now, schedule), 0, closes_text(now, schedule)
    for student_id, email, name in students:
        if only and email.lower() != only.lower():
            continue
        with sessions.begin() as session:
            check_in_id = session.execute(
                insert(CheckIn)
                .values(student_id=student_id, week_start=week, sent_at=now)
                .on_conflict_do_nothing(constraint="uq_check_ins_student_week")
                .returning(CheckIn.id)
            ).scalar()
        if check_in_id is None:
            continue  # already has this week's check-in
        if deliver(mailer, checkin_email(to=email, student_name=name, check_in_id=str(check_in_id), closes=closes)):
            sent += 1
        else:
            with sessions.begin() as session:
                session.execute(delete(CheckIn).where(CheckIn.id == check_in_id))
    log.info("weekly check-in: %d sent for week of %s (%d students)", sent, week, len(students))
    return sent


def reset_week(sessions: sessionmaker[Session], now: datetime, schedule: Schedule, email: str) -> int:
    """Testing aid (worker job "reset-checkin"): delete one student's check-in
    for this week, with its triage decision and meeting (foreign keys
    cascade), so the next tick sends them a fresh one. Returns rows deleted."""
    with sessions.begin() as session:
        deleted = session.execute(
            delete(CheckIn).where(
                CheckIn.week_start == week_start(now, schedule),
                CheckIn.student_id.in_(select(User.id).where(func.lower(User.email) == email.lower())),
            )
        ).rowcount
    log.info("reset-checkin: %d check-in(s) deleted for %s, week of %s", deleted, email, week_start(now, schedule))
    return deleted


def run_daily(sessions: sessionmaker[Session], mailer: Mailer, now: datetime,
              schedule: Schedule = DEFAULT_SCHEDULE) -> tuple[int, int]:
    """Expire, then remind. Returns (expired, reminded)."""
    with sessions.begin() as session:
        expired = session.execute(
            update(CheckIn)
            .where(CheckIn.status == "sent", CheckIn.sent_at <= now - REPLY_WINDOW)
            .values(status="expired")
        ).rowcount
        due = session.execute(
            update(CheckIn)
            .where(CheckIn.status == "sent", CheckIn.reminded_at.is_(None), CheckIn.sent_at <= now - REMIND_AFTER)
            .values(reminded_at=now)
            .returning(CheckIn.id, CheckIn.student_id, CheckIn.sent_at)
        ).all()
        people = {
            row.id: (row.email, row.full_name)
            for row in session.execute(
                select(User.id, User.email, StudentProfile.full_name)
                .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
                .where(User.id.in_([student_id for _, student_id, _ in due]))
            )
        }

    reminded = 0
    for check_in_id, student_id, sent_at in due:
        email, name = people.get(student_id, (None, ""))
        if email and deliver(mailer, checkin_reminder_email(to=email, student_name=name or "", check_in_id=str(check_in_id),
                                                            closes=closes_text(sent_at, schedule))):
            reminded += 1
        elif email:
            with sessions.begin() as session:
                session.execute(update(CheckIn).where(CheckIn.id == check_in_id).values(reminded_at=None))
    log.info("daily check-in: %d expired, %d reminded", expired, reminded)
    return expired, reminded


# ---- routes: the check-in page -------------------------------------------
router = APIRouter()


class CheckInOut(_Camel):
    id: str
    week_start: date
    status: str  # sent | answered | expired
    closes_at: datetime
    progress: str
    blockers: str
    confidence: int | None
    help_wanted: str
    answered_at: datetime | None


class CheckInAnswer(_Camel):
    progress: str = Field(min_length=1, max_length=2000)
    blockers: str = Field(default="", max_length=2000)
    confidence: int = Field(ge=1, le=5)
    help_wanted: str = Field(default="", max_length=2000)


def _out(row: CheckIn) -> CheckInOut:
    return CheckInOut(id=str(row.id), week_start=row.week_start, status=row.status,
                      closes_at=row.sent_at + REPLY_WINDOW, progress=row.progress, blockers=row.blockers,
                      confidence=row.confidence, help_wanted=row.help_wanted, answered_at=row.answered_at)


def _own(session: Session, user: Principal, check_in_id: str) -> CheckIn:
    """The caller's check-in; anyone else's is "not found", never "forbidden"."""
    try:
        row = session.get(CheckIn, uuid.UUID(check_in_id))
    except ValueError:
        row = None
    if row is None or row.student_id != user.user_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Check-in not found.")
    return row


def _conflict(code: str, message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, {"code": code, "message": message})


def history_body(row: CheckIn) -> str:
    return "\n\n".join([
        f"Weekly check-in, week of {row.week_start}",
        f"What I got done: {row.progress}",
        f"What is blocking me: {row.blockers or 'Nothing'}",
        f"Confidence about my next deadline: {row.confidence}/5",
        f"What I want help with: {row.help_wanted or 'Nothing'}",
    ])


@router.get("/me/check-ins/{check_in_id}", response_model=CheckInOut, response_model_by_alias=True)
def get_my_check_in(
    check_in_id: str,
    user: Annotated[Principal, Depends(require_student)],
    session: Annotated[Session, Depends(get_session)],
) -> CheckInOut:
    return _out(_own(session, user, check_in_id))


@router.put("/me/check-ins/{check_in_id}", response_model=CheckInOut, response_model_by_alias=True)
def answer_my_check_in(
    check_in_id: str,
    body: CheckInAnswer,
    user: Annotated[Principal, Depends(require_student)],
    session: Annotated[Session, Depends(get_session)],
    storage: Annotated[Storage | None, Depends(get_storage)],
) -> CheckInOut:
    row = _own(session, user, check_in_id)
    now = datetime.now(UTC)
    if row.status == "answered":
        raise _conflict("already_answered", "You already sent this week's check-in.")
    if row.status == "expired" or now > row.sent_at + REPLY_WINDOW:
        raise _conflict("closed", "This check-in has closed. The next one arrives next week.")
    row.progress, row.blockers, row.confidence, row.help_wanted = (
        body.progress, body.blockers, body.confidence, body.help_wanted)
    row.status, row.answered_at = "answered", now
    session.commit()  # the answer is saved before anything else can fail

    # ponytail: a failed S3 write or SQS send is logged and the answer stays
    # saved; nothing re-sends it. Add a daily sweep for answered check-ins
    # without a decision if this ever shows up in the logs.
    if storage:
        try:
            history.save(storage, student_id=row.student_id, kind="check-in", record_id=str(row.id),
                         body=history_body(row))
        except Exception as exc:  # noqa: BLE001
            log.error("check-in %s: could not save history: %s: %s", row.id, type(exc).__name__, exc)
    jobs.enqueue({"job": "triage", "student_id": row.student_id, "check_in_id": str(row.id)})
    jobs.enqueue({"job": "ingest-history", "source": "check-in"})
    return _out(row)
