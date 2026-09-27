"""Profile pictures: presign, confirm, show, remove. S3 is a fake in memory."""

import pytest

from tests.conftest import MENTOR

pytestmark = pytest.mark.usefixtures("configured_database")

auth = lambda bearer, sub="user_stu1", metadata=None: bearer(sub=sub, metadata=metadata)  # noqa: E731


def presign(client, bearer, content_type="image/png", size=1024, **who):
    return client.post("/me/avatar/upload-url", json={"contentType": content_type, "sizeBytes": size},
                       headers=auth(bearer, **who))


def test_presign_confirm_and_show_for_a_student(client, bearer, fake_storage):
    response = presign(client, bearer)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["key"].startswith("avatars/user_stu1/") and body["key"].endswith(".png")
    assert body["uploadUrl"].startswith("https://fake-s3.test/avatars/user_stu1/")
    assert body["expiresInSeconds"] == 300

    fake_storage.put(body["key"])  # the browser's PUT
    confirmed = client.put("/me/avatar", json={"key": body["key"]}, headers=auth(bearer))
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["avatarUrl"].startswith("https://fake-s3.test/avatars/user_stu1/")

    profile = client.get("/me/student-profile", headers=auth(bearer)).json()
    assert profile["avatarUrl"] == confirmed.json()["avatarUrl"]


def test_mentor_picture_is_public_and_replacing_deletes_the_old_one(client, bearer, fake_storage):
    me = {"sub": "user_m", "metadata": MENTOR}
    client.put("/me/mentor-profile", json={"name": "Jae Park", "university": "Stanford"}, headers=auth(bearer, **me))
    first = presign(client, bearer, content_type="image/jpeg", **me).json()["key"]
    fake_storage.put(first, content_type="image/jpeg")
    client.put("/me/avatar", json={"key": first}, headers=auth(bearer, **me))

    listed = client.get("/mentors").json()
    assert listed[0]["avatarUrl"] == f"https://fake-s3.test/{first}?X-Amz-Signature=get"

    second = presign(client, bearer, content_type="image/webp", **me).json()["key"]
    fake_storage.put(second, content_type="image/webp")
    assert client.put("/me/avatar", json={"key": second}, headers=auth(bearer, **me)).status_code == 200
    assert first in fake_storage.deleted and second in fake_storage.objects


def test_remove(client, bearer, fake_storage):
    key = presign(client, bearer).json()["key"]
    fake_storage.put(key)
    client.put("/me/avatar", json={"key": key}, headers=auth(bearer))
    assert client.delete("/me/avatar", headers=auth(bearer)).status_code == 204
    assert key in fake_storage.deleted
    assert client.get("/me/student-profile", headers=auth(bearer)).json()["avatarUrl"] is None


def test_rejections(client, bearer, fake_storage):
    client.put("/me/student-profile", json={}, headers=auth(bearer))
    assert presign(client, bearer, content_type="image/gif").status_code == 415
    assert presign(client, bearer, size=6 * 1024 * 1024).status_code == 413
    assert client.post("/me/avatar/upload-url", json={"contentType": "image/png", "sizeBytes": 10}).status_code == 401

    # Someone else's key, even if it exists.
    fake_storage.put("avatars/user_other/x.png")
    other = client.put("/me/avatar", json={"key": "avatars/user_other/x.png"}, headers=auth(bearer))
    assert other.status_code == 403 and other.json()["detail"]["code"] == "not_your_upload"

    # Confirm before the upload arrived.
    key = presign(client, bearer).json()["key"]
    missing = client.put("/me/avatar", json={"key": key}, headers=auth(bearer))
    assert missing.status_code == 404 and missing.json()["detail"]["code"] == "upload_missing"

    # What landed is not a small image: it gets deleted, not attached.
    fake_storage.put(key, content_type="image/png", size=9 * 1024 * 1024)
    bad = client.put("/me/avatar", json={"key": key}, headers=auth(bearer))
    assert bad.status_code == 422 and key in fake_storage.deleted
    assert client.get("/me/student-profile", headers=auth(bearer)).json()["avatarUrl"] is None


def test_storage_unconfigured_answers_503_and_profiles_still_work(client, bearer):
    assert presign(client, bearer).status_code == 503
    profile = client.put("/me/student-profile", json={"fullName": "Maya"}, headers=auth(bearer))
    assert profile.status_code == 200 and profile.json()["avatarUrl"] is None
