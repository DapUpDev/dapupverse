"""Connection requests: the student → mentor lifecycle.

State machine (no rejected state, on purpose):

    pending  --accept (mentor)-->  accepted  --disconnect (either)-->  disconnected
       \\_________________ block (mentor) _________________/  -->  blocked

Rules the API enforces, matching src/lib/repositories/mock.ts:
- one active (pending or accepted) request per student/mentor pair
  (also a partial unique index in the database);
- a blocked pair can never create a new request;
- only a pending request can be accepted; only an accepted one disconnected;
- archiving is a mentor-side inbox flag and never touches the state;
- accepting creates the message thread, in the same transaction.

Errors carry a machine-readable `code` so the frontend can map them onto
its own error classes (DuplicateRequestError, BlockedPairError).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import Field
from sqlalchemy import exists, func, or_, select
from sqlalchemy.orm import Session

from app.auth import Principal, current_user
from app.db import get_session
from app.mentors import _Camel, require_mentor, upsert_user
from app.models import ConnectionRequest, MentorProfile, MessageThread, StudentProfile
from app.students import is_complete, require_student

router = APIRouter()

PURPOSES = ["Essay review", "Application advice", "Subject help", "General mentorship"]
ACTIVE_STATES = ("pending", "accepted")


class ConnectionOut(_Camel):
    id: str
    mentor_id: str
    student_id: str
    purpose: str
    message: str
    state: str
    archived_by_mentor: bool
    created_at: datetime
    updated_at: datetime


class CreateConnectionIn(_Camel):
    mentor_id: str = Field(max_length=64)
    purpose: str
    message: str = Field(min_length=20, max_length=600)


def to_out(row: ConnectionRequest) -> ConnectionOut:
    return ConnectionOut(id=str(row.id), mentor_id=row.mentor_id, student_id=row.student_id, purpose=row.purpose,
                         message=row.message, state=row.state, archived_by_mentor=row.archived_by_mentor,
                         created_at=row.created_at, updated_at=row.updated_at)


def _error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code, {"code": code, "message": message})


def _load(session: Session, connection_id: str) -> ConnectionRequest:
    try:
        key = uuid.UUID(connection_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Connection not found.") from None
    row = session.get(ConnectionRequest, key)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Connection not found.")
    return row


def _participant(row: ConnectionRequest, user: Principal) -> None:
    if user.user_id not in (row.mentor_id, row.student_id) and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed.")


def _mentor_of(row: ConnectionRequest, user: Principal) -> None:
    if user.user_id != row.mentor_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the mentor may do that.")


# ---- helpers used by other routers -------------------------------------------
def has_accepted_connection(session: Session, student_id: str, mentor_id: str) -> bool:
    return session.scalar(
        select(exists().where(ConnectionRequest.student_id == student_id, ConnectionRequest.mentor_id == mentor_id,
                              ConnectionRequest.state == "accepted"))
    ) or False


def has_any_request(session: Session, student_id: str, mentor_id: str) -> bool:
    return session.scalar(
        select(exists().where(ConnectionRequest.student_id == student_id, ConnectionRequest.mentor_id == mentor_id))
    ) or False


# ---- routes ------------------------------------------------------------------
@router.post("/connections", response_model=ConnectionOut, response_model_by_alias=True, status_code=201)
def create_request(
    body: CreateConnectionIn,
    user: Annotated[Principal, Depends(require_student)],
    session: Annotated[Session, Depends(get_session)],
) -> ConnectionOut:
    if body.purpose not in PURPOSES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, f"unknown purpose: {body.purpose}")
    upsert_user(session, user)
    profile = session.get(StudentProfile, user.user_id)
    if profile is None or not is_complete(profile):
        raise _error(status.HTTP_409_CONFLICT, "profile_incomplete", "Complete your profile before sending requests.")
    mentor = session.get(MentorProfile, body.mentor_id)
    if mentor is None or mentor.name == "":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mentor not found.")
    existing = session.execute(
        select(ConnectionRequest).where(ConnectionRequest.student_id == user.user_id,
                                        ConnectionRequest.mentor_id == body.mentor_id)
    ).scalars().all()
    if any(r.state == "blocked" for r in existing):
        raise _error(status.HTTP_403_FORBIDDEN, "blocked_pair", "A new request cannot be sent to this mentor.")
    if any(r.state in ACTIVE_STATES for r in existing):
        raise _error(status.HTTP_409_CONFLICT, "duplicate_request", "You already have an active request with this mentor.")
    row = ConnectionRequest(mentor_id=body.mentor_id, student_id=user.user_id, purpose=body.purpose,
                            message=body.message.strip(), state="pending")
    session.add(row)
    session.flush()
    session.refresh(row)
    return to_out(row)


@router.get("/connections", response_model=list[ConnectionOut], response_model_by_alias=True)
def list_mine(
    user: Annotated[Principal, Depends(current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> list[ConnectionOut]:
    """Every request the caller is a party to, on either side."""
    stmt = (
        select(ConnectionRequest)
        .where(or_(ConnectionRequest.student_id == user.user_id, ConnectionRequest.mentor_id == user.user_id))
        .order_by(ConnectionRequest.created_at.desc())
    )
    return [to_out(r) for r in session.execute(stmt).scalars()]


@router.get("/connections/active", response_model=ConnectionOut, response_model_by_alias=True)
def active_for_mentor(
    user: Annotated[Principal, Depends(require_student)],
    session: Annotated[Session, Depends(get_session)],
    mentor_id: str = Query(alias="mentorId", max_length=64),
) -> ConnectionOut:
    """The caller's pending or accepted request to one mentor, or 404."""
    row = session.execute(
        select(ConnectionRequest).where(ConnectionRequest.student_id == user.user_id,
                                        ConnectionRequest.mentor_id == mentor_id,
                                        ConnectionRequest.state.in_(ACTIVE_STATES))
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No active request.")
    return to_out(row)


@router.get("/connections/{connection_id}", response_model=ConnectionOut, response_model_by_alias=True)
def get_one(
    connection_id: str,
    user: Annotated[Principal, Depends(current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> ConnectionOut:
    row = _load(session, connection_id)
    _participant(row, user)
    return to_out(row)


@router.post("/connections/{connection_id}/accept", response_model=ConnectionOut, response_model_by_alias=True)
def accept(
    connection_id: str,
    user: Annotated[Principal, Depends(require_mentor)],
    session: Annotated[Session, Depends(get_session)],
) -> ConnectionOut:
    row = _load(session, connection_id)
    _mentor_of(row, user)
    if row.state != "pending":
        raise _error(status.HTTP_409_CONFLICT, "not_pending", "Only pending requests can be accepted.")
    row.state = "accepted"
    row.archived_by_mentor = False
    row.updated_at = func.now()
    session.add(MessageThread(connection_id=row.id, mentor_id=row.mentor_id, student_id=row.student_id))
    session.flush()
    session.refresh(row)
    return to_out(row)


def _set_archive(session: Session, connection_id: str, user: Principal, archived: bool) -> ConnectionOut:
    row = _load(session, connection_id)
    _mentor_of(row, user)
    row.archived_by_mentor = archived  # inbox tidying only; state untouched
    session.flush()
    session.refresh(row)
    return to_out(row)


@router.post("/connections/{connection_id}/archive", response_model=ConnectionOut, response_model_by_alias=True)
def archive(connection_id: str, user: Annotated[Principal, Depends(require_mentor)],
            session: Annotated[Session, Depends(get_session)]) -> ConnectionOut:
    return _set_archive(session, connection_id, user, True)


@router.post("/connections/{connection_id}/unarchive", response_model=ConnectionOut, response_model_by_alias=True)
def unarchive(connection_id: str, user: Annotated[Principal, Depends(require_mentor)],
              session: Annotated[Session, Depends(get_session)]) -> ConnectionOut:
    return _set_archive(session, connection_id, user, False)


@router.post("/connections/{connection_id}/disconnect", response_model=ConnectionOut, response_model_by_alias=True)
def disconnect(
    connection_id: str,
    user: Annotated[Principal, Depends(current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> ConnectionOut:
    row = _load(session, connection_id)
    _participant(row, user)
    if row.state != "accepted":
        raise _error(status.HTTP_409_CONFLICT, "not_accepted", "Only accepted connections can be disconnected.")
    row.state = "disconnected"
    row.updated_at = func.now()
    session.flush()
    session.refresh(row)
    return to_out(row)


@router.post("/connections/{connection_id}/block", response_model=ConnectionOut, response_model_by_alias=True)
def block(
    connection_id: str,
    user: Annotated[Principal, Depends(require_mentor)],
    session: Annotated[Session, Depends(get_session)],
) -> ConnectionOut:
    row = _load(session, connection_id)
    _mentor_of(row, user)
    row.state = "blocked"
    row.updated_at = func.now()
    session.flush()
    session.refresh(row)
    return to_out(row)
