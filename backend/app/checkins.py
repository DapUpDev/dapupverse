"""The weekly check-in cycle, run by the worker (app/worker.py).

weekly-checkin (Mondays, see infra/schedule.tf):
    every student with a profile gets one check-in record for this week,
    then an email linking to it. The record is written FIRST and its unique
    (student_id, week_start) pair means a second run finds nothing to do,
    so a retried or hand-run job never emails anyone twice.

daily-checkin (every day):
    check-ins open past the reply window are marked expired; check-ins open
    for two days get one reminder (reminded_at is set before the email goes
    out, for the same reason).

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
from datetime import UTC, date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, sessionmaker

from app import history, jobs
from app.auth import Principal
from app.db import get_session
from app.mentors import _Camel
from app.models import AccountType, CheckIn, StudentProfile, User
from app.notifications import Mailer, checkin_email, checkin_reminder_email, deliver
from app.storage import Storage, get_storage
from app.students import require_student

log = logging.getLogger("dapup.checkins")

# The schedule fires at 09:00 UTC; an hour of slack keeps a job that ran a
# few seconds late on Monday from missing Wednesday's reminder by a day.
SLACK = timedelta(hours=1)
REMIND_AFTER = timedelta(days=2) - SLACK  # Monday -> Wednesday
REPLY_WINDOW = timedelta(days=5) - SLACK  # Monday -> Saturday (the email says so)


def week_start(now: datetime) -> date:
    """The Monday (UTC) of the week `now` falls in."""
    return (now - timedelta(days=now.weekday())).date()


def send_weekly(sessions: sessionmaker[Session], mailer: Mailer, now: datetime, only: str | None = None) -> int:
    """Create this week's check-in and email it, per student. `only` limits
    the run to one email address (for testing by hand). Returns emails sent."""
    with sessions() as session:
        students = session.execute(
            select(User.id, User.email, StudentProfile.full_name)
            .join(StudentProfile, StudentProfile.user_id == User.id)
            .where(User.account_type == AccountType.student, User.email.is_not(None))
        ).all()

    week, sent = week_start(now), 0
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
        if deliver(mailer, checkin_email(to=email, student_name=name, check_in_id=str(check_in_id))):
            sent += 1
        else:
            with sessions.begin() as session:
                session.execute(delete(CheckIn).where(CheckIn.id == check_in_id))
    log.info("weekly check-in: %d sent for week of %s (%d students)", sent, week, len(students))
    return sent


def run_daily(sessions: sessionmaker[Session], mailer: Mailer, now: datetime) -> tuple[int, int]:
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
            .returning(CheckIn.id, CheckIn.student_id)
        ).all()
        people = {
            row.id: (row.email, row.full_name)
            for row in session.execute(
                select(User.id, User.email, StudentProfile.full_name)
                .outerjoin(StudentProfile, StudentProfile.user_id == User.id)
                .where(User.id.in_([student_id for _, student_id in due]))
            )
        }

    reminded = 0
    for check_in_id, student_id in due:
        email, name = people.get(student_id, (None, ""))
        if email and deliver(mailer, checkin_reminder_email(to=email, student_name=name or "", check_in_id=str(check_in_id))):
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
        raise _conflict("closed", "This check-in has closed. The next one arrives on Monday.")
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
