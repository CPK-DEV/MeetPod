# Plan 4 — Backend: 약속 / 알림 / 위치 cron

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 약속(meetup) CRUD, 참여자 관리, 개인 알림(`meetup_reminders`) 등록·해제 엔드포인트를 구현한다. 약속 생성 시 자동으로 채팅방을 만들고 본인 알림을 등록한다. 위치 핑은 모바일이 Supabase 직결로 INSERT(Plan 9), 본 Plan은 그 이외 모든 약속 관련 서버 권한 검증을 책임진다.

**Architecture:**
- 약속 생성은 단일 트랜잭션 등가 시퀀스: meetups INSERT → meetup_participants 일괄 INSERT → chat_rooms INSERT(`kind='meetup'`) → 본인 reminder INSERT(요청 시).
- 권한 모델: 그룹 약속이면 그룹 멤버 누구나 생성 가능, UPDATE/CANCEL은 creator 또는 그룹 owner/admin. 1회성 약속은 creator만.
- `notify_at = starts_at - minutes_before` 계산은 백엔드 책임.
- meetup status 전환(`scheduled`→`active`→`ended`)은 Plan 1의 pg_cron이 처리. 백엔드는 즉시 cancel만 노출.

**Tech Stack:** FastAPI, supabase-py, pydantic v2, pytest.

**전제:** Plan 3 완료 (`require_group_role`, group_service 사용). Plan 1의 `meetups`, `meetup_participants`, `meetup_reminders`, `chat_rooms` 테이블 + RLS.

---

## File Structure

```
MeetPod/backend/app/
├── routers/
│   ├── meetups.py
│   └── reminders.py
├── services/
│   ├── meetup_service.py
│   └── reminder_service.py
├── models/
│   └── meetup.py
└── dependencies/
    └── permissions.py        # require_meetup_access(min='participant'|'editor') 추가

tests/
├── test_meetups.py
└── test_reminders.py
```

---

## Task 1: meetup 모델

**Files:**
- Create: `MeetPod/backend/app/models/meetup.py`

- [ ] **Step 1: 모델 정의**

Create `MeetPod/backend/app/models/meetup.py`:
```python
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
```

- [ ] **Step 2: import smoke**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\backend
python -c "from app.models.meetup import MeetupCreate, Place; m = MeetupCreate(title='t', starts_at='2026-01-01T00:00:00Z', ends_at='2026-01-01T01:00:00Z', place=Place(name='p', lat=0, lng=0)); print(m.location_share_minutes_before)"
```
Expected: `20`.

- [ ] **Step 3: Commit**

```powershell
git add MeetPod/backend/app/models/meetup.py
git commit -m "feat(backend): meetup pydantic models"
```

---

## Task 2: meetup_service — 생성

**Files:**
- Create: `MeetPod/backend/app/services/meetup_service.py`

- [ ] **Step 1: service 작성**

Create `MeetPod/backend/app/services/meetup_service.py`:
```python
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app.models.meetup import (
    Meetup, MeetupCreate, MeetupUpdate, Participant,
)
from app.utils.db import single
from app.utils.supabase_client import get_supabase


def _row_to_meetup(row: dict) -> Meetup:
    return Meetup(**row)


def create_meetup(creator_id: str, body: MeetupCreate) -> Meetup:
    sb = get_supabase()

    # 그룹 약속이면 creator는 멤버여야 함, 참여자는 모두 멤버여야 함
    if body.group_id:
        member = single(sb.table("group_members").select("user_id")
                        .eq("group_id", body.group_id).eq("user_id", creator_id))
        if not member:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "not a group member")

        member_rows = sb.table("group_members").select("user_id") \
            .eq("group_id", body.group_id).execute().data or []
        member_ids = {r["user_id"] for r in member_rows}
        invalid = [uid for uid in body.participant_ids if uid not in member_ids]
        if invalid:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"non-member participants: {invalid}")

    # 항상 creator 포함
    participant_ids = list({creator_id, *body.participant_ids})

    payload = {
        "group_id": body.group_id,
        "creator_id": creator_id,
        "title": body.title,
        "starts_at": body.starts_at.isoformat(),
        "ends_at": body.ends_at.isoformat(),
        "place_name": body.place.name,
        "place_lat": body.place.lat,
        "place_lng": body.place.lng,
        "place_address": body.place.address,
        "place_google_id": body.place.google_id,
        "location_share_minutes_before": body.location_share_minutes_before,
        "status": "scheduled",
    }
    row = sb.table("meetups").insert(payload).execute().data[0]
    mid = row["id"]

    sb.table("meetup_participants").insert(
        [{"meetup_id": mid, "user_id": uid} for uid in participant_ids]
    ).execute()

    sb.table("chat_rooms").insert({"kind": "meetup", "ref_id": mid}).execute()

    if body.self_reminder_minutes_before is not None:
        notify_at = body.starts_at - timedelta(minutes=body.self_reminder_minutes_before)
        sb.table("meetup_reminders").insert({
            "meetup_id": mid,
            "user_id": creator_id,
            "minutes_before": body.self_reminder_minutes_before,
            "notify_at": notify_at.isoformat(),
        }).execute()

    return _row_to_meetup(row)


