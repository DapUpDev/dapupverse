"""users: the first real table (docs/backend-needs.md, Tier 1).

Revision ID: 0001_users
Revises:
Create Date: 2026-09-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001_users"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The enum type is created once, explicitly; the column then refers to
    # it with create_type=False, otherwise create_table would try to create
    # the same type a second time and fail.
    sa.Enum("student", "mentor", name="account_type").create(op.get_bind(), checkfirst=True)
    account_type = postgresql.ENUM("student", "mentor", name="account_type", create_type=False)
    op.create_table(
        "users",
        sa.Column("id", sa.String(64), primary_key=True),
        # Nullable until the Clerk webhook (next slice) supplies it; the
        # session token alone does not carry the address.
        sa.Column("email", sa.String(320), nullable=True, unique=True),
        sa.Column("account_type", account_type, nullable=False, server_default="student"),
        sa.Column("is_admin", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_account_type", "users", ["account_type"])


def downgrade() -> None:
    op.drop_index("ix_users_account_type", table_name="users")
    op.drop_table("users")
    sa.Enum(name="account_type").drop(op.get_bind(), checkfirst=True)
