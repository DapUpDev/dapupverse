"""when2meet-style scheduling: the grid, the triage summary, marking times, booking."""

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
    AccountType, Booking, BookingPerson, CheckIn, ConnectionRequest, ConsultingMentor, GoogleConnection,
    MentorProfile, StudentProfile, Task, TriageDecision, User,
)
from app.notifications import get_mailer
from tests.conftest import MENTOR

LA, NZ = ZoneInfo("America/Los_Angeles"), ZoneInfo("Pacific/Auckland")
Q = timedelta(minutes=15)


def la(day: int, hour: int, minute: int = 0) -> datetime:
    """A time in October 2026, Los Angeles (17th = Saturday), as UTC."""
    return datetime(2026, 10, day, hour, minute, tzinfo=LA).astimezone(UTC)


def run(start: datetime, cells: int) -> set[datetime]:
    return {start + i * Q for i in range(cells)}


# ---- the grid (pure) ------------------------------------------------------------------

def test_window_starts_on_a_quarter_hour_an_hour_out_and_lasts_a_week():
    start, end = scheduling.new_window(datetime(2026, 10, 15, 16, 7, tzinfo=UTC))
    assert start == datetime(2026, 10, 15, 17, 15, tzinfo=UTC) and end - start == timedelta(days=7)


def test_grid_is_7am_to_10pm_in_the_viewers_own_zone():
    start, end = la(17, 0), la(18, 0)
    la_cells = scheduling.grid_cells(start, end, LA)
    assert la_cells[0] == la(17, 7) and la_cells[-1] == la(17, 21, 45) and len(la_cells) == 60
    nz_cells = scheduling.grid_cells(start, end, NZ)
    assert all(7 <= c.astimezone(NZ).hour < 22 for c in nz_cells) and set(nz_cells) != set(la_cells)


def test_prefill_leaves_out_busy_times():
    cells = scheduling.grid_cells(la(17, 0), la(18, 0), LA)
    free = scheduling.free_cells([(la(17, 9), la(17, 10, 5))], cells)
    assert la(17, 8, 45) in free and la(17, 9) not in free and la(17, 10) not in free and la(17, 10, 15) in free


def test_only_runs_where_everyone_is_free_for_the_whole_meeting_are_bookable():
    maya = run(la(17, 9), 8)  # 9:00-11:00
    jae = run(la(17, 9, 30), 8)  # 9:30-11:30
    kim = run(la(17, 9), 4) | run(la(17, 10, 15), 3)  # 9:00-10:00 and 10:15-11:00: busy 10:00-10:15
    end = la(24, 0)
    # Everyone: 9:30-10:00 and 10:15-11:00.
    assert scheduling.bookable([maya, jae, kim], end, 30) == [la(17, 9, 30), la(17, 10, 15), la(17, 10, 30)]
    assert scheduling.bookable([maya, jae, kim], end, 45) == [la(17, 10, 15)]
    assert scheduling.bookable([maya, jae, kim], end, 60) == []  # the gap breaks every hour-long run
    assert scheduling.bookable([maya, jae, None], end, 15) == []  # someone hasn't filled in yet


def test_ranking_prefers_sensible_hours_sooner_and_last_weeks_slot():
    now = la(15, 9)
    early, evening, later_good = la(17, 6, 30), la(17, 14), la(18, 14)
    # 6:30 AM in LA is outside 9-20 for the LA person; 2 PM LA is 10 AM NZ next day: fine for both.
    assert scheduling.rank([early, evening, later_good], [LA, NZ], now) == [evening, later_good, early]
    # Last time was a Sunday 2 PM slot: that weekday-and-hour wins over the sooner Saturday.
    assert scheduling.rank([evening, later_good], [LA, NZ], now, last=la(11, 14))[0] == later_good


def test_when_reads_like_a_person_wrote_it():
    assert scheduling.when(la(17, 10), LA) == "Saturday 17 October, 10:00 AM PDT"


# ---- with the database ------------------------------------------------------------------

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
THURSDAY = la(15, 9)


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


