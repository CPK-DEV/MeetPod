# Plan 5 — Backend: 채팅

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 채팅방(group/meetup) 멤버십 기반 메시지 송신/조회/소프트 삭제/수정 엔드포인트와, `chat-images` 버킷 업로드용 signed URL 발급 엔드포인트를 구현한다. 메시지 수신은 모바일이 Supabase Realtime 구독으로 처리(Plan 10).

**Architecture:**
- 메시지 송신은 백엔드 경유(권한 + 소속 검증). 페이로드 분기는 DB CHECK가 보장하지만 백엔드도 사전 거부.
- 이미지: 모바일이 백엔드에서 signed upload URL 발급 → Supabase Storage에 직접 PUT → 반환된 path로 `kind='image'` 메시지 송신.
  - 객체 키: `<room_id>/<uuid>.<ext>` (room_id는 Storage RLS의 split_part가 파싱).
- 그룹/약속 채팅방 자동 생성: 그룹은 그룹 생성 시(이번 Plan에서 추가), 약속은 약속 생성 시(Plan 4에서 이미 처리).

**Tech Stack:** FastAPI, supabase-py, pydantic v2, pytest.

**전제:** Plan 4 완료. `chat_rooms`, `messages`, `chat-images` 버킷 + 정책 (Plan 1).

---

## File Structure

```
MeetPod/backend/app/
├── routers/
│   └── chat.py
├── services/
│   └── chat_service.py
└── models/
    └── chat.py

# Plan 3의 group_service.create_group을 보강 (chat_rooms 생성 추가)
# 새 파일 없음 — Modify only

tests/
└── test_chat.py
```

---

## Task 1: chat 모델

**Files:**
- Create: `MeetPod/backend/app/models/chat.py`

- [ ] **Step 1: 모델**

Create `MeetPod/backend/app/models/chat.py`:
```python
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
```

- [ ] **Step 2: 검증 단위 테스트 (인라인 sanity)**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\backend
python -c "from app.models.chat import MessageSend; import pydantic; \
try: MessageSend(kind='text'); \
except pydantic.ValidationError as e: print('ok:', 'body' in str(e))"
```
Expected: `ok: True`.

- [ ] **Step 3: Commit**

```powershell
git add MeetPod/backend/app/models/chat.py
git commit -m "feat(backend): chat models with per-kind payload validation"
```

---

## Task 2: chat_service

**Files:**
- Create: `MeetPod/backend/app/services/chat_service.py`

- [ ] **Step 1: service**

Create `MeetPod/backend/app/services/chat_service.py`:
```python
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
```

- [ ] **Step 2: import smoke**

Run:
```powershell
python -c "from app.services.chat_service import send_message, list_messages, create_image_upload_url; print('ok')"
```
Expected: `ok`.

- [ ] **Step 3: Commit**

```powershell
git add MeetPod/backend/app/services/chat_service.py
git commit -m "feat(backend): chat service (rooms, messages, upload signed url)"
```

---

## Task 3: 그룹 생성 시 chat_room 자동 생성

**Files:**
- Modify: `MeetPod/backend/app/services/group_service.py`

- [ ] **Step 1: 패치**

Edit `MeetPod/backend/app/services/group_service.py` — `create_group` 함수의 마지막 `return Group(**row)` 직전에 다음 한 줄 추가:
```python
    sb.table("chat_rooms").insert({"kind": "group", "ref_id": row["id"]}).execute()
    return Group(**row)
```

- [ ] **Step 2: 회귀 테스트**

Run:
```powershell
pytest tests/test_groups.py -v
```
Expected: 8 passed (모킹 기반이라 통과).

- [ ] **Step 3: Commit**

```powershell
git add MeetPod/backend/app/services/group_service.py
git commit -m "feat(backend): auto-create chat_room on group create"
```

---

## Task 4: chat 라우터 + 테스트

**Files:**
- Create: `MeetPod/backend/app/routers/chat.py`
- Modify: `MeetPod/backend/app/main.py`
- Create: `MeetPod/backend/tests/test_chat.py`

- [ ] **Step 1: 테스트 (실패)**

Create `MeetPod/backend/tests/test_chat.py`:
```python
from datetime import datetime, timezone
from unittest.mock import patch

from app.models.chat import ChatRoom, Message, UploadUrlResponse


def _msg(**kw):
    base = dict(id="msg1", room_id="r1", sender_id="u1", kind="text",
                body="hi", image_url=None, place_payload=None,
                created_at=datetime.now(timezone.utc),
                edited_at=None, deleted_at=None)
    base.update(kw)
    return Message(**base)


