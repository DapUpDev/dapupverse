"""Student profiles through the API, against a real PostgreSQL."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.db import get_engine
from app.main import app
from app.migrate import run_migrations
from tests.conftest import mint

MENTOR = {"accountType": "mentor"}
ADMIN = {"accountType": "mentor", "capabilities": {"isAdmin": True}}


@pytest.fixture(autouse=True)
def configured_database(database_url, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_engine.cache_clear()
    run_migrations()
    yield
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(text("DELETE FROM student_profiles"))
        connection.execute(text("DELETE FROM users"))
    engine.dispose()
    get_engine.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def bearer(keys, sub="user_stu1", metadata=None, **claims):
    private, _ = keys
    return {"Authorization": f"Bearer {mint(private, sub=sub, metadata=metadata, **claims)}"}


MAYA = {"fullName": "Maya Lin", "school": "Lincoln High", "yearLevel": "Grade 12",
        "educationSystem": "AP", "subjects": ["Mathematics", "Physics"], "biography": "Applying for CS."}


def test_ensure_then_update(client, keys):
    assert client.get("/me/student-profile", headers=bearer(keys)).status_code == 404
    ensured = client.put("/me/student-profile", json={}, headers=bearer(keys))
    assert ensured.status_code == 200, ensured.text
    assert ensured.json() == {"id": "user_stu1", "fullName": "", "school": "", "yearLevel": "",
                              "educationSystem": None, "subjects": [], "biography": ""}
    updated = client.put("/me/student-profile", json=MAYA, headers=bearer(keys)).json()
    assert updated["fullName"] == "Maya Lin" and updated["educationSystem"] == "AP"
    assert client.get("/me/student-profile", headers=bearer(keys)).json() == updated


def test_mentors_cannot_have_student_profiles(client, keys):
    assert client.put("/me/student-profile", json=MAYA, headers=bearer(keys, metadata=MENTOR)).status_code == 403
    assert client.get("/me/student-profile", headers=bearer(keys, metadata=MENTOR)).status_code == 403


def test_signed_out_is_rejected(client):
    assert client.put("/me/student-profile", json=MAYA).status_code == 401


def test_validation(client, keys):
    assert client.put("/me/student-profile", json={"educationSystem": "GCSE"}, headers=bearer(keys)).status_code == 422
    assert client.put("/me/student-profile", json={"fullName": "x" * 200}, headers=bearer(keys)).status_code == 422


def test_who_may_view_a_student(client, keys):
    client.put("/me/student-profile", json=MAYA, headers=bearer(keys))
    own = client.get("/students/user_stu1/profile", headers=bearer(keys))
    assert own.status_code == 200 and own.json()["school"] == "Lincoln High"
    # A mentor sees a student only once that student has sent them a request
    # (covered in test_connections); with none, it is a stranger.
    mentor = client.get("/students/user_stu1/profile", headers=bearer(keys, sub="user_m", metadata=MENTOR))
    assert mentor.status_code == 403
    admin = client.get("/students/user_stu1/profile", headers=bearer(keys, sub="user_a", metadata=ADMIN))
    assert admin.status_code == 200
    other_student = client.get("/students/user_stu1/profile", headers=bearer(keys, sub="user_stu2"))
    assert other_student.status_code == 403
    assert client.get("/students/user_stu1/profile").status_code == 401
    assert client.get("/students/user_nobody/profile", headers=bearer(keys, sub="user_a", metadata=ADMIN)).status_code == 404


def test_write_mirrors_the_user_row(client, keys, database_url):
    client.put("/me/student-profile", json=MAYA, headers=bearer(keys, email="maya@example.com"))
    engine = create_engine(database_url)
    with engine.connect() as connection:
        row = connection.execute(text("SELECT account_type, email FROM users WHERE id='user_stu1'")).one()
    engine.dispose()
    assert tuple(row) == ("student", "maya@example.com")
