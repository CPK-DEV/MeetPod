from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

Status = Literal["scheduled", "active", "ended", "cancelled"]
ShareWindow = Literal[10, 20, 30, 60]


class Place(BaseModel):
    name: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    address: str | None = None
    google_id: str | None = None


class MeetupCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    starts_at: datetime
    ends_at: datetime
    place: Place
    group_id: str | None = None
    participant_ids: list[str] = Field(default_factory=list)
    location_share_minutes_before: ShareWindow = 20
    self_reminder_minutes_before: int | None = None    # 본인 푸시 알림(분)

    @model_validator(mode="after")
    def _validate(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        if self.self_reminder_minutes_before is not None and self.self_reminder_minutes_before <= 0:
            raise ValueError("self_reminder_minutes_before must be > 0")
        return self


class MeetupUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    place: Place | None = None
    location_share_minutes_before: ShareWindow | None = None


class Meetup(BaseModel):
    id: str
    group_id: str | None
    creator_id: str
    title: str
    starts_at: datetime
    ends_at: datetime
    place_name: str
    place_lat: float
    place_lng: float
    place_address: str | None
    place_google_id: str | None
    location_share_minutes_before: int
    status: Status
    created_at: datetime


class Participant(BaseModel):
    user_id: str
    status: str
    joined_at: datetime


class ReminderUpsert(BaseModel):
    minutes_before: int = Field(gt=0)


class Reminder(BaseModel):
    meetup_id: str
    user_id: str
    minutes_before: int
    notify_at: datetime
