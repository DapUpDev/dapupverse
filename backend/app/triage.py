"""The triage agent: decide whether a student needs a mentor meeting, and
how long, from this week's check-in. A LangGraph workflow run by the worker:

    load -> search -> ask -> check --valid--> save
                      ^        |
                      +--------+ invalid, first time (one retry)
                               |
                               +--invalid twice--> save as needs_mentor

load    this week's check-in, open tasks with deadlines, last meeting notes (RDS)
search  the student's history in pgvector, using the check-in text
ask     the configured model (app/llm.py; DeepSeek today, Bedrock later)
check   validate the answer in code (see validate())
save    one triage_decisions row per check-in. needs_mentor = book nothing,
        a mentor decides.

Every node logs one line. No names, emails or ids go to the model: the
prompt says "the student". (History passages may still mention a name.)
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from typing import Any, TypedDict

from langgraph.graph import END, START, StateGraph

log = logging.getLogger("dapup.triage")

DECISIONS = ("NO_MEETING", "15", "30", "45", "60")
MAX_ATTEMPTS = 2

RULES = """You triage weekly check-ins for DapUp, a mentoring service for high school students
applying to university. Decide whether this student needs a meeting with their mentor this
week, and how long it should be. Use the shortest length that will actually help.

- NO_MEETING: on track, nothing blocking them, confidence 4 or 5, no help asked for.
- 15: one small, specific question or a quick check-in; otherwise on track.
- 30: one real blocker, or a deadline within 14 days and confidence 3 or lower.
- 45: several blockers, or a deadline within 7 days and confidence 2 or lower, or work
  (an essay, an application) that needs reviewing together.
- 60: stuck on the same problem for two weeks or more (compare the check-in with the last
  meeting notes and the history), or several urgent deadlines with low confidence.
  Never more than 60.

Reply with ONLY a JSON object, no other text:
{"decision": "NO_MEETING" | "15" | "30" | "45" | "60",
 "reason": "one or two sentences a mentor can read at a glance",
 "blockers": "short summary of what is blocking the student, or \\"None\\"",
 "agenda": ["meeting agenda items; empty list only for NO_MEETING"]}"""


@dataclass(frozen=True)
class Answer:
    decision: str
    reason: str
    blockers: str
    agenda: list[str]


def validate(raw: str) -> tuple[Answer | None, str]:
    """(answer, "") when the model's reply is valid, else (None, why)."""
    text = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", raw or "")
    try:
        data = json.loads(text)
    except ValueError:
        return None, "the reply is not JSON"
    if not isinstance(data, dict):
        return None, "the reply is not a JSON object"
    decision = str(data.get("decision", "")).strip().upper()
    if decision not in DECISIONS:
        return None, f"decision must be one of {', '.join(DECISIONS)}"
    reason, blockers, agenda = data.get("reason"), data.get("blockers"), data.get("agenda")
    if not isinstance(reason, str) or not reason.strip():
        return None, "reason is missing"
    if not isinstance(blockers, str) or not blockers.strip():
        return None, "blockers is missing"
    if not isinstance(agenda, list) or not all(isinstance(a, str) and a.strip() for a in agenda):
        return None, "agenda must be a list of strings"
    if decision != "NO_MEETING" and not agenda:
        return None, "a meeting needs at least one agenda item"
    return Answer(decision, reason.strip(), blockers.strip(), [a.strip() for a in agenda]), ""


class State(TypedDict, total=False):
    check_in_id: str
    student_id: str
    context: dict[str, Any]
    history: list[str]
    attempts: int
    raw: str
    model: str
    answer: Answer | None
    error: str


@dataclass(frozen=True)
class Deps:
    """What the workflow needs from the outside world; tests and the
    evaluation job pass their own."""

    load: Callable[[str], dict[str, Any]]                  # check_in_id -> context (incl. student_id)
    search: Callable[[str, str], list[str]]                # (student_id, query) -> passages
    ask: Callable[[str, str], tuple[str, str]]             # (system, user) -> (reply text, model name)
    save: Callable[[State], None]


def user_prompt(context: dict[str, Any], history: list[str], today: date) -> str:
    c = context["check_in"]
    tasks = "\n".join(
        f"- {t['title']}" + (f" (due {t['due_on']}, in {(t['due_on'] - today).days} days)" if t.get("due_on") else "")
        for t in context["tasks"]
    ) or "- none"
    meeting = context.get("last_meeting")
    meeting_text = f"{meeting['held_on']}: {meeting['notes']}" if meeting else "no meeting yet"
    passages = "\n---\n".join(history) or "none"
    return (
        f"Today is {today}.\n\n"
        f"This week's check-in:\n"
        f"- What I got done: {c['progress'] or '(blank)'}\n"
        f"- What is blocking me: {c['blockers'] or '(blank)'}\n"
        f"- Confidence about my next deadline (1-5): {c['confidence'] or '(blank)'}\n"
        f"- What I want help with: {c['help_wanted'] or '(blank)'}\n\n"
        f"Open tasks:\n{tasks}\n\n"
        f"Last meeting notes ({meeting_text})\n\n"
        f"Relevant history:\n{passages}"
    )


