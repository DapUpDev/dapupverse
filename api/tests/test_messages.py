"""Messaging through the API, against a real PostgreSQL."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.db import get_engine
from app.main import app
from app.migrate import run_migrations
from tests.conftest import mint

MENTOR = {"accountType": "mentor"}
STUDENT_PROFILE = {"fullName": "Maya Lin", "school": "Lincoln High", "yearLevel": "Grade 12", "educationSystem": "AP"}
MENTOR_PROFILE = {"name": "Jae Park", "university": "Stanford", "major": "CS", "countryRegion": "US"}
MESSAGE = "I'm applying to CS programs this year and would love essay feedback."


@pytest.fixture(autouse=True)
def configured_database(database_url, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_engine.cache_clear()
    run_migrations()
    yield
    engine = create_engine(database_url)
    with engine.begin() as connection:
        for table in ("thread_reads", "messages", "message_threads", "connection_requests",
                      "student_profiles", "mentor_profiles", "users"):
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
def accepted(client, keys):
    """A student/mentor pair with an accepted connection; returns the thread id."""
    client.put("/me/student-profile", json=STUDENT_PROFILE, headers=student(keys))
    client.put("/me/mentor-profile", json=MENTOR_PROFILE, headers=mentor(keys))
    rid = client.post("/connections", json={"mentorId": "user_jae", "purpose": "Essay review", "message": MESSAGE},
                      headers=student(keys)).json()["id"]
    client.post(f"/connections/{rid}/accept", headers=mentor(keys))
    threads = client.get("/threads", headers=student(keys)).json()
    assert len(threads) == 1 and threads[0]["connectionId"] == rid
    return threads[0]["id"], rid


def test_no_threads_before_acceptance(client, keys):
    client.put("/me/student-profile", json=STUDENT_PROFILE, headers=student(keys))
    client.put("/me/mentor-profile", json=MENTOR_PROFILE, headers=mentor(keys))
    client.post("/connections", json={"mentorId": "user_jae", "purpose": "Essay review", "message": MESSAGE},
                headers=student(keys))
    assert client.get("/threads", headers=student(keys)).json() == []


def test_send_list_and_unread(client, keys, accepted):
    tid, _ = accepted
    sent = client.post(f"/threads/{tid}/messages", json={"text": "Hi Jae, thanks for accepting!"}, headers=student(keys))
    assert sent.status_code == 201 and sent.json()["senderId"] == "user_maya"
    assert client.get(f"/threads/{tid}/unread", headers=mentor(keys)).json() == {"count": 1}
    assert client.get(f"/threads/{tid}/unread", headers=student(keys)).json() == {"count": 0}  # own message
    listed = client.get(f"/threads/{tid}/messages", headers=mentor(keys)).json()
    assert [m["text"] for m in listed] == ["Hi Jae, thanks for accepting!"]
    assert client.post(f"/threads/{tid}/read", headers=mentor(keys)).status_code == 204
    assert client.get(f"/threads/{tid}/unread", headers=mentor(keys)).json() == {"count": 0}
    thread = client.get(f"/threads/{tid}", headers=mentor(keys)).json()
    assert set(thread["lastReadAt"]) == {"user_maya", "user_jae"}


def test_both_participants_only(client, keys, accepted):
    tid, _ = accepted
    assert client.get(f"/threads/{tid}/messages", headers=student(keys, sub="user_stranger")).status_code == 403
    assert client.post(f"/threads/{tid}/messages", json={"text": "hi"}, headers=mentor(keys, sub="user_other")).status_code == 403
    assert client.get(f"/threads/{tid}/messages").status_code == 401
    assert client.get("/threads/not-a-uuid", headers=student(keys)).status_code == 404


def test_thread_goes_read_only_when_the_connection_ends(client, keys, accepted):
    tid, rid = accepted
    client.post(f"/connections/{rid}/disconnect", headers=student(keys))
    response = client.post(f"/threads/{tid}/messages", json={"text": "still there?"}, headers=student(keys))
    assert response.status_code == 409 and response.json()["detail"]["code"] == "messaging_unavailable"
    # History stays readable.
    assert client.get(f"/threads/{tid}/messages", headers=mentor(keys)).status_code == 200


def test_validation(client, keys, accepted):
    tid, _ = accepted
    assert client.post(f"/threads/{tid}/messages", json={"text": ""}, headers=student(keys)).status_code == 422
    assert client.post(f"/threads/{tid}/messages", json={"text": "x" * 5000}, headers=student(keys)).status_code == 422