def get_meetup(meetup_id: str) -> Meetup:
    sb = get_supabase()
    row = single(sb.table("meetups").select("*").eq("id", meetup_id))
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "meetup not found")
    return _row_to_meetup(row)


def list_my_meetups(user_id: str, include_ended: bool = False) -> list[Meetup]:
    sb = get_supabase()
    parts = sb.table("meetup_participants").select("meetup_id").eq("user_id", user_id).execute().data or []
    ids = [p["meetup_id"] for p in parts]
    if not ids:
        return []
    q = sb.table("meetups").select("*").in_("id", ids).order("starts_at", desc=False)
    if not include_ended:
        q = q.in_("status", ["scheduled", "active"])
    rows = q.execute().data or []
    return [_row_to_meetup(r) for r in rows]


def update_meetup(meetup_id: str, body: MeetupUpdate) -> Meetup:
    sb = get_supabase()
    patch: dict = {}
    if body.title is not None: patch["title"] = body.title
    if body.starts_at is not None: patch["starts_at"] = body.starts_at.isoformat()
    if body.ends_at is not None: patch["ends_at"] = body.ends_at.isoformat()
    if body.location_share_minutes_before is not None:
        patch["location_share_minutes_before"] = body.location_share_minutes_before
    if body.place is not None:
        patch.update({
            "place_name": body.place.name,
            "place_lat": body.place.lat,
            "place_lng": body.place.lng,
            "place_address": body.place.address,
            "place_google_id": body.place.google_id,
        })
    if patch:
        sb.table("meetups").update(patch).eq("id", meetup_id).execute()

    # starts_at 변경 시 notify_at 재계산 (모든 user_id의 reminders)
    if body.starts_at is not None:
        rems = sb.table("meetup_reminders").select("user_id, minutes_before") \
            .eq("meetup_id", meetup_id).execute().data or []
        for r in rems:
            new_at = body.starts_at - timedelta(minutes=r["minutes_before"])
            sb.table("meetup_reminders").update({"notify_at": new_at.isoformat()}) \
                .eq("meetup_id", meetup_id).eq("user_id", r["user_id"]) \
                .eq("minutes_before", r["minutes_before"]).execute()

    return get_meetup(meetup_id)


def cancel_meetup(meetup_id: str) -> Meetup:
    sb = get_supabase()
    sb.table("meetups").update({"status": "cancelled"}).eq("id", meetup_id).execute()
    sb.table("meetup_reminders").delete().eq("meetup_id", meetup_id).execute()
    return get_meetup(meetup_id)


def list_participants(meetup_id: str) -> list[Participant]:
    sb = get_supabase()
    rows = sb.table("meetup_participants").select("user_id, status, joined_at") \
        .eq("meetup_id", meetup_id).execute().data or []
    return [Participant(**r) for r in rows]


def add_participants(meetup_id: str, user_ids: list[str]) -> None:
    sb = get_supabase()
    if not user_ids:
        return
    rows = [{"meetup_id": meetup_id, "user_id": uid} for uid in user_ids]
    sb.table("meetup_participants").upsert(rows).execute()


def remove_participant(meetup_id: str, user_id: str) -> None:
    sb = get_supabase()
    sb.table("meetup_participants").delete() \
        .eq("meetup_id", meetup_id).eq("user_id", user_id).execute()
    sb.table("meetup_reminders").delete() \
        .eq("meetup_id", meetup_id).eq("user_id", user_id).execute()
