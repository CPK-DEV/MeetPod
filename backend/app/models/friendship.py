from pydantic import BaseModel


class FriendSummary(BaseModel):
    id: str
    handle: str | None
    display_name: str
    avatar_url: str | None
