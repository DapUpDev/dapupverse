"""ORM models. The schema itself is owned by the Alembic migrations in
api/alembic/versions; these classes must match them, never replace them."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

import uuid

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Numeric, String, Text, func, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class AccountType(StrEnum):
    student = "student"
    mentor = "mentor"


class User(Base):
    """Mirror of a Clerk user. Clerk owns identity; this row lets every other
    table reference a user by foreign key and lets queries filter by role
    without calling Clerk. Admin is a capability column, never inferred from
    account_type (docs/authentication.md)."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # Clerk user id
    email: Mapped[str | None] = mapped_column(String(320), unique=True)
    account_type: Mapped[AccountType] = mapped_column(
        Enum(AccountType, name="account_type", values_callable=lambda e: [m.value for m in e]),
        default=AccountType.student,
    )
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MentorProfile(Base):
    """One per mentor account. An empty name means "not filled in yet" and
    keeps the profile out of the public directory. The price is private:
    only app/mentors.py's private shape ever serialises it."""

    __tablename__ = "mentor_profiles"

    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(120), default="")
    university: Mapped[str] = mapped_column(String(200), default="")
    major: Mapped[str] = mapped_column(String(200), default="")
    country_region: Mapped[str] = mapped_column(String(120), default="")
    biography: Mapped[str] = mapped_column(Text, default="")
    services: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    subjects: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    education_systems: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    private_price_usd: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=Decimal(0))
    avatar_key: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class StudentProfile(Base):
    """One per student account. Never public; mentors see it attached to
    the requests a student sends them."""

    __tablename__ = "student_profiles"

    user_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(120), default="")
    school: Mapped[str] = mapped_column(String(200), default="")
    year_level: Mapped[str] = mapped_column(String(60), default="")
    education_system: Mapped[str | None] = mapped_column(String(20))
    subjects: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    biography: Mapped[str] = mapped_column(Text, default="")
    avatar_key: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ConnectionRequest(Base):
    """A student's request to a mentor and, once accepted, the connection
    itself: same row, narrowed state. Lifecycle rules live in app/connections.py."""

    __tablename__ = "connection_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    mentor_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"))
    student_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"))
    purpose: Mapped[str] = mapped_column(String(40))
    message: Mapped[str] = mapped_column(Text)
    state: Mapped[str] = mapped_column(String(20), default="pending")
    archived_by_mentor: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class MessageThread(Base):
    """Exists only for an accepted connection; created in the same
    transaction as the accept."""

    __tablename__ = "message_threads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("connection_requests.id", ondelete="CASCADE"), unique=True
    )
    mentor_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"))
    student_id: Mapped[str] = mapped_column(String(64), ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
