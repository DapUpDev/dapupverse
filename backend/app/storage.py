"""Object storage for profile pictures (and later, student documents).

The browser never gets AWS credentials. It asks the API for a presigned
URL, which is an ordinary HTTPS URL that carries a signature made with the
task role's credentials and expires in minutes. S3 checks the signature
and lets exactly that one request (PUT this key with this content type)
through. Reads work the same way: profile responses carry a presigned GET
URL that stops working after an hour.

`Storage` is a tiny interface so tests can swap in an in-memory fake and
never touch the network; `S3Storage` is the real thing.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Protocol

PUT_EXPIRES_SECONDS = 5 * 60
GET_EXPIRES_SECONDS = 60 * 60


@dataclass(frozen=True)
class ObjectInfo:
    content_type: str
    size: int


class Storage(Protocol):
    def presign_put(self, key: str, content_type: str) -> str: ...
    def presign_get(self, key: str) -> str: ...
    def head(self, key: str) -> ObjectInfo | None: ...
    def delete(self, key: str) -> None: ...


class S3Storage:
    def __init__(self, bucket: str, region: str, client=None) -> None:
        import boto3
        from botocore.config import Config

        self.bucket = bucket
        self.client = client or boto3.client(
            "s3", region_name=region,
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
        )

    def presign_put(self, key: str, content_type: str) -> str:
        # ContentType becomes a signed header: the upload must send exactly
        # this Content-Type or S3 refuses it.
        return self.client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=PUT_EXPIRES_SECONDS,
        )

    def presign_get(self, key: str) -> str:
        return self.client.generate_presigned_url(
            "get_object", Params={"Bucket": self.bucket, "Key": key}, ExpiresIn=GET_EXPIRES_SECONDS
        )

    def head(self, key: str) -> ObjectInfo | None:
        try:
            meta = self.client.head_object(Bucket=self.bucket, Key=key)
        except self.client.exceptions.ClientError as exc:
            if exc.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                return None
            raise
        return ObjectInfo(content_type=meta.get("ContentType", ""), size=int(meta.get("ContentLength", 0)))

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)


@lru_cache
def get_storage() -> Storage | None:
    """None when STORAGE_BUCKET is unset: the API runs, avatar routes answer
    503, and profile responses carry avatarUrl null."""
    bucket = os.getenv("STORAGE_BUCKET")
    if not bucket:
        return None
    return S3Storage(bucket=bucket, region=os.getenv("AWS_REGION", "us-west-2"))


def avatar_url_for(key: str | None) -> str | None:
    """Presigned read URL for a stored avatar, or None when there is none."""
    if not key:
        return None
    storage = get_storage()
    return storage.presign_get(key) if storage else None
