"""Migrations apply, and upsert_user mirrors the caller into the users
table. Runs against a real PostgreSQL (see conftest)."""

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.auth import principal_from_claims
from app.db import get_engine
from app.mentors import upsert_user
from app.migrate import run_migrations

pytestmark = pytest.mark.usefixtures("configured_database")


def test_migration_creates_users_table(db, configured_database):
    inspector = inspect(db)
    assert "users" in inspector.get_table_names()
    columns = {c["name"] for c in inspector.get_columns("users")}
    assert {"id", "email", "account_type", "is_admin", "created_at", "updated_at", "last_seen_at"} <= columns
    current = db.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    assert current == configured_database  # the newest migration, whatever it is
    assert "mentor_profiles" in inspector.get_table_names()


def test_migrations_are_idempotent(configured_database):
    assert run_migrations() == configured_database  # second run: nothing to do, no error


def upsert(**claims):
    with Session(get_engine()) as session:
        upsert_user(session, principal_from_claims({"sub": "user_2abc", **claims}))
        session.commit()


def test_upsert_creates_the_users_row_with_least_privilege(db):
    upsert()
    row = db.execute(text("SELECT id, account_type, is_admin, email, last_seen_at FROM users")).one()
    assert tuple(row)[:4] == ("user_2abc", "student", False, None) and row.last_seen_at is not None


def test_upsert_refreshes_role_and_last_seen_without_duplicating(db):
    upsert()
    first = db.execute(text("SELECT created_at, last_seen_at FROM users")).one()
    upsert(metadata={"accountType": "mentor", "capabilities": {"isAdmin": True}}, email="jae@example.com")
    rows = db.execute(text("SELECT account_type, is_admin, email, created_at, last_seen_at FROM users")).all()
    assert len(rows) == 1 and tuple(rows[0])[:3] == ("mentor", True, "jae@example.com")
    assert rows[0].created_at == first.created_at and rows[0].last_seen_at >= first.last_seen_at


def test_upsert_never_erases_a_known_email(db):
    upsert(email="jae@example.com")
    upsert()  # a token without an email claim
    assert db.execute(text("SELECT email FROM users")).scalar_one() == "jae@example.com"
