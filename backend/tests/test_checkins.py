"""The weekly check-in cycle against a real PostgreSQL and a fake mailer."""

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import checkins
from app.db import get_engine
from app.models import AccountType, CheckIn, MentorProfile, StudentProfile, User

pytestmark = pytest.mark.usefixtures("configured_database")

MONDAY = datetime(2026, 10, 12, 9, 0, 3, tzinfo=UTC)  # a few seconds after the schedule fired


class FakeMailer:
    def __init__(self, failing=()) -> None:
        self.sent = []
        self.failing = set(failing)

    def send(self, email) -> None:
        if email.to in self.failing:
            raise RuntimeError("AccessDeniedException")
        self.sent.append(email)


@pytest.fixture
def sessions():
    factory = sessionmaker(bind=get_engine(), expire_on_commit=False)
    with factory.begin() as s:
        s.add_all([
            User(id="u_maya", email="maya@example.com", account_type=AccountType.student),
            User(id="u_leo", email="leo@example.com", account_type=AccountType.student),
            User(id="u_new", email="new@example.com", account_type=AccountType.student),  # no profile yet
            User(id="u_jae", email="jae@example.com", account_type=AccountType.mentor),
        ])
        s.flush()
        s.add_all([
            StudentProfile(user_id="u_maya", full_name="Maya Lin"),
            StudentProfile(user_id="u_leo", full_name="Leo Tu"),
            MentorProfile(user_id="u_jae", slug="jae", name="Jae Park"),
        ])
    return factory


def test_weekly_emails_each_student_once_and_a_rerun_sends_nothing(sessions):
    mailer = FakeMailer()
    assert checkins.send_weekly(sessions, mailer, MONDAY) == 2
    assert sorted(e.to for e in mailer.sent) == ["leo@example.com", "maya@example.com"]
    maya = next(e for e in mailer.sent if e.to == "maya@example.com")
    assert maya.subject == "Your DapUp check-in for this week"
    assert "Hi Maya Lin," in maya.text and "https://www.dapup.space/app/check-ins/" in maya.text

    # Same week, later in the day (a retry or a hand run): nothing new.
    assert checkins.send_weekly(sessions, mailer, MONDAY + timedelta(hours=5)) == 0
    assert len(mailer.sent) == 2
    with sessions() as s:
        rows = s.scalars(select(CheckIn)).all()
    assert len(rows) == 2 and {r.week_start.isoformat() for r in rows} == {"2026-10-12"}

    # Next Monday is a new week.
    assert checkins.send_weekly(sessions, mailer, MONDAY + timedelta(days=7)) == 2


def test_only_limits_a_hand_run_to_one_address(sessions):
    mailer = FakeMailer()
    assert checkins.send_weekly(sessions, mailer, MONDAY, only="MAYA@example.com") == 1
    assert [e.to for e in mailer.sent] == ["maya@example.com"]
    # Leo is still due this week.
    assert checkins.send_weekly(sessions, mailer, MONDAY) == 1


def test_daily_reminds_once_after_two_days_then_expires_on_saturday(sessions):
    mailer = FakeMailer()
    checkins.send_weekly(sessions, mailer, MONDAY)
    with sessions.begin() as s:
        s.execute(CheckIn.__table__.update().where(CheckIn.student_id == "u_leo").values(status="answered"))
    mailer.sent.clear()

    tuesday = MONDAY.replace(second=0) + timedelta(days=1)
    assert checkins.run_daily(sessions, mailer, tuesday) == (0, 0)

    wednesday = tuesday + timedelta(days=1)
    assert checkins.run_daily(sessions, mailer, wednesday) == (0, 1)
    assert [e.to for e in mailer.sent] == ["maya@example.com"]  # Leo already answered
    assert mailer.sent[0].subject == "Reminder: your DapUp check-in closes Saturday"
    assert checkins.run_daily(sessions, mailer, wednesday + timedelta(days=1)) == (0, 0)  # one reminder only

    saturday = MONDAY.replace(second=0) + timedelta(days=5)
    assert checkins.run_daily(sessions, mailer, saturday) == (1, 0)
    with sessions() as s:
        statuses = dict(s.execute(select(CheckIn.student_id, CheckIn.status)).all())
    assert statuses == {"u_maya": "expired", "u_leo": "answered"}
    assert len(mailer.sent) == 1


def test_a_failed_email_is_retried_on_the_next_run(sessions):
    mailer = FakeMailer(failing={"maya@example.com"})
    assert checkins.send_weekly(sessions, mailer, MONDAY) == 1  # Leo only
    mailer.failing.clear()
    assert checkins.send_weekly(sessions, mailer, MONDAY + timedelta(hours=1)) == 1
    assert sorted(e.to for e in mailer.sent) == ["leo@example.com", "maya@example.com"]

    # A failed reminder is retried the next day, then sent once.
    mailer.failing.add("leo@example.com")
    wednesday = MONDAY.replace(second=0) + timedelta(days=2)
    assert checkins.run_daily(sessions, mailer, wednesday) == (0, 0)  # Maya's went out an hour later
    mailer.failing.clear()
    assert checkins.run_daily(sessions, mailer, wednesday + timedelta(days=1)) == (0, 2)
    assert checkins.run_daily(sessions, mailer, wednesday + timedelta(days=1, hours=1)) == (0, 0)
