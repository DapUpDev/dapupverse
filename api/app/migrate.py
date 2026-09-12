"""Apply pending Alembic migrations, safely, at container start.

Why at start and not in the pipeline: the GitHub runner cannot reach the
database (it is private, by design), the container can. A failed
migration makes the container exit non-zero, the ECS circuit breaker
rolls the deployment back, and the previous revision keeps serving.

Why the advisory lock: a rolling deploy can start more than one new task.
Postgres hands the lock to exactly one of them; the others wait, then find
nothing left to do. `pg_advisory_lock` is session-scoped, so a crashed
holder releases it automatically.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text

from app.settings import database_url

log = logging.getLogger("dapup.migrate")
LOCK_KEY = 918_273_645  # arbitrary, but fixed: every task must use the same key
API_ROOT = Path(__file__).resolve().parent.parent


def run_migrations() -> str | None:
    url = database_url()
    if url is None:
        log.warning("database not configured; skipping migrations")
        return None

    config = Config(str(API_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(API_ROOT / "alembic"))
    head = ScriptDirectory.from_config(config).get_current_head()

    engine = create_engine(url)
    with engine.connect() as connection:
        connection.execute(text("SELECT pg_advisory_lock(:key)"), {"key": LOCK_KEY})
        try:
            current = MigrationContext.configure(connection).get_current_revision()
            if current == head:
                log.info("migrations: already at %s", head)
            else:
                log.info("migrations: upgrading %s -> %s", current, head)
                command.upgrade(config, "head")
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": LOCK_KEY})
            connection.commit()
    return head


if __name__ == "__main__":
    logging.basicConfig(level="INFO", format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    try:
        run_migrations()
    except Exception:  # noqa: BLE001 - the exit code is the contract
        log.exception("migrations failed")
        sys.exit(1)
