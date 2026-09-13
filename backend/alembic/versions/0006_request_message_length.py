"""connection_requests.message: allow 5–500 characters (was 20–600).

Customers told us 20 characters felt like a wall. The check is added
NOT VALID so rows written under the old rule are left alone; only new
and edited rows are checked against the new range.

Revision ID: 0006_request_message_length
Revises: 0005_messages
Create Date: 2026-09-12
"""

from __future__ import annotations

from alembic import op

revision = "0006_request_message_length"
down_revision = "0005_messages"
branch_labels = None
depends_on = None

CONSTRAINT = "ck_connection_requests_message_length"


def upgrade() -> None:
    op.drop_constraint(CONSTRAINT, "connection_requests", type_="check")
    op.execute(
        f"ALTER TABLE connection_requests ADD CONSTRAINT {CONSTRAINT} "
        "CHECK (char_length(message) BETWEEN 5 AND 500) NOT VALID"
    )


def downgrade() -> None:
    op.drop_constraint(CONSTRAINT, "connection_requests", type_="check")
    op.execute(
        f"ALTER TABLE connection_requests ADD CONSTRAINT {CONSTRAINT} "
        "CHECK (char_length(message) BETWEEN 20 AND 600) NOT VALID"
    )
