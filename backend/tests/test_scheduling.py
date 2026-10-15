"""Finding a time, the triage summary, confirming, and manual requests."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import scheduling
from app.db import get_engine
from app.google_calendar import CalendarError, get_calendar
from app.main import app
from app.models import (
    AccountType, Booking, CheckIn, ConnectionRequest, ConsultingMentor, GoogleConnection, MentorProfile,
    StudentProfile, Task, TriageDecision, User,
)
from app.notifications import get_mailer
from tests.conftest import MENTOR

LA = ZoneInfo("America/Los_Angeles")
WEEKENDS = scheduling.Hours(frozenset({5, 6}), scheduling.time(9), scheduling.time(17), LA)


def la(day: int, hour: int, minute: int = 0) -> datetime:
    """A time in October 2026, Los Angeles (17th = Saturday)."""
    return datetime(2026, 10, day, hour, minute, tzinfo=LA)


# ---- free_slots ---------------------------------------------------------------

def test_first_slot_is_after_everyone_is_free():
    # Three mentors and a student, each busy for part of Saturday morning.
    busy = [(la(17, 9), la(17, 10)), (la(17, 9, 30), la(17, 11)), (la(17, 11), la(17, 11, 20))]
    slots = scheduling.free_slots(busy, la(15, 8), la(22, 8), 30, WEEKENDS, limit=3)
    assert slots == [la(17, 11, 30), la(17, 12), la(17, 12, 30)]  # 11:20 rounds up to the next quarter hour


def test_only_meeting_days_and_hours_and_the_window():
    slots = scheduling.free_slots([(la(17, 9), la(17, 17))], la(15, 8), la(22, 8), 60, WEEKENDS, limit=2)
    assert slots == [la(18, 9), la(18, 10)]  # Saturday full -> Sunday; never Thursday/Friday/Monday
    assert scheduling.free_slots([], la(18, 16, 1), la(18, 18), 60, WEEKENDS) == []  # 16:15 + 60 > 17:00
    assert scheduling.free_slots([], la(17, 9), la(17, 9, 45), 60, WEEKENDS) == []  # window ends first


def test_when_reads_like_a_person_wrote_it():
    assert scheduling.when(la(17, 10), LA) == "Saturday 17 October, 10:00 AM PDT"


# ---- the database-backed parts --------------------------------------------------

class FakeCalendar:
    def __init__(self, busy=(), fail=False):
        self.busy_blocks, self.fail, self.events = list(busy), fail, []

    def busy(self, session, user_ids, start, end):
        linked = set(session.scalars(select(GoogleConnection.user_id).where(GoogleConnection.user_id.in_(user_ids))))
        return [b for b in self.busy_blocks if b[0] < end and b[1] > start], [u for u in user_ids if u not in linked]

    def create_event(self, session, organizer_id, start, end, summary, description, attendees):
        if self.fail:
            raise CalendarError("events.insert answered HTTP 403")
        self.events.append({"organizer": organizer_id, "start": start, "end": end, "summary": summary,
                            "description": description, "attendees": sorted(attendees)})
        return "evt_1"


class FakeMailer:
    def __init__(self):
        self.sent = []

    def send(self, email):
        self.sent.append(email)

    def to(self, address):
        return [e for e in self.sent if e.to == address]


pytestmark = pytest.mark.usefixtures("configured_database")
THURSDAY = la(15, 9).astimezone(UTC)


@pytest.fixture
def sessions():
    factory = sessionmaker(bind=get_engine(), expire_on_commit=False)
    with factory.begin() as s:
        s.add_all([User(id=i, email=f"{i}@example.com", account_type=t) for i, t in (
            ("user_maya", AccountType.student), ("user_jae", AccountType.mentor), ("user_kim", AccountType.mentor),
            ("user_ola", AccountType.mentor))])
        s.flush()
        s.add_all([
            StudentProfile(user_id="user_maya", full_name="Maya Lin", consulting=True),
            MentorProfile(user_id="user_jae", slug="jae", name="Jae Park"),
            MentorProfile(user_id="user_kim", slug="kim", name="Kim Ito"),
            MentorProfile(user_id="user_ola", slug="ola", name="Ola Berg"),
            ConsultingMentor(student_id="user_maya", mentor_id="user_jae"),
            ConsultingMentor(student_id="user_maya", mentor_id="user_kim"),
            GoogleConnection(user_id="user_jae", google_email="jae@gmail.com", refresh_token=b"x"),
            Task(student_id="user_maya", title="Physics IA draft", due_on=date(2026, 10, 10)),
            Task(student_id="user_maya", title="Common App essay", due_on=date(2026, 10, 20)),
        ])
    return factory


@pytest.fixture
def mailer():
    fake = FakeMailer()
    app.dependency_overrides[get_mailer] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_mailer, None)


@pytest.fixture
def calendar():
    fake = FakeCalendar(busy=[(la(17, 9), la(17, 10))])
    app.dependency_overrides[get_calendar] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_calendar, None)


def decided(sessions, decision="30", status="decided", week=date(2026, 10, 12), confidence=2):
    with sessions.begin() as s:
        c = CheckIn(student_id="user_maya", week_start=week, status="answered", progress="Finished my essay draft.",
                    blockers="It is too long.", confidence=confidence, help_wanted="Essay review",
                    answered_at=THURSDAY)
        s.add(c)
        s.flush()
        s.add(TriageDecision(student_id="user_maya", check_in_id=c.id, status=status,
                             decision=decision if status == "decided" else None,
                             reason="Essay due soon and confidence is low.", blockers="Essay over the word limit",
                             agenda=["Cut the introduction"] if decision != "NO_MEETING" else [], attempts=1))
    return c.id


def test_a_30_minute_decision_proposes_the_first_free_slot_and_emails_the_team(sessions, mailer, calendar):
    with sessions.begin() as s:  # last week's check-in, to show what changed
        s.add(CheckIn(student_id="user_maya", week_start=date(2026, 10, 5), status="answered", progress="Outline",
                      blockers="", confidence=4, answered_at=THURSDAY - timedelta(days=7)))
    check_in = decided(sessions)
    booking = scheduling.after_triage(sessions, check_in, calendar, mailer, THURSDAY)
    assert (booking.status, booking.minutes, booking.starts_at) == ("proposed", 30, la(17, 10))

    jae = mailer.to("jae@gmail.com")[0]  # invites go to the linked Google address
    assert jae.subject == "Maya Lin: 30-minute meeting proposed for Saturday 17 October, 10:00 AM PDT"
    for line in ("Finished: Finished my essay draft.", "Missed: Physics IA draft",
                 "Confidence went from 4/5 to 2/5.", "Blockers: Essay over the word limit",
                 "Next deadline: Common App essay on 20 Oct", "Meeting: 30 minutes",
                 "Why: Essay due soon and confidence is low.", "Agenda: Cut the introduction",
                 "Not checked (calendar not connected): Kim Ito, Maya Lin.", "Review and confirm",
                 f"/app/meetings/{booking.id}"):
        assert line in jae.text, line
    assert len(mailer.to("user_kim@example.com")) == 1 and mailer.to("user_maya@example.com") == []

    assert scheduling.after_triage(sessions, check_in, calendar, mailer, THURSDAY) is None  # once per check-in
    assert len(mailer.sent) == 2


@pytest.mark.parametrize("decision, status, expected, headline", [
    ("NO_MEETING", "decided", "no_meeting", "no meeting needed this week"),
    (None, "needs_mentor", "needs_mentor", "needs your decision"),
])
def test_summary_only_decisions(sessions, mailer, calendar, decision, status, expected, headline):
    booking = scheduling.after_triage(sessions, decided(sessions, decision, status), calendar, mailer, THURSDAY)
    assert booking.status == expected and booking.starts_at is None
    assert mailer.to("jae@gmail.com")[0].subject == f"Maya Lin: {headline}"
    assert "Open in DapUp" in mailer.to("jae@gmail.com")[0].text


def test_when_nothing_fits_this_week_the_student_gets_options(sessions, mailer):
    full = FakeCalendar(busy=[(la(17, 0), la(19, 0))])
    booking = scheduling.after_triage(sessions, decided(sessions), full, mailer, THURSDAY)
    assert booking.status == "no_slot" and booking.options[0] == la(24, 9)
    assert mailer.to("user_maya@example.com")[0].subject == "Pick a time for your DapUp meeting"
    assert "has been asked to pick one of: Saturday 24 October, 9:00 AM PDT" in mailer.to("jae@gmail.com")[0].text


def test_no_team_means_no_booking(sessions, mailer, calendar):
    with sessions.begin() as s:
        s.query(ConsultingMentor).delete()
    assert scheduling.after_triage(sessions, decided(sessions), calendar, mailer, THURSDAY) is None


def test_a_mentor_confirms_and_it_goes_on_everyones_calendar(client, bearer, sessions, mailer, calendar):
    booking = scheduling.after_triage(sessions, decided(sessions), calendar, FakeMailer(), THURSDAY)
    kim = bearer(sub="user_kim", metadata=MENTOR)
    got = client.get(f"/meetings/{booking.id}", headers=kim).json()
    assert (got["status"], got["myRole"], got["myResponse"]) == ("proposed", "mentor", "pending")

    confirmed = client.post(f"/meetings/{booking.id}/respond", json={"accept": True}, headers=kim)
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["status"] == "confirmed"
    event = calendar.events[0]
    assert event["organizer"] == "user_jae"  # Kim isn't connected; Jae can host
    assert (event["start"], event["end"]) == (la(17, 10), la(17, 10, 30))
    assert event["attendees"] == ["jae@gmail.com", "user_kim@example.com", "user_maya@example.com"]
    assert "Cut the introduction" in event["description"]
    assert {e.to for e in mailer.sent} == {"jae@gmail.com", "user_kim@example.com", "user_maya@example.com"}
    assert all(e.subject == "Booked: Maya Lin and mentors" for e in mailer.sent)

    again = client.post(f"/meetings/{booking.id}/respond", json={"accept": True}, headers=kim)
    assert again.status_code == 409


def test_a_google_failure_leaves_it_unbooked(client, bearer, sessions, mailer):
    booking = scheduling.after_triage(sessions, decided(sessions), FakeCalendar(), FakeMailer(), THURSDAY)
    app.dependency_overrides[get_calendar] = lambda: FakeCalendar(fail=True)
    try:
        response = client.post(f"/meetings/{booking.id}/respond", json={"accept": True},
                               headers=bearer(sub="user_jae", metadata=MENTOR))
    finally:
        app.dependency_overrides.pop(get_calendar, None)
    assert response.status_code == 502
    with sessions() as s:
        assert s.get(Booking, booking.id).status == "proposed"


def test_strangers_cannot_see_it(client, bearer, sessions, calendar):
    booking = scheduling.after_triage(sessions, decided(sessions), calendar, FakeMailer(), THURSDAY)
    assert client.get(f"/meetings/{booking.id}", headers=bearer(sub="user_ola", metadata=MENTOR)).status_code == 404


def test_the_student_picks_an_offered_time(client, bearer, sessions, mailer):
    booking = scheduling.after_triage(sessions, decided(sessions), FakeCalendar(busy=[(la(17, 0), la(19, 0))]),
                                      FakeMailer(), THURSDAY)
    maya = bearer(sub="user_maya", email="user_maya@example.com")
    bad = client.post(f"/meetings/{booking.id}/pick", json={"startsAt": la(24, 13).isoformat()}, headers=maya)
    assert bad.status_code == 422
    picked = client.post(f"/meetings/{booking.id}/pick", json={"startsAt": booking.options[1].isoformat()}, headers=maya)
    assert picked.status_code == 200, picked.text
    assert picked.json()["status"] == "proposed"
    assert {e.to for e in mailer.sent} == {"jae@gmail.com", "user_kim@example.com"}


def test_manual_request_needs_everyone_to_accept(client, bearer, sessions, mailer, calendar):
    with sessions.begin() as s:
        s.add(ConnectionRequest(student_id="user_maya", mentor_id="user_ola", purpose="Essay review",
                                message="Hello there", state="accepted"))
    maya = bearer(sub="user_maya", email="user_maya@example.com")
    people = client.get("/meetings/people", headers=maya).json()
    assert [p["name"] for p in people] == ["Jae Park", "Kim Ito", "Ola Berg"]
    assert [p["calendarConnected"] for p in people] == [True, False, False]

    body = {"peopleIds": ["user_jae", "user_ola"], "minutes": 45, "timezone": "Pacific/Auckland"}
    found = client.post("/meetings/slots", json=body, headers=maya).json()
    assert found["notConnected"] == ["Maya Lin", "Ola Berg"] and len(found["slots"]) == 12
    start = datetime.fromisoformat(found["slots"][0]).astimezone(ZoneInfo("Pacific/Auckland"))
    assert 8 <= start.hour < 21  # any day, waking hours where the requester is

    made = client.post("/meetings", json={**body, "startsAt": found["slots"][0], "note": "Essay plan"}, headers=maya)
    assert made.status_code == 201, made.text
    meeting = made.json()
    assert meeting["kind"] == "manual" and meeting["status"] == "proposed"
    assert {p["id"]: p["response"] for p in meeting["people"]} == {
        "user_maya": "accepted", "user_jae": "pending", "user_ola": "pending"}
    assert {e.subject for e in mailer.sent} == {"Maya Lin asked for a meeting"}

    first = client.post(f"/meetings/{meeting['id']}/respond", json={"accept": True},
                        headers=bearer(sub="user_jae", metadata=MENTOR))
    assert first.json()["status"] == "proposed"  # still waiting for Ola
    second = client.post(f"/meetings/{meeting['id']}/respond", json={"accept": True},
                         headers=bearer(sub="user_ola", metadata=MENTOR))
    assert second.json()["status"] == "confirmed" and calendar.events[0]["organizer"] == "user_jae"


def test_manual_request_rules(client, bearer, sessions, mailer, calendar):
    maya = bearer(sub="user_maya", email="user_maya@example.com")
    assert client.post("/meetings/slots", json={"peopleIds": ["user_ola"], "minutes": 30},
                       headers=maya).status_code == 422  # not someone she works with
    assert client.post("/meetings/slots", json={"peopleIds": ["user_jae"], "minutes": 20},
                       headers=maya).status_code == 422
    past = {"peopleIds": ["user_jae"], "minutes": 30, "startsAt": "2020-01-01T00:00:00Z"}
    assert client.post("/meetings", json=past, headers=maya).status_code == 409


def test_declining_calls_it_off(client, bearer, sessions, mailer, calendar):
    booking = scheduling.after_triage(sessions, decided(sessions), calendar, FakeMailer(), THURSDAY)
    response = client.post(f"/meetings/{booking.id}/respond", json={"accept": False},
                           headers=bearer(sub="user_kim", metadata=MENTOR))
    assert response.json()["status"] == "declined" and calendar.events == []
    assert {e.subject for e in mailer.sent} == {"Declined: Maya Lin and mentors"}
