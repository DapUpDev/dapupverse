"""The connection lifecycle through the API, against a real PostgreSQL."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.db import get_engine
from app.main import app
from app.migrate import run_migrations
from tests.conftest import mint

MENTOR = {"accountType": "mentor"}
STUDENT_PROFILE = {"fullName": "Maya Lin", "school": "Lincoln High", "yearLevel": "Grade 12", "educationSystem": "AP"}
MENTOR_PROFILE = {"name": "Jae Park", "university": "Stanford", "major": "CS", "countryRegion": "US", "privatePriceUsd": 40}
MESSAGE = "I'm applying to CS programs this year and would love essay feedback."


@pytest.fixture(autouse=True)
def configured_database(database_url, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_engine.cache_clear()
    run_migrations()
    yield
    engine = create_engine(database_url)
    with engine.begin() as connection:
        for table in ("message_threads", "connection_requests", "student_profiles", "mentor_profiles", "users"):
            connection.execute(text(f"DELETE FROM {table}"))
    engine.dispose()
    get_engine.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def student(keys, sub="user_maya"):
    private, _ = keys
    return {"Authorization": f"Bearer {mint(private, sub=sub)}"}


def mentor(keys, sub="user_jae"):
    private, _ = keys
    return {"Authorization": f"Bearer {mint(private, sub=sub, metadata=MENTOR)}"}


@pytest.fixture
def people(client, keys):
    client.put("/me/student-profile", json=STUDENT_PROFILE, headers=student(keys))
    client.put("/me/mentor-profile", json=MENTOR_PROFILE, headers=mentor(keys))


def send(client, keys, **overrides):
    body = {"mentorId": "user_jae", "purpose": "Essay review", "message": MESSAGE, **overrides}
    return client.post("/connections", json=body, headers=student(keys))


def test_student_sends_a_request(client, keys, people):
    response = send(client, keys)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["state"] == "pending" and body["archivedByMentor"] is False
    assert body["mentorId"] == "user_jae" and body["studentId"] == "user_maya"
    assert [r["id"] for r in client.get("/connections", headers=student(keys)).json()] == [body["id"]]
    assert [r["id"] for r in client.get("/connections", headers=mentor(keys)).json()] == [body["id"]]


def test_incomplete_profile_cannot_send(client, keys):
    client.put("/me/mentor-profile", json=MENTOR_PROFILE, headers=mentor(keys))
    client.put("/me/student-profile", json={"fullName": "Maya"}, headers=student(keys))
    response = send(client, keys)
    assert response.status_code == 409 and response.json()["detail"]["code"] == "profile_incomplete"


def test_duplicate_active_request_is_refused(client, keys, people):
    send(client, keys)
    second = send(client, keys)
    assert second.status_code == 409 and second.json()["detail"]["code"] == "duplicate_request"


def test_blocked_pair_cannot_request_again(client, keys, people):
    rid = send(client, keys).json()["id"]
    client.post(f"/connections/{rid}/accept", headers=mentor(keys))
    client.post(f"/connections/{rid}/block", headers=mentor(keys))
    again = send(client, keys)
    assert again.status_code == 403 and again.json()["detail"]["code"] == "blocked_pair"


def test_mentors_cannot_send_and_students_cannot_accept(client, keys, people):
    assert client.post("/connections", json={"mentorId": "user_jae", "purpose": "Essay review", "message": MESSAGE},
                       headers=mentor(keys)).status_code == 403
    rid = send(client, keys).json()["id"]
    assert client.post(f"/connections/{rid}/accept", headers=student(keys)).status_code == 403


def test_only_the_addressed_mentor_may_accept(client, keys, people):
    rid = send(client, keys).json()["id"]
    assert client.post(f"/connections/{rid}/accept", headers=mentor(keys, sub="user_other_mentor")).status_code == 403


def test_accept_creates_the_thread_and_unlocks_the_price(client, keys, people, database_url):
    rid = send(client, keys).json()["id"]
    before = client.get("/mentors/user_jae/private", headers=student(keys))
    assert before.status_code == 403
    accepted = client.post(f"/connections/{rid}/accept", headers=mentor(keys))
    assert accepted.status_code == 200 and accepted.json()["state"] == "accepted"
    engine = create_engine(database_url)
    with engine.connect() as connection:
        threads = connection.execute(text("SELECT connection_id::text FROM message_threads")).scalars().all()
    engine.dispose()
    assert threads == [rid]
    after = client.get("/mentors/user_jae/private", headers=student(keys))
    assert after.status_code == 200 and after.json()["privatePriceUsd"] == "40.00"
    assert client.post(f"/connections/{rid}/accept", headers=mentor(keys)).status_code == 409  # not pending anymore


def test_active_lookup_for_a_mentor(client, keys, people):
    assert client.get("/connections/active", params={"mentorId": "user_jae"}, headers=student(keys)).status_code == 404
    rid = send(client, keys).json()["id"]
    active = client.get("/connections/active", params={"mentorId": "user_jae"}, headers=student(keys))
    assert active.status_code == 200 and active.json()["id"] == rid


def test_archive_is_invisible_to_the_student(client, keys, people):
    rid = send(client, keys).json()["id"]
    archived = client.post(f"/connections/{rid}/archive", headers=mentor(keys)).json()
    assert archived["archivedByMentor"] is True and archived["state"] == "pending"
    assert client.get(f"/connections/{rid}", headers=student(keys)).json()["state"] == "pending"
    assert client.post(f"/connections/{rid}/unarchive", headers=mentor(keys)).json()["archivedByMentor"] is False
    assert client.post(f"/connections/{rid}/archive", headers=student(keys)).status_code == 403


def test_disconnect_needs_an_accepted_connection_and_either_party_may(client, keys, people):
    rid = send(client, keys).json()["id"]
    assert client.post(f"/connections/{rid}/disconnect", headers=student(keys)).status_code == 409
    client.post(f"/connections/{rid}/accept", headers=mentor(keys))
    ended = client.post(f"/connections/{rid}/disconnect", headers=student(keys))
    assert ended.status_code == 200 and ended.json()["state"] == "disconnected"
    # A new request is allowed after a disconnect (only blocked forbids it).
    assert send(client, keys).status_code == 201


def test_outsiders_cannot_read_a_connection(client, keys, people):
    rid = send(client, keys).json()["id"]
    assert client.get(f"/connections/{rid}", headers=student(keys, sub="user_stranger")).status_code == 403
    assert client.get(f"/connections/{rid}").status_code == 401
    assert client.get("/connections/not-a-uuid", headers=student(keys)).status_code == 404


def test_mentor_may_view_a_requester_but_not_a_stranger(client, keys, people):
    assert client.get("/students/user_maya/profile", headers=mentor(keys)).status_code == 403
    send(client, keys)
    assert client.get("/students/user_maya/profile", headers=mentor(keys)).status_code == 200


def test_validation(client, keys, people):
    assert send(client, keys, purpose="Life coaching").status_code == 422
    assert send(client, keys, message="too short").status_code == 422
    assert send(client, keys, mentorId="user_nobody").status_code == 404
