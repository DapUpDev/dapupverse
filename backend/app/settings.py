"""Database configuration, read from the environment.

In production the five DB_* variables are injected by the ECS task
definition's `secrets` block straight from Secrets Manager (see
infra/ecs.tf), so the credentials never sit in Terraform-managed plain
environment or in the image. Locally, either set the same variables or
pass one DATABASE_URL.
"""

from __future__ import annotations

import os
from urllib.parse import quote_plus


def database_url() -> str | None:
    """SQLAlchemy URL for PostgreSQL via psycopg 3, or None when unconfigured.

    `None` is a first-class state: /health must keep working in a container
    that has no database (Stage 1 of the AWS milestone still holds), so the
    app treats "no database" as "database routes answer 503", never a crash
    at import time.
    """
    direct = os.getenv("DATABASE_URL")
    if direct:
        return direct
    host = os.getenv("DB_HOST")
    if not host:
        return None
    user = quote_plus(os.getenv("DB_USER", ""))
    password = quote_plus(os.getenv("DB_PASSWORD", ""))
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "postgres")
    sslmode = os.getenv("DB_SSLMODE", "require")  # RDS enforces TLS; local may set "disable"
    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{name}?sslmode={sslmode}"
