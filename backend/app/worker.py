"""The queue worker: the second process built from this image.

The API answers requests; this loop handles jobs that should not make a
request wait (weekly check-ins, later the AI workflows). It long-polls the
SQS queue, handles each message, and deletes it only once handled, so a
crash mid-job means the message reappears and is retried instead of lost.

For now "handle" mostly means log the job. The one real job is "llm-ping":
it asks the configured model (see app/llm.py) for a one-line reply and
logs it, which proves the provider switch end to end. Real behaviour
arrives with the AI workflows module; the plumbing (queue, schedule,
permissions, deploy) is what this file proves.

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
from typing import Any, Protocol

from app import llm

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


def handle(job: dict[str, Any], message_id: str) -> None:
    """One job. The receipt line is logged for every job; known kinds then
    go to their handler. Unknown shapes are logged too, not dropped
    silently, so a producer bug is visible in CloudWatch."""
    kind = job.get("job", "<unknown>")
    log.info("job %s received: %s (message %s)", kind, json.dumps(job, sort_keys=True)[:500], message_id)
    if kind == "llm-ping":
        llm_ping(job, message_id)


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
