"""mentor_profiles: the public directory and the mentor's private price.

Revision ID: 0002_mentor_profiles
Revises: 0001_users
Create Date: 2026-09-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_mentor_profiles"
down_revision = "0001_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mentor_profiles",
        # One profile per mentor account; goes away with the user.
        sa.Column("user_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        # Public URL handle, generated from the name the first time it is set
        # and stable afterwards so links never break.
        sa.Column("slug", sa.String(80), nullable=False, unique=True),
        # Empty name = profile not yet filled in = not listed publicly.
        sa.Column("name", sa.String(120), nullable=False, server_default=""),
        sa.Column("university", sa.String(200), nullable=False, server_default=""),
        sa.Column("major", sa.String(200), nullable=False, server_default=""),
        sa.Column("country_region", sa.String(120), nullable=False, server_default=""),
        sa.Column("biography", sa.Text, nullable=False, server_default=""),
        sa.Column("services", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("subjects", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("education_systems", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
        # Never part of any public payload; see app/mentors.py.
        sa.Column("private_price_usd", sa.Numeric(8, 2), nullable=False, server_default="0"),
        sa.Column("avatar_key", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    # Directory filters: subject containment and free text over a few columns.
    op.create_index("ix_mentor_profiles_subjects", "mentor_profiles", ["subjects"], postgresql_using="gin")


def downgrade() -> None:
    op.drop_index("ix_mentor_profiles_subjects", table_name="mentor_profiles")
    op.drop_table("mentor_profiles")
