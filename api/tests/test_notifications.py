"""Emails on request sent / accepted, plus the unread total for the badge."""

import boto3
import pytest
from botocore.stub import Stubber
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.db import get_engine
from app.main import app
from app.migrate import run_migrations
from app.notifications import Email, SesMailer, deliver, get_mailer
from tests.conftest import mint

MENTOR = {"accountType": "mentor"}
STUDENT_PROFILE = {"fullName": "Maya Lin", "school": "Lincoln High", "yearLevel": "Grade 12", "educationSystem": "AP"}
MENTOR_PROFILE = {"name": "Jae Park", "university": "Stanford", "major": "CS", "countryRegion": "US"}
MESSAGE = "I'm applying to CS programs this year and would love essay feedback."


class FakeMailer:
    def __init__(self) -> None:
        self.sent: list[Email] = []

    def send(self, email: Email) -> None:
        self.sent.append(email)


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
def mailer():
    fake = FakeMailer()
    app.dependency_overrides[get_mailer] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_mailer, None)


@pytest.fixture
def client():
    return TestClient(app)


def student(keys, email="maya@example.com"):
    private, _ = keys
    return {"Authorization": f"Bearer {mint(private, sub='user_maya', email=email)}"}


def mentor(keys, email="jae@example.com"):
    private, _ = keys
    return {"Authorization": f"Bearer {mint(private, sub='user_jae', metadata=MENTOR, email=email)}"}


def send_request(client, keys, **who):
    client.put("/me/student-profile", json=STUDENT_PROFILE, headers=student(keys))
    client.put("/me/mentor-profile", json=MENTOR_PROFILE, headers=mentor(keys, **who))
    return client.post("/connections", json={"mentorId": "user_jae", "purpose": "Essay review", "message": MESSAGE},
                       headers=student(keys))


def test_request_emails_the_mentor_and_acceptance_emails_the_student(client, keys, mailer):
    response = send_request(client, keys)
    assert response.status_code == 201, response.text
    assert len(mailer.sent) == 1
    first = mailer.sent[0]
    assert first.to == "jae@example.com"
    assert first.subject == "Maya Lin wants to connect with you on DapUp"
    assert "Essay review" in first.text and MESSAGE in first.text
    assert "https://www.dapup.space/app/requests" in first.text and "/app/requests" in first.html
    assert "<p>Hi Jae Park,</p>" in first.html

    accepted = client.post(f"/connections/{response.json()['id']}/accept", headers=mentor(keys))
    assert accepted.status_code == 200, accepted.text
    assert len(mailer.sent) == 2
    second = mailer.sent[1]
    assert second.to == "maya@example.com"
    assert second.subject == "Jae Park accepted your request on DapUp"
    assert "https://www.dapup.space/app/messages" in second.text


def test_no_address_means_no_email_and_no_failure(client, keys, mailer):
    # The mentor's token carries no email claim: nothing to send to.
    response = send_request(client, keys, email=None)
    assert response.status_code == 201
    assert mailer.sent == []


def test_unconfigured_mailer_changes_nothing(client, keys, monkeypatch):
    monkeypatch.delenv("EMAIL_FROM", raising=False)
    get_mailer.cache_clear()
    assert get_mailer() is None
    assert send_request(client, keys).status_code == 201


def test_html_escapes_what_the_student_typed(client, keys, mailer):
    client.put("/me/student-profile", json={**STUDENT_PROFILE, "fullName": "<b>Maya</b>"}, headers=student(keys))
    client.put("/me/mentor-profile", json=MENTOR_PROFILE, headers=mentor(keys))
    client.post("/connections", json={"mentorId": "user_jae", "purpose": "Essay review", "message": MESSAGE},
                headers=student(keys))
    assert "&lt;b&gt;Maya&lt;/b&gt;" in mailer.sent[0].html and "<b>Maya</b>" not in mailer.sent[0].html


def test_unread_total_across_conversations(client, keys):
    response = send_request(client, keys)
    client.post(f"/connections/{response.json()['id']}/accept", headers=mentor(keys))
    thread_id = client.get("/threads", headers=student(keys)).json()[0]["id"]
    assert client.get("/me/unread", headers=mentor(keys)).json() == {"count": 0}
    for text_ in ("hi", "are you there?", "one more"):
        client.post(f"/threads/{thread_id}/messages", json={"text": text_}, headers=student(keys))
    assert client.get("/me/unread", headers=mentor(keys)).json() == {"count": 3}
    assert client.get("/me/unread", headers=student(keys)).json() == {"count": 0}  # own messages
    client.post(f"/threads/{thread_id}/read", headers=mentor(keys))
    assert client.get("/me/unread", headers=mentor(keys)).json() == {"count": 0}
    assert client.get("/me/unread").status_code == 401


def test_ses_mailer_sends_one_simple_email_and_deliver_never_raises():
    client = boto3.client("sesv2", region_name="us-east-2", aws_access_key_id="AKIATEST", aws_secret_access_key="x")
    email = Email(to="jae@example.com", subject="Subject", text="plain", html="<p>plain</p>")
    with Stubber(client) as stub:
        stub.add_response("send_email", {"MessageId": "m-1"}, {
            "FromEmailAddress": "DapUp <no-reply@dapup.space>",
            "Destination": {"ToAddresses": ["jae@example.com"]},
            "Content": {"Simple": {
                "Subject": {"Data": "Subject", "Charset": "UTF-8"},
                "Body": {"Text": {"Data": "plain", "Charset": "UTF-8"}, "Html": {"Data": "<p>plain</p>", "Charset": "UTF-8"}},
            }},
        })
        SesMailer(sender="DapUp <no-reply@dapup.space>", region="us-east-2", client=client).send(email)
        stub.assert_no_pending_responses()
    with Stubber(client) as stub:
        # Sandbox-style rejection: logged, swallowed.
        stub.add_client_error("send_email", service_error_code="MessageRejected", http_status_code=400)
        deliver(SesMailer(sender="DapUp <no-reply@dapup.space>", region="us-east-2", client=client), email)
