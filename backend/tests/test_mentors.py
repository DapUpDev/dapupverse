"""Mentor directory and profiles through the API, against a real PostgreSQL."""

import pytest
from sqlalchemy import text

from tests.conftest import ADMIN, MENTOR

pytestmark = pytest.mark.usefixtures("configured_database")

auth = lambda bearer, sub="user_mentor1", metadata=MENTOR, **claims: bearer(sub=sub, metadata=metadata, **claims)  # noqa: E731


JAE = {
    "name": "Jae Park", "university": "Stanford University", "major": "Computer Science",
    "countryRegion": "United States", "biography": "IB grad; essays and CS applications.",
    "services": ["Essay review", "Interview prep"], "subjects": ["Computer Science", "Mathematics"],
    "educationSystems": ["IB", "AP"], "privatePriceUsd": 40,
}


def test_directory_is_empty_on_a_fresh_database(client):
    assert client.get("/mentors").json() == []


def test_mentor_creates_profile_and_appears_publicly_without_price(client, bearer):
    created = client.put("/me/mentor-profile", json=JAE, headers=auth(bearer))
    assert created.status_code == 200, created.text
    assert created.json()["privatePriceUsd"] == "40.00"
    assert created.json()["slug"] == "jae-park"

    listing = client.get("/mentors").json()
    assert [m["slug"] for m in listing] == ["jae-park"]
    public = listing[0]
    assert public["name"] == "Jae Park" and public["id"] == "user_mentor1"
    assert "privatePriceUsd" not in public and "price" not in str(public).lower()

    detail = client.get("/mentors/jae-park")
    assert detail.status_code == 200 and "privatePriceUsd" not in detail.json()


def test_ensure_then_fill_in_later(client, bearer):
    ensured = client.put("/me/mentor-profile", json={}, headers=auth(bearer)).json()
    assert ensured["name"] == "" and ensured["slug"] == "user_mentor1"
    assert client.get("/mentors").json() == []  # unfilled profiles are not listed
    assert client.get("/mentors/user_mentor1").status_code == 404
    filled = client.put("/me/mentor-profile", json={"name": "Jae Park"}, headers=auth(bearer)).json()
    assert filled["slug"] == "jae-park"  # minted from the first real name
    renamed = client.put("/me/mentor-profile", json={"name": "Jae K. Park"}, headers=auth(bearer)).json()
    assert renamed["slug"] == "jae-park"  # and stable afterwards


def test_slugs_are_unique(client, bearer):
    client.put("/me/mentor-profile", json={"name": "Jae Park"}, headers=auth(bearer, sub="user_a"))
    second = client.put("/me/mentor-profile", json={"name": "Jae Park"}, headers=auth(bearer, sub="user_b")).json()
    assert second["slug"] == "jae-park-2"


def test_filters(client, bearer):
    client.put("/me/mentor-profile", json=JAE, headers=auth(bearer, sub="user_jae"))
    client.put("/me/mentor-profile", json={**JAE, "name": "Mira Chen", "university": "University of Cambridge",
                                           "countryRegion": "United Kingdom", "subjects": ["Chemistry"],
                                           "educationSystems": ["A Levels"], "services": ["Subject tutoring"]},
               headers=auth(bearer, sub="user_mira"))
    names = lambda r: [m["name"] for m in r.json()]  # noqa: E731
    assert names(client.get("/mentors")) == ["Jae Park", "Mira Chen"]
    assert names(client.get("/mentors", params={"query": "cambridge"})) == ["Mira Chen"]
    assert names(client.get("/mentors", params={"query": "mathematics"})) == ["Jae Park"]
    assert names(client.get("/mentors", params={"educationSystem": "AP"})) == ["Jae Park"]
    assert names(client.get("/mentors", params={"subject": "Chemistry"})) == ["Mira Chen"]
    assert names(client.get("/mentors", params={"countryRegion": "United States"})) == ["Jae Park"]
    assert names(client.get("/mentors", params={"university": "University of Cambridge"})) == ["Mira Chen"]
    assert names(client.get("/mentors", params={"serviceType": "Interview prep"})) == ["Jae Park"]
    assert names(client.get("/mentors", params={"query": "zzz"})) == []


def test_students_cannot_create_mentor_profiles(client, bearer):
    response = client.put("/me/mentor-profile", json=JAE, headers=auth(bearer, metadata=None))
    assert response.status_code == 403


def test_signed_out_cannot_write(client):
    assert client.put("/me/mentor-profile", json=JAE).status_code == 401


def test_validation_rejects_unknown_vocabulary_and_negative_price(client, bearer):
    bad_service = client.put("/me/mentor-profile", json={"services": ["Life coaching"]}, headers=auth(bearer))
    assert bad_service.status_code == 422
    bad_price = client.put("/me/mentor-profile", json={"privatePriceUsd": -5}, headers=auth(bearer))
    assert bad_price.status_code == 422


def test_private_profile_visibility(client, bearer):
    client.put("/me/mentor-profile", json=JAE, headers=auth(bearer, sub="user_jae"))
    own = client.get("/mentors/user_jae/private", headers=auth(bearer, sub="user_jae"))
    assert own.status_code == 200 and own.json()["privatePriceUsd"] == "40.00"
    admin = client.get("/mentors/user_jae/private", headers=auth(bearer, sub="user_admin", metadata=ADMIN))
    assert admin.status_code == 200
    other_mentor = client.get("/mentors/user_jae/private", headers=auth(bearer, sub="user_other"))
    assert other_mentor.status_code == 403
    student = client.get("/mentors/user_jae/private", headers=auth(bearer, sub="user_stu", metadata=None))
    assert student.status_code == 403
    assert client.get("/mentors/user_jae/private").status_code == 401
    missing = client.get("/mentors/user_nobody/private", headers=auth(bearer, sub="user_x"))
    assert missing.status_code == 403  # not 404: no id enumeration


def test_my_profile_404_before_ensure_then_200(client, bearer):
    assert client.get("/me/mentor-profile", headers=auth(bearer)).status_code == 404
    client.put("/me/mentor-profile", json={}, headers=auth(bearer))
    assert client.get("/me/mentor-profile", headers=auth(bearer)).status_code == 200


def test_write_also_mirrors_the_user_row(client, bearer, db):
    client.put("/me/mentor-profile", json=JAE, headers=auth(bearer, email="jae@example.com"))
    row = db.execute(text("SELECT account_type, email FROM users WHERE id='user_mentor1'")).one()
    assert tuple(row) == ("mentor", "jae@example.com")