```

- [ ] **Step 2: import smoke**

Run:
```powershell
python -c "from app.services.meetup_service import create_meetup, update_meetup, cancel_meetup; print('ok')"
```
Expected: `ok`.

- [ ] **Step 3: Commit**

```powershell
git add MeetPod/backend/app/services/meetup_service.py
git commit -m "feat(backend): meetup service (create + update + cancel + participants)"
```

---

## Task 3: meetup 권한 의존성

**Files:**
- Modify: `MeetPod/backend/app/dependencies/permissions.py`

- [ ] **Step 1: 추가 함수**

Edit `MeetPod/backend/app/dependencies/permissions.py` — 파일 하단에 다음 추가:
```python
def _is_meetup_participant(meetup_id: str, user_id: str) -> bool:
    sb = get_supabase()
    return single(sb.table("meetup_participants").select("user_id")
                  .eq("meetup_id", meetup_id).eq("user_id", user_id)) is not None


def _meetup_editor(meetup_id: str, user_id: str) -> bool:
    """creator 또는 그룹 owner/admin"""
    sb = get_supabase()
    m = single(sb.table("meetups").select("creator_id, group_id").eq("id", meetup_id))
    if not m:
        return False
    if m["creator_id"] == user_id:
        return True
    if m["group_id"]:
        role = _fetch_role(m["group_id"], user_id)
        return role in ("owner", "admin")
    return False


def require_meetup_participant():
    def _dep(
        mid: str = Path(..., alias="mid"),
        user: CurrentUser = Depends(current_user),
    ) -> None:
        if not _is_meetup_participant(mid, user.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "not a meetup participant")
    return Depends(_dep)


def require_meetup_editor():
    def _dep(
        mid: str = Path(..., alias="mid"),
        user: CurrentUser = Depends(current_user),
    ) -> None:
        if not _meetup_editor(mid, user.id):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "not allowed to edit this meetup")
    return Depends(_dep)
```

- [ ] **Step 2: 회귀 테스트 통과 확인**

Run:
```powershell
pytest tests/test_permissions.py -v
```
Expected: 기존 7 passed (변경 없음).

- [ ] **Step 3: Commit**

```powershell
git add MeetPod/backend/app/dependencies/permissions.py
git commit -m "feat(backend): meetup participant/editor permission deps"
```

---

## Task 4: meetups 라우터 + 테스트

**Files:**
- Create: `MeetPod/backend/app/routers/meetups.py`
- Modify: `MeetPod/backend/app/main.py`
- Create: `MeetPod/backend/tests/test_meetups.py`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `MeetPod/backend/tests/test_meetups.py`:
```python
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.models.meetup import Meetup, Participant


def _m(**kw):
    base = dict(
        id="m1", group_id=None, creator_id="u1", title="T",
        starts_at=datetime.now(timezone.utc) + timedelta(hours=1),
        ends_at=datetime.now(timezone.utc) + timedelta(hours=2),
        place_name="P", place_lat=37.5, place_lng=127.0,
        place_address=None, place_google_id=None,
        location_share_minutes_before=20, status="scheduled",
        created_at=datetime.now(timezone.utc),
    )
    base.update(kw)
    return Meetup(**base)


def _create_body() -> dict:
    return {
        "title": "T",
        "starts_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "ends_at":   (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat(),
        "place": {"name": "P", "lat": 37.5, "lng": 127.0},
    }


