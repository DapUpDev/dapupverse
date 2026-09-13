"""The queue worker, against a fake SQS client: no network, no AWS."""

import json
import logging
import threading

from app import worker


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
    queue = FakeQueue([json.dumps({"job": "a"})])
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
