"""Student profiles.

A student's profile is private to them, admins, and mentors, who see it
attached to the requests a student sends them. There is no public student
directory, so there is no public shape at all.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field, field_validator
from sqlalchemy.orm import Session

from app.auth import Principal, current_user
from app.db import get_session
from app.mentors import EDUCATION_SYSTEMS, _Camel, upsert_user
from app.models import StudentProfile

router = APIRouter()

REQUIRED_FOR_REQUESTS = ("full_name", "school", "year_level", "education_system")


class StudentProfileOut(_Camel):
    id: str
    full_name: str
    school: str
    year_level: str
    education_system: str | None
    subjects: list[str]
    biography: str


class StudentProfileUpdate(_Camel):
    full_name: str | None = Field(default=None, max_length=120)
    school: str | None = Field(default=None, max_length=200)
    year_level: str | None = Field(default=None, max_length=60)
    education_system: str | None = None
    subjects: list[str] | None = Field(default=None, max_length=30)
    biography: str | None = Field(default=None, max_length=4000)

    @field_validator("education_system")
    @classmethod
    def _system(cls, value: str | None) -> str | None:
        if value is not None and value not in EDUCATION_SYSTEMS:
            raise ValueError(f"unknown education system: {value}")
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

    @field_validator("full_name", "school", "year_level", "biography")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


def to_out(row: StudentProfile) -> StudentProfileOut:
    return StudentProfileOut(id=row.user_id, full_name=row.full_name, school=row.school,
                             year_level=row.year_level, education_system=row.education_system,
                             subjects=row.subjects, biography=row.biography)


def is_complete(row: StudentProfile) -> bool:
    return all(bool(getattr(row, field)) for field in REQUIRED_FOR_REQUESTS)


def require_student(user: Principal = Depends(current_user)) -> Principal:
    if user.account_type != "student":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "A student account is required.")
    return user


def may_view_student(viewer: Principal, student_id: str) -> bool:
    """The student themself, an admin, or a mentor (who sees requesters).
    The connections slice narrows the mentor case to mentors with a request
    from this student."""
    return viewer.user_id == student_id or viewer.is_admin or viewer.account_type == "mentor"


@router.get("/me/student-profile", response_model=StudentProfileOut, response_model_by_alias=True)
def my_student_profile(
    user: Annotated[Principal, Depends(require_student)],
    session: Annotated[Session, Depends(get_session)],
) -> StudentProfileOut:
    row = session.get(StudentProfile, user.user_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No student profile yet.")
    return to_out(row)


@router.put("/me/student-profile", response_model=StudentProfileOut, response_model_by_alias=True)
def upsert_my_student_profile(
    body: StudentProfileUpdate,
    user: Annotated[Principal, Depends(require_student)],
    session: Annotated[Session, Depends(get_session)],
) -> StudentProfileOut:
    """Create-if-missing, then apply the given fields (the frontend's
    ensure() and update() both land here)."""
    upsert_user(session, user)
    row = session.get(StudentProfile, user.user_id)
    if row is None:
        row = StudentProfile(user_id=user.user_id)
        session.add(row)
    for field, value in body.model_dump(exclude_unset=True, by_alias=False).items():
        setattr(row, field, value)
    session.flush()
    session.refresh(row)
    return to_out(row)


@router.get("/students/{student_id}/profile", response_model=StudentProfileOut, response_model_by_alias=True)
def get_student_profile(
    student_id: str,
    user: Annotated[Principal, Depends(current_user)],
    session: Annotated[Session, Depends(get_session)],
) -> StudentProfileOut:
    if not may_view_student(user, student_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed.")
    row = session.get(StudentProfile, student_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")
    return to_out(row)
