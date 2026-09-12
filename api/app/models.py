"""ORM models. The schema itself is owned by the Alembic migrations in
api/alembic/versions; these classes must match them, never replace them."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, Enum, String, func
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
