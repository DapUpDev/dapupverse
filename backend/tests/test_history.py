"""Student history in pgvector: load, search, and keep students apart.

Uses the real local embedding model (downloaded once, ~120 MB, then cached)
and a real PostgreSQL with pgvector. Run with -s to see the search results.
"""

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker

from app import history
from app.db import get_engine
from app.models import AccountType, Document, User

pytestmark = pytest.mark.usefixtures("configured_database")

MAYA_HISTORY = {
    ("mentor-note", "n1"): (
        "Maya has been stuck on the same integration by parts error in calculus for two weeks. "
        "She keeps choosing u and dv the wrong way round on the practice exam questions.\n\n"
        "We agreed she will redo five past-paper questions before next week and bring the worst one."
    ),
    ("meeting-summary", "m1"): (
        "30 minute meeting. Maya's Common App personal essay draft is finished but runs 150 words "
        "over the limit.\n\nAgenda for next time: cut the introduction and check the supplemental "
        "essays for Stanford and USC."
    ),
    ("check-in", "c1"): (
        "This week I finished my chemistry titration lab report.\n\nI'm still confused about "
        "calculus integration and I'm worried about the maths mock exam on Friday."
    ),
}
LEO_HISTORY = {
    ("mentor-note", "n2"): (
        "Leo is choosing between UBC and the University of Toronto for engineering. "
        "He wants to compare co-op programmes and living costs."
    ),
    ("check-in", "c2"): (
        "I sat my IELTS speaking test and got a 7.5.\n\nNext I need help with my physics "
        "internal assessment on projectile motion."
    ),
}


@pytest.fixture
def sessions():
    factory = sessionmaker(bind=get_engine(), expire_on_commit=False)
    with factory.begin() as s:
        s.add_all([User(id=sid, email=f"{sid}@example.com", account_type=AccountType.student)
                   for sid in ("u_maya", "u_leo")])
    return factory


@pytest.fixture
def loaded(sessions, fake_storage):
    for student_id, records in (("u_maya", MAYA_HISTORY), ("u_leo", LEO_HISTORY)):
        for (kind, record_id), body in records.items():
            history.save(fake_storage, student_id=student_id, kind=kind, record_id=record_id, body=body)
    assert history.ingest(sessions, fake_storage, history.get_embedder()) == 5
    return sessions


def show(title, passages):
    print(f"\n{title}")
    for p in passages:
        print(f"  {p.distance:.3f}  {p.s3_key}  {p.text[:90]!r}")


def test_files_are_saved_per_student_and_loading_twice_is_safe(loaded, fake_storage):
    assert fake_storage.list_keys("history/u_maya/") == [
        "history/u_maya/check-in/c1.md", "history/u_maya/meeting-summary/m1.md", "history/u_maya/mentor-note/n1.md",
    ]
    assert history.ingest(loaded, fake_storage, history.get_embedder()) == 0
    with loaded() as s:
        assert s.scalar(select(func.count()).select_from(Document)) == 5


def test_search_finds_the_right_passages_and_never_crosses_students(loaded):
    question = "What has the student been stuck on in maths?"

    maya = history.search(loaded, history.get_embedder(), student_id="u_maya", question=question, limit=3)
    show("Maya:", maya)
    assert maya[0].s3_key == "history/u_maya/mentor-note/n1.md"  # the two-week integration error
    assert all(p.s3_key.startswith("history/u_maya/") for p in maya)

    leo = history.search(loaded, history.get_embedder(), student_id="u_leo", question=question, limit=10)
    show("Leo, same question:", leo)
    assert leo and all(p.s3_key.startswith("history/u_leo/") for p in leo)
    assert not {p.text for p in maya} & {p.text for p in leo}


def test_chunks_group_paragraphs_up_to_the_limit():
    paragraph = "x" * 500
    assert history.chunk(f"{paragraph}\n\n{paragraph}\n\n{paragraph}") == [f"{paragraph}\n\n{paragraph}", paragraph]
    assert history.chunk("  \n\n ") == []
