"""SQLAlchemy engine and per-request sessions."""

from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache

from fastapi import HTTPException, status
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.settings import database_url


@lru_cache(maxsize=1)
def get_engine() -> Engine | None:
    url = database_url()
    if url is None:
        return None
    # pool_pre_ping: a connection RDS closed during a maintenance window is
    # detected and replaced instead of surfacing as a failed request.
    return create_engine(url, pool_pre_ping=True, pool_size=5, max_overflow=5)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one transaction per request, committed on success."""
    engine = get_engine()
    if engine is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database is not configured.",
        )
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as session:
        yield session
        session.commit()
