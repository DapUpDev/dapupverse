"""The queue worker: the second process built from this image.

The API answers requests; this loop handles jobs that should not make a
request wait (weekly check-ins, later the AI workflows). It long-polls the
SQS queue, handles each message, and deletes it only once handled, so a
crash mid-job means the message reappears and is retried instead of lost.

Every job is logged. Known kinds then run: "checkin-tick" (hourly), "weekly-checkin" and
"daily-checkin" (the check-in cycle, app/checkins.py), "ingest-history"
(student history into pgvector, app/history.py), "triage" and
"triage-eval" (the meeting-length agent, app/triage.py) and "llm-ping",
which asks the configured model (app/llm.py) for a one-line reply and
logs it to prove the provider switch end to end.

Stops cleanly: ECS sends SIGTERM before it removes a task (deploys, Spot
reclaims). The loop finishes the batch in hand and exits 0.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import sys
import threading
import time
from datetime import UTC, datetime
from typing import Any, Protocol

from app import checkins, llm

log = logging.getLogger("dapup.worker")

BATCH_SIZE = 10
WAIT_SECONDS = 20
PING_SYSTEM = "You are DapUp's assistant. Reply briefly."
PING_PROMPT = "Say hello to DapUp in one sentence."


class QueueClient(Protocol):
    def receive_message(self, **kwargs) -> dict[str, Any]: ...
    def delete_message(self, **kwargs) -> Any: ...


def llm_ping(job: dict[str, Any], message_id: str) -> None:
    """Ask the configured model for a one-liner and log the answer. A ping
    is never retried: whatever happens, the message is deleted, so errors
    are logged (class and message, never a key) rather than raised."""
    prompt = job.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        prompt = PING_PROMPT
    try:
        reply = llm.complete(system=PING_SYSTEM, user=prompt)
    except Exception as exc:  # noqa: BLE001 - a ping is not retried
        log.warning("llm-ping failed: %s: %s (message %s)", type(exc).__name__, exc, message_id)
        return
    if reply is None:
        log.info("llm-ping skipped: LLM_PROVIDER is not set (message %s)", message_id)
        return
    log.info(
        "llm-ping reply via %s/%s (%s/%s tokens): %s",
        reply.provider, reply.model, reply.input_tokens, reply.output_tokens, reply.text[:300],
    )


def checkin_job(kind: str, job: dict[str, Any]) -> None:
    """The check-in cycle. Database errors are NOT caught: the message is
    then retried, which is safe because both jobs are idempotent."""
    from sqlalchemy.orm import sessionmaker

    from app.db import get_engine
    from app.notifications import get_mailer

    engine, mailer = get_engine(), get_mailer()
    if engine is None or mailer is None:
        log.warning("%s skipped: database or EMAIL_FROM is not configured", kind)
        return
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    now = datetime.now(UTC)
    if kind == "checkin-tick":
        from app import scheduling

        checkins.checkin_tick(sessions, mailer, now)
        scheduling.remind_unfilled(sessions, mailer, now)  # meetings waiting on someone's times
        return
    with sessions() as session:
        schedule = checkins.load_schedule(session)
    only = job.get("only") if isinstance(job.get("only"), str) else None
    if kind == "weekly-checkin":  # by hand: send now, whatever the schedule says
        checkins.send_weekly(sessions, mailer, now, schedule, only=only)
    elif kind == "reset-checkin":  # testing: forget one student's check-in for this week
        if only:
            checkins.reset_week(sessions, now, schedule, only)
        else:
            log.warning("reset-checkin needs \"only\": one student's email address")
    else:
        checkins.run_daily(sessions, mailer, now, schedule)


def ingest_history_job() -> None:
    """Load new history files. Errors are not caught: the message is retried
    and already-loaded files are skipped."""
    from sqlalchemy.orm import sessionmaker

    from app import history
    from app.db import get_engine
    from app.storage import get_storage

    engine, storage = get_engine(), get_storage()
    if engine is None or storage is None:
        log.warning("ingest-history skipped: database or STORAGE_BUCKET is not configured")
        return
    history.ingest(sessionmaker(bind=engine, expire_on_commit=False), storage, history.get_embedder())


def triage_job(kind: str, job: dict[str, Any]) -> None:
    """One check-in through the triage agent, or the five evaluation cases.
    Database errors are not caught: the message is retried, and a check-in
    that already has a decision is skipped."""
    from app import triage

    if kind == "triage-eval":
        triage.evaluate(triage.db_deps(None).ask)
        return

    from sqlalchemy.orm import sessionmaker

    from app.db import get_engine

    engine = get_engine()
    if engine is None:
        log.warning("triage skipped: database is not configured")
        return
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    check_in_id = str(job.get("check_in_id", ""))
    triage.triage_check_in(sessions, check_in_id)

    # Then the summary for the mentors and, for a meeting, a proposed slot.
    # Also runs when triage was already done (a retried message), and books
    # at most once per check-in.
    import uuid

    from app import scheduling
    from app.google_calendar import get_calendar
    from app.notifications import get_mailer

    try:
        key = uuid.UUID(check_in_id)
    except ValueError:
        return
    scheduling.after_triage(sessions, key, get_calendar(), get_mailer(), datetime.now(UTC))


def handle(job: dict[str, Any], message_id: str) -> None:
    """One job. The receipt line is logged for every job; known kinds then
    go to their handler. Unknown shapes are logged too, not dropped
    silently, so a producer bug is visible in CloudWatch."""
    kind = job.get("job", "<unknown>")
    log.info("job %s received: %s (message %s)", kind, json.dumps(job, sort_keys=True)[:500], message_id)
    if kind == "llm-ping":
        llm_ping(job, message_id)
    elif kind in ("checkin-tick", "weekly-checkin", "daily-checkin", "reset-checkin"):
        checkin_job(kind, job)
    elif kind == "ingest-history":
        ingest_history_job()
    elif kind in ("triage", "triage-eval"):
        triage_job(kind, job)


def run(client: QueueClient, queue_url: str, stop: threading.Event, once: bool = False) -> int:
    """Poll until `stop` is set (or one poll when `once`). Returns the number
    of messages handled, which is what the tests check."""
    handled = 0
    while not stop.is_set():
        response = client.receive_message(
            QueueUrl=queue_url, MaxNumberOfMessages=BATCH_SIZE, WaitTimeSeconds=WAIT_SECONDS,
        )
        for message in response.get("Messages", []):
            try:
                job = json.loads(message.get("Body") or "{}")
                if not isinstance(job, dict):
                    job = {"job": "<not an object>", "body": job}
            except ValueError:
                job = {"job": "<not json>", "body": (message.get("Body") or "")[:200]}
            handle(job, message.get("MessageId", "?"))
            client.delete_message(QueueUrl=queue_url, ReceiptHandle=message["ReceiptHandle"])
            handled += 1
        if once:
            break
    return handled


def main() -> int:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    queue_url = os.getenv("QUEUE_URL")
    if not queue_url:
        log.error("QUEUE_URL is not set; nothing to read from")
        return 2

    import boto3

    client = boto3.client("sqs", region_name=os.getenv("AWS_REGION", "us-west-2"))
    stop = threading.Event()

    def ask_to_stop(signum, _frame):
        log.info("signal %s received, finishing the current batch", signum)
        stop.set()

    signal.signal(signal.SIGTERM, ask_to_stop)
    signal.signal(signal.SIGINT, ask_to_stop)

    log.info("worker %s up, polling %s", os.getenv("APP_VERSION", "dev"), queue_url)
    started = time.monotonic()
    handled = run(client, queue_url, stop, once=os.getenv("WORKER_ONCE") == "1")
    log.info("worker exiting cleanly after %d job(s) in %.0f s", handled, time.monotonic() - started)
    return 0


if __name__ == "__main__":
    sys.exit(main())
