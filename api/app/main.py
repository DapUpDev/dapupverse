"""DapUp API.

/health has no dependency on Clerk, a database, or any other external
service: it must answer purely from the running container so it can serve
as the load-balancer and ECS health signal. Everything else is protected by
Clerk session-token verification (see app/auth.py).
"""

import logging
import os

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.auth import Principal, current_user
from app.db import get_engine, get_session
from app.mentors import router as mentors_router, upsert_user
from app.models import User
from app.connections import router as connections_router
from app.students import router as students_router

# One line to stdout per event, which the awslogs driver ships to CloudWatch.
# Without this the app's own loggers (e.g. rejected-token reasons) are
# silently dropped: uvicorn configures only its own loggers.
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

# Injected at deploy time (Git commit SHA) so /health identifies exactly which
# build is serving traffic. Defaults to "dev" for local runs.
APP_VERSION = os.getenv("APP_VERSION", "dev")


def allowed_origins() -> list[str]:
    """Browser origins allowed to call this API, from a comma-separated env var.

    Empty by default: a server-to-server or curl client never needs CORS, and
    an accidental wildcard would let any site call the API with credentials.
    """
    raw = os.getenv("CORS_ALLOWED_ORIGINS", "")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(title="DapUp API", version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins(),
    # Optional pattern for Vercel preview deployments (public reads only:
    # their Clerk tokens come from the development instance, which the
    # production API does not trust, so nothing authenticated works there).
    allow_origin_regex=os.getenv("CORS_ALLOWED_ORIGIN_REGEX") or None,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=False,
)

app.include_router(mentors_router)
app.include_router(students_router)
app.include_router(connections_router)


@app.get("/health")
def health() -> dict[str, str]:
    """Unauthenticated liveness check used by Docker, ECS, and the ALB."""
    return {"status": "ok", "service": "dapup-api", "version": APP_VERSION}


@app.get("/ready")
def ready() -> dict[str, str]:
    """Readiness: can this task reach the database? Not used by the load
    balancer (that stays /health, dependency-free); for operators."""
    engine = get_engine()
    if engine is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Database is not configured.")
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - any failure means "not ready"
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Database unreachable.") from exc
    return {"database": "ok"}


@app.get("/me")
def me(
    user: Principal = Depends(current_user),
    session: Session = Depends(get_session),
) -> dict[str, object]:
    """Who the API thinks you are, as a row in the users table.

    Upserts the caller: first call creates the mirror row, later calls
    refresh role and last-seen. Clerk stays the source of truth for
    identity; this row is what every other table will reference.
    """
    upsert_user(session, user)
    row = session.execute(select(User).where(User.id == user.user_id)).scalar_one()
    return {
        "user_id": row.id,
        "session_id": user.session_id,
        "account_type": row.account_type.value,
        "is_admin": row.is_admin,
        "email": row.email,
        "created_at": row.created_at.isoformat(),
        "last_seen_at": row.last_seen_at.isoformat() if row.last_seen_at else None,
    }