def test_list_my_rooms(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.chat.list_my_rooms") as m:
            m.return_value = [ChatRoom(id="r1", kind="group", ref_id="g1",
                                        archived_at=None, created_at=datetime.now(timezone.utc))]
            r = client.get("/api/chat/rooms")
    assert r.status_code == 200
    assert r.json()[0]["kind"] == "group"


def test_list_messages(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.chat.list_messages") as m:
            m.return_value = [_msg()]
            r = client.get("/api/chat/rooms/r1/messages?limit=10")
    assert r.status_code == 200
    assert r.json()[0]["body"] == "hi"


def test_send_text(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.chat.send_message") as m:
            m.return_value = _msg()
            r = client.post("/api/chat/rooms/r1/messages", json={"kind": "text", "body": "hi"})
    assert r.status_code == 200
    assert r.json()["body"] == "hi"


def test_send_text_missing_body_422(client, auth_as):
    with auth_as("u1"):
        r = client.post("/api/chat/rooms/r1/messages", json={"kind": "text"})
    assert r.status_code == 422


def test_edit_message(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.chat.edit_message") as m:
            m.return_value = _msg(body="edited")
            r = client.patch("/api/chat/messages/msg1", json={"body": "edited"})
    assert r.status_code == 200
    assert r.json()["body"] == "edited"


def test_delete_message(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.chat.delete_message") as m:
            r = client.delete("/api/chat/messages/msg1")
    assert r.status_code == 204
    m.assert_called_with("msg1", "u1")


def test_create_upload_url(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.chat.create_image_upload_url") as m:
            m.return_value = UploadUrlResponse(object_key="r1/abc.jpg",
                                                signed_url="https://x", public_path="chat-images/r1/abc.jpg",
                                                expires_in=60)
            r = client.post("/api/chat/rooms/r1/upload-url", json={"ext": "jpg"})
    assert r.status_code == 200
    assert r.json()["object_key"].startswith("r1/")
```

- [ ] **Step 2: 실패 확인**

Run:
```powershell
pytest tests/test_chat.py -v
```
Expected: 404 FAIL.

- [ ] **Step 3: 라우터**

Create `MeetPod/backend/app/routers/chat.py`:
```python
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
```

- [ ] **Step 4: main.py include**

Edit `MeetPod/backend/app/main.py`:
```python
    from app.routers import chat as chat_router
    app.include_router(chat_router.router)
```

- [ ] **Step 5: 통과**

Run:
```powershell
pytest tests/test_chat.py -v
```
Expected: 7 passed.

- [ ] **Step 6: 전체 테스트 회귀**

Run:
```powershell
pytest -v
```
Expected: 모든 이전 plan 테스트 + 새 7개 모두 passed.

- [ ] **Step 7: Commit**

```powershell
git add MeetPod/backend/app/routers/chat.py MeetPod/backend/app/main.py MeetPod/backend/tests/test_chat.py
git commit -m "feat(backend): chat router (rooms, messages, edit/delete, upload-url)"
```

---

## Task 5: 라이브 통합 검증 (옵션)

- [ ] **Step 1: 그룹 채팅 end-to-end**

(Plan 4 컨텍스트 재사용, $g 그룹)
```powershell
# group room 자동 생성 확인
$rooms = Invoke-RestMethod -Method Get -Uri "$BASE/chat/rooms" -Headers @{Authorization="Bearer $AT"}
$gr = $rooms | Where-Object { $_.kind -eq 'group' -and $_.ref_id -eq $g.id }

# alice 메시지 송신
Invoke-RestMethod -Method Post -Uri "$BASE/chat/rooms/$($gr.id)/messages" -Headers @{Authorization="Bearer $AT"} -Body (@{kind='text'; body='hello bob'} | ConvertTo-Json) -ContentType 'application/json'

# bob 조회
Invoke-RestMethod -Method Get -Uri "$BASE/chat/rooms/$($gr.id)/messages" -Headers @{Authorization="Bearer $BT"}
```
Expected: bob의 응답에 "hello bob" 1건.

- [ ] **Step 2: 이미지 업로드 URL 발급 후 PUT**

```powershell
$u = Invoke-RestMethod -Method Post -Uri "$BASE/chat/rooms/$($gr.id)/upload-url" -Headers @{Authorization="Bearer $AT"} -Body (@{ext='jpg'} | ConvertTo-Json) -ContentType 'application/json'

# 작은 더미 jpg PUT
$bytes = [byte[]](0xFF,0xD8,0xFF,0xD9)
Invoke-RestMethod -Method Put -Uri $u.signed_url -InFile (New-TemporaryFile | % { [IO.File]::WriteAllBytes($_.FullName, $bytes); $_.FullName })

# 메시지 송신
Invoke-RestMethod -Method Post -Uri "$BASE/chat/rooms/$($gr.id)/messages" -Headers @{Authorization="Bearer $AT"} -Body (@{kind='image'; image_url=$u.public_path} | ConvertTo-Json) -ContentType 'application/json'
```
Expected: 메시지 1건 추가, image_url에 경로 저장.

- [ ] **Step 3: Commit**

```powershell
git commit --allow-empty -m "chore(backend): plan-5 verified end-to-end"
```

---

## Self-Review Notes

§6.6 채팅 송신/수신 분담: 송신=백엔드(이번 Plan), 수신=Realtime(Plan 10) ✓
이미지 업로드: signed upload URL 발급(백엔드) → 직접 PUT(클라이언트) → 메시지에 path 저장 ✓
장소 메시지(`kind='place'`): pydantic + DB CHECK로 페이로드 분기 강제 ✓

**제외:** 메시지 reaction, 읽음 표시, 타이핑 indicator — MVP 외.

---

## Execution Handoff

1) Subagent-Driven 2) Inline.
