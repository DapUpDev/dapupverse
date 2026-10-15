"""Google Calendar: connect, read free/busy, create events.

Connecting (any signed-in student or mentor, from their profile page):
    POST /google/connect      -> {"url"}: the browser goes to Google's consent screen
    GET  /google/callback     <- Google sends the browser back with a code; we swap
                                 it for a refresh token, encrypt it, store it, and
                                 redirect to /app/profile?calendar=connected
    GET  /google/connection   -> {"available", "connected", "email"}
    DELETE /google/connection    forget (and revoke) it

Scopes are the narrowest that work: calendar.freebusy (see when someone is
busy, never what the event is) and calendar.events.owned (create the
meeting on the organiser's calendar; Google emails the invites), plus
openid/email to know which Google account was linked.

Refresh tokens are Fernet-encrypted with GOOGLE_TOKEN_KEY (Secrets
Manager) before they reach the database. Nothing here logs a token, a
code or a key. Unconfigured (no GOOGLE_* env) = get_calendar() is None and
every caller falls back to "nobody's calendar is connected".
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import time as clock
from dataclasses import dataclass
from datetime import datetime
from functools import lru_cache
from typing import Annotated, Protocol
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth import Principal, current_user
from app.db import get_session
from app.mentors import _Camel, upsert_user
from app.models import GoogleConnection, User
from app.notifications import app_url

log = logging.getLogger("dapup.google_calendar")

SCOPES = " ".join([
    "openid", "email",
    "https://www.googleapis.com/auth/calendar.freebusy",
    "https://www.googleapis.com/auth/calendar.events.owned",
])
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy"
EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events"
STATE_SECONDS = 15 * 60
TIMEOUT = 15

Busy = list[tuple[datetime, datetime]]


class CalendarError(RuntimeError):
    """Google refused or failed; the message never contains a token."""


class Calendar(Protocol):
    def busy(self, session: Session, user_ids: list[str], start: datetime, end: datetime) -> tuple[Busy, list[str]]:
        """Everyone's busy times merged, and the ids whose calendar could not be read."""
        ...

    def create_event(self, session: Session, organizer_id: str, start: datetime, end: datetime, summary: str,
                     description: str, attendees: list[str]) -> str | None: ...


@dataclass(frozen=True)
class GoogleConfig:
    client_id: str
    client_secret: str
    token_key: str
    redirect_uri: str


@lru_cache
def get_config() -> GoogleConfig | None:
    client_id, secret, key = (os.getenv(v) for v in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_TOKEN_KEY"))
    if not (client_id and secret and key):
        return None
    return GoogleConfig(client_id, secret, key,
                        os.getenv("GOOGLE_REDIRECT_URI", "https://api.dapup.space/google/callback"))


class GoogleCalendar:
    def __init__(self, config: GoogleConfig, client=None) -> None:
        import httpx
        from cryptography.fernet import Fernet

        self.config = config
        self.fernet = Fernet(config.token_key.encode())
        self.http = client or httpx.Client(timeout=TIMEOUT)

    # ---- connect ----------------------------------------------------------
    def _sign(self, payload: str) -> str:
        return hmac.new(self.config.token_key.encode(), payload.encode(), hashlib.sha256).hexdigest()[:32]

    def state_for(self, user_id: str, now: float | None = None) -> str:
        payload = f"{user_id}|{int((now or clock.time()) + STATE_SECONDS)}"
        return base64.urlsafe_b64encode(f"{payload}|{self._sign(payload)}".encode()).decode()

    def user_from_state(self, state: str, now: float | None = None) -> str | None:
        try:
            user_id, expires, signature = base64.urlsafe_b64decode(state.encode()).decode().rsplit("|", 2)
        except (ValueError, UnicodeDecodeError):
            return None
        if not hmac.compare_digest(signature, self._sign(f"{user_id}|{expires}")):
            return None
        return user_id if int(expires) >= (now or clock.time()) else None

    def auth_url(self, user_id: str) -> str:
        return AUTH_URL + "?" + urlencode({
            "client_id": self.config.client_id, "redirect_uri": self.config.redirect_uri,
            "response_type": "code", "scope": SCOPES, "access_type": "offline",
            "prompt": "consent", "include_granted_scopes": "true", "state": self.state_for(user_id),
        })

    def exchange(self, code: str) -> tuple[bytes, str]:
        """Code -> (encrypted refresh token, Google email)."""
        response = self.http.post(TOKEN_URL, data={
            "code": code, "client_id": self.config.client_id, "client_secret": self.config.client_secret,
            "redirect_uri": self.config.redirect_uri, "grant_type": "authorization_code",
        })
        if response.status_code != 200:
            raise CalendarError(f"Google token exchange answered HTTP {response.status_code}")
        data = response.json()
        refresh = data.get("refresh_token")
        if not refresh:
            raise CalendarError("Google did not return a refresh token")
        # The ID token came straight from Google's token endpoint over TLS, so
        # its payload can be read without re-verifying the signature (OIDC 3.1.3.7).
        payload = data.get("id_token", "..").split(".")[1]
        email = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4))).get("email", "")
        return self.fernet.encrypt(refresh.encode()), email

    def revoke(self, encrypted: bytes) -> None:
        try:
            self.http.post(REVOKE_URL, data={"token": self.fernet.decrypt(encrypted).decode()})
        except Exception as exc:  # noqa: BLE001 - forgetting the token is what matters
            log.warning("could not revoke a Google token: %s", type(exc).__name__)

    # ---- use --------------------------------------------------------------
    def _access_token(self, encrypted: bytes) -> str:
        response = self.http.post(TOKEN_URL, data={
            "client_id": self.config.client_id, "client_secret": self.config.client_secret,
            "refresh_token": self.fernet.decrypt(encrypted).decode(), "grant_type": "refresh_token",
        })
        if response.status_code != 200:
            raise CalendarError(f"Google token refresh answered HTTP {response.status_code}")
        return response.json()["access_token"]

    def _connections(self, session: Session, user_ids: list[str]) -> dict[str, GoogleConnection]:
        rows = session.scalars(select(GoogleConnection).where(GoogleConnection.user_id.in_(user_ids)))
        return {row.user_id: row for row in rows}

    def busy(self, session: Session, user_ids: list[str], start: datetime, end: datetime) -> tuple[Busy, list[str]]:
        connections = self._connections(session, user_ids)
        busy: Busy = []
        unread = [u for u in user_ids if u not in connections]
        for user_id, row in connections.items():
            try:
                response = self.http.post(
                    FREEBUSY_URL, headers={"Authorization": f"Bearer {self._access_token(row.refresh_token)}"},
                    json={"timeMin": start.isoformat(), "timeMax": end.isoformat(), "items": [{"id": "primary"}]},
                )
                if response.status_code != 200:
                    raise CalendarError(f"freeBusy answered HTTP {response.status_code}")
                for block in response.json()["calendars"]["primary"].get("busy", []):
                    busy.append((datetime.fromisoformat(block["start"]), datetime.fromisoformat(block["end"])))
            except Exception as exc:  # noqa: BLE001 - one unreadable calendar must not block the others
                log.warning("could not read %s's calendar: %s: %s", user_id, type(exc).__name__, exc)
                unread.append(user_id)
        return busy, unread

    def create_event(self, session: Session, organizer_id: str, start: datetime, end: datetime, summary: str,
                     description: str, attendees: list[str]) -> str | None:
        row = self._connections(session, [organizer_id]).get(organizer_id)
        if row is None:
            return None
        response = self.http.post(
            EVENTS_URL, params={"sendUpdates": "all"},
            headers={"Authorization": f"Bearer {self._access_token(row.refresh_token)}"},
            json={"summary": summary, "description": description,
                  "start": {"dateTime": start.isoformat()}, "end": {"dateTime": end.isoformat()},
                  "attendees": [{"email": e} for e in dict.fromkeys(attendees) if e]},
        )
        if response.status_code not in (200, 201):
            raise CalendarError(f"events.insert answered HTTP {response.status_code}")
        return response.json().get("id")


