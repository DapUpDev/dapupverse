"""Mentor profiles: the public directory and the mentor's own private record.

Two shapes, on purpose, mirroring src/lib/domain/types.ts:

- MentorPublic never carries the price. It is not "hidden"; the type
  simply does not have the field, so no code path can leak it.
- MentorPrivate adds privatePriceUsd and is returned only to the mentor
  themself or an admin. (A student with an accepted connection is the
  third case in the design; it arrives with the connections slice.)

Field names are camelCase on the wire because the frontend's domain types
are the contract; the ORM columns stay snake_case.
"""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.auth import Principal, current_user
from app.db import get_session
from app.models import MentorProfile, User

router = APIRouter()

# The closed vocabularies from src/lib/domain/types.ts.
SERVICE_TYPES = ["Essay review", "Application strategy", "Subject tutoring", "Interview prep", "Portfolio review"]
EDUCATION_SYSTEMS = ["AP", "IB", "A Levels"]


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class MentorPublic(_Camel):
    id: str
    slug: str
    name: str
    university: str
    major: str
    country_region: str
    biography: str
    services: list[str]
    subjects: list[str]
    education_systems: list[str]


class MentorPrivate(MentorPublic):
    private_price_usd: Decimal


class MentorProfileUpdate(_Camel):
    """Partial update; every field optional. Empty body = ensure the row exists."""

    name: str | None = Field(default=None, max_length=120)
    university: str | None = Field(default=None, max_length=200)
    major: str | None = Field(default=None, max_length=200)
    country_region: str | None = Field(default=None, max_length=120)
    biography: str | None = Field(default=None, max_length=4000)
    services: list[str] | None = None
    subjects: list[str] | None = Field(default=None, max_length=30)
    education_systems: list[str] | None = None
    private_price_usd: Decimal | None = Field(default=None, ge=0, le=100000, decimal_places=2)

    @field_validator("services")
    @classmethod
    def _services(cls, value: list[str] | None) -> list[str] | None:
        if value is not None and (bad := [v for v in value if v not in SERVICE_TYPES]):
            raise ValueError(f"unknown service type(s): {bad}")
        return value

    @field_validator("education_systems")
    @classmethod
    def _systems(cls, value: list[str] | None) -> list[str] | None:
        if value is not None and (bad := [v for v in value if v not in EDUCATION_SYSTEMS]):
            raise ValueError(f"unknown education system(s): {bad}")
        return value

    @field_validator("subjects")
    @classmethod
    def _subjects(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        cleaned = [s.strip() for s in value if s.strip()]
        if any(len(s) > 60 for s in cleaned):
            raise ValueError("subject too long")
        return cleaned

    @field_validator("name", "university", "major", "country_region", "biography")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


def _to_public(row: MentorProfile) -> MentorPublic:
    return MentorPublic(id=row.user_id, slug=row.slug, name=row.name, university=row.university,
                        major=row.major, country_region=row.country_region, biography=row.biography,
                        services=row.services, subjects=row.subjects, education_systems=row.education_systems)


def _to_private(row: MentorProfile) -> MentorPrivate:
    return MentorPrivate(**_to_public(row).model_dump(by_alias=False), private_price_usd=row.private_price_usd)


def upsert_user(session: Session, principal: Principal) -> None:
    """Every authenticated write goes through here so the users row exists
    (foreign keys) and reflects the token's current role."""
    statement = (
        insert(User)
        .values(id=principal.user_id, email=principal.email, account_type=principal.account_type,
                is_admin=principal.is_admin, last_seen_at=func.now())
        .on_conflict_do_update(
            index_elements=[User.id],
            set_={"account_type": principal.account_type, "is_admin": principal.is_admin,
                  "last_seen_at": func.now(), "updated_at": func.now(),
                  **({"email": principal.email} if principal.email else {})},
        )
    )
    session.execute(statement)


def require_mentor(user: Principal = Depends(current_user)) -> Principal:
    if user.account_type != "mentor":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "A mentor account is required.")
    return user


def _slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60]
    return base or "mentor"


