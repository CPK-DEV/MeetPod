from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class ChatRoom(BaseModel):
    id: str
    kind: Literal["group", "meetup"]
    ref_id: str
    archived_at: datetime | None
    created_at: datetime


class Message(BaseModel):
    id: str
    room_id: str
    sender_id: str
    kind: Literal["text", "image", "place"]
    body: str | None
    image_url: str | None
    place_payload: dict[str, Any] | None
    created_at: datetime
    edited_at: datetime | None
    deleted_at: datetime | None


class MessageSend(BaseModel):
    kind: Literal["text", "image", "place"]
    body: str | None = None
    image_url: str | None = None
    place_payload: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _validate(self):
        if self.kind == "text"  and not self.body:
            raise ValueError("text message requires body")
        if self.kind == "image" and not self.image_url:
            raise ValueError("image message requires image_url")
        if self.kind == "place" and not self.place_payload:
            raise ValueError("place message requires place_payload")
        # 다른 필드는 None 강제
        if self.kind != "text"  and self.body is not None:
            raise ValueError("body only allowed when kind=text")
        if self.kind != "image" and self.image_url is not None:
            raise ValueError("image_url only allowed when kind=image")
        if self.kind != "place" and self.place_payload is not None:
            raise ValueError("place_payload only allowed when kind=place")
        return self


class MessageEdit(BaseModel):
    body: str = Field(min_length=1)


class UploadUrlResponse(BaseModel):
    object_key: str
    signed_url: str
    public_path: str        # Storage 내부 경로 (메시지 저장용)
    expires_in: int
