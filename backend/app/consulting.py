"""The USA applications consulting program, managed on /admin.

Admins only (the explicit isAdmin capability in Clerk metadata, never
inferred from account type):

    GET  /admin/consulting/students          every student with a profile
    PUT  /admin/consulting/students/<id>     consulting on/off + up to 3 mentors
    GET  /admin/settings                     when the weekly check-in goes out, and
    PUT  /admin/settings                     the meeting hours bookings must fit in

Only consulting students get the weekly check-in (app/checkins.py).
"""

from __future__ import annotations

from datetime import time
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.auth import Principal, current_user
from app.db import get_session
from app.mentors import _Camel, upsert_user
from app.models import AccountType, ConsultingMentor, ProgramSettings, StudentProfile, User

router = APIRouter()

MAX_MENTORS = 3


def require_admin(user: Principal = Depends(current_user)) -> Principal:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin capability required.")
    return user


Admin = Annotated[Principal, Depends(require_admin)]
Db = Annotated[Session, Depends(get_session)]


class ConsultingStudentOut(_Camel):
    id: str
    full_name: str
    school: str
    year_level: str
    email: str | None
    consulting: bool
    mentor_ids: list[str]


class ConsultingUpdate(_Camel):
    consulting: bool
    mentor_ids: list[str] = Field(default_factory=list, max_length=MAX_MENTORS)


class SettingsOut(_Camel):
    checkin_weekday: int  # Monday = 0
    checkin_time: str  # "HH:MM", local to timezone
    timezone: str  # IANA, e.g. America/Los_Angeles
    meeting_days: list[int]  # when meetings may be booked, Monday = 0
    meeting_start: str  # "HH:MM"
    meeting_end: str


HHMM = r"^([01]\d|2[0-3]):[0-5]\d$"


class SettingsUpdate(_Camel):
    checkin_weekday: int = Field(ge=0, le=6)
    checkin_time: str = Field(pattern=HHMM)
    timezone: str
    # Optional: left out = unchanged.
    meeting_days: list[int] | None = Field(default=None, min_length=1, max_length=7)
    meeting_start: str | None = Field(default=None, pattern=HHMM)
    meeting_end: str | None = Field(default=None, pattern=HHMM)

    @field_validator("meeting_days")
    @classmethod
    def weekdays(cls, value: list[int] | None) -> list[int] | None:
        if value is not None and not all(0 <= d <= 6 for d in value):
            raise ValueError("Days are 0 (Monday) to 6 (Sunday).")
        return sorted(set(value)) if value is not None else None

    @field_validator("timezone")
    @classmethod
    def known_zone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Unknown time zone.") from None
        return value


def _teams(session: Session) -> dict[str, list[str]]:
    teams: dict[str, list[str]] = {}
    for student_id, mentor_id in session.execute(
        select(ConsultingMentor.student_id, ConsultingMentor.mentor_id).order_by(ConsultingMentor.mentor_id)
    ):
        teams.setdefault(student_id, []).append(mentor_id)
    return teams


@router.get("/admin/consulting/students", response_model=list[ConsultingStudentOut], response_model_by_alias=True)
def list_students(user: Admin, session: Db) -> list[ConsultingStudentOut]:
    teams = _teams(session)
    rows = session.execute(
        select(StudentProfile, User.email)
        .join(User, User.id == StudentProfile.user_id)
        .where(User.account_type == AccountType.student)
        .order_by(StudentProfile.consulting.desc(), StudentProfile.full_name)
    ).all()
    return [
        ConsultingStudentOut(id=p.user_id, full_name=p.full_name, school=p.school, year_level=p.year_level,
                             email=email, consulting=p.consulting, mentor_ids=teams.get(p.user_id, []))
        for p, email in rows
    ]


@router.put("/admin/consulting/students/{student_id}", response_model=ConsultingStudentOut,
            response_model_by_alias=True)
def update_student(student_id: str, body: ConsultingUpdate, user: Admin, session: Db) -> ConsultingStudentOut:
    upsert_user(session, user)
    profile = session.get(StudentProfile, student_id)
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Student not found.")
    mentor_ids = list(dict.fromkeys(body.mentor_ids))
    mentors = set(session.scalars(
        select(User.id).where(User.id.in_(mentor_ids), User.account_type == AccountType.mentor)
    ))
    if len(mentors) != len(mentor_ids):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Every team member must be a mentor.")
    profile.consulting = body.consulting
    session.execute(delete(ConsultingMentor).where(ConsultingMentor.student_id == student_id))
    session.add_all(ConsultingMentor(student_id=student_id, mentor_id=m) for m in mentor_ids)
    session.flush()
    return ConsultingStudentOut(id=profile.user_id, full_name=profile.full_name, school=profile.school,
                                year_level=profile.year_level, email=session.get(User, student_id).email,
                                consulting=profile.consulting, mentor_ids=sorted(mentor_ids))


def _settings_out(row: ProgramSettings) -> SettingsOut:
    return SettingsOut(checkin_weekday=row.checkin_weekday, checkin_time=row.checkin_time.strftime("%H:%M"),
                       timezone=row.timezone, meeting_days=sorted(row.meeting_days),
                       meeting_start=row.meeting_start.strftime("%H:%M"), meeting_end=row.meeting_end.strftime("%H:%M"))


@router.get("/admin/settings", response_model=SettingsOut, response_model_by_alias=True)
def get_settings(user: Admin, session: Db) -> SettingsOut:
    return _settings_out(session.get(ProgramSettings, 1))


@router.put("/admin/settings", response_model=SettingsOut, response_model_by_alias=True)
def update_settings(body: SettingsUpdate, user: Admin, session: Db) -> SettingsOut:
    row = session.get(ProgramSettings, 1)
    row.checkin_weekday = body.checkin_weekday
    row.checkin_time = time.fromisoformat(body.checkin_time)
    row.timezone = body.timezone
    if body.meeting_days is not None:
        row.meeting_days = body.meeting_days
    start = time.fromisoformat(body.meeting_start) if body.meeting_start else row.meeting_start
    end = time.fromisoformat(body.meeting_end) if body.meeting_end else row.meeting_end
    if start >= end:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Meeting hours must end after they start.")
    row.meeting_start, row.meeting_end = start, end
    session.flush()
    return _settings_out(row)
