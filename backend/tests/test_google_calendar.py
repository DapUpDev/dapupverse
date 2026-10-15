"""Google Calendar over a fake HTTP transport: no network, no real Google."""

import base64
import json
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlparse

import httpx
import pytest
from cryptography.fernet import Fernet
from sqlalchemy.orm import sessionmaker

from app import google_calendar as gc
from app.db import get_engine
from app.main import app
from app.models import AccountType, GoogleConnection, User

KEY = Fernet.generate_key().decode()
CONFIG = gc.GoogleConfig("client-123", "secret-456", KEY, "https://api.test/google/callback")


def id_token(email):
    payload = base64.urlsafe_b64encode(json.dumps({"email": email}).encode()).decode().rstrip("=")
    return f"h.{payload}.s"


class Google:
    """Records requests; answers like Google would."""

    def __init__(self):
        self.requests = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        body = parse_qs(request.content.decode()) if request.headers.get("content-type", "").startswith(
            "application/x-www-form") else {}
        if request.url.path == "/token" and body.get("grant_type") == ["authorization_code"]:
            if body["code"] != ["good-code"]:
                return httpx.Response(400)
            return httpx.Response(200, json={"refresh_token": "refresh-789", "access_token": "a",
                                             "id_token": id_token("maya@gmail.com")})
        if request.url.path == "/token":
            assert body["refresh_token"] == ["refresh-789"]
            return httpx.Response(200, json={"access_token": "access-1"})
        if request.url.path == "/calendar/v3/freeBusy":
            assert request.headers["authorization"] == "Bearer access-1"
            return httpx.Response(200, json={"calendars": {"primary": {"busy": [
                {"start": "2026-10-17T16:00:00Z", "end": "2026-10-17T17:00:00Z"}]}}})
        if request.url.path == "/calendar/v3/calendars/primary/events":
            return httpx.Response(200, json={"id": "evt_42"})
        if request.url.path == "/revoke":
            return httpx.Response(200)
        return httpx.Response(404)


@pytest.fixture
def google():
    return Google()


@pytest.fixture
def calendar(google):
    return gc.GoogleCalendar(CONFIG, client=httpx.Client(transport=httpx.MockTransport(google)))


def test_state_is_signed_and_expires(calendar):
    state = calendar.state_for("user_maya", now=1_000)
    assert calendar.user_from_state(state, now=1_000) == "user_maya"
    assert calendar.user_from_state(state, now=1_000 + gc.STATE_SECONDS + 1) is None
    forged = base64.urlsafe_b64encode(b"user_admin|9999999999|00000000000000000000000000000000").decode()
    assert calendar.user_from_state(forged) is None
    assert calendar.user_from_state("garbage") is None


def test_consent_url_asks_for_the_narrow_scopes(calendar):
    query = parse_qs(urlparse(calendar.auth_url("user_maya")).query)
    assert query["scope"] == [gc.SCOPES] and query["access_type"] == ["offline"]
    assert "calendar.freebusy" in gc.SCOPES and "calendar.events.owned" in gc.SCOPES
    assert "auth/calendar " not in gc.SCOPES + " "  # never the full calendar scope


def test_exchange_encrypts_the_refresh_token(calendar):
    encrypted, email = calendar.exchange("good-code")
    assert email == "maya@gmail.com"
    assert b"refresh-789" not in encrypted
    assert Fernet(KEY.encode()).decrypt(encrypted) == b"refresh-789"
    with pytest.raises(gc.CalendarError, match="HTTP 400") as error:
        calendar.exchange("bad-code")
    assert "secret" not in str(error.value)


@pytest.mark.usefixtures("configured_database")
class TestWithDatabase:
    @pytest.fixture
    def session(self, calendar):
        factory = sessionmaker(bind=get_engine(), expire_on_commit=False)
        encrypted, _ = calendar.exchange("good-code")
        with factory.begin() as s:
            s.add_all([User(id="user_maya", email="maya@example.com", account_type=AccountType.student),
                       User(id="user_jae", email="jae@example.com", account_type=AccountType.mentor)])
            s.flush()
            s.add(GoogleConnection(user_id="user_maya", google_email="maya@gmail.com", refresh_token=encrypted))
        with factory() as s:
            yield s

    def test_busy_reads_connected_calendars_and_names_the_rest(self, calendar, session):
        busy, unread = calendar.busy(session, ["user_maya", "user_jae"], datetime(2026, 10, 17, tzinfo=UTC),
                                     datetime(2026, 10, 18, tzinfo=UTC))
        assert busy == [(datetime(2026, 10, 17, 16, tzinfo=UTC), datetime(2026, 10, 17, 17, tzinfo=UTC))]
        assert unread == ["user_jae"]

    def test_create_event_invites_everyone(self, calendar, google, session):
        event = calendar.create_event(session, "user_maya", datetime(2026, 10, 17, 17, tzinfo=UTC),
                                      datetime(2026, 10, 17, 17, 30, tzinfo=UTC), "DapUp", "Agenda",
                                      ["maya@gmail.com", "jae@example.com", "jae@example.com"])
        assert event == "evt_42"
        sent = google.requests[-1]
        assert sent.url.params["sendUpdates"] == "all"
        assert json.loads(sent.content)["attendees"] == [{"email": "maya@gmail.com"}, {"email": "jae@example.com"}]
        assert calendar.create_event(session, "user_jae", datetime.now(UTC), datetime.now(UTC), "x", "", []) is None


@pytest.mark.usefixtures("configured_database")
class TestRoutes:
    @pytest.fixture(autouse=True)
    def wired(self, calendar):
        gc.get_calendar.cache_clear()
        original = gc.get_calendar
        gc.get_calendar = lambda: calendar  # the callback and status routes call it directly
        app.dependency_overrides[original] = lambda: calendar
        yield
        gc.get_calendar = original
        app.dependency_overrides.pop(original, None)

    def test_connect_then_callback_then_disconnect(self, client, bearer, calendar, google):
        maya = bearer(sub="user_maya", email="maya@example.com")
        assert client.get("/google/connection", headers=maya).json() == {
            "available": True, "connected": False, "email": None}
        url = client.post("/google/connect", headers=maya).json()["url"]
        state = parse_qs(urlparse(url).query)["state"][0]

        back = client.get("/google/callback", params={"state": state, "code": "good-code"}, follow_redirects=False)
        assert back.status_code == 302 and back.headers["location"].endswith("/app/profile?calendar=connected")
        assert client.get("/google/connection", headers=maya).json()["email"] == "maya@gmail.com"

        assert client.delete("/google/connection", headers=maya).status_code == 204
        assert google.requests[-1].url.path == "/revoke"
        assert client.get("/google/connection", headers=maya).json()["connected"] is False

    @pytest.mark.parametrize("params", [{"state": "forged", "code": "good-code"}, {"error": "access_denied"}])
    def test_bad_callbacks_go_back_with_an_error(self, client, params):
        back = client.get("/google/callback", params=params, follow_redirects=False)
        assert back.headers["location"].endswith("/app/profile?calendar=error")