def build(deps: Deps, today: Callable[[], date] = date.today):
    def load(state: State) -> State:
        context = deps.load(state["check_in_id"])
        log.info("triage %s load: %d open task(s), last meeting %s", state["check_in_id"],
                 len(context["tasks"]), "yes" if context.get("last_meeting") else "none")
        return {"context": context, "student_id": context["student_id"], "attempts": 0}

    def search(state: State) -> State:
        c = state["context"]["check_in"]
        query = " ".join(filter(None, (c["progress"], c["blockers"], c["help_wanted"])))
        passages = deps.search(state["student_id"], query) if query else []
        log.info("triage %s search: %d history passage(s)", state["check_in_id"], len(passages))
        return {"history": passages}

    def ask(state: State) -> State:
        attempts = state["attempts"] + 1
        prompt = user_prompt(state["context"], state["history"], today())
        if attempts > 1:
            prompt += f"\n\nYour previous reply was invalid ({state['error']}). Reply with only the JSON object."
        try:
            raw, model = deps.ask(RULES, prompt)
        except Exception as exc:  # noqa: BLE001 - a failed call counts as an invalid answer
            raw, model = "", state.get("model", "")
            log.warning("triage %s ask #%d failed: %s: %s", state["check_in_id"], attempts, type(exc).__name__, exc)
        log.info("triage %s ask #%d: %d character(s) from %s", state["check_in_id"], attempts, len(raw), model or "?")
        return {"attempts": attempts, "raw": raw, "model": model}

    def check(state: State) -> State:
        answer, error = validate(state["raw"])
        log.info("triage %s check #%d: %s", state["check_in_id"], state["attempts"],
                 f"valid ({answer.decision})" if answer else f"invalid ({error})")
        return {"answer": answer, "error": error}

    def after_check(state: State) -> str:
        if state["answer"] is None and state["attempts"] < MAX_ATTEMPTS:
            return "ask"
        return "save"

    def save(state: State) -> State:
        deps.save(state)
        answer = state["answer"]
        log.info("triage %s save: %s", state["check_in_id"],
                 f"decided {answer.decision}: {answer.reason}" if answer
                 else f"needs_mentor after {state['attempts']} invalid answer(s): {state['error']}")
        return {}

    graph = StateGraph(State)
    for name, node in (("load", load), ("search", search), ("ask", ask), ("check", check), ("save", save)):
        graph.add_node(name, node)
    graph.add_edge(START, "load")
    graph.add_edge("load", "search")
    graph.add_edge("search", "ask")
    graph.add_edge("ask", "check")
    graph.add_conditional_edges("check", after_check, ["ask", "save"])
    graph.add_edge("save", END)
    return graph.compile()


def run(deps: Deps, check_in_id: str, today: Callable[[], date] = date.today) -> State:
    return build(deps, today).invoke({"check_in_id": check_in_id})


# ---- production wiring: RDS, pgvector, the configured model ---------------

def db_deps(sessions) -> Deps:
    from sqlalchemy import select
    from sqlalchemy.dialects.postgresql import insert

    from app import history, llm
    from app.models import CheckIn, Meeting, Task, TriageDecision

    def load(check_in_id: str) -> dict[str, Any]:
        with sessions() as session:
            c = session.get(CheckIn, check_in_id)
            tasks = session.scalars(
                select(Task).where(Task.student_id == c.student_id, Task.done.is_(False))
                .order_by(Task.due_on.asc().nulls_last()).limit(20)
            ).all()
            meeting = session.scalars(
                select(Meeting).where(Meeting.student_id == c.student_id).order_by(Meeting.held_on.desc()).limit(1)
            ).first()
            return {
                "student_id": c.student_id,
                "check_in": {"progress": c.progress, "blockers": c.blockers,
                             "confidence": c.confidence, "help_wanted": c.help_wanted},
                "tasks": [{"title": t.title, "due_on": t.due_on} for t in tasks],
                "last_meeting": {"held_on": meeting.held_on, "notes": meeting.notes} if meeting else None,
            }

    def search(student_id: str, query: str) -> list[str]:
        found = history.search(sessions, history.get_embedder(), student_id=student_id, question=query, limit=5)
        return [p.text for p in found]

    def ask(system: str, user: str) -> tuple[str, str]:
        reply = llm.complete(system, user, max_tokens=800)
        if reply is None:
            raise llm.LLMError("LLM_PROVIDER is not set")
        return reply.text, f"{reply.provider}/{reply.model}"

    def save(state: State) -> None:
        answer = state["answer"]
        values = {
            "student_id": state["student_id"], "check_in_id": state["check_in_id"],
            "status": "decided" if answer else "needs_mentor",
            "decision": answer.decision if answer else None,
            "reason": answer.reason if answer else "",
            "blockers": answer.blockers if answer else "",
            "agenda": answer.agenda if answer else [],
            "error": "" if answer else f"{state['error']}; last reply: {state['raw'][:500]}",
            "model": state.get("model", ""), "attempts": state["attempts"],
        }
        with sessions.begin() as session:
            session.execute(insert(TriageDecision).values(**values).on_conflict_do_nothing(index_elements=["check_in_id"]))

    return Deps(load=load, search=search, ask=ask, save=save)


