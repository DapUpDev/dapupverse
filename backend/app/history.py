"""Student history: one text file per record in S3, searchable in pgvector.

Files live at history/<student_id>/<kind>/<record_id>.md, written by the API
with save() whenever a mentor note, meeting summary or check-in answer is
created. The worker's "ingest-history" job (ingest()) picks up every file it
has not seen, splits it into chunks of a few paragraphs, embeds each chunk
and stores it with the file's student_id. A file is recorded in `documents`
in the same transaction as its chunks, so a rerun skips it.

search() always filters by student_id inside the SQL query, so one
student's history can never come back for another student.

Embeddings come from a small model that runs inside the worker (no API, no
key, nothing leaves AWS). ponytail: one embedder; when Bedrock opens up, add
a Titan Text Embeddings V2 class with dimensions=512 behind get_embedder()
and re-run ingestion (delete the documents rows first so every file is redone).
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, sessionmaker

from app.models import Document, User
from app.storage import Storage

log = logging.getLogger("dapup.history")

PREFIX = "history/"
KINDS = ("mentor-note", "meeting-summary", "check-in")
CHUNK_CHARS = 1200  # "a few paragraphs"
MODEL = "jinaai/jina-embeddings-v2-small-en"  # 512 numbers per text


def history_key(student_id: str, kind: str, record_id: str) -> str:
    return f"{PREFIX}{student_id}/{kind}/{record_id}.md"


def save(storage: Storage, *, student_id: str, kind: str, record_id: str, body: str) -> str:
    """Write one history record to S3 and return its key."""
    if kind not in KINDS:
        raise ValueError(f"unknown history kind {kind!r}")
    key = history_key(student_id, kind, record_id)
    storage.put_text(key, body)
    return key


def chunk(body: str) -> list[str]:
    """Group paragraphs into chunks of up to CHUNK_CHARS. A single longer
    paragraph stays whole (the model reads up to 8k tokens)."""
    chunks: list[str] = []
    current = ""
    for paragraph in (p.strip() for p in re.split(r"\n\s*\n", body)):
        if not paragraph:
            continue
        if current and len(current) + len(paragraph) + 2 > CHUNK_CHARS:
            chunks.append(current)
            current = paragraph
        else:
            current = f"{current}\n\n{paragraph}" if current else paragraph
    if current:
        chunks.append(current)
    return chunks


class Embedder(Protocol):
    def documents(self, texts: list[str]) -> list[list[float]]: ...
    def query(self, question: str) -> list[float]: ...


class LocalEmbedder:
    """fastembed (ONNX, CPU). The Docker image ships the model files in
    EMBED_CACHE_DIR, so production never downloads anything."""

    def __init__(self) -> None:
        from fastembed import TextEmbedding

        self.model = TextEmbedding(MODEL, cache_dir=os.getenv("EMBED_CACHE_DIR"))

    def documents(self, texts: list[str]) -> list[list[float]]:
        return [vector.tolist() for vector in self.model.embed(texts)]

    def query(self, question: str) -> list[float]:
        return next(iter(self.model.query_embed([question]))).tolist()


@lru_cache
def get_embedder() -> Embedder:
    return LocalEmbedder()


def _vector(values: list[float]) -> str:
    return "[" + ",".join(repr(float(v)) for v in values) + "]"


def ingest(sessions: sessionmaker[Session], storage: Storage, embedder: Embedder) -> int:
    """Load every history file not yet in `documents`. Returns files loaded."""
    keys = storage.list_keys(PREFIX)
    with sessions() as session:
        done = set(session.scalars(select(Document.s3_key).where(Document.s3_key.in_(keys))))

    loaded = 0
    for key in keys:
        if key in done:
            continue
        parts = key[len(PREFIX):].split("/")
        if len(parts) != 3 or parts[1] not in KINDS:
            log.warning("ingest-history: skipping unexpected key %s", key)
            continue
        student_id, kind, _ = parts
        texts = chunk(storage.get_text(key))
        vectors = embedder.documents(texts) if texts else []
        with sessions.begin() as session:
            if session.get(User, student_id) is None:
                log.warning("ingest-history: no user %s for %s; will retry next run", student_id, key)
                continue
            document_id = session.execute(
                insert(Document).values(student_id=student_id, s3_key=key, kind=kind)
                .on_conflict_do_nothing(index_elements=["s3_key"]).returning(Document.id)
            ).scalar()
            if document_id is None:
                continue  # another run loaded it meanwhile
            if texts:
                session.execute(
                    text("INSERT INTO document_chunks (document_id, student_id, chunk_index, text, embedding) "
                         "VALUES (:document_id, :student_id, :chunk_index, :text, CAST(:embedding AS vector))"),
                    [{"document_id": document_id, "student_id": student_id, "chunk_index": i,
                      "text": t, "embedding": _vector(v)} for i, (t, v) in enumerate(zip(texts, vectors))],
                )
        log.info("ingest-history: %s -> %d chunk(s)", key, len(texts))
        loaded += 1
    log.info("ingest-history: %d new file(s), %d already loaded", loaded, len(done))
    return loaded


@dataclass(frozen=True)
class Passage:
    text: str
    kind: str
    s3_key: str
    distance: float  # cosine distance: 0 = same meaning


def search(sessions: sessionmaker[Session], embedder: Embedder, *, student_id: str, question: str,
           limit: int = 5) -> list[Passage]:
    """The closest chunks to `question`, from this student's history only."""
    with sessions() as session:
        rows = session.execute(
            text("SELECT c.text, d.kind, d.s3_key, c.embedding <=> CAST(:q AS vector) AS distance "
                 "FROM document_chunks c JOIN documents d ON d.id = c.document_id "
                 "WHERE c.student_id = :student_id ORDER BY distance LIMIT :limit"),
            {"q": _vector(embedder.query(question)), "student_id": student_id, "limit": limit},
        ).all()
    return [Passage(text=r.text, kind=r.kind, s3_key=r.s3_key, distance=float(r.distance)) for r in rows]
