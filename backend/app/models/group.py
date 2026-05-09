from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = None
    avatar_url: str | None = None


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = None
    avatar_url: str | None = None


class Group(BaseModel):
    id: str
    name: str
    description: str | None
    avatar_url: str | None
    owner_id: str
    created_at: datetime


class GroupMember(BaseModel):
    user_id: str
    role: Literal["owner", "admin", "member"]


class RoleUpdate(BaseModel):
    role: Literal["admin", "member"]      # owner 위임은 별도 엔드포인트
