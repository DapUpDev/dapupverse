"""The weekly check-in cycle against a real PostgreSQL and a fake mailer."""

from datetime import UTC, datetime, time, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import checkins
from app.db import get_engine
from app.models import AccountType, CheckIn, MentorProfile, ProgramSettings, StudentProfile, User

pytestmark = pytest.mark.usefixtures("configured_database")

# Thursday 15 October 2026, 08:00:03 in Los Angeles (PDT): just after the default send time.
THURSDAY = datetime(2026, 10, 15, 15, 0, 3, tzinfo=UTC)
HOUR = timedelta(hours=1)


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
            User(id="u_sam", email="sam@example.com", account_type=AccountType.student),  # social network only
            User(id="u_new", email="new@example.com", account_type=AccountType.student),  # no profile yet
            User(id="u_jae", email="jae@example.com", account_type=AccountType.mentor),
        ])
        s.flush()
        s.add_all([
            StudentProfile(user_id="u_maya", full_name="Maya Lin", consulting=True),
            StudentProfile(user_id="u_leo", full_name="Leo Tu", consulting=True),
            StudentProfile(user_id="u_sam", full_name="Sam Ng"),
            MentorProfile(user_id="u_jae", slug="jae", name="Jae Park"),
        ])
    return factory


def test_weekly_emails_each_consulting_student_once(sessions):
    mailer = FakeMailer()
    assert checkins.send_weekly(sessions, mailer, THURSDAY) == 2
    assert sorted(e.to for e in mailer.sent) == ["leo@example.com", "maya@example.com"]  # not Sam
    maya = next(e for e in mailer.sent if e.to == "maya@example.com")
    assert maya.subject == "Your DapUp check-in for this week"
    assert "Hi Maya Lin," in maya.text and "https://www.dapup.space/app/check-ins/" in maya.text
    assert "It closes Saturday 17 October at 8:00 AM PDT." in maya.text

    # Same week, later (a retry or a hand run): nothing new.
    assert checkins.send_weekly(sessions, mailer, THURSDAY + 5 * HOUR) == 0
    assert len(mailer.sent) == 2
    with sessions() as s:
        rows = s.scalars(select(CheckIn)).all()
    assert len(rows) == 2 and {r.week_start.isoformat() for r in rows} == {"2026-10-12"}

    # Next week is a new week.
    assert checkins.send_weekly(sessions, mailer, THURSDAY + timedelta(days=7)) == 2


def test_the_hourly_tick_sends_once_the_scheduled_time_has_passed(sessions):
    mailer = FakeMailer()
    assert checkins.checkin_tick(sessions, mailer, THURSDAY - HOUR) == 0  # 07:00 Thursday: not yet
    assert checkins.checkin_tick(sessions, mailer, THURSDAY) == 2
    assert checkins.checkin_tick(sessions, mailer, THURSDAY + HOUR) == 0  # already sent this week

    # The admin moves it to Saturday 10:00 Auckland time: next week's Thursday tick sends nothing.
    with sessions.begin() as s:
        row = s.get(ProgramSettings, 1)
        row.checkin_weekday, row.checkin_time, row.timezone = 5, time(10, 0), "Pacific/Auckland"
    next_thursday = THURSDAY + timedelta(days=7)
    assert checkins.checkin_tick(sessions, mailer, next_thursday) == 0
    # Saturday 24 October 10:00 NZDT is Friday 23 October 21:00 UTC.
    assert checkins.checkin_tick(sessions, mailer, datetime(2026, 10, 23, 21, 0, 5, tzinfo=UTC)) == 2


def test_only_limits_a_hand_run_to_one_address(sessions):
    mailer = FakeMailer()
    assert checkins.send_weekly(sessions, mailer, THURSDAY, only="MAYA@example.com") == 1
    assert [e.to for e in mailer.sent] == ["maya@example.com"]
    assert checkins.send_weekly(sessions, mailer, THURSDAY, only="sam@example.com") == 0  # not consulting
    assert checkins.send_weekly(sessions, mailer, THURSDAY) == 1  # Leo is still due


def test_reminds_once_after_a_day_then_closes_after_two(sessions):
    mailer = FakeMailer()
    checkins.send_weekly(sessions, mailer, THURSDAY)
    with sessions.begin() as s:
        s.execute(CheckIn.__table__.update().where(CheckIn.student_id == "u_leo").values(status="answered"))
    mailer.sent.clear()

    assert checkins.run_daily(sessions, mailer, THURSDAY + 23 * HOUR) == (0, 0)
    assert checkins.run_daily(sessions, mailer, THURSDAY + 24 * HOUR) == (0, 1)
    assert [e.to for e in mailer.sent] == ["maya@example.com"]  # Leo already answered
    assert mailer.sent[0].subject == "Reminder: your DapUp check-in closes soon"
    assert "It closes Saturday 17 October at 8:00 AM PDT" in mailer.sent[0].text
    assert checkins.run_daily(sessions, mailer, THURSDAY + 30 * HOUR) == (0, 0)  # one reminder only

    assert checkins.run_daily(sessions, mailer, THURSDAY + 48 * HOUR) == (1, 0)
    with sessions() as s:
        statuses = dict(s.execute(select(CheckIn.student_id, CheckIn.status)).all())
    assert statuses == {"u_maya": "expired", "u_leo": "answered"}
    assert len(mailer.sent) == 1


def test_a_failed_email_is_retried_on_the_next_run(sessions):
    mailer = FakeMailer(failing={"maya@example.com"})
    assert checkins.send_weekly(sessions, mailer, THURSDAY) == 1  # Leo only
    mailer.failing.clear()
    assert checkins.send_weekly(sessions, mailer, THURSDAY + HOUR) == 1
    assert sorted(e.to for e in mailer.sent) == ["leo@example.com", "maya@example.com"]

    # A failed reminder is retried on a later tick, then sent once.
    mailer.failing.add("leo@example.com")
    assert checkins.run_daily(sessions, mailer, THURSDAY + 24 * HOUR) == (0, 0)  # Maya's went out an hour later
    mailer.failing.clear()
    assert checkins.run_daily(sessions, mailer, THURSDAY + 25 * HOUR) == (0, 2)
    assert checkins.run_daily(sessions, mailer, THURSDAY + 26 * HOUR) == (0, 0)
