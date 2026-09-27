"""Clerk webhook: signature checks, and user.deleted wiping everything."""

import base64
import hashlib
import hmac
import json
import time

import pytest
from sqlalchemy import text

from app.webhooks import verify_svix
from tests.conftest import MENTOR

SECRET = "whsec_" + base64.b64encode(b"a-32-byte-test-signing-secret!!").decode()
TABLES = ("thread_reads", "messages", "message_threads", "connection_requests",
          "mentor_profiles", "student_profiles", "users")


pytestmark = pytest.mark.usefixtures("configured_database")


@pytest.fixture(autouse=True)
def secret(monkeypatch):
    monkeypatch.setenv("CLERK_WEBHOOK_SECRET", SECRET)


def signed(body: dict, secret: str = SECRET, msg_id: str = "msg_1", timestamp: int | None = None):
    raw = json.dumps(body).encode()
    ts = str(timestamp if timestamp is not None else int(time.time()))
    key = base64.b64decode(secret.removeprefix("whsec_"))
    sig = base64.b64encode(hmac.new(key, f"{msg_id}.{ts}.".encode() + raw, hashlib.sha256).digest()).decode()
    return raw, {"svix-id": msg_id, "svix-timestamp": ts, "svix-signature": f"v1,{sig}",
                 "Content-Type": "application/json"}


def deliver(client, body, **kwargs):
    raw, headers = signed(body, **kwargs)
    return client.post("/webhooks/clerk", content=raw, headers=headers)


def counts(db) -> dict[str, int]:
    return {t: db.execute(text(f"SELECT count(*) FROM {t}")).scalar_one() for t in TABLES}


def test_verify_svix_accepts_good_and_rejects_bad():
    raw, headers = signed({"type": "x"})
    assert verify_svix(SECRET, headers["svix-id"], headers["svix-timestamp"], headers["svix-signature"], raw)
    assert not verify_svix(SECRET, headers["svix-id"], headers["svix-timestamp"], headers["svix-signature"], raw + b" ")
    assert not verify_svix(SECRET, "msg_other", headers["svix-timestamp"], headers["svix-signature"], raw)
    other = "whsec_" + base64.b64encode(b"some-other-secret-of-32-bytes!!").decode()
    assert not verify_svix(other, headers["svix-id"], headers["svix-timestamp"], headers["svix-signature"], raw)
    # Rotation: several signatures in one header, any valid one passes.
    assert verify_svix(SECRET, headers["svix-id"], headers["svix-timestamp"],
                       "v1,bogus " + headers["svix-signature"], raw)


def test_rejections(client):
    body = {"type": "user.deleted", "data": {"id": "user_x", "deleted": True}}
    assert deliver(client, body, secret="whsec_" + base64.b64encode(b"wrong-secret-wrong-secret-wrong!").decode()).status_code == 401
    assert deliver(client, body, timestamp=int(time.time()) - 3600).status_code == 401
    raw, headers = signed(body)
    headers.pop("svix-signature")
    assert client.post("/webhooks/clerk", content=raw, headers=headers).status_code == 401
    assert client.post("/webhooks/clerk", json=body).status_code == 401


def test_placeholder_secret_rejects_instead_of_crashing(client, monkeypatch):
    monkeypatch.setenv("CLERK_WEBHOOK_SECRET", "whsec_placeholder-set-me-from-the-clerk-dashboard")
    assert deliver(client, {"type": "user.deleted", "data": {"id": "user_x"}}).status_code == 401


def test_unconfigured_answers_503(client, monkeypatch):
    monkeypatch.delenv("CLERK_WEBHOOK_SECRET")
    assert deliver(client, {"type": "user.deleted", "data": {"id": "user_x"}}).status_code == 503


def test_other_events_are_acknowledged_not_acted_on(client, bearer, db):
    client.put("/me/student-profile", json={"fullName": "Maya"}, headers=bearer(sub="user_maya"))
    response = deliver(client, {"type": "user.updated", "data": {"id": "user_maya"}})
    assert response.status_code == 200 and response.json() == {"handled": False}
    assert counts(db)["users"] == 1


def test_user_deleted_wipes_everything_they_touched(client, bearer, db, fake_storage):
    # A student with a picture sends a request; the mentor accepts; they chat.
    student, mentor = bearer(sub="user_maya"), bearer(sub="user_jae", metadata=MENTOR)
    client.put("/me/student-profile", headers=student,
               json={"fullName": "Maya Lin", "school": "Lincoln", "yearLevel": "12", "educationSystem": "AP"})
    client.put("/me/mentor-profile", headers=mentor, json={"name": "Jae Park"})
    key = client.post("/me/avatar/upload-url", headers=student,
                      json={"contentType": "image/png", "sizeBytes": 10}).json()["key"]
    fake_storage.put(key)
    client.put("/me/avatar", headers=student, json={"key": key})
    request_id = client.post("/connections", headers=student,
                             json={"mentorId": "user_jae", "purpose": "Essay review", "message": "Could you review my main essay before the deadline?"}).json()["id"]
    client.post(f"/connections/{request_id}/accept", headers=mentor)
    thread_id = client.get("/threads", headers=student).json()[0]["id"]
    client.post(f"/threads/{thread_id}/messages", headers=student, json={"text": "Hi!"})
    client.post(f"/threads/{thread_id}/read", headers=mentor)
    before = counts(db)
    assert before["users"] == 2 and before["messages"] == 1 and before["thread_reads"] >= 1

    response = deliver(client, {"type": "user.deleted", "data": {"id": "user_maya", "deleted": True}})
    assert response.status_code == 200 and response.json() == {"handled": True, "removed": True}

    after = counts(db)
    assert after == {"thread_reads": 0, "messages": 0, "message_threads": 0, "connection_requests": 0,
                     "mentor_profiles": 1, "student_profiles": 0, "users": 1}
    assert key in fake_storage.deleted
    # The mentor is untouched and still signed in.
    assert client.get("/me/mentor-profile", headers=mentor).status_code == 200

    # Delivered twice (Clerk retries): still 200, nothing left to remove.
    again = deliver(client, {"type": "user.deleted", "data": {"id": "user_maya"}}, msg_id="msg_2")
    assert again.status_code == 200 and again.json() == {"handled": True, "removed": False}
