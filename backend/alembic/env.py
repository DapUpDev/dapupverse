"""Alembic environment: URL from app.settings, metadata from app.models."""

from __future__ import annotations

from alembic import context
from sqlalchemy import create_engine, pool

from app.models import Base
from app.settings import database_url

target_metadata = Base.metadata


def _url() -> str:
    url = database_url()
    if url is None:
        raise RuntimeError("Database is not configured (DB_HOST or DATABASE_URL).")
    return url


def run_migrations_online() -> None:
    engine = create_engine(_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


run_migrations_online()
