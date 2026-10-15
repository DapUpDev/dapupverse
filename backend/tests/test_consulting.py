"""Admin: consulting students, their mentor teams, the check-in schedule."""

import pytest

from tests.conftest import ADMIN, MENTOR, MENTOR_PROFILE, STUDENT_PROFILE

pytestmark = pytest.mark.usefixtures("configured_database")


@pytest.fixture
def people(client, bearer):
    """Two students, three mentors (one of them the admin), and the admin's headers."""
    for sub in ("user_maya", "user_leo"):
        client.put("/me/student-profile", json=STUDENT_PROFILE, headers=bearer(sub=sub, email=f"{sub}@example.com"))
    for sub in ("user_jae", "user_kim", "user_ola"):
        client.put("/me/mentor-profile", json=MENTOR_PROFILE, headers=bearer(sub=sub, metadata=MENTOR))
    admin = bearer(sub="user_admin", metadata=ADMIN)
    client.put("/me/mentor-profile", json=MENTOR_PROFILE, headers=admin)
    return admin


def test_only_admins_can_use_it(client, bearer, people):
    for headers in (bearer(sub="user_jae", metadata=MENTOR), bearer(sub="user_maya")):
        assert client.get("/admin/consulting/students", headers=headers).status_code == 403
        assert client.get("/admin/settings", headers=headers).status_code == 403
        assert client.put("/admin/consulting/students/user_maya", json={"consulting": True},
                          headers=headers).status_code == 403
    assert client.get("/admin/settings").status_code == 401


def test_admin_marks_a_consulting_student_and_picks_their_team(client, people):
    listed = client.get("/admin/consulting/students", headers=people).json()
    assert {s["id"] for s in listed} == {"user_maya", "user_leo"}
    assert all(s["consulting"] is False and s["mentorIds"] == [] for s in listed)

    response = client.put("/admin/consulting/students/user_maya",
                          json={"consulting": True, "mentorIds": ["user_kim", "user_jae", "user_ola"]}, headers=people)
    assert response.status_code == 200, response.text
    assert response.json()["consulting"] is True
    assert response.json()["mentorIds"] == ["user_jae", "user_kim", "user_ola"]

    first = client.get("/admin/consulting/students", headers=people).json()[0]
    assert (first["id"], first["consulting"], first["email"]) == ("user_maya", True, "user_maya@example.com")

    # Changing the team replaces it.
    client.put("/admin/consulting/students/user_maya", json={"consulting": True, "mentorIds": ["user_ola"]},
               headers=people)
    assert client.get("/admin/consulting/students", headers=people).json()[0]["mentorIds"] == ["user_ola"]


@pytest.mark.parametrize("body, code", [
    ({"consulting": True, "mentorIds": ["user_jae", "user_kim", "user_ola", "user_admin"]}, 422),  # more than 3
    ({"consulting": True, "mentorIds": ["user_leo"]}, 422),  # a student, not a mentor
    ({"consulting": True, "mentorIds": ["nobody"]}, 422),
])
def test_team_rules(client, people, body, code):
    assert client.put("/admin/consulting/students/user_maya", json=body, headers=people).status_code == code


def test_unknown_student_is_404(client, people):
    assert client.put("/admin/consulting/students/user_jae", json={"consulting": True},
                      headers=people).status_code == 404


def test_check_in_schedule_defaults_to_thursday_8am_pacific_and_can_change(client, people):
    assert client.get("/admin/settings", headers=people).json() == {
        "checkinWeekday": 3, "checkinTime": "08:00", "timezone": "America/Los_Angeles",
        "meetingDays": [5, 6], "meetingStart": "09:00", "meetingEnd": "17:00"}
    new = {"checkinWeekday": 5, "checkinTime": "10:30", "timezone": "Pacific/Auckland",
           "meetingDays": [6, 0, 6], "meetingStart": "13:00", "meetingEnd": "20:30"}
    saved = {**new, "meetingDays": [0, 6]}
    assert client.put("/admin/settings", json=new, headers=people).json() == saved
    assert client.get("/admin/settings", headers=people).json() == saved
    # Meeting hours are optional on save: left out = unchanged.
    only_checkin = {"checkinWeekday": 3, "checkinTime": "08:00", "timezone": "America/Los_Angeles"}
    assert client.put("/admin/settings", json=only_checkin, headers=people).json()["meetingStart"] == "13:00"


@pytest.mark.parametrize("change", [{"checkinWeekday": 7}, {"checkinTime": "25:00"}, {"checkinTime": "8am"},
                                    {"timezone": "Mars/Olympus"}, {"meetingDays": []}, {"meetingDays": [7]},
                                    {"meetingStart": "18:00", "meetingEnd": "09:00"}])
def test_schedule_is_validated(client, people, change):
    body = {"checkinWeekday": 3, "checkinTime": "08:00", "timezone": "America/Los_Angeles", **change}
    assert client.put("/admin/settings", json=body, headers=people).status_code == 422
