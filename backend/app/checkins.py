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

Email failures are logged and dropped (notifications.deliver): the record
already exists, and one lost email beats a duplicate.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, sessionmaker

from app.models import AccountType, CheckIn, StudentProfile, User
from app.notifications import Mailer, checkin_email, checkin_reminder_email, deliver

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
        deliver(mailer, checkin_email(to=email, student_name=name, check_in_id=str(check_in_id)))
        sent += 1
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
        if email:
            deliver(mailer, checkin_reminder_email(to=email, student_name=name or "", check_in_id=str(check_in_id)))
            reminded += 1
    log.info("daily check-in: %d expired, %d reminded", expired, reminded)
    return expired, reminded