def test_create_meetup(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.meetups.create_meetup") as m:
            m.return_value = _m()
            r = client.post("/api/meetups", json=_create_body())
    assert r.status_code == 200
    assert r.json()["id"] == "m1"


def test_create_validates_time_order(client, auth_as):
    body = _create_body()
    body["ends_at"] = body["starts_at"]
    with auth_as("u1"):
        r = client.post("/api/meetups", json=body)
    assert r.status_code == 422


def test_list_my_meetups(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.meetups.list_my_meetups") as m:
            m.return_value = [_m()]
            r = client.get("/api/meetups")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_get_meetup_requires_participant(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._is_meetup_participant") as p, \
             patch("app.routers.meetups.get_meetup") as g:
            p.return_value = False
            assert client.get("/api/meetups/m1").status_code == 403
            p.return_value = True
            g.return_value = _m()
            assert client.get("/api/meetups/m1").status_code == 200


def test_update_requires_editor(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._meetup_editor") as e, \
             patch("app.routers.meetups.update_meetup") as u:
            e.return_value = False
            assert client.patch("/api/meetups/m1", json={"title": "X"}).status_code == 403
            e.return_value = True
            u.return_value = _m(title="X")
            assert client.patch("/api/meetups/m1", json={"title": "X"}).status_code == 200


def test_cancel_requires_editor(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._meetup_editor") as e, \
             patch("app.routers.meetups.cancel_meetup") as c:
            e.return_value = True
            c.return_value = _m(status="cancelled")
            r = client.post("/api/meetups/m1/cancel")
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"


def test_participants_list(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._is_meetup_participant") as p, \
             patch("app.routers.meetups.list_participants") as lp:
            p.return_value = True
            lp.return_value = [Participant(user_id="u1", status="going",
                                            joined_at=datetime.now(timezone.utc))]
            r = client.get("/api/meetups/m1/participants")
    assert r.status_code == 200
    assert r.json()[0]["user_id"] == "u1"


def test_add_participants_requires_editor(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._meetup_editor") as e, \
             patch("app.routers.meetups.add_participants") as a:
            e.return_value = True
            r = client.post("/api/meetups/m1/participants", json={"user_ids": ["u2", "u3"]})
    assert r.status_code == 204
    a.assert_called_with("m1", ["u2", "u3"])


def test_leave_meetup(client, auth_as):
    with auth_as("u2"):
        with patch("app.dependencies.permissions._is_meetup_participant") as p, \
             patch("app.routers.meetups.remove_participant") as r:
            p.return_value = True
            res = client.delete("/api/meetups/m1/participants/me")
    assert res.status_code == 204
    r.assert_called_with("m1", "u2")
```

- [ ] **Step 2: 실패 확인**

Run:
```powershell
pytest tests/test_meetups.py -v
```
Expected: 404 FAIL.

- [ ] **Step 3: 라우터 구현**

Create `MeetPod/backend/app/routers/meetups.py`:
```python
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel

from app.dependencies.auth import CurrentUser, current_user
from app.dependencies.permissions import (
    require_meetup_editor, require_meetup_participant,
)
from app.models.meetup import (
    Meetup, MeetupCreate, MeetupUpdate, Participant,
)
from app.services.meetup_service import (
    add_participants, cancel_meetup, create_meetup, get_meetup,
    list_my_meetups, list_participants, remove_participant, update_meetup,
)

router = APIRouter(prefix="/api/meetups", tags=["meetups"])


class AddParticipantsBody(BaseModel):
    user_ids: list[str]


@router.post("", response_model=Meetup)
def create(body: MeetupCreate, user: CurrentUser = Depends(current_user)) -> Meetup:
    return create_meetup(user.id, body)


@router.get("", response_model=list[Meetup])
def list_(
    user: CurrentUser = Depends(current_user),
    include_ended: bool = Query(default=False),
) -> list[Meetup]:
    return list_my_meetups(user.id, include_ended=include_ended)


@router.get("/{mid}", response_model=Meetup)
def get_(mid: str, _: None = require_meetup_participant()) -> Meetup:
    return get_meetup(mid)


@router.patch("/{mid}", response_model=Meetup)
def patch_(mid: str, body: MeetupUpdate, _: None = require_meetup_editor()) -> Meetup:
    return update_meetup(mid, body)


@router.post("/{mid}/cancel", response_model=Meetup)
def cancel(mid: str, _: None = require_meetup_editor()) -> Meetup:
    return cancel_meetup(mid)


@router.get("/{mid}/participants", response_model=list[Participant])
def participants(mid: str, _: None = require_meetup_participant()) -> list[Participant]:
    return list_participants(mid)


@router.post("/{mid}/participants", status_code=status.HTTP_204_NO_CONTENT)
def add(mid: str, body: AddParticipantsBody, _: None = require_meetup_editor()) -> None:
    add_participants(mid, body.user_ids)


@router.delete("/{mid}/participants/me", status_code=status.HTTP_204_NO_CONTENT)
def leave(
    mid: str,
    user: CurrentUser = Depends(current_user),
    _: None = require_meetup_participant(),
) -> None:
    remove_participant(mid, user.id)
```

- [ ] **Step 4: main.py include**

Edit `MeetPod/backend/app/main.py`:
```python
    from app.routers import meetups as meetups_router
    app.include_router(meetups_router.router)
```

- [ ] **Step 5: 통과**

Run:
```powershell
pytest tests/test_meetups.py -v
```
Expected: 9 passed.

- [ ] **Step 6: Commit**

```powershell
git add MeetPod/backend/app/routers/meetups.py MeetPod/backend/app/main.py MeetPod/backend/tests/test_meetups.py
git commit -m "feat(backend): meetups router (CRUD + participants + cancel)"
```

---

## Task 5: reminders 라우터 + 테스트

**Files:**
- Create: `MeetPod/backend/app/services/reminder_service.py`
- Create: `MeetPod/backend/app/routers/reminders.py`
- Modify: `MeetPod/backend/app/main.py`
- Create: `MeetPod/backend/tests/test_reminders.py`

- [ ] **Step 1: service**

Create `MeetPod/backend/app/services/reminder_service.py`:
```python
from datetime import timedelta

from fastapi import HTTPException, status

from app.models.meetup import Reminder
from app.utils.db import single
from app.utils.supabase_client import get_supabase


def list_my_reminders(user_id: str, meetup_id: str | None = None) -> list[Reminder]:
    sb = get_supabase()
    q = sb.table("meetup_reminders").select("*").eq("user_id", user_id)
    if meetup_id:
        q = q.eq("meetup_id", meetup_id)
    return [Reminder(**r) for r in (q.execute().data or [])]


def upsert_reminder(user_id: str, meetup_id: str, minutes_before: int) -> Reminder:
    sb = get_supabase()
    m = single(sb.table("meetups").select("starts_at").eq("id", meetup_id))
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "meetup not found")
    from datetime import datetime
    starts_at = datetime.fromisoformat(m["starts_at"].replace("Z", "+00:00"))
    notify_at = starts_at - timedelta(minutes=minutes_before)
    sb.table("meetup_reminders").upsert({
        "meetup_id": meetup_id,
        "user_id": user_id,
        "minutes_before": minutes_before,
        "notify_at": notify_at.isoformat(),
    }).execute()
    return Reminder(meetup_id=meetup_id, user_id=user_id,
                    minutes_before=minutes_before, notify_at=notify_at)


def delete_reminder(user_id: str, meetup_id: str, minutes_before: int) -> None:
    sb = get_supabase()
    sb.table("meetup_reminders").delete() \
        .eq("user_id", user_id).eq("meetup_id", meetup_id) \
        .eq("minutes_before", minutes_before).execute()
```

- [ ] **Step 2: 테스트 (실패)**

Create `MeetPod/backend/tests/test_reminders.py`:
```python
from datetime import datetime, timezone
from unittest.mock import patch

from app.models.meetup import Reminder


def test_list_reminders(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.reminders.list_my_reminders") as m:
            m.return_value = [Reminder(meetup_id="m1", user_id="u1",
                                        minutes_before=30, notify_at=datetime.now(timezone.utc))]
            r = client.get("/api/meetups/m1/reminders/me")
    assert r.status_code == 200
    assert r.json()[0]["minutes_before"] == 30


def test_upsert_reminder(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._is_meetup_participant") as p, \
             patch("app.routers.reminders.upsert_reminder") as u:
            p.return_value = True
            u.return_value = Reminder(meetup_id="m1", user_id="u1",
                                       minutes_before=30, notify_at=datetime.now(timezone.utc))
            r = client.put("/api/meetups/m1/reminders/me", json={"minutes_before": 30})
    assert r.status_code == 200
    u.assert_called_with("u1", "m1", 30)


def test_delete_reminder(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._is_meetup_participant") as p, \
             patch("app.routers.reminders.delete_reminder") as d:
            p.return_value = True
            r = client.delete("/api/meetups/m1/reminders/me/30")
    assert r.status_code == 204
    d.assert_called_with("u1", "m1", 30)
```

- [ ] **Step 3: 실패 확인**

Run:
```powershell
pytest tests/test_reminders.py -v
```
Expected: 404 FAIL.

- [ ] **Step 4: 라우터**

Create `MeetPod/backend/app/routers/reminders.py`:
```python
from fastapi import APIRouter, Depends, status

from app.dependencies.auth import CurrentUser, current_user
from app.dependencies.permissions import require_meetup_participant
from app.models.meetup import Reminder, ReminderUpsert
from app.services.reminder_service import (
    delete_reminder, list_my_reminders, upsert_reminder,
)

router = APIRouter(prefix="/api/meetups/{mid}/reminders/me", tags=["reminders"])


@router.get("", response_model=list[Reminder])
def list_(mid: str, user: CurrentUser = Depends(current_user)) -> list[Reminder]:
    return list_my_reminders(user.id, meetup_id=mid)


@router.put("", response_model=Reminder)
def upsert(
    mid: str, body: ReminderUpsert,
    user: CurrentUser = Depends(current_user),
    _: None = require_meetup_participant(),
) -> Reminder:
    return upsert_reminder(user.id, mid, body.minutes_before)


@router.delete("/{minutes_before}", status_code=status.HTTP_204_NO_CONTENT)
def delete_(
    mid: str, minutes_before: int,
    user: CurrentUser = Depends(current_user),
    _: None = require_meetup_participant(),
) -> None:
    delete_reminder(user.id, mid, minutes_before)
```

- [ ] **Step 5: main.py include**

Edit `MeetPod/backend/app/main.py`:
```python
    from app.routers import reminders as reminders_router
    app.include_router(reminders_router.router)
```

- [ ] **Step 6: 통과**

Run:
```powershell
pytest tests/test_reminders.py -v
```
Expected: 3 passed.

- [ ] **Step 7: Commit**

```powershell
git add MeetPod/backend/app/services/reminder_service.py MeetPod/backend/app/routers/reminders.py MeetPod/backend/app/main.py MeetPod/backend/tests/test_reminders.py
git commit -m "feat(backend): reminders endpoints (list/upsert/delete)"
```

---

## Task 6: 라이브 통합 검증

**Files:** (변경 없음)

- [ ] **Step 1: 그룹 약속 생성 + 참여자/알림 검증**

(Plan 3 Task 8의 alice/bob/group_id $g 컨텍스트 재사용)
```powershell
$body = @{
  title = "저녁"
  starts_at = (Get-Date).AddHours(2).ToString("o")
  ends_at   = (Get-Date).AddHours(4).ToString("o")
  place = @{ name = "강남"; lat = 37.498; lng = 127.027 }
  group_id = $g.id
  participant_ids = @("<bob-uuid>")
  self_reminder_minutes_before = 30
} | ConvertTo-Json -Depth 5

$mt = Invoke-RestMethod -Method Post -Uri "$BASE/meetups" -Headers @{Authorization="Bearer $AT"} -Body $body -ContentType 'application/json'

# 참여자 2명 확인
Invoke-RestMethod -Method Get -Uri "$BASE/meetups/$($mt.id)/participants" -Headers @{Authorization="Bearer $AT"}

# bob도 보인다
Invoke-RestMethod -Method Get -Uri "$BASE/meetups" -Headers @{Authorization="Bearer $BT"}

# 채팅방 자동 생성 확인 (Studio SQL):
#   SELECT * FROM chat_rooms WHERE kind='meetup' AND ref_id=$mt.id
# 본인 reminder 자동 등록 확인:
#   SELECT * FROM meetup_reminders WHERE meetup_id=$mt.id
```
Expected: 참여자 2명, bob의 list에도 등장, chat_rooms 1행 + meetup_reminders 1행.

- [ ] **Step 2: cancel 검증**

```powershell
Invoke-RestMethod -Method Post -Uri "$BASE/meetups/$($mt.id)/cancel" -Headers @{Authorization="Bearer $AT"}
```
Expected: status=cancelled. DB에서 reminders 0행.

- [ ] **Step 3: Commit**

```powershell
git commit --allow-empty -m "chore(backend): plan-4 verified end-to-end"
```

---

## Self-Review Notes

§6.3 약속 생성 흐름(그룹 멤버 default + place + share window + reminder) ✓
§6.4 위치 cron 정리는 Plan 1 011에서 담당; 본 Plan은 cancel 시 reminder 정리 ✓
편집/취소 권한: creator + 그룹 owner/admin ✓
모바일 직결 INSERT(location_pings)는 의도적으로 백엔드 비노출 — Plan 9가 처리.

---

## Execution Handoff

1) Subagent-Driven 2) Inline.
