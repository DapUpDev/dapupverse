"""The triage agent: answer checking, one retry, and the saved decision."""

import json
import logging
from datetime import UTC, date, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app import llm, triage
from app.db import get_engine
from app.llm import Reply
from app.models import AccountType, CheckIn, Meeting, Task, TriageDecision, User

GOOD = json.dumps({"decision": "45", "reason": "Stuck on the same calculus error for two weeks.",
                   "blockers": "Integration by parts", "agenda": ["Work through two past-paper questions together"]})
NO_MEETING = json.dumps({"decision": "NO_MEETING", "reason": "On track.", "blockers": "None", "agenda": []})


@pytest.mark.parametrize("raw, error", [
    (GOOD, ""),
    (f"```json\n{GOOD}\n```", ""),
    (NO_MEETING, ""),
    (json.dumps({"decision": 30, "reason": "r", "blockers": "b", "agenda": ["a"]}), ""),
    ("Sure! I think 30 minutes.", "the reply is not JSON"),
    (json.dumps({"decision": "20", "reason": "r", "blockers": "b", "agenda": ["a"]}), "decision must be one of"),
    (json.dumps({"decision": "90", "reason": "r", "blockers": "b", "agenda": ["a"]}), "decision must be one of"),
    (json.dumps({"decision": "30", "reason": " ", "blockers": "b", "agenda": ["a"]}), "reason is missing"),
    (json.dumps({"decision": "30", "reason": "r", "agenda": ["a"]}), "blockers is missing"),
    (json.dumps({"decision": "30", "reason": "r", "blockers": "b", "agenda": "a"}), "agenda must be a list"),
    (json.dumps({"decision": "30", "reason": "r", "blockers": "b", "agenda": []}), "a meeting needs at least one agenda item"),
])
def test_validate(raw, error):
    answer, why = triage.validate(raw)
    assert why.startswith(error) if error else (answer is not None and why == "")


CONTEXT = {"student_id": "s1", "tasks": [], "last_meeting": None,
           "check_in": {"progress": "p", "blockers": "b", "confidence": 3, "help_wanted": "h"}}


def run_with(replies):
    calls, saved = [], []

    def ask(system, user):
        calls.append(user)
        reply = replies[len(calls) - 1]
        if isinstance(reply, Exception):
            raise reply
        return reply, "fake/model"

    deps = triage.Deps(load=lambda _id: CONTEXT, search=lambda _s, _q: ["passage"], ask=ask, save=saved.append)
    state = triage.run(deps, "c1", today=lambda: date(2026, 10, 15))
    return state, calls, saved


def test_a_valid_first_answer_is_saved(caplog):
    with caplog.at_level(logging.INFO, logger="dapup.triage"):
        state, calls, saved = run_with([GOOD])
    assert len(calls) == 1 and saved[0]["answer"].decision == "45"
    steps = [r.getMessage().split(":")[0] for r in caplog.records]
    assert steps == ["triage c1 load", "triage c1 search", "triage c1 ask #1", "triage c1 check #1", "triage c1 save"]


def test_an_invalid_answer_is_asked_once_more():
    state, calls, saved = run_with(["not json", GOOD])
    assert len(calls) == 2 and "previous reply was invalid (the reply is not JSON)" in calls[1]
    assert saved[0]["answer"].decision == "45" and saved[0]["attempts"] == 2


@pytest.mark.parametrize("replies", [["nope", "still nope"], [RuntimeError("timeout"), "{}"]])
def test_two_invalid_answers_book_nothing_and_flag_the_mentor(replies):
    state, calls, saved = run_with(replies)
    assert len(calls) == 2
    assert saved[0]["answer"] is None and saved[0]["error"]


@pytest.mark.usefixtures("configured_database")
class TestWithDatabase:
    @pytest.fixture
    def sessions(self):
        factory = sessionmaker(bind=get_engine(), expire_on_commit=False)
        with factory.begin() as s:
            s.add(User(id="u_maya", email="maya@example.com", account_type=AccountType.student))
            s.flush()
            s.add_all([
                Task(student_id="u_maya", title="Maths mock exam", due_on=date(2026, 10, 24)),
                Task(student_id="u_maya", title="Old task", done=True),
                Meeting(student_id="u_maya", held_on=date(2026, 10, 1), notes="Stuck on integration by parts."),
            ])
        return factory

    @pytest.fixture
    def check_in(self, sessions):
        with sessions.begin() as s:
            row = CheckIn(student_id="u_maya", week_start=date(2026, 10, 12), status="answered",
                          progress="Redid calculus questions.", blockers="Same integration error.", confidence=2,
                          help_wanted="Calculus", answered_at=datetime(2026, 10, 13, tzinfo=UTC))
            s.add(row)
        return str(row.id)

    def fake_model(self, monkeypatch, *texts):
        prompts = []

        def complete(system, user, max_tokens=1024):
            prompts.append(user)
            return Reply(text=texts[len(prompts) - 1], provider="fake", model="m", input_tokens=1, output_tokens=1)

        monkeypatch.setattr(llm, "complete", complete)
        return prompts

    def decision(self, sessions):
        with sessions() as s:
            return s.scalars(select(TriageDecision)).one()

    def test_a_check_in_produces_a_saved_decision_once(self, sessions, check_in, monkeypatch):
        prompts = self.fake_model(monkeypatch, GOOD)
        triage.triage_check_in(sessions, check_in)
        row = self.decision(sessions)
        assert (row.status, row.decision, row.attempts, row.model) == ("decided", "45", 1, "fake/m")
        assert row.agenda == ["Work through two past-paper questions together"]
        assert "Maths mock exam (due 2026-10-24" in prompts[0] and "Old task" not in prompts[0]
        assert "Stuck on integration by parts." in prompts[0]
        assert "maya" not in prompts[0].lower()  # no names or ids go to the model

        assert triage.triage_check_in(sessions, check_in) is None  # a retried message decides nothing new
        assert len(prompts) == 1

    def test_a_broken_model_books_nothing(self, sessions, check_in, monkeypatch):
        self.fake_model(monkeypatch, "I'd say thirty minutes", '{"decision": "maybe"}')
        triage.triage_check_in(sessions, check_in)
        row = self.decision(sessions)
        assert (row.status, row.decision, row.attempts) == ("needs_mentor", None, 2)
        assert row.error.startswith("decision must be one of") and "maybe" in row.error

    def test_unanswered_or_unknown_check_ins_are_skipped(self, sessions):
        with sessions.begin() as s:
            row = CheckIn(student_id="u_maya", week_start=date(2026, 10, 12))
            s.add(row)
        assert triage.triage_check_in(sessions, str(row.id)) is None
        assert triage.triage_check_in(sessions, "not-a-uuid") is None


def test_evaluation_runs_every_case_through_the_workflow():
    replies = iter([NO_MEETING, GOOD, GOOD, NO_MEETING, GOOD])
    # Stub replies, one per case in order: cases 1-3 match their expected answers, 4-5 do not.
    assert triage.evaluate(lambda system, user: (next(replies), "fake/m")) == 3