def triage_check_in(sessions, check_in_id: str) -> State | None:
    """The worker's "triage" job. Skips a check-in that is not answered yet
    or already has a decision, so a retried message never decides twice."""
    import uuid

    from app.models import CheckIn, TriageDecision

    try:
        check_in_id = uuid.UUID(str(check_in_id))
    except ValueError:
        log.warning("triage skipped: %r is not a check-in id", check_in_id)
        return None
    with sessions() as session:
        check_in = session.get(CheckIn, check_in_id)
        decided = session.query(TriageDecision.id).filter_by(check_in_id=check_in_id).first()
    if check_in is None or check_in.answered_at is None:
        log.warning("triage %s skipped: no answered check-in with that id", check_in_id)
        return None
    if decided:
        log.info("triage %s skipped: already decided", check_in_id)
        return None
    return run(db_deps(sessions), check_in_id)


# ---- evaluation: five made-up check-ins with known answers ----------------

D = date(2026, 10, 15)  # the evaluation's "today"; deadlines are relative to it
EVAL_CASES: list[tuple[str, set[str], dict[str, Any], list[str]]] = [
    ("on track, nothing blocking", {"NO_MEETING"}, {
        "check_in": {"progress": "Finished my chemistry lab report and two maths past papers.",
                     "blockers": "Nothing really.", "confidence": 5, "help_wanted": ""},
        "tasks": [{"title": "Physics internal assessment draft", "due_on": date(2026, 11, 20)}],
        "last_meeting": {"held_on": date(2026, 10, 1), "notes": "On track. Keep going with past papers."}},
     []),
    ("stuck on the same error for two weeks", {"45", "60"}, {
        "check_in": {"progress": "Not much, I kept redoing the same calculus questions.",
                     "blockers": "Still getting integration by parts wrong, same as last time.",
                     "confidence": 2, "help_wanted": "Calculus, I don't get why my answers are wrong."},
        "tasks": [{"title": "Maths mock exam", "due_on": date(2026, 10, 24)}],
        "last_meeting": {"held_on": date(2026, 10, 1),
                         "notes": "Stuck on integration by parts (choosing u and dv). Redo five past-paper questions."}},
     ["Two weeks ago: student stuck on integration by parts, keeps choosing u and dv the wrong way round."]),
    ("essay due in three days, low confidence", {"30", "45"}, {
        "check_in": {"progress": "Wrote a full draft of my Common App personal essay.",
                     "blockers": "It is 150 words over the limit and I don't know what to cut.",
                     "confidence": 2, "help_wanted": "Essay review before I submit."},
        "tasks": [{"title": "Submit Common App personal essay", "due_on": date(2026, 10, 18)}],
        "last_meeting": {"held_on": date(2026, 10, 8), "notes": "Brainstormed essay topics; picked the robotics club story."}},
     []),
    ("one small question", {"15"}, {
        "check_in": {"progress": "Booked my IELTS test and finished my reading practice.",
                     "blockers": "None.", "confidence": 4,
                     "help_wanted": "Quick question: should I send IELTS scores to all my universities now or later?"},
        "tasks": [{"title": "IELTS test", "due_on": date(2026, 11, 28)}],
        "last_meeting": {"held_on": date(2026, 10, 8), "notes": "On track."}},
     []),
    ("one new blocker, deadline in two weeks", {"15", "30"}, {
        "check_in": {"progress": "Collected all my data for the physics internal assessment.",
                     "blockers": "I'm not sure how to do the uncertainty analysis for my graphs.",
                     "confidence": 3, "help_wanted": "Uncertainty analysis for the physics IA."},
        "tasks": [{"title": "Physics internal assessment draft", "due_on": date(2026, 10, 29)}],
        "last_meeting": {"held_on": date(2026, 10, 8), "notes": "Planned the IA method. Data collection next."}},
     []),
]


def evaluate(ask: Callable[[str, str], tuple[str, str]]) -> int:
    """Run every evaluation case through the real workflow with the given
    model call (nothing is read from or written to the database). Logs
    expected vs actual; returns how many matched."""
    saved: dict[str, State] = {}
    matched = 0
    for i, (name, expected, context, passages) in enumerate(EVAL_CASES, 1):
        case_id = f"eval-{i}"
        deps = Deps(load=lambda _id, c=context: {"student_id": "eval-student", **c},
                    search=lambda _s, _q, p=passages: p, ask=ask,
                    save=lambda state: saved.__setitem__(state["check_in_id"], state))
        state = run(deps, case_id, today=lambda: D)
        answer = state["answer"]
        got = answer.decision if answer else "needs_mentor"
        ok = got in expected
        matched += ok
        log.info("triage-eval %s %s: expected %s, got %s%s", case_id, "MATCH" if ok else "DIFF", "/".join(sorted(expected)),
                 got, f" - {answer.reason}" if answer else "")
    log.info("triage-eval: %d of %d matched", matched, len(EVAL_CASES))
    return matched
