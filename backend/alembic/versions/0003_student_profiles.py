"""student_profiles: what a student fills in before sending requests.

Revision ID: 0003_student_profiles
Revises: 0002_mentor_profiles
Create Date: 2026-09-12
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0003_student_profiles"
down_revision = "0002_mentor_profiles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "student_profiles",
        sa.Column("user_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("full_name", sa.String(120), nullable=False, server_default=""),
        sa.Column("school", sa.String(200), nullable=False, server_default=""),
        sa.Column("year_level", sa.String(60), nullable=False, server_default=""),
        # Nullable: "not chosen yet". Completeness is judged by the API and
        # the frontend the same way (all four required fields set).
        sa.Column("education_system", sa.String(20), nullable=True),
        sa.Column("subjects", postgresql.ARRAY(sa.Text), nullable=False, server_default="{}"),
        sa.Column("biography", sa.Text, nullable=False, server_default=""),
        sa.Column("avatar_key", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "education_system IS NULL OR education_system IN ('AP', 'IB', 'A Levels')",
            name="ck_student_profiles_education_system",
        ),
    )


def downgrade() -> None:
    op.drop_table("student_profiles")
