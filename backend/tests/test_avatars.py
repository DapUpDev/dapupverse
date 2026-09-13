"""Profile pictures: presign, confirm, show, remove. S3 is a fake in memory."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.db import get_engine
from app.main import app
from app.migrate import run_migrations
from tests.conftest import mint

MENTOR = {"accountType": "mentor"}


@pytest.fixture(autouse=True)
def configured_database(database_url, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_engine.cache_clear()
    run_migrations()
    yield
    engine = create_engine(database_url)
    with engine.begin() as connection:
        for table in ("mentor_profiles", "student_profiles", "users"):
            connection.execute(text(f"DELETE FROM {table}"))
    engine.dispose()
    get_engine.cache_clear()


@pytest.fixture
def client():
    return TestClient(app)


def bearer(keys, sub="user_stu1", metadata=None):
    private, _ = keys
    return {"Authorization": f"Bearer {mint(private, sub=sub, metadata=metadata)}"}


def presign(client, keys, content_type="image/png", size=1024, **who):
    return client.post("/me/avatar/upload-url", json={"contentType": content_type, "sizeBytes": size},
                       headers=bearer(keys, **who))


def test_presign_confirm_and_show_for_a_student(client, keys, fake_storage):
    response = presign(client, keys)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["key"].startswith("avatars/user_stu1/") and body["key"].endswith(".png")
    assert body["uploadUrl"].startswith("https://fake-s3.test/avatars/user_stu1/")
    assert body["expiresInSeconds"] == 300

    fake_storage.put(body["key"])  # the browser's PUT
    confirmed = client.put("/me/avatar", json={"key": body["key"]}, headers=bearer(keys))
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["avatarUrl"].startswith("https://fake-s3.test/avatars/user_stu1/")

    profile = client.get("/me/student-profile", headers=bearer(keys)).json()
    assert profile["avatarUrl"] == confirmed.json()["avatarUrl"]


def test_mentor_picture_is_public_and_replacing_deletes_the_old_one(client, keys, fake_storage):
    me = {"sub": "user_m", "metadata": MENTOR}
    client.put("/me/mentor-profile", json={"name": "Jae Park", "university": "Stanford"}, headers=bearer(keys, **me))
    first = presign(client, keys, content_type="image/jpeg", **me).json()["key"]
    fake_storage.put(first, content_type="image/jpeg")
    client.put("/me/avatar", json={"key": first}, headers=bearer(keys, **me))

    listed = client.get("/mentors").json()
    assert listed[0]["avatarUrl"] == f"https://fake-s3.test/{first}?X-Amz-Signature=get"

    second = presign(client, keys, content_type="image/webp", **me).json()["key"]
    fake_storage.put(second, content_type="image/webp")
    assert client.put("/me/avatar", json={"key": second}, headers=bearer(keys, **me)).status_code == 200
    assert first in fake_storage.deleted and second in fake_storage.objects


def test_remove(client, keys, fake_storage):
    key = presign(client, keys).json()["key"]
    fake_storage.put(key)
    client.put("/me/avatar", json={"key": key}, headers=bearer(keys))
    assert client.delete("/me/avatar", headers=bearer(keys)).status_code == 204
    assert key in fake_storage.deleted
    assert client.get("/me/student-profile", headers=bearer(keys)).json()["avatarUrl"] is None


def test_rejections(client, keys, fake_storage):
    client.put("/me/student-profile", json={}, headers=bearer(keys))
    assert presign(client, keys, content_type="image/gif").status_code == 415
    assert presign(client, keys, size=6 * 1024 * 1024).status_code == 413
    assert client.post("/me/avatar/upload-url", json={"contentType": "image/png", "sizeBytes": 10}).status_code == 401

    # Someone else's key, even if it exists.
    fake_storage.put("avatars/user_other/x.png")
    other = client.put("/me/avatar", json={"key": "avatars/user_other/x.png"}, headers=bearer(keys))
    assert other.status_code == 403 and other.json()["detail"]["code"] == "not_your_upload"

    # Confirm before the upload arrived.
    key = presign(client, keys).json()["key"]
    missing = client.put("/me/avatar", json={"key": key}, headers=bearer(keys))
    assert missing.status_code == 404 and missing.json()["detail"]["code"] == "upload_missing"

    # What landed is not a small image: it gets deleted, not attached.
    fake_storage.put(key, content_type="image/png", size=9 * 1024 * 1024)
    bad = client.put("/me/avatar", json={"key": key}, headers=bearer(keys))
    assert bad.status_code == 422 and key in fake_storage.deleted
    assert client.get("/me/student-profile", headers=bearer(keys)).json()["avatarUrl"] is None


def test_storage_unconfigured_answers_503_and_profiles_still_work(client, keys):
    assert presign(client, keys).status_code == 503
    profile = client.put("/me/student-profile", json={"fullName": "Maya"}, headers=bearer(keys))
    assert profile.status_code == 200 and profile.json()["avatarUrl"] is None