@lru_cache
def get_calendar() -> GoogleCalendar | None:
    config = get_config()
    return GoogleCalendar(config) if config else None


# ---- routes ----------------------------------------------------------------
router = APIRouter()
Db = Annotated[Session, Depends(get_session)]
Me = Annotated[Principal, Depends(current_user)]


class ConnectionOut(_Camel):
    available: bool
    connected: bool
    email: str | None


class ConnectOut(_Camel):
    url: str


def _calendar_or_503() -> GoogleCalendar:
    calendar = get_calendar()
    if calendar is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google Calendar is not set up yet.")
    return calendar


@router.get("/google/connection", response_model=ConnectionOut, response_model_by_alias=True)
def my_connection(user: Me, session: Db) -> ConnectionOut:
    row = session.get(GoogleConnection, user.user_id)
    return ConnectionOut(available=get_calendar() is not None, connected=row is not None,
                         email=row.google_email if row else None)


@router.post("/google/connect", response_model=ConnectOut, response_model_by_alias=True)
def connect(user: Me, session: Db) -> ConnectOut:
    upsert_user(session, user)  # the callback's insert needs the users row
    return ConnectOut(url=_calendar_or_503().auth_url(user.user_id))


@router.get("/google/callback", include_in_schema=False)
def callback(session: Db, state: str = "", code: str = "", error: str = "") -> RedirectResponse:
    """Google redirects the browser here; there is no bearer token, so the
    signed, expiring `state` is what says who this is."""
    calendar = _calendar_or_503()
    user_id = calendar.user_from_state(state)
    done = lambda outcome: RedirectResponse(app_url(f"/app/profile?calendar={outcome}"), status_code=302)  # noqa: E731
    if error or not code or user_id is None or session.get(User, user_id) is None:
        log.warning("calendar connect refused: %s", error or "bad or expired state")
        return done("error")
    try:
        encrypted, email = calendar.exchange(code)
    except CalendarError as exc:
        log.warning("calendar connect failed for %s: %s", user_id, exc)
        return done("error")
    session.execute(
        insert(GoogleConnection).values(user_id=user_id, google_email=email, refresh_token=encrypted)
        .on_conflict_do_update(index_elements=["user_id"],
                               set_={"google_email": email, "refresh_token": encrypted, "connected_at": func.now()})
    )
    log.info("calendar connected for %s", user_id)
    return done("connected")


@router.delete("/google/connection", status_code=204)
def disconnect(user: Me, session: Db) -> None:
    row = session.get(GoogleConnection, user.user_id)
    if row is None:
        return
    calendar = get_calendar()
    if calendar:
        calendar.revoke(row.refresh_token)
    session.delete(row)
