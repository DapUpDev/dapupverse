"""DapUp API — minimal FastAPI service for the first AWS milestone.

Deliberately has no dependency on Clerk, a database, or any other external
service: /health must answer purely from the running container so it can
serve as the load-balancer and ECS health signal.
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=False,
)


@app.get("/health")
def health() -> dict[str, str]:
    """Unauthenticated liveness check used by Docker, ECS, and the ALB."""
    return {"status": "ok", "service": "dapup-api", "version": APP_VERSION}
