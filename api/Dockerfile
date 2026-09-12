# syntax=docker/dockerfile:1

# ---- Stage 1: resolve dependencies into an isolated virtualenv -------------
FROM python:3.13-slim AS builder

# uv is copied in as a static binary (no pip/network install of the tool).
COPY --from=ghcr.io/astral-sh/uv:0.12.10 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=0

WORKDIR /app

# Install locked runtime dependencies first so this layer is cached across
# code-only changes. --locked fails the build if uv.lock is out of date.
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-dev --no-install-project

COPY app ./app
COPY alembic.ini ./alembic.ini
COPY alembic ./alembic
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# ---- Stage 2: minimal runtime image -----------------------------------------
FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH"

# Run as an unprivileged user; nothing here needs root.
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin appuser

WORKDIR /app
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appuser /app/app /app/app
COPY --from=builder --chown=appuser:appuser /app/alembic.ini /app/alembic.ini
COPY --from=builder --chown=appuser:appuser /app/alembic /app/alembic
COPY --from=builder --chown=appuser:appuser /app/docker-entrypoint.sh /app/docker-entrypoint.sh

USER appuser
EXPOSE 8000

# Container-level liveness check; ECS and the ALB add their own on top.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2).status == 200 else 1)"

# The entrypoint applies pending migrations, then execs uvicorn bound to
# all interfaces (inside a container 127.0.0.1 would be unreachable from
# the load balancer) with --proxy-headers so the app sees the real
# scheme/host behind the ALB. See docker-entrypoint.sh.
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
