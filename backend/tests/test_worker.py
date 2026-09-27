"""The queue worker, against a fake SQS client: no network, no AWS."""

import json
import logging
import threading

import pytest

from app import llm, worker
from app.llm import LLMError, Reply, get_provider


class FakeQueue:
    """Hands out the queued bodies once, records deletes."""

    def __init__(self, bodies):
        self.pending = [{"MessageId": f"m{i}", "ReceiptHandle": f"r{i}", "Body": b} for i, b in enumerate(bodies)]
        self.deleted: list[str] = []
        self.receive_calls = 0

    def receive_message(self, **kwargs):
        self.receive_calls += 1
        assert kwargs["QueueUrl"] == "https://sqs.test/jobs" and kwargs["WaitTimeSeconds"] == 20
        batch, self.pending = self.pending[:kwargs["MaxNumberOfMessages"]], self.pending[kwargs["MaxNumberOfMessages"]:]
        return {"Messages": batch} if batch else {}

    def delete_message(self, **kwargs):
        self.deleted.append(kwargs["ReceiptHandle"])


def test_handles_and_deletes_each_message(caplog):
    queue = FakeQueue([json.dumps({"job": "weekly-checkin", "source": "schedule"}), "not json", "[1, 2]"])
    with caplog.at_level(logging.INFO, logger="dapup.worker"):
        handled = worker.run(queue, "https://sqs.test/jobs", threading.Event(), once=True)
    assert handled == 3
    assert queue.deleted == ["r0", "r1", "r2"]
    messages = [r.getMessage() for r in caplog.records]
    assert any("job weekly-checkin received" in m and '"source": "schedule"' in m for m in messages)
    assert any("job <not json> received" in m for m in messages)
    assert any("job <not an object> received" in m for m in messages)


def test_stops_when_asked_and_keeps_polling_otherwise():
    stop = threading.Event()

    class StopAfterTwo(FakeQueue):
        def receive_message(self, **kwargs):
            if self.receive_calls == 1:
                stop.set()  # the SIGTERM handler does exactly this
            return super().receive_message(**kwargs)

    queue = StopAfterTwo([json.dumps({"job": "a"})])
    handled = worker.run(queue, "https://sqs.test/jobs", stop)
    assert handled == 1 and queue.receive_calls == 2


def test_main_refuses_to_start_without_a_queue(monkeypatch):
    monkeypatch.delenv("QUEUE_URL", raising=False)
    assert worker.main() == 2


# ---- llm-ping ------------------------------------------------------------
class FakeProvider:
    def __init__(self, text="Hello, DapUp!", error=None):
        self.text, self.error = text, error
        self.calls: list[dict] = []

    def complete(self, *, system, user, max_tokens=1024):
        self.calls.append({"system": system, "user": user, "max_tokens": max_tokens})
        if self.error:
            raise self.error
        return Reply(text=self.text, provider="fake", model="fake-model", input_tokens=11, output_tokens=4)


@pytest.fixture(autouse=True)
def no_real_provider(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    get_provider.cache_clear()
    yield
    get_provider.cache_clear()


def run_one(job: dict, caplog) -> tuple[FakeQueue, list[str]]:
    queue = FakeQueue([json.dumps(job)])
    with caplog.at_level(logging.INFO, logger="dapup.worker"):
        worker.run(queue, "https://sqs.test/jobs", threading.Event(), once=True)
    return queue, [r.getMessage() for r in caplog.records]


def test_llm_ping_logs_the_reply(monkeypatch, caplog):
    provider = FakeProvider()
    monkeypatch.setattr(llm, "get_provider", lambda: provider)
    queue, messages = run_one({"job": "llm-ping"}, caplog)
    assert queue.deleted == ["r0"]
    assert provider.calls == [{"system": worker.PING_SYSTEM, "user": worker.PING_PROMPT, "max_tokens": 1024}]
    assert any("llm-ping reply via fake/fake-model (11/4 tokens): Hello, DapUp!" in m for m in messages)


def test_llm_ping_uses_the_prompt_from_the_job(monkeypatch, caplog):
    provider = FakeProvider()
    monkeypatch.setattr(llm, "get_provider", lambda: provider)
    run_one({"job": "llm-ping", "prompt": "What is 2+2?"}, caplog)
    assert provider.calls[0]["user"] == "What is 2+2?"


def test_llm_ping_skipped_when_unconfigured(caplog):
    queue, messages = run_one({"job": "llm-ping"}, caplog)
    assert queue.deleted == ["r0"]
    assert any("llm-ping skipped: LLM_PROVIDER is not set" in m for m in messages)


def test_llm_ping_failure_is_a_warning_and_the_message_is_still_deleted(monkeypatch, caplog):
    provider = FakeProvider(error=LLMError("DeepSeek answered HTTP 401 for model m"))
    monkeypatch.setattr(llm, "get_provider", lambda: provider)
    queue, messages = run_one({"job": "llm-ping"}, caplog)
    assert queue.deleted == ["r0"]
    warning = next(r for r in caplog.records if r.levelno == logging.WARNING)
    assert "llm-ping failed: LLMError: DeepSeek answered HTTP 401" in warning.getMessage()