def decided(sessions, decision="30", status="decided"):
    with sessions.begin() as s:
        c = CheckIn(student_id="user_maya", week_start=date(2026, 10, 12), status="answered",
                    progress="Finished my essay draft.", blockers="It is too long.", confidence=2,
                    help_wanted="Essay review", answered_at=THURSDAY)
        s.add(c)
        s.flush()
        s.add(TriageDecision(student_id="user_maya", check_in_id=c.id, status=status,
                             decision=decision if status == "decided" else None,
                             reason="Essay due soon and confidence is low.", blockers="Essay over the word limit",
                             agenda=["Cut the introduction"] if decision != "NO_MEETING" else [], attempts=1))
    return c.id


def headers(bearer, who):
    return bearer(sub=who, metadata=MENTOR) if who != "user_maya" else bearer(sub=who, email="user_maya@example.com")


def mark(client, bearer, booking_id, who, slots):
    return client.put(f"/meetings/{booking_id}/availability", headers=headers(bearer, who),
                      json={"slots": [s.isoformat() for s in sorted(slots)]})


def test_a_meeting_decision_emails_the_team_and_opens_a_grid(sessions, mailer, calendar):
    with sessions.begin() as s:  # last week's check-in, to show what changed
        s.add(CheckIn(student_id="user_maya", week_start=date(2026, 10, 5), status="answered", progress="Outline",
                      blockers="", confidence=4, answered_at=THURSDAY - timedelta(days=7)))
    check_in = decided(sessions)
    booking = scheduling.after_triage(sessions, check_in, calendar, mailer, THURSDAY)
    assert (booking.status, booking.minutes, booking.starts_at) == ("collecting", 30, None)
    assert booking.window_end - booking.window_start == timedelta(days=7) and booking.window_start > THURSDAY

    jae = mailer.to("jae@gmail.com")[0]
    assert jae.subject == "Maya Lin: 30-minute meeting: mark when you're free"
    for line in ("Finished: Finished my essay draft.", "Missed: Physics IA draft",
                 "Confidence went from 4/5 to 2/5.", "Blockers: Essay over the word limit",
                 "Next deadline: Common App essay on 20 Oct", "Meeting: 30 minutes",
                 "Why: Essay due soon and confidence is low.", "Agenda: Cut the introduction",
                 "Mark your times", f"/app/meetings/{booking.id}"):
        assert line in jae.text, line
    assert mailer.to("user_maya@example.com")[0].subject == "When are you free to meet your mentors?"
    assert len(mailer.to("user_kim@example.com")) == 1

    assert scheduling.after_triage(sessions, check_in, calendar, mailer, THURSDAY) is None  # once per check-in
    assert len(mailer.sent) == 3


@pytest.mark.parametrize("decision, status, expected, headline", [
    ("NO_MEETING", "decided", "no_meeting", "no meeting needed this week"),
    (None, "needs_mentor", "needs_mentor", "needs your decision"),
])
def test_summary_only_decisions(sessions, mailer, calendar, decision, status, expected, headline):
    booking = scheduling.after_triage(sessions, decided(sessions, decision, status), calendar, mailer, THURSDAY)
    assert booking.status == expected and booking.window_start is None
    assert mailer.to("jae@gmail.com")[0].subject == f"Maya Lin: {headline}"
    assert mailer.to("user_maya@example.com") == []


def test_no_team_means_no_booking(sessions, mailer, calendar):
    with sessions.begin() as s:
        s.query(ConsultingMentor).delete()
    assert scheduling.after_triage(sessions, decided(sessions), calendar, mailer, THURSDAY) is None


