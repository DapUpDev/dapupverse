"""Remove the week-of-2026-10-12 check-in rows.

The only row is the hand test from 2026-10-14, whose email SES refused
(the worker lacked permission on the domain's configuration set). Before
the retry-on-failure fix the row stayed behind and blocked a resend.
No email for that week was ever delivered, so nothing real is lost.

Revision ID: 0008_drop_unsent_test_check_in
Revises: 0007_check_ins
Create Date: 2026-10-14
"""

from __future__ import annotations

from alembic import op

revision = "0008_drop_unsent_test_check_in"
down_revision = "0007_check_ins"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DELETE FROM check_ins WHERE week_start = '2026-10-12' AND status = 'sent'")


def downgrade() -> None:
    pass  # nothing to restore: the row only ever blocked a resend
