"""messages and thread_reads.

Revision ID: 0005_messages
Revises: 0004_connections
Create Date: 2026-09-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005_messages"
down_revision = "0004_connections"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("message_threads.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("char_length(text) BETWEEN 1 AND 4000", name="ck_messages_text_length"),
    )
    op.create_index("ix_messages_thread_sent", "messages", ["thread_id", "sent_at"])

    # Replaces the mock's lastReadAt map: one row per participant per thread.
    op.create_table(
        "thread_reads",
        sa.Column("thread_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("message_threads.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("last_read_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("thread_reads")
    op.drop_index("ix_messages_thread_sent", table_name="messages")
    op.drop_table("messages")
