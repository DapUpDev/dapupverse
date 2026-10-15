"""when2meet-style availability for bookings.

A booking that needs a time is 'collecting': it has a 7-day window
(window_start..window_end, quarter-hour aligned) and every person marks the
15-minute cells they are free. booking_people.slots holds those cell
starts (UTC); NULL means "not filled in yet". filled_at / reminded_at drive
the "everyone's in" email and the one reminder. timezone is the zone the
person saved from, used to rank times sensible for everyone.

The grid always covers 07:00-22:00 in each viewer's own time zone, so the
shared meeting hours added in 0012 are no longer used and are dropped.

Revision ID: 0013_availability
Revises: 0012_calendar_booking
Create Date: 2026-10-15
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0013_availability"
down_revision = "0012_calendar_booking"
branch_labels = None
depends_on = None

OLD = "status IN ('proposed', 'confirmed', 'declined', 'no_slot', 'no_meeting', 'needs_mentor')"
NEW = "status IN ('collecting', 'proposed', 'confirmed', 'declined', 'no_slot', 'no_meeting', 'needs_mentor')"


def upgrade() -> None:
    op.add_column("bookings", sa.Column("window_start", sa.DateTime(timezone=True)))
    op.add_column("bookings", sa.Column("window_end", sa.DateTime(timezone=True)))
    op.drop_constraint("ck_bookings_status", "bookings", type_="check")
    op.create_check_constraint("ck_bookings_status", "bookings", NEW)
    op.add_column("booking_people", sa.Column("slots", postgresql.ARRAY(sa.DateTime(timezone=True))))
    op.add_column("booking_people", sa.Column("filled_at", sa.DateTime(timezone=True)))
    op.add_column("booking_people", sa.Column("reminded_at", sa.DateTime(timezone=True)))
    op.add_column("booking_people", sa.Column("timezone", sa.String(64)))
    op.drop_constraint("ck_program_settings_meeting_hours", "program_settings", type_="check")
    for column in ("meeting_end", "meeting_start", "meeting_days"):
        op.drop_column("program_settings", column)


def downgrade() -> None:
    op.add_column("program_settings", sa.Column("meeting_days", postgresql.ARRAY(sa.SmallInteger), nullable=False,
                                                server_default="{5,6}"))
    op.add_column("program_settings", sa.Column("meeting_start", sa.Time, nullable=False, server_default="09:00"))
    op.add_column("program_settings", sa.Column("meeting_end", sa.Time, nullable=False, server_default="17:00"))
    op.create_check_constraint("ck_program_settings_meeting_hours", "program_settings", "meeting_start < meeting_end")
    for column in ("timezone", "reminded_at", "filled_at", "slots"):
        op.drop_column("booking_people", column)
    op.drop_constraint("ck_bookings_status", "bookings", type_="check")
    op.create_check_constraint("ck_bookings_status", "bookings", OLD)
    op.drop_column("bookings", "window_end")
    op.drop_column("bookings", "window_start")
