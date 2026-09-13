"""Clerk webhooks: Clerk phoning us when something happens to an account.

Every other route is called by a browser holding a session token. This one
is called by Clerk's servers, which have no session, so the proof that the
call is genuine is a signature instead: Clerk signs each delivery with a
secret only Clerk and this API know (the Svix scheme: HMAC-SHA256 over
"<id>.<timestamp>.<body>"). A stale timestamp is refused too, so a
captured delivery cannot be replayed later.

Why it exists: the users table syncs itself on every API call, but a
person who deletes their Clerk account never calls again. Without this
hook their profile, requests, and messages would stay forever.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import time
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import MentorProfile, StudentProfile, User
from app import storage as object_storage

router = APIRouter()
log = logging.getLogger("dapup.webhooks")

TOLERANCE_SECONDS = 5 * 60


def verify_svix(secret: str, msg_id: str, timestamp: str, signature_header: str, body: bytes,
                now: float | None = None) -> bool:
    """True when one of the delivery's signatures matches and it is fresh."""
    try:
        sent_at = int(timestamp)
    except ValueError:
        return False
    if abs((now if now is not None else time.time()) - sent_at) > TOLERANCE_SECONDS:
        return False
    key = base64.b64decode(secret.removeprefix("whsec_"))
    signed = f"{msg_id}.{timestamp}.".encode() + body
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()
    # The header may carry several "v1,<sig>" entries (during a secret rotation).
    for entry in signature_header.split():
        version, _, candidate = entry.partition(",")
        if version == "v1" and hmac.compare_digest(candidate, expected):
            return True
    return False


async def verified_event(
    request: Request,
    svix_id: Annotated[str | None, Header(alias="svix-id")] = None,
    svix_timestamp: Annotated[str | None, Header(alias="svix-timestamp")] = None,
    svix_signature: Annotated[str | None, Header(alias="svix-signature")] = None,
) -> dict:
    secret = os.getenv("CLERK_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Webhooks are not configured.")
    body = await request.body()
    if not (svix_id and svix_timestamp and svix_signature) or not verify_svix(
        secret, svix_id, svix_timestamp, svix_signature, body
    ):
        log.warning("rejected webhook delivery %s", svix_id or "<no id>")
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid signature.")
    try:
        return json.loads(body)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Body is not JSON.") from exc


def delete_user_everywhere(session: Session, user_id: str) -> bool:
    """Remove the user row (the database cascades the rest) and their
    pictures. Returns False when there was nothing to remove."""
    keys = [
        key
        for key in session.execute(
            select(MentorProfile.avatar_key).where(MentorProfile.user_id == user_id)
        ).scalars()
        if key
    ] + [
        key
        for key in session.execute(
            select(StudentProfile.avatar_key).where(StudentProfile.user_id == user_id)
        ).scalars()
        if key
    ]
    removed = session.execute(delete(User).where(User.id == user_id)).rowcount
    # Looked up at call time (not imported by name) so tests can swap in a fake.
    storage = object_storage.get_storage()
    for key in keys:
        try:
            if storage:
                storage.delete(key)
        except Exception:  # noqa: BLE001 - an orphaned picture must not undo the deletion
            log.warning("could not delete picture %s for deleted user %s", key, user_id)
    return removed > 0


@router.post("/webhooks/clerk")
def clerk_webhook(
    event: Annotated[dict, Depends(verified_event)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, object]:
    kind = event.get("type")
    data = event.get("data") or {}
    if kind == "user.deleted":
        user_id = str(data.get("id") or "")
        removed = delete_user_everywhere(session, user_id) if user_id else False
        log.info("user.deleted %s -> %s", user_id, "removed" if removed else "nothing to remove")
        return {"handled": True, "removed": removed}
    # Anything else is acknowledged so Clerk does not retry it.
    log.info("ignored webhook event %s", kind)
    return {"handled": False}
