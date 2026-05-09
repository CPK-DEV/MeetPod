from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class InviteCreate(BaseModel):
    kind: Literal["friend", "group"]
    target_group_id: str | None = None
    expires_in_days: int = 7
    max_uses: int = 10


class Invite(BaseModel):
    code: str
    inviter_id: str
    kind: Literal["friend", "group"]
    target_group_id: str | None
    expires_at: datetime
    max_uses: int
    used_count: int


class InviteAcceptResult(BaseModel):
    kind: Literal["friend", "group"]
    inviter_id: str
    group_id: str | None