def test_mark_times_then_a_mentor_books_a_green_slot(client, bearer, sessions, mailer, calendar):
    booking = scheduling.after_triage(sessions, decided(sessions), calendar, FakeMailer(), datetime.now(UTC))
    saturday = scheduling.grid_cells(booking.window_start, booking.window_end, LA)
    day = [c for c in saturday if c.astimezone(LA).weekday() == 5]
    first = day[8]  # some Saturday cell; the exact clock time doesn't matter

    # Jae's grid starts pre-filled from Google (busy times left out); nothing is saved yet.
    pre = client.get(f"/meetings/{booking.id}/availability", params={"timezone": "America/Los_Angeles"},
                     headers=headers(bearer, "user_jae")).json()
    assert pre["suggested"] is True and len(pre["mine"]) > 0 and pre["bookable"] == []
    # Kim hasn't connected Google: an empty grid to fill by hand.
    kim_pre = client.get(f"/meetings/{booking.id}/availability", headers=headers(bearer, "user_kim")).json()
    assert kim_pre == {"mine": [], "suggested": False, "cells": [], "bookable": [], "blocked": []}

    assert mark(client, bearer, booking.id, "user_maya", run(first, 4)).status_code == 200
    assert mark(client, bearer, booking.id, "user_jae", run(first, 3)).status_code == 200
    after = mark(client, bearer, booking.id, "user_kim", run(first + Q, 3)).json()  # last one in
    assert after["bookable"] == [(first + Q).isoformat().replace("+00:00", "Z")]
    counts = {c["start"]: len(c["free"]) for c in after["cells"]}
    assert counts[first.isoformat().replace("+00:00", "Z")] == 2  # partial: Maya and Jae
    ready = [e for e in mailer.sent if e.subject.startswith("Ready to book")]
    assert {e.to for e in ready} == {"jae@gmail.com", "user_kim@example.com"}  # mentors only, once

    meeting_get = client.get(f"/meetings/{booking.id}", headers=headers(bearer, "user_maya")).json()
    assert all(p["filledIn"] for p in meeting_get["people"])

    red = client.post(f"/meetings/{booking.id}/book", json={"startsAt": first.isoformat()},
                      headers=headers(bearer, "user_jae"))
    assert red.status_code == 409 and red.json()["detail"]["code"] == "not_green"
    student = client.post(f"/meetings/{booking.id}/book", json={"startsAt": (first + Q).isoformat()},
                          headers=headers(bearer, "user_maya"))
    assert student.status_code == 403

    booked = client.post(f"/meetings/{booking.id}/book", json={"startsAt": (first + Q).isoformat()},
                         headers=headers(bearer, "user_kim"))
    assert booked.status_code == 200, booked.text
    assert booked.json()["status"] == "confirmed"
    event = calendar.events[0]
    assert event["organizer"] == "user_jae"  # Kim isn't connected; Jae can host
    assert (event["start"], event["end"]) == (first + Q, first + Q + timedelta(minutes=30))
    assert event["attendees"] == ["jae@gmail.com", "user_kim@example.com", "user_maya@example.com"]
    assert {e.to for e in mailer.sent if e.subject.startswith("Booked")} == {
        "jae@gmail.com", "user_kim@example.com", "user_maya@example.com"}
    closed = mark(client, bearer, booking.id, "user_maya", run(first, 2))
    assert closed.status_code == 409


def test_times_must_be_cells_inside_the_window(client, bearer, sessions, calendar):
    booking = scheduling.after_triage(sessions, decided(sessions), calendar, FakeMailer(), datetime.now(UTC))
    for bad in (booking.window_start - Q, booking.window_end, booking.window_start + timedelta(minutes=7)):
        assert mark(client, bearer, booking.id, "user_maya", {bad}).status_code == 422


def test_a_google_failure_leaves_it_unbooked(client, bearer, sessions, mailer):
    booking = scheduling.after_triage(sessions, decided(sessions, "15"), FakeCalendar(), FakeMailer(),
                                      datetime.now(UTC))
    cell = booking.window_start + timedelta(days=1)
    for who in ("user_maya", "user_jae", "user_kim"):
        mark(client, bearer, booking.id, who, {cell})
    app.dependency_overrides[get_calendar] = lambda: FakeCalendar(fail=True)
    try:
        response = client.post(f"/meetings/{booking.id}/book", json={"startsAt": cell.isoformat()},
                               headers=headers(bearer, "user_jae"))
    finally:
        app.dependency_overrides.pop(get_calendar, None)
    assert response.status_code == 502
    with sessions() as s:
        assert s.get(Booking, booking.id).status == "collecting"


