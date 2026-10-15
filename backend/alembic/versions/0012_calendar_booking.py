"""Google Calendar connections, meeting hours, and bookings.

google_connections: one per person who connected Google Calendar. The
refresh token is encrypted (Fernet, key in Secrets Manager) before it is
stored, so a database dump alone cannot read anyone's calendar.

program_settings gains the shared meeting hours: weekdays (Monday = 0),
a start and end time, in the program time zone. Default Saturday and
Sunday, 09:00-17:00.

bookings: a proposed or confirmed meeting. kind 'triage' (from a check-in;
check_in_id unique, so the worker never books one check-in twice) or
'manual' (requested on /app/meetings). status: proposed, confirmed,
declined, no_slot (options offered instead), no_meeting / needs_mentor
(summary only, from triage). booking_people: everyone in it and their
answer.

Revision ID: 0012_calendar_booking
Revises: 0011_consulting
Create Date: 2026-10-15
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0012_calendar_booking"
down_revision = "0011_consulting"
branch_labels = None
depends_on = None

UUID = postgresql.UUID(as_uuid=True)


def _user(name: str, nullable: bool = False) -> sa.Column:
    return sa.Column(name, sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=nullable)


def upgrade() -> None:
    op.create_table(
        "google_connections",
        sa.Column("user_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("google_email", sa.String(320), nullable=False),
        sa.Column("refresh_token", sa.LargeBinary, nullable=False),
        sa.Column("connected_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.add_column("program_settings", sa.Column("meeting_days", postgresql.ARRAY(sa.SmallInteger), nullable=False,
                                                server_default="{5,6}"))
    op.add_column("program_settings", sa.Column("meeting_start", sa.Time, nullable=False, server_default="09:00"))
    op.add_column("program_settings", sa.Column("meeting_end", sa.Time, nullable=False, server_default="17:00"))
    op.create_check_constraint("ck_program_settings_meeting_hours", "program_settings", "meeting_start < meeting_end")

    op.create_table(
        "bookings",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("check_in_id", UUID, sa.ForeignKey("check_ins.id", ondelete="CASCADE"), unique=True),
        _user("requested_by", nullable=True),
        _user("student_id", nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("minutes", sa.SmallInteger),
        sa.Column("starts_at", sa.DateTime(timezone=True)),
        sa.Column("options", postgresql.ARRAY(sa.DateTime(timezone=True)), nullable=False, server_default="{}"),
        sa.Column("title", sa.Text, nullable=False, server_default=""),
        sa.Column("note", sa.Text, nullable=False, server_default=""),
        sa.Column("reason", sa.Text, nullable=False, server_default=""),
        sa.Column("agenda", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("google_event_id", sa.Text),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("kind IN ('triage', 'manual')", name="ck_bookings_kind"),
        sa.CheckConstraint(
            "status IN ('proposed', 'confirmed', 'declined', 'no_slot', 'no_meeting', 'needs_mentor')",
            name="ck_bookings_status"),
    )
    op.create_table(
        "booking_people",
        sa.Column("booking_id", UUID, sa.ForeignKey("bookings.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("role", sa.String(10), nullable=False),
        sa.Column("response", sa.String(10), nullable=False, server_default="pending"),
        sa.CheckConstraint("role IN ('student', 'mentor')", name="ck_booking_people_role"),
        sa.CheckConstraint("response IN ('pending', 'accepted', 'declined')", name="ck_booking_people_response"),
    )
    op.create_index("ix_booking_people_user", "booking_people", ["user_id"])


def downgrade() -> None:
    op.drop_table("booking_people")
    op.drop_table("bookings")
    op.drop_constraint("ck_program_settings_meeting_hours", "program_settings", type_="check")
    for column in ("meeting_end", "meeting_start", "meeting_days"):
        op.drop_column("program_settings", column)
    op.drop_table("google_connections")
