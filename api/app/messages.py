"""Messaging: threads exist only for accepted connections (created by the
accept), and a thread becomes read-only the moment its connection is no
longer accepted. Only the two participants can see a thread at all."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field
from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth import Principal, current_user
from app.db import get_session
from app.mentors import _Camel, upsert_user
from app.models import ConnectionRequest, Message, MessageThread, ThreadRead

router = APIRouter()


class ThreadOut(_Camel):
    id: str
    connection_id: str
    mentor_id: str
    student_id: str
    # Keyed by user id, ISO timestamps: the shape the frontend already uses.
    last_read_at: dict[str, datetime]


class MessageOut(_Camel):
    id: str
    thread_id: str
    sender_id: str
    text: str
    sent_at: datetime


class SendMessageIn(_Camel):
    text: str = Field(min_length=1, max_length=4000)


class UnreadOut(_Camel):
    count: int


def _load_thread(session: Session, thread_id: str, user: Principal) -> MessageThread:
    try:
        key = uuid.UUID(thread_id)
    except ValueError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.") from None
    thread = session.get(MessageThread, key)
    if thread is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found.")
    if user.user_id not in (thread.mentor_id, thread.student_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed.")
    return thread


def _thread_out(session: Session, thread: MessageThread) -> ThreadOut:
    reads = session.execute(select(ThreadRead).where(ThreadRead.thread_id == thread.id)).scalars()
    return ThreadOut(id=str(thread.id), connection_id=str(thread.connection_id), mentor_id=thread.mentor_id,
                     student_id=thread.student_id, last_read_at={r.user_id: r.last_read_at for r in reads})


def _message_out(row: Message) -> MessageOut:
    return MessageOut(id=str(row.id), thread_id=str(row.thread_id), sender_id=row.sender_id, text=row.text,
                      sent_at=row.sent_at)


def _mark_read(session: Session, thread: MessageThread, user_id: str) -> None:
    statement = (
        insert(ThreadRead)
        .values(thread_id=thread.id, user_id=user_id, last_read_at=func.now())
        .on_conflict_do_update(index_elements=[ThreadRead.thread_id, ThreadRead.user_id],
                               set_={"last_read_at": func.now()})
    )
    session.execute(statement)


@router.get("/threads", response_model=list[ThreadOut], response_model_by_alias=True)
def list_threads(
    user: Annotated[Principal, Depends(current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> list[ThreadOut]:
    stmt = (
        select(MessageThread)
        .where(or_(MessageThread.mentor_id == user.user_id, MessageThread.student_id == user.user_id))
        .order_by(MessageThread.created_at.desc())
    )
    return [_thread_out(session, t) for t in session.execute(stmt).scalars()]


@router.get("/threads/{thread_id}", response_model=ThreadOut, response_model_by_alias=True)
def get_thread(thread_id: str, user: Annotated[Principal, Depends(current_user)],
               session: Annotated[Session, Depends(get_session)]) -> ThreadOut:
    return _thread_out(session, _load_thread(session, thread_id, user))


@router.get("/threads/{thread_id}/messages", response_model=list[MessageOut], response_model_by_alias=True)
def list_messages(thread_id: str, user: Annotated[Principal, Depends(current_user)],
                  session: Annotated[Session, Depends(get_session)]) -> list[MessageOut]:
    thread = _load_thread(session, thread_id, user)
    stmt = select(Message).where(Message.thread_id == thread.id).order_by(Message.sent_at, Message.id)
    return [_message_out(m) for m in session.execute(stmt).scalars()]


@router.post("/threads/{thread_id}/messages", response_model=MessageOut, response_model_by_alias=True, status_code=201)
def send_message(
    thread_id: str,
    body: SendMessageIn,
    user: Annotated[Principal, Depends(current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> MessageOut:
    thread = _load_thread(session, thread_id, user)
    connection = session.get(ConnectionRequest, thread.connection_id)
    if connection is None or connection.state != "accepted":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {"code": "messaging_unavailable",
             "message": "This conversation is read-only because the connection has ended."},
        )
    upsert_user(session, user)
    message = Message(thread_id=thread.id, sender_id=user.user_id, text=body.text.strip())
    session.add(message)
    session.flush()
    _mark_read(session, thread, user.user_id)  # sending implies having read up to now
    session.refresh(message)
    return _message_out(message)


@router.post("/threads/{thread_id}/read", status_code=204)
def mark_read(thread_id: str, user: Annotated[Principal, Depends(current_user)],
              session: Annotated[Session, Depends(get_session)]) -> None:
    thread = _load_thread(session, thread_id, user)
    _mark_read(session, thread, user.user_id)


@router.get("/threads/{thread_id}/unread", response_model=UnreadOut, response_model_by_alias=True)
def unread_count(thread_id: str, user: Annotated[Principal, Depends(current_user)],
                 session: Annotated[Session, Depends(get_session)]) -> UnreadOut:
    thread = _load_thread(session, thread_id, user)
    last_read = session.get(ThreadRead, (thread.id, user.user_id))
    stmt = select(func.count()).select_from(Message).where(Message.thread_id == thread.id,
                                                            Message.sender_id != user.user_id)
    if last_read is not None:
        stmt = stmt.where(Message.sent_at > last_read.last_read_at)
    return UnreadOut(count=session.scalar(stmt) or 0)
