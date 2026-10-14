"""The API's side of the job queue: put one small JSON job on SQS for the
worker (app/worker.py). Never raises: the caller's own work (say, a saved
check-in) has already happened, so a failed send is logged, not undone."""

from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from typing import Any

log = logging.getLogger("dapup.jobs")


@lru_cache
def _client():
    import boto3

    return boto3.client("sqs", region_name=os.getenv("AWS_REGION", "us-west-2"))


def enqueue(job: dict[str, Any]) -> bool:
    queue_url = os.getenv("QUEUE_URL")
    if not queue_url:
        log.warning("QUEUE_URL is not set; job %s not queued", job.get("job"))
        return False
    try:
        _client().send_message(QueueUrl=queue_url, MessageBody=json.dumps(job))
    except Exception as exc:  # noqa: BLE001 - see module docstring
        log.error("could not queue job %s: %s: %s", job.get("job"), type(exc).__name__, exc)
        return False
    log.info("queued job %s", job.get("job"))
    return True
