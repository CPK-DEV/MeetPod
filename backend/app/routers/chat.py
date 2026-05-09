from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field

from app.dependencies.auth import CurrentUser, current_user
from app.models.chat import (
    ChatRoom, Message, MessageEdit, MessageSend, UploadUrlResponse,
)
from app.services.chat_service import (
    create_image_upload_url, delete_message, edit_message,
    list_messages, list_my_rooms, send_message,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class UploadUrlBody(BaseModel):
    ext: str = Field(min_length=1, max_length=5)


@router.get("/rooms", response_model=list[ChatRoom])
def rooms(user: CurrentUser = Depends(current_user)) -> list[ChatRoom]:
    return list_my_rooms(user.id)


@router.get("/rooms/{room_id}/messages", response_model=list[Message])
def messages(
    room_id: str,
    user: CurrentUser = Depends(current_user),
    before: datetime | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
) -> list[Message]:
    return list_messages(room_id, user.id, before, limit)


@router.post("/rooms/{room_id}/messages", response_model=Message)
def send(
    room_id: str, body: MessageSend,
    user: CurrentUser = Depends(current_user),
) -> Message:
    return send_message(room_id, user.id, body)


@router.patch("/messages/{message_id}", response_model=Message)
def edit(
    message_id: str, body: MessageEdit,
    user: CurrentUser = Depends(current_user),
) -> Message:
    return edit_message(message_id, user.id, body.body)


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_(message_id: str, user: CurrentUser = Depends(current_user)) -> None:
    delete_message(message_id, user.id)


@router.post("/rooms/{room_id}/upload-url", response_model=UploadUrlResponse)
def upload_url(
    room_id: str, body: UploadUrlBody,
    user: CurrentUser = Depends(current_user),
) -> UploadUrlResponse:
    return create_image_upload_url(room_id, user.id, body.ext)
