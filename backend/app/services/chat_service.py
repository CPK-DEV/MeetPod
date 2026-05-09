import uuid
from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException, status

from app.models.chat import ChatRoom, Message, MessageSend, UploadUrlResponse
from app.utils.db import single
from app.utils.supabase_client import get_supabase

BUCKET = "chat-images"
SIGNED_UPLOAD_TTL_SEC = 60


def _is_room_member(room_id: str, user_id: str) -> bool:
    sb = get_supabase()
    room = single(sb.table("chat_rooms").select("kind, ref_id").eq("id", room_id))
    if not room:
        return False
    if room["kind"] == "group":
        return single(sb.table("group_members").select("user_id")
                      .eq("group_id", room["ref_id"]).eq("user_id", user_id)) is not None
    return single(sb.table("meetup_participants").select("user_id")
                  .eq("meetup_id", room["ref_id"]).eq("user_id", user_id)) is not None


def get_room(room_id: str) -> ChatRoom:
    sb = get_supabase()
    row = single(sb.table("chat_rooms").select("*").eq("id", room_id))
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "room not found")
    return ChatRoom(**row)


def list_my_rooms(user_id: str) -> list[ChatRoom]:
    sb = get_supabase()
    gids = [r["group_id"] for r in (sb.table("group_members").select("group_id")
                                     .eq("user_id", user_id).execute().data or [])]
    mids = [r["meetup_id"] for r in (sb.table("meetup_participants").select("meetup_id")
                                      .eq("user_id", user_id).execute().data or [])]
    rooms: list[dict] = []
    if gids:
        rooms += sb.table("chat_rooms").select("*").eq("kind", "group").in_("ref_id", gids).execute().data or []
    if mids:
        rooms += sb.table("chat_rooms").select("*").eq("kind", "meetup").in_("ref_id", mids).execute().data or []
    return [ChatRoom(**r) for r in rooms]


def list_messages(
    room_id: str, user_id: str, before: datetime | None, limit: int = 50,
) -> list[Message]:
    if not _is_room_member(room_id, user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not a room member")
    sb = get_supabase()
    q = sb.table("messages").select("*").eq("room_id", room_id) \
        .is_("deleted_at", None).order("created_at", desc=True).limit(limit)
    if before:
        q = q.lt("created_at", before.isoformat())
    rows = q.execute().data or []
    return [Message(**r) for r in rows]


def send_message(room_id: str, user_id: str, body: MessageSend) -> Message:
    if not _is_room_member(room_id, user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not a room member")
    sb = get_supabase()
    room = single(sb.table("chat_rooms").select("archived_at").eq("id", room_id))
    if room and room["archived_at"]:
        raise HTTPException(status.HTTP_410_GONE, "room archived")

    payload = {
        "room_id": room_id,
        "sender_id": user_id,
        "kind": body.kind,
        "body": body.body,
        "image_url": body.image_url,
        "place_payload": body.place_payload,
    }
    row = sb.table("messages").insert(payload).execute().data[0]
    return Message(**row)


def edit_message(message_id: str, user_id: str, new_body: str) -> Message:
    sb = get_supabase()
    msg = single(sb.table("messages").select("*").eq("id", message_id))
    if not msg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "message not found")
    if msg["sender_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not your message")
    if msg["kind"] != "text":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "only text messages are editable")
    if msg["deleted_at"]:
        raise HTTPException(status.HTTP_410_GONE, "deleted")
    sb.table("messages").update(
        {"body": new_body, "edited_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", message_id).execute()
    row = single(sb.table("messages").select("*").eq("id", message_id))
    return Message(**row)


def delete_message(message_id: str, user_id: str) -> None:
    sb = get_supabase()
    msg = single(sb.table("messages").select("sender_id, deleted_at").eq("id", message_id))
    if not msg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "message not found")
    if msg["sender_id"] != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not your message")
    if msg["deleted_at"]:
        return
    sb.table("messages").update(
        {"deleted_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", message_id).execute()


def create_image_upload_url(room_id: str, user_id: str, ext: str) -> UploadUrlResponse:
    if ext.lower() not in {"jpg", "jpeg", "png", "webp", "gif"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "unsupported image extension")
    if not _is_room_member(room_id, user_id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not a room member")
    sb = get_supabase()
    object_key = f"{room_id}/{uuid.uuid4().hex}.{ext.lower()}"
    res = sb.storage.from_(BUCKET).create_signed_upload_url(object_key)
    # supabase-py 2.x: returns {'signed_url': ..., 'token': ..., 'path': ...}
    return UploadUrlResponse(
        object_key=object_key,
        signed_url=res["signed_url"],
        public_path=f"{BUCKET}/{object_key}",
        expires_in=SIGNED_UPLOAD_TTL_SEC,
    )
