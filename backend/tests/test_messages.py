"""Messaging through the API, against a real PostgreSQL."""

import pytest

from tests.conftest import MENTOR, MENTOR_PROFILE, MESSAGE, STUDENT_PROFILE

pytestmark = pytest.mark.usefixtures("configured_database")

student = lambda bearer, sub="user_maya": bearer(sub=sub)  # noqa: E731
mentor = lambda bearer, sub="user_jae": bearer(sub=sub, metadata=MENTOR)  # noqa: E731


@pytest.fixture
def accepted(client, bearer):
    """A student/mentor pair with an accepted connection; returns the thread id."""
    client.put("/me/student-profile", json=STUDENT_PROFILE, headers=student(bearer))
    client.put("/me/mentor-profile", json=MENTOR_PROFILE, headers=mentor(bearer))
    rid = client.post("/connections", json={"mentorId": "user_jae", "purpose": "Essay review", "message": MESSAGE},
                      headers=student(bearer)).json()["id"]
    client.post(f"/connections/{rid}/accept", headers=mentor(bearer))
    threads = client.get("/threads", headers=student(bearer)).json()
    assert len(threads) == 1 and threads[0]["connectionId"] == rid
    return threads[0]["id"], rid


def test_no_threads_before_acceptance(client, bearer):
    client.put("/me/student-profile", json=STUDENT_PROFILE, headers=student(bearer))
    client.put("/me/mentor-profile", json=MENTOR_PROFILE, headers=mentor(bearer))
    client.post("/connections", json={"mentorId": "user_jae", "purpose": "Essay review", "message": MESSAGE},
                headers=student(bearer))
    assert client.get("/threads", headers=student(bearer)).json() == []


def test_send_list_and_unread(client, bearer, accepted):
    tid, _ = accepted
    sent = client.post(f"/threads/{tid}/messages", json={"text": "Hi Jae, thanks for accepting!"}, headers=student(bearer))
    assert sent.status_code == 201 and sent.json()["senderId"] == "user_maya"
    assert client.get(f"/threads/{tid}/unread", headers=mentor(bearer)).json() == {"count": 1}
    assert client.get(f"/threads/{tid}/unread", headers=student(bearer)).json() == {"count": 0}  # own message
    listed = client.get(f"/threads/{tid}/messages", headers=mentor(bearer)).json()
    assert [m["text"] for m in listed] == ["Hi Jae, thanks for accepting!"]
    assert client.post(f"/threads/{tid}/read", headers=mentor(bearer)).status_code == 204
    assert client.get(f"/threads/{tid}/unread", headers=mentor(bearer)).json() == {"count": 0}
    thread = client.get(f"/threads/{tid}", headers=mentor(bearer)).json()
    assert set(thread["lastReadAt"]) == {"user_maya", "user_jae"}


def test_both_participants_only(client, bearer, accepted):
    tid, _ = accepted
    assert client.get(f"/threads/{tid}/messages", headers=student(bearer, sub="user_stranger")).status_code == 403
    assert client.post(f"/threads/{tid}/messages", json={"text": "hi"}, headers=mentor(bearer, sub="user_other")).status_code == 403
    assert client.get(f"/threads/{tid}/messages").status_code == 401
    assert client.get("/threads/not-a-uuid", headers=student(bearer)).status_code == 404


def test_thread_goes_read_only_when_the_connection_ends(client, bearer, accepted):
    tid, rid = accepted
    client.post(f"/connections/{rid}/disconnect", headers=student(bearer))
    response = client.post(f"/threads/{tid}/messages", json={"text": "still there?"}, headers=student(bearer))
    assert response.status_code == 409 and response.json()["detail"]["code"] == "messaging_unavailable"
    # History stays readable.
    assert client.get(f"/threads/{tid}/messages", headers=mentor(bearer)).status_code == 200


def test_validation(client, bearer, accepted):
    tid, _ = accepted
    assert client.post(f"/threads/{tid}/messages", json={"text": ""}, headers=student(bearer)).status_code == 422
    assert client.post(f"/threads/{tid}/messages", json={"text": "x" * 5000}, headers=student(bearer)).status_code == 422
