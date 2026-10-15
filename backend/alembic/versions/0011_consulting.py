"""Consulting students, their mentor teams, and the shared check-in schedule.

student_profiles.consulting: only these students get the weekly check-in.
consulting_mentors: a consulting student's team (up to 3 mentors; the API
enforces the limit). program_settings: one row (id = 1) holding when the
check-in email goes out: a weekday (Monday = 0), a local time and an IANA
time zone. Default Thursday 08:00 America/Los_Angeles.

Revision ID: 0011_consulting
Revises: 0010_triage
Create Date: 2026-10-15
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0011_consulting"
down_revision = "0010_triage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("student_profiles", sa.Column("consulting", sa.Boolean, nullable=False, server_default=sa.false()))
    op.create_table(
        "consulting_mentors",
        sa.Column("student_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("mentor_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "program_settings",
        sa.Column("id", sa.SmallInteger, primary_key=True),
        sa.Column("checkin_weekday", sa.SmallInteger, nullable=False, server_default="3"),
        sa.Column("checkin_time", sa.Time, nullable=False, server_default="08:00"),
        sa.Column("timezone", sa.String(64), nullable=False, server_default="America/Los_Angeles"),
        sa.CheckConstraint("id = 1", name="ck_program_settings_single_row"),
        sa.CheckConstraint("checkin_weekday BETWEEN 0 AND 6", name="ck_program_settings_weekday"),
    )
    op.execute("INSERT INTO program_settings (id) VALUES (1)")


def downgrade() -> None:
    op.drop_table("program_settings")
    op.drop_table("consulting_mentors")
    op.drop_column("student_profiles", "consulting")
