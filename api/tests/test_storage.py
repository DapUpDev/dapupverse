"""S3Storage signs URLs locally: no network, throwaway credentials."""

from urllib.parse import parse_qs, urlparse

import boto3
import pytest
from botocore.config import Config

from app.storage import GET_EXPIRES_SECONDS, PUT_EXPIRES_SECONDS, S3Storage, get_storage


@pytest.fixture
def storage():
    client = boto3.client(
        "s3", region_name="us-west-2", aws_access_key_id="AKIATEST", aws_secret_access_key="secret",
        config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
    )
    return S3Storage(bucket="dapup-test-bucket", region="us-west-2", client=client)


def test_presigned_put_pins_key_content_type_and_expiry(storage):
    url = urlparse(storage.presign_put("avatars/user_1/a.png", "image/png"))
    query = parse_qs(url.query)
    assert url.scheme == "https" and url.netloc == "dapup-test-bucket.s3.us-west-2.amazonaws.com"
    assert url.path == "/avatars/user_1/a.png"
    assert query["X-Amz-Expires"] == [str(PUT_EXPIRES_SECONDS)]
    assert "content-type" in query["X-Amz-SignedHeaders"][0]
    assert "X-Amz-Signature" in query


def test_presigned_get_expires_in_an_hour(storage):
    query = parse_qs(urlparse(storage.presign_get("avatars/user_1/a.png")).query)
    assert query["X-Amz-Expires"] == [str(GET_EXPIRES_SECONDS)]


def test_unconfigured_means_none(monkeypatch):
    monkeypatch.delenv("STORAGE_BUCKET", raising=False)
    get_storage.cache_clear()
    assert get_storage() is None
    get_storage.cache_clear()
