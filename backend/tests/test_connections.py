"""The connection lifecycle through the API, against a real PostgreSQL."""

import pytest
from sqlalchemy import text

from tests.conftest import MENTOR, MENTOR_PROFILE, MESSAGE, STUDENT_PROFILE

pytestmark = pytest.mark.usefixtures("configured_database")

student = lambda bearer, sub="user_maya": bearer(sub=sub)  # noqa: E731
mentor = lambda bearer, sub="user_jae": bearer(sub=sub, metadata=MENTOR)  # noqa: E731


@pytest.fixture
def people(client, bearer):
    client.put("/me/student-profile", json=STUDENT_PROFILE, headers=student(bearer))
    client.put("/me/mentor-profile", json=MENTOR_PROFILE, headers=mentor(bearer))


def send(client, bearer, **overrides):
    body = {"mentorId": "user_jae", "purpose": "Essay review", "message": MESSAGE, **overrides}
    return client.post("/connections", json=body, headers=student(bearer))


def test_student_sends_a_request(client, bearer, people):
    response = send(client, bearer)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["state"] == "pending" and body["archivedByMentor"] is False
    assert body["mentorId"] == "user_jae" and body["studentId"] == "user_maya"
    assert [r["id"] for r in client.get("/connections", headers=student(bearer)).json()] == [body["id"]]
    assert [r["id"] for r in client.get("/connections", headers=mentor(bearer)).json()] == [body["id"]]


def test_incomplete_profile_cannot_send(client, bearer):
    client.put("/me/mentor-profile", json=MENTOR_PROFILE, headers=mentor(bearer))
    client.put("/me/student-profile", json={"fullName": "Maya"}, headers=student(bearer))
    response = send(client, bearer)
    assert response.status_code == 409 and response.json()["detail"]["code"] == "profile_incomplete"


def test_duplicate_active_request_is_refused(client, bearer, people):
    send(client, bearer)
    second = send(client, bearer)
    assert second.status_code == 409 and second.json()["detail"]["code"] == "duplicate_request"


def test_blocked_pair_cannot_request_again(client, bearer, people):
    rid = send(client, bearer).json()["id"]
    client.post(f"/connections/{rid}/accept", headers=mentor(bearer))
    client.post(f"/connections/{rid}/block", headers=mentor(bearer))
    again = send(client, bearer)
    assert again.status_code == 403 and again.json()["detail"]["code"] == "blocked_pair"


def test_mentors_cannot_send_and_students_cannot_accept(client, bearer, people):
    assert client.post("/connections", json={"mentorId": "user_jae", "purpose": "Essay review", "message": MESSAGE},
                       headers=mentor(bearer)).status_code == 403
    rid = send(client, bearer).json()["id"]
    assert client.post(f"/connections/{rid}/accept", headers=student(bearer)).status_code == 403


def test_only_the_addressed_mentor_may_accept(client, bearer, people):
    rid = send(client, bearer).json()["id"]
    assert client.post(f"/connections/{rid}/accept", headers=mentor(bearer, sub="user_other_mentor")).status_code == 403


def test_accept_creates_the_thread_and_unlocks_the_price(client, bearer, people, db):
    rid = send(client, bearer).json()["id"]
    before = client.get("/mentors/user_jae/private", headers=student(bearer))
    assert before.status_code == 403
    accepted = client.post(f"/connections/{rid}/accept", headers=mentor(bearer))
    assert accepted.status_code == 200 and accepted.json()["state"] == "accepted"
    threads = db.execute(text("SELECT connection_id::text FROM message_threads")).scalars().all()
    assert threads == [rid]
    after = client.get("/mentors/user_jae/private", headers=student(bearer))
    assert after.status_code == 200 and after.json()["privatePriceUsd"] == "40.00"
    assert client.post(f"/connections/{rid}/accept", headers=mentor(bearer)).status_code == 409  # not pending anymore


def test_active_lookup_for_a_mentor(client, bearer, people):
    assert client.get("/connections/active", params={"mentorId": "user_jae"}, headers=student(bearer)).status_code == 404
    rid = send(client, bearer).json()["id"]
    active = client.get("/connections/active", params={"mentorId": "user_jae"}, headers=student(bearer))
    assert active.status_code == 200 and active.json()["id"] == rid


def test_archive_is_invisible_to_the_student(client, bearer, people):
    rid = send(client, bearer).json()["id"]
    archived = client.post(f"/connections/{rid}/archive", headers=mentor(bearer)).json()
    assert archived["archivedByMentor"] is True and archived["state"] == "pending"
    assert client.get(f"/connections/{rid}", headers=student(bearer)).json()["state"] == "pending"
    assert client.post(f"/connections/{rid}/unarchive", headers=mentor(bearer)).json()["archivedByMentor"] is False
    assert client.post(f"/connections/{rid}/archive", headers=student(bearer)).status_code == 403


def test_disconnect_needs_an_accepted_connection_and_either_party_may(client, bearer, people):
    rid = send(client, bearer).json()["id"]
    assert client.post(f"/connections/{rid}/disconnect", headers=student(bearer)).status_code == 409
    client.post(f"/connections/{rid}/accept", headers=mentor(bearer))
    ended = client.post(f"/connections/{rid}/disconnect", headers=student(bearer))
    assert ended.status_code == 200 and ended.json()["state"] == "disconnected"
    # A new request is allowed after a disconnect (only blocked forbids it).
    assert send(client, bearer).status_code == 201


def test_outsiders_cannot_read_a_connection(client, bearer, people):
    rid = send(client, bearer).json()["id"]
    assert client.get(f"/connections/{rid}", headers=student(bearer, sub="user_stranger")).status_code == 403
    assert client.get(f"/connections/{rid}").status_code == 401
    assert client.get("/connections/not-a-uuid", headers=student(bearer)).status_code == 404


def test_mentor_may_view_a_requester_but_not_a_stranger(client, bearer, people):
    assert client.get("/students/user_maya/profile", headers=mentor(bearer)).status_code == 403
    send(client, bearer)
    assert client.get("/students/user_maya/profile", headers=mentor(bearer)).status_code == 200


def test_validation(client, bearer, people):
    assert send(client, bearer, purpose="Life coaching").status_code == 422
    assert send(client, bearer, message="hi").status_code == 422
    assert send(client, bearer, message="x" * 501).status_code == 422
    assert send(client, bearer, message="Help?").status_code == 201
    assert send(client, bearer, mentorId="user_nobody").status_code == 404