def _unique_slug(session: Session, base: str, own_id: str) -> str:
    taken = set(
        session.execute(
            select(MentorProfile.slug).where(MentorProfile.slug.like(f"{base}%"), MentorProfile.user_id != own_id)
        ).scalars()
    )
    if base not in taken:
        return base
    n = 2
    while f"{base}-{n}" in taken:
        n += 1
    return f"{base}-{n}"


def _listed(query):
    return query.where(MentorProfile.name != "")


# ---- public ------------------------------------------------------------------
@router.get("/mentors", response_model=list[MentorPublic], response_model_by_alias=True)
def list_mentors(
    session: Annotated[Session, Depends(get_session)],
    query: str | None = Query(default=None, max_length=100),
    education_system: str | None = Query(default=None, alias="educationSystem"),
    subject: str | None = Query(default=None, max_length=60),
    country_region: str | None = Query(default=None, alias="countryRegion", max_length=120),
    university: str | None = Query(default=None, max_length=200),
    service_type: str | None = Query(default=None, alias="serviceType"),
) -> list[MentorPublic]:
    stmt = _listed(select(MentorProfile)).order_by(MentorProfile.name)
    if query and query.strip():
        needle = f"%{query.strip()}%"
        stmt = stmt.where(
            or_(
                MentorProfile.name.ilike(needle),
                MentorProfile.university.ilike(needle),
                MentorProfile.major.ilike(needle),
                func.array_to_string(MentorProfile.subjects, " ").ilike(needle),
            )
        )
    if education_system:
        stmt = stmt.where(MentorProfile.education_systems.contains([education_system]))
    if subject:
        stmt = stmt.where(MentorProfile.subjects.contains([subject]))
    if country_region:
        stmt = stmt.where(MentorProfile.country_region == country_region)
    if university:
        stmt = stmt.where(MentorProfile.university == university)
    if service_type:
        stmt = stmt.where(MentorProfile.services.contains([service_type]))
    return [_to_public(row) for row in session.execute(stmt).scalars()]


@router.get("/mentors/{slug}", response_model=MentorPublic, response_model_by_alias=True)
def get_mentor(slug: str, session: Annotated[Session, Depends(get_session)]) -> MentorPublic:
    row = session.execute(_listed(select(MentorProfile)).where(MentorProfile.slug == slug)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mentor not found.")
    return _to_public(row)


# ---- private -----------------------------------------------------------------
@router.get("/mentors/{mentor_id}/private", response_model=MentorPrivate, response_model_by_alias=True)
def get_private_profile(
    mentor_id: str,
    user: Annotated[Principal, Depends(current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> MentorPrivate:
    """The mentor themself or an admin. Anyone else gets 403 whether or not
    the mentor exists, so the endpoint cannot be used to enumerate ids."""
    if user.user_id != mentor_id and not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed.")
    row = session.get(MentorProfile, mentor_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mentor not found.")
    return _to_private(row)


@router.get("/me/mentor-profile", response_model=MentorPrivate, response_model_by_alias=True)
def my_mentor_profile(
    user: Annotated[Principal, Depends(require_mentor)],
    session: Annotated[Session, Depends(get_session)],
) -> MentorPrivate:
    row = session.get(MentorProfile, user.user_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No mentor profile yet.")
    return _to_private(row)


@router.put("/me/mentor-profile", response_model=MentorPrivate, response_model_by_alias=True)
def upsert_my_mentor_profile(
    body: MentorProfileUpdate,
    user: Annotated[Principal, Depends(require_mentor)],
    session: Annotated[Session, Depends(get_session)],
) -> MentorPrivate:
    """Create-if-missing, then apply the given fields. Idempotent: an empty
    body just guarantees the row exists (the frontend's ensureProfile)."""
    upsert_user(session, user)
    row = session.get(MentorProfile, user.user_id)
    if row is None:
        row = MentorProfile(user_id=user.user_id, slug=_unique_slug(session, user.user_id.lower(), user.user_id))
        session.add(row)
    changes = body.model_dump(exclude_unset=True, by_alias=False)
    # The slug is minted from the first real name and then left alone.
    # (A freshly constructed row has name None until it is flushed.)
    if changes.get("name") and not row.name:
        row.slug = _unique_slug(session, _slugify(changes["name"]), user.user_id)
    for field, value in changes.items():
        setattr(row, field, value)
    session.flush()
    session.refresh(row)
    return _to_private(row)
