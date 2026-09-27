"""DapUp API.

/health has no dependency on Clerk, a database, or any other external
service: it must answer purely from the running container so it can serve
as the load-balancer and ECS health signal. Everything else is protected by
Clerk session-token verification (see app/auth.py).
"""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.avatars import router as avatars_router
from app.mentors import router as mentors_router
from app.messages import router as messages_router
from app.connections import router as connections_router
from app.students import router as students_router
from app.webhooks import router as webhooks_router

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
app.include_router(messages_router)
app.include_router(avatars_router)
app.include_router(webhooks_router)


@app.get("/health")
def health() -> dict[str, str]:
    """Unauthenticated liveness check used by Docker, ECS, and the ALB."""
    return {"status": "ok", "service": "dapup-api", "version": APP_VERSION}
