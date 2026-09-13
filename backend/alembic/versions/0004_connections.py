"""connection_requests and message_threads.

Revision ID: 0004_connections
Revises: 0003_student_profiles
Create Date: 2026-09-12

The lifecycle is deliberate (docs/architecture.md): pending → accepted →
disconnected, or → blocked from anywhere. There is no rejected state.
Archiving is a mentor-side inbox flag that never changes what the student
sees. A thread exists only for an accepted request.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004_connections"
down_revision = "0003_student_profiles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "connection_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("mentor_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("purpose", sa.String(40), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("state", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("archived_by_mentor", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "purpose IN ('Essay review', 'Application advice', 'Subject help', 'General mentorship')",
            name="ck_connection_requests_purpose",
        ),
        sa.CheckConstraint(
            "state IN ('pending', 'accepted', 'disconnected', 'blocked')",
            name="ck_connection_requests_state",
        ),
        sa.CheckConstraint(
            "char_length(message) BETWEEN 20 AND 600",
            name="ck_connection_requests_message_length",
        ),
    )
    # The DuplicateRequestError rule, enforced by the database: one active
    # (pending or accepted) request per student/mentor pair.
    op.create_index(
        "uq_connection_requests_active_pair",
        "connection_requests",
        ["student_id", "mentor_id"],
        unique=True,
        postgresql_where=sa.text("state IN ('pending', 'accepted')"),
    )
    op.create_index("ix_connection_requests_mentor", "connection_requests", ["mentor_id"])
    op.create_index("ix_connection_requests_student", "connection_requests", ["student_id"])

    op.create_table(
        "message_threads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "connection_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("connection_requests.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("mentor_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_message_threads_mentor", "message_threads", ["mentor_id"])
    op.create_index("ix_message_threads_student", "message_threads", ["student_id"])


def downgrade() -> None:
    op.drop_table("message_threads")
    op.drop_index("uq_connection_requests_active_pair", table_name="connection_requests")
    op.drop_table("connection_requests")
