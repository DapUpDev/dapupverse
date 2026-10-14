"""check_ins: one weekly check-in per student.

The unique (student_id, week_start) pair is what makes the weekly job safe
to run twice: the second run's insert hits the constraint and sends nothing.

Revision ID: 0007_check_ins
Revises: 0006_request_message_length
Create Date: 2026-10-13
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007_check_ins"
down_revision = "0006_request_message_length"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "check_ins",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("student_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("week_start", sa.Date, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="sent"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("reminded_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("student_id", "week_start", name="uq_check_ins_student_week"),
        sa.CheckConstraint("status IN ('sent', 'answered', 'expired')", name="ck_check_ins_status"),
    )
    # The daily job only ever looks at open check-ins.
    op.create_index("ix_check_ins_open", "check_ins", ["sent_at"], postgresql_where=sa.text("status = 'sent'"))


def downgrade() -> None:
    op.drop_index("ix_check_ins_open", table_name="check_ins")
    op.drop_table("check_ins")