def test_strangers_cannot_see_it(client, bearer, sessions, calendar):
    booking = scheduling.after_triage(sessions, decided(sessions), calendar, FakeMailer(), THURSDAY)
    for path in (f"/meetings/{booking.id}", f"/meetings/{booking.id}/availability"):
        assert client.get(path, headers=headers(bearer, "user_ola")).status_code == 404


def test_a_reminder_goes_once_to_whoever_hasnt_marked_their_times(client, bearer, sessions, mailer, calendar):
    booking = scheduling.after_triage(sessions, decided(sessions), calendar, FakeMailer(), datetime.now(UTC))
    mark(client, bearer, booking.id, "user_jae", {booking.window_start})
    later = datetime.now(UTC) + timedelta(days=1, minutes=1)
    reminders = FakeMailer()
    assert scheduling.remind_unfilled(sessions, reminders, datetime.now(UTC)) == 0  # too soon
    assert scheduling.remind_unfilled(sessions, reminders, later) == 2  # Maya and Kim
    assert {e.to for e in reminders.sent} == {"user_maya@example.com", "user_kim@example.com"}
    assert scheduling.remind_unfilled(sessions, reminders, later + timedelta(hours=5)) == 0


def test_manual_request_opens_a_grid_for_everyone(client, bearer, sessions, mailer, calendar):
    with sessions.begin() as s:
        s.add(ConnectionRequest(student_id="user_maya", mentor_id="user_ola", purpose="Essay review",
                                message="Hello there", state="accepted"))
    maya = headers(bearer, "user_maya")
    people = client.get("/meetings/people", headers=maya).json()
    assert [p["name"] for p in people] == ["Jae Park", "Kim Ito", "Ola Berg"]

    made = client.post("/meetings", json={"peopleIds": ["user_jae", "user_ola"], "minutes": 45,
                                          "note": "Essay plan"}, headers=maya)
    assert made.status_code == 201, made.text
    meeting = made.json()
    assert (meeting["kind"], meeting["status"], meeting["minutes"]) == ("manual", "collecting", 45)
    assert sorted(p["id"] for p in meeting["people"]) == ["user_jae", "user_maya", "user_ola"]
    assert {e.subject for e in mailer.sent} == {"Maya Lin wants to meet"}
    assert {e.to for e in mailer.sent} == {"jae@gmail.com", "user_ola@example.com"}


def test_manual_request_rules(client, bearer, sessions, mailer, calendar):
    maya = headers(bearer, "user_maya")
    assert client.post("/meetings", json={"peopleIds": ["user_ola"], "minutes": 30}, headers=maya).status_code == 422
    assert client.post("/meetings", json={"peopleIds": ["user_jae"], "minutes": 20}, headers=maya).status_code == 422


def test_an_existing_dapup_meeting_is_never_green_again(client, bearer, sessions, mailer, calendar):
    first = scheduling.after_triage(sessions, decided(sessions, "15"), calendar, FakeMailer(), datetime.now(UTC))
    cell = first.window_start + timedelta(days=1)
    for who in ("user_maya", "user_jae", "user_kim"):
        mark(client, bearer, first.id, who, {cell, cell + Q})
    booked = client.post(f"/meetings/{first.id}/book", json={"startsAt": cell.isoformat()},
                         headers=headers(bearer, "user_jae"))
    assert booked.json()["status"] == "confirmed"

    with sessions.begin() as s:  # Ola is connected to Maya; Jae is in both meetings
        s.add(ConnectionRequest(student_id="user_maya", mentor_id="user_ola", purpose="Essay review",
                                message="Hello there", state="accepted"))
    second = client.post("/meetings", json={"peopleIds": ["user_jae"], "minutes": 15},
                         headers=headers(bearer, "user_maya")).json()
    for who in ("user_maya", "user_jae"):
        out = mark(client, bearer, second["id"], who, {cell, cell + Q}).json()
    assert out["blocked"] == [cell.isoformat().replace("+00:00", "Z")]  # Jae is already booked then
    assert out["bookable"] == [(cell + Q).isoformat().replace("+00:00", "Z")]
    clash = client.post(f"/meetings/{second['id']}/book", json={"startsAt": cell.isoformat()},
                        headers=headers(bearer, "user_jae"))
    assert clash.status_code == 409
