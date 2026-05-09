from pydantic import BaseModel, Field


class Profile(BaseModel):
    id: str
    handle: str | None = None
    display_name: str
    avatar_url: str | None = None
    expo_push_token: str | None = None


class BootstrapRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=80)
    avatar_url: str | None = None


class HandleUpdate(BaseModel):
    handle: str = Field(pattern=r"^[A-Za-z0-9_]{3,20}$")
