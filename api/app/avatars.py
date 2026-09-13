"""Profile pictures: three small steps instead of one big upload.

1. POST /me/avatar/upload-url  -> the API mints a presigned PUT URL.
2. The browser PUTs the file straight to S3 (never through the API).
3. PUT /me/avatar {key}         -> the API checks the object really is
   there and is a small image, then records the key on the caller's
   profile (mentor or student, decided by the token's account type).

The key always starts with avatars/<user_id>/, and step 3 refuses any
other prefix, so a user can only ever attach their own upload.
"""

from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field
from sqlalchemy.orm import Session

from app.auth import Principal, current_user
from app.db import get_session
from app.mentors import _Camel, ensure_mentor_row, upsert_user
from app.storage import PUT_EXPIRES_SECONDS, Storage, avatar_url_for, get_storage
from app.students import ensure_student_row

router = APIRouter()
log = logging.getLogger("dapup.avatars")

MAX_BYTES = 5 * 1024 * 1024
CONTENT_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


class UploadUrlIn(_Camel):
    content_type: str
    size_bytes: int = Field(gt=0)


class UploadUrlOut(_Camel):
    upload_url: str
    key: str
    expires_in_seconds: int


class ConfirmIn(_Camel):
    key: str = Field(max_length=200)


class AvatarOut(_Camel):
    avatar_url: str | None


def _error(code: int, machine: str, message: str) -> HTTPException:
    return HTTPException(code, {"code": machine, "message": message})


def require_storage(storage: Annotated[Storage | None, Depends(get_storage)]) -> Storage:
    if storage is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "File storage is not configured.")
    return storage


def _profile_row(session: Session, user: Principal):
    upsert_user(session, user)
    if user.account_type == "mentor":
        return ensure_mentor_row(session, user)
    return ensure_student_row(session, user)


@router.post("/me/avatar/upload-url", response_model=UploadUrlOut, response_model_by_alias=True)
def avatar_upload_url(
    body: UploadUrlIn,
    user: Annotated[Principal, Depends(current_user)],
    storage: Annotated[Storage, Depends(require_storage)],
) -> UploadUrlOut:
    ext = CONTENT_TYPES.get(body.content_type)
    if ext is None:
        raise _error(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "unsupported_type", "Use a JPEG, PNG, or WebP image.")
    if body.size_bytes > MAX_BYTES:
        raise _error(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "too_large", "Images must be 5 MB or smaller.")
    key = f"avatars/{user.user_id}/{uuid.uuid4().hex}.{ext}"
    return UploadUrlOut(
        upload_url=storage.presign_put(key, body.content_type), key=key, expires_in_seconds=PUT_EXPIRES_SECONDS
    )


@router.put("/me/avatar", response_model=AvatarOut, response_model_by_alias=True)
def confirm_avatar(
    body: ConfirmIn,
    user: Annotated[Principal, Depends(current_user)],
    storage: Annotated[Storage, Depends(require_storage)],
    session: Annotated[Session, Depends(get_session)],
) -> AvatarOut:
    if not body.key.startswith(f"avatars/{user.user_id}/"):
        raise _error(status.HTTP_403_FORBIDDEN, "not_your_upload", "That upload does not belong to you.")
    info = storage.head(body.key)
    if info is None:
        raise _error(status.HTTP_404_NOT_FOUND, "upload_missing", "The upload has not arrived yet.")
    if info.content_type not in CONTENT_TYPES or info.size > MAX_BYTES:
        # Defence in depth: the presigned URL already pinned the content
        # type, but the size was only checked on the browser's word.
        storage.delete(body.key)
        raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_image", "Use a JPEG, PNG, or WebP image up to 5 MB.")
    row = _profile_row(session, user)
    previous = row.avatar_key
    row.avatar_key = body.key
    session.flush()
    if previous and previous != body.key:
        try:
            storage.delete(previous)
        except Exception:  # noqa: BLE001 - an orphaned object is not worth failing the request
            log.warning("could not delete previous avatar %s", previous)
    return AvatarOut(avatar_url=avatar_url_for(body.key))


@router.delete("/me/avatar", status_code=status.HTTP_204_NO_CONTENT)
def remove_avatar(
    user: Annotated[Principal, Depends(current_user)],
    storage: Annotated[Storage, Depends(require_storage)],
    session: Annotated[Session, Depends(get_session)],
) -> None:
    row = _profile_row(session, user)
    key, row.avatar_key = row.avatar_key, None
    session.flush()
    if key:
        storage.delete(key)
