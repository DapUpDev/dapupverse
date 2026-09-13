"""The queue worker: the second process built from this image.

The API answers requests; this loop handles jobs that should not make a
request wait (weekly check-ins, later the AI workflows). It long-polls the
SQS queue, handles each message, and deletes it only once handled, so a
crash mid-job means the message reappears and is retried instead of lost.

For now "handle" means log the job. Real behaviour arrives with the AI
workflows module; the plumbing (queue, schedule, permissions, deploy) is
what this file proves.

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

log = logging.getLogger("dapup.worker")

BATCH_SIZE = 10
WAIT_SECONDS = 20


class QueueClient(Protocol):
    def receive_message(self, **kwargs) -> dict[str, Any]: ...
    def delete_message(self, **kwargs) -> Any: ...


def handle(job: dict[str, Any], message_id: str) -> None:
    """One job. Today: log it. Unknown shapes are logged too, not dropped
    silently, so a producer bug is visible in CloudWatch."""
    kind = job.get("job", "<unknown>")
    log.info("job %s received: %s (message %s)", kind, json.dumps(job, sort_keys=True)[:500], message_id)


def run(client: QueueClient, queue_url: str, stop: threading.Event, once: bool = False) -> int:
    """Poll until `stop` is set (or one poll when `once`). Returns the number
    of messages handled, which is what the tests check."""
    handled = 0
    while not stop.is_set():
        response = client.receive_message(
            QueueUrl=queue_url, MaxNumberOfMessages=BATCH_SIZE, WaitTimeSeconds=WAIT_SECONDS,
            AttributeNames=["ApproximateReceiveCount"],
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
