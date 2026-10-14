"""pgvector and the student-history search tables.

documents: one row per history file in S3 (mentor note, meeting summary,
check-in). Its unique s3_key is what lets the ingestion job skip files it
has already processed.

document_chunks: a few paragraphs of a document, its student_id copied in
so every search filters by student inside the query, and a 512-number
embedding (the local model's size, and one Amazon Titan Text Embeddings V2
also supports).

Revision ID: 0009_history_vectors
Revises: 0008_drop_unsent_test_check_in
Create Date: 2026-10-15
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0009_history_vectors"
down_revision = "0008_drop_unsent_test_check_in"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("student_id", sa.String(64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("s3_key", sa.Text, nullable=False, unique=True),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("ingested_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    # Plain SQL: SQLAlchemy has no built-in vector column type.
    op.execute("""
        CREATE TABLE document_chunks (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            student_id varchar(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            chunk_index integer NOT NULL,
            text text NOT NULL,
            embedding vector(512) NOT NULL
        )
    """)
    # ponytail: a plain student_id index; each student has a few hundred chunks
    # at most, so an exact scan is fast. Add an HNSW index when that changes.
    op.create_index("ix_document_chunks_student", "document_chunks", ["student_id"])


def downgrade() -> None:
    op.drop_table("document_chunks")
    op.drop_table("documents")
