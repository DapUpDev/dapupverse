"""The check-in page's API: read your own check-in, answer it once."""

from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy.orm import sessionmaker

from app import jobs
from app.db import get_engine
from app.models import AccountType, CheckIn, User
from tests.conftest import MENTOR

pytestmark = pytest.mark.usefixtures("configured_database")

ANSWER = {"progress": "Finished my essay draft.", "blockers": "It is too long.", "confidence": 2,
          "helpWanted": "Essay review."}


@pytest.fixture
def queued(monkeypatch):
    sent = []
    monkeypatch.setattr(jobs, "enqueue", lambda job: sent.append(job) or True)
    return sent


@pytest.fixture
def make_check_in():
    factory = sessionmaker(bind=get_engine(), expire_on_commit=False)
    with factory.begin() as s:
        s.add_all([User(id=sid, email=f"{sid}@example.com", account_type=AccountType.student)
                   for sid in ("user_maya", "user_leo")])

    weeks = iter(range(52))

    def make(student_id="user_maya", sent_at=None, status="sent"):
        with factory.begin() as s:  # one check-in per student per week: each call gets its own week
            row = CheckIn(student_id=student_id, week_start=date(2026, 1, 5) + timedelta(weeks=next(weeks)), status=status,
                          sent_at=sent_at or datetime.now(UTC))
            s.add(row)
        return str(row.id)

    return make


maya = lambda bearer: bearer(sub="user_maya", email="user_maya@example.com")  # noqa: E731


def test_a_student_answers_their_check_in_once(client, bearer, make_check_in, queued, fake_storage):
    check_in_id = make_check_in()
    got = client.get(f"/me/check-ins/{check_in_id}", headers=maya(bearer))
    assert got.status_code == 200, got.text
    assert got.json()["status"] == "sent" and got.json()["progress"] == ""

    answered = client.put(f"/me/check-ins/{check_in_id}", json=ANSWER, headers=maya(bearer))
    assert answered.status_code == 200, answered.text
    body = answered.json()
    assert (body["status"], body["confidence"], body["helpWanted"]) == ("answered", 2, "Essay review.")
    assert body["answeredAt"]

    assert queued == [
        {"job": "triage", "student_id": "user_maya", "check_in_id": check_in_id},
        {"job": "ingest-history", "source": "check-in"},
    ]
    key = f"history/user_maya/check-in/{check_in_id}.md"
    assert "What I got done: Finished my essay draft." in fake_storage.get_text(key)
    assert "Confidence about my next deadline: 2/5" in fake_storage.get_text(key)

    again = client.put(f"/me/check-ins/{check_in_id}", json=ANSWER, headers=maya(bearer))
    assert again.status_code == 409 and again.json()["detail"]["code"] == "already_answered"
    assert len(queued) == 2


def test_closed_check_ins_cannot_be_answered(client, bearer, make_check_in, queued):
    late = make_check_in(sent_at=datetime.now(UTC) - timedelta(days=6))
    expired = make_check_in(status="expired")
    for check_in_id in (late, expired):
        response = client.put(f"/me/check-ins/{check_in_id}", json=ANSWER, headers=maya(bearer))
        assert response.status_code == 409 and response.json()["detail"]["code"] == "closed"
    assert queued == []


def test_only_the_owner_can_see_or_answer_it(client, bearer, make_check_in, queued):
    leos = make_check_in(student_id="user_leo")
    assert client.get(f"/me/check-ins/{leos}", headers=maya(bearer)).status_code == 404
    assert client.put(f"/me/check-ins/{leos}", json=ANSWER, headers=maya(bearer)).status_code == 404
    assert client.get("/me/check-ins/not-a-uuid", headers=maya(bearer)).status_code == 404
    mentor = bearer(sub="user_jae", metadata=MENTOR)
    assert client.get(f"/me/check-ins/{leos}", headers=mentor).status_code == 403
    assert client.get(f"/me/check-ins/{leos}").status_code == 401
    assert queued == []


@pytest.mark.parametrize("change", [{"progress": "  "}, {"confidence": 6}, {"confidence": 0}, {"blockers": "x" * 2001}])
def test_answers_are_validated(client, bearer, make_check_in, queued, change):
    check_in_id = make_check_in()
    response = client.put(f"/me/check-ins/{check_in_id}", json={**ANSWER, **change}, headers=maya(bearer))
    assert response.status_code == 422
    assert queued == []
