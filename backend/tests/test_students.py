"""Student profiles through the API, against a real PostgreSQL."""

import pytest
from sqlalchemy import text

from tests.conftest import ADMIN, MENTOR

pytestmark = pytest.mark.usefixtures("configured_database")

auth = lambda bearer, sub="user_stu1", metadata=None, **claims: bearer(sub=sub, metadata=metadata, **claims)  # noqa: E731


MAYA = {"fullName": "Maya Lin", "school": "Lincoln High", "yearLevel": "Grade 12",
        "educationSystem": "AP", "subjects": ["Mathematics", "Physics"], "biography": "Applying for CS."}


def test_ensure_then_update(client, bearer):
    assert client.get("/me/student-profile", headers=auth(bearer)).status_code == 404
    ensured = client.put("/me/student-profile", json={}, headers=auth(bearer))
    assert ensured.status_code == 200, ensured.text
    assert ensured.json() == {"id": "user_stu1", "fullName": "", "school": "", "yearLevel": "",
                              "educationSystem": None, "subjects": [], "biography": "", "avatarUrl": None}
    updated = client.put("/me/student-profile", json=MAYA, headers=auth(bearer)).json()
    assert updated["fullName"] == "Maya Lin" and updated["educationSystem"] == "AP"
    assert client.get("/me/student-profile", headers=auth(bearer)).json() == updated


def test_mentors_cannot_have_student_profiles(client, bearer):
    assert client.put("/me/student-profile", json=MAYA, headers=auth(bearer, metadata=MENTOR)).status_code == 403
    assert client.get("/me/student-profile", headers=auth(bearer, metadata=MENTOR)).status_code == 403


def test_signed_out_is_rejected(client):
    assert client.put("/me/student-profile", json=MAYA).status_code == 401


def test_validation(client, bearer):
    assert client.put("/me/student-profile", json={"educationSystem": "GCSE"}, headers=auth(bearer)).status_code == 422
    assert client.put("/me/student-profile", json={"fullName": "x" * 200}, headers=auth(bearer)).status_code == 422


def test_who_may_view_a_student(client, bearer):
    client.put("/me/student-profile", json=MAYA, headers=auth(bearer))
    own = client.get("/students/user_stu1/profile", headers=auth(bearer))
    assert own.status_code == 200 and own.json()["school"] == "Lincoln High"
    # A mentor sees a student only once that student has sent them a request
    # (covered in test_connections); with none, it is a stranger.
    mentor = client.get("/students/user_stu1/profile", headers=auth(bearer, sub="user_m", metadata=MENTOR))
    assert mentor.status_code == 403
    admin = client.get("/students/user_stu1/profile", headers=auth(bearer, sub="user_a", metadata=ADMIN))
    assert admin.status_code == 200
    other_student = client.get("/students/user_stu1/profile", headers=auth(bearer, sub="user_stu2"))
    assert other_student.status_code == 403
    assert client.get("/students/user_stu1/profile").status_code == 401
    assert client.get("/students/user_nobody/profile", headers=auth(bearer, sub="user_a", metadata=ADMIN)).status_code == 404


def test_write_mirrors_the_user_row(client, bearer, db):
    client.put("/me/student-profile", json=MAYA, headers=auth(bearer, email="maya@example.com"))
    row = db.execute(text("SELECT account_type, email FROM users WHERE id='user_stu1'")).one()
    assert tuple(row) == ("student", "maya@example.com")
