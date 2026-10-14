"""Triage: check-in answers, tasks, meetings, and the agent's decisions.

check_ins gains the student's answer (empty/NULL until answered).
tasks and meetings are what the triage agent reads besides the check-in:
open tasks with deadlines, and the last meeting's notes. Both start empty;
they are filled by the app later and by importing the old Google Sheets.
triage_decisions holds one decision per check-in (unique check_in_id, so a
retried job never decides twice). status 'needs_mentor' means the model
failed twice: nothing is booked and a mentor decides.

Revision ID: 0010_triage
Revises: 0009_history_vectors
Create Date: 2026-10-15
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0010_triage"
down_revision = "0009_history_vectors"
branch_labels = None
depends_on = None

UUID = postgresql.UUID(as_uuid=True)


def _id() -> sa.Column:
    return sa.Column("id", UUID, primary_key=True, server_default=sa.text("gen_random_uuid()"))


def _student() -> sa.Column:
    return sa.Column("student_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)


def upgrade() -> None:
    op.add_column("check_ins", sa.Column("progress", sa.Text, nullable=False, server_default=""))
    op.add_column("check_ins", sa.Column("blockers", sa.Text, nullable=False, server_default=""))
    op.add_column("check_ins", sa.Column("confidence", sa.SmallInteger))
    op.add_column("check_ins", sa.Column("help_wanted", sa.Text, nullable=False, server_default=""))
    op.add_column("check_ins", sa.Column("answered_at", sa.DateTime(timezone=True)))
    op.create_check_constraint("ck_check_ins_confidence", "check_ins", "confidence BETWEEN 1 AND 5")

    op.create_table(
        "tasks",
        _id(), _student(),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("due_on", sa.Date),
        sa.Column("done", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_tasks_student_open", "tasks", ["student_id"], postgresql_where=sa.text("NOT done"))

    op.create_table(
        "meetings",
        _id(), _student(),
        sa.Column("mentor_id", sa.String(64), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("held_on", sa.Date, nullable=False),
        sa.Column("minutes", sa.Integer),
        sa.Column("notes", sa.Text, nullable=False, server_default=""),
    )
    op.create_index("ix_meetings_student_held", "meetings", ["student_id", "held_on"])

    op.create_table(
        "triage_decisions",
        _id(), _student(),
        sa.Column("check_in_id", UUID, sa.ForeignKey("check_ins.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("decision", sa.String(20)),
        sa.Column("reason", sa.Text, nullable=False, server_default=""),
        sa.Column("blockers", sa.Text, nullable=False, server_default=""),
        sa.Column("agenda", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("error", sa.Text, nullable=False, server_default=""),
        sa.Column("model", sa.String(120), nullable=False, server_default=""),
        sa.Column("attempts", sa.SmallInteger, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('decided', 'needs_mentor')", name="ck_triage_status"),
        sa.CheckConstraint("decision IS NULL OR decision IN ('NO_MEETING', '15', '30', '45', '60')",
                           name="ck_triage_decision"),
    )


def downgrade() -> None:
    op.drop_table("triage_decisions")
    op.drop_table("meetings")
    op.drop_table("tasks")
    op.drop_constraint("ck_check_ins_confidence", "check_ins", type_="check")
    for column in ("answered_at", "help_wanted", "confidence", "blockers", "progress"):
        op.drop_column("check_ins", column)
