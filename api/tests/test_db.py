"""The first real table: migrations apply, /me writes and reads it, /ready
reports the database. Runs against a real PostgreSQL (see conftest)."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, text

from app.db import get_engine
from app.migrate import run_migrations
from tests.conftest import mint


@pytest.fixture(autouse=True)
def configured_database(database_url, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_engine.cache_clear()
    head = run_migrations()
    yield head
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM users"))
    engine.dispose()
    get_engine.cache_clear()


@pytest.fixture
def client():
    return TestClient(app_module().app)


def app_module():
    import app.main as main

    return main


def bearer(keys, **claims) -> dict[str, str]:
    private, _ = keys
    return {"Authorization": f"Bearer {mint(private, **claims)}"}


def test_migration_creates_users_table(database_url, configured_database):
    engine = create_engine(database_url)
    inspector = inspect(engine)
    assert "users" in inspector.get_table_names()
    columns = {c["name"] for c in inspector.get_columns("users")}
    assert {"id", "email", "account_type", "is_admin", "created_at", "updated_at", "last_seen_at"} <= columns
    with engine.connect() as connection:
        current = connection.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
    assert current == configured_database  # the newest migration, whatever it is
    assert "mentor_profiles" in inspector.get_table_names()
    engine.dispose()


def test_migrations_are_idempotent(configured_database):
    assert run_migrations() == configured_database  # second run: nothing to do, no error


def test_ready_reports_database(client):
    response = client.get("/ready")
    assert response.status_code == 200
    assert response.json() == {"database": "ok"}


def test_ready_is_503_when_unconfigured(client, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    get_engine.cache_clear()
    assert client.get("/ready").status_code == 503


def test_me_creates_the_users_row_with_least_privilege(client, keys, database_url):
    response = client.get("/me", headers=bearer(keys))
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == "user_2abc"
    assert body["account_type"] == "student"
    assert body["is_admin"] is False
    assert body["email"] is None
    assert body["last_seen_at"] is not None
    engine = create_engine(database_url)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM users")).scalar_one() == 1
    engine.dispose()


def test_me_refreshes_role_and_last_seen_without_duplicating(client, keys, database_url):
    first = client.get("/me", headers=bearer(keys)).json()
    second = client.get(
        "/me",
        headers=bearer(keys, metadata={"accountType": "mentor", "capabilities": {"isAdmin": True}},
                       email="jae@example.com"),
    ).json()
    assert second["account_type"] == "mentor"
    assert second["is_admin"] is True
    assert second["email"] == "jae@example.com"
    assert second["created_at"] == first["created_at"]
    assert second["last_seen_at"] >= first["last_seen_at"]
    engine = create_engine(database_url)
    with engine.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM users")).scalar_one() == 1
    engine.dispose()


def test_me_never_erases_a_known_email(client, keys):
    client.get("/me", headers=bearer(keys, email="jae@example.com"))
    later = client.get("/me", headers=bearer(keys)).json()  # token without an email claim
    assert later["email"] == "jae@example.com"
