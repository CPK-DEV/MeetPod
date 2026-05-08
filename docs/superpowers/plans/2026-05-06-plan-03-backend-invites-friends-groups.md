# Plan 3 — Backend: 초대 / 친구 / 그룹

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초대 코드 발급/소비, 친구 관계, 그룹 CRUD + 멤버 관리(역할/위임/추방)을 위한 FastAPI 라우터·서비스·권한 의존성을 구현한다.

**Architecture:**
- 모든 쓰기는 백엔드 경유(서버 권위). 권한 의존성(`require_group_role`)으로 owner/admin/member 가드.
- 초대 코드는 `secrets.token_urlsafe(6)` → 8자 URL-safe. INSERT 충돌 시 1회 재시도.
- 친구 추가는 `invites.accept`로 진입; 자기 자신 초대 거부, 이미 친구인 경우 멱등 처리.
- 그룹 owner 위임은 단일 SQL 트랜잭션(이전 owner → admin, 신규 → owner)을 RPC가 아닌 백엔드 두 UPDATE로 수행하되, `group_members_one_owner_per_group` 인덱스가 일시적으로 위반되지 않도록 **이전 owner를 먼저 admin으로 격하 후** 신규 owner UPDATE.

**Tech Stack:** FastAPI, supabase-py(service_role), pydantic v2, pytest + httpx + supabase 모킹.

**전제:** Plan 2 완료. `current_user`, `get_supabase`, `single` 사용 가능. Plan 1의 `groups`, `group_members`, `friendships`, `invites` 테이블 + RLS 존재.

---

## File Structure

```
MeetPod/backend/app/
├── routers/
│   ├── invites.py             # POST /api/invites, POST /api/invites/{code}/accept
│   ├── friendships.py         # GET /api/friendships
│   └── groups.py              # CRUD + 멤버 mgmt
├── services/
│   ├── invite_service.py
│   ├── friendship_service.py
│   └── group_service.py
├── models/
│   ├── invite.py
│   ├── friendship.py
│   └── group.py
├── dependencies/
│   └── permissions.py         # require_group_role(min_role)
└── utils/
    └── invite_code.py         # generate_code() + 충돌 재시도 helper

tests/
├── test_invites.py
├── test_friendships.py
└── test_groups.py
```

---

## Task 1: invite_code 유틸 + 단위 테스트

**Files:**
- Create: `MeetPod/backend/app/utils/invite_code.py`
- Create: `MeetPod/backend/tests/test_invite_code.py`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `MeetPod/backend/tests/test_invite_code.py`:
```python
import re

from app.utils.invite_code import generate_code


def test_generate_code_format():
    code = generate_code()
    assert re.fullmatch(r"[A-Za-z0-9_-]{8}", code)


def test_generate_code_unique_enough():
    seen = {generate_code() for _ in range(1000)}
    assert len(seen) == 1000
```

- [ ] **Step 2: 실패 확인**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\backend
pytest tests/test_invite_code.py -v
```
Expected: ImportError FAIL.

- [ ] **Step 3: 구현**

Create `MeetPod/backend/app/utils/invite_code.py`:
```python
import secrets


def generate_code() -> str:
    """8-char URL-safe code. token_urlsafe(6)은 base64로 정확히 8자."""
    return secrets.token_urlsafe(6)
```

- [ ] **Step 4: 통과**

Run:
```powershell
pytest tests/test_invite_code.py -v
```
Expected: 2 passed.

- [ ] **Step 5: Commit**

```powershell
git add MeetPod/backend/app/utils/invite_code.py MeetPod/backend/tests/test_invite_code.py
git commit -m "feat(backend): invite code generator"
```

---

## Task 2: invite 모델 + 서비스

**Files:**
- Create: `MeetPod/backend/app/models/invite.py`
- Create: `MeetPod/backend/app/services/invite_service.py`

- [ ] **Step 1: 모델**

Create `MeetPod/backend/app/models/invite.py`:
```python
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
```

- [ ] **Step 2: 서비스**

Create `MeetPod/backend/app/services/invite_service.py`:
```python
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status

from app.models.invite import Invite, InviteAcceptResult, InviteCreate
from app.utils.db import single
from app.utils.invite_code import generate_code
from app.utils.supabase_client import get_supabase


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_invite(inviter_id: str, body: InviteCreate) -> Invite:
    if body.kind == "group" and not body.target_group_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "target_group_id required for group invite")
    if body.kind == "friend" and body.target_group_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "friend invite must not target a group")

    sb = get_supabase()

    if body.kind == "group":
        # 초대 권한: 그룹 멤버여야 함 (owner/admin은 후속 ACL에서 분리; MVP는 멤버 누구나)
        m = single(sb.table("group_members").select("user_id")
                   .eq("group_id", body.target_group_id).eq("user_id", inviter_id))
        if not m:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "not a group member")

    payload = {
        "inviter_id": inviter_id,
        "kind": body.kind,
        "target_group_id": body.target_group_id,
        "expires_at": (_now() + timedelta(days=body.expires_in_days)).isoformat(),
        "max_uses": body.max_uses,
        "used_count": 0,
    }

    # 코드 충돌 시 재시도
    for _ in range(3):
        code = generate_code()
        try:
            sb.table("invites").insert({**payload, "code": code}).execute()
            row = single(sb.table("invites").select("*").eq("code", code))
            return Invite(**row)
        except Exception as e:
            if "duplicate key" not in str(e).lower():
                raise
    raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "could not allocate invite code")


def accept_invite(user_id: str, code: str) -> InviteAcceptResult:
    sb = get_supabase()
    inv = single(sb.table("invites").select("*").eq("code", code))
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "invite not found")

    expires_at = datetime.fromisoformat(inv["expires_at"].replace("Z", "+00:00"))
    if expires_at < _now():
        raise HTTPException(status.HTTP_410_GONE, "invite expired")
    if inv["used_count"] >= inv["max_uses"]:
        raise HTTPException(status.HTTP_410_GONE, "invite exhausted")
    if inv["inviter_id"] == user_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot accept own invite")

    if inv["kind"] == "friend":
        a, b = sorted([inv["inviter_id"], user_id])
        existing = single(sb.table("friendships").select("user_a_id")
                          .eq("user_a_id", a).eq("user_b_id", b))
        if not existing:
            sb.table("friendships").insert({"user_a_id": a, "user_b_id": b}).execute()
        group_id = None
    else:
        gid = inv["target_group_id"]
        existing_member = single(sb.table("group_members").select("user_id")
                                 .eq("group_id", gid).eq("user_id", user_id))
        if not existing_member:
            sb.table("group_members").insert(
                {"group_id": gid, "user_id": user_id, "role": "member"}
            ).execute()
        group_id = gid

    sb.table("invites").update({"used_count": inv["used_count"] + 1}).eq("code", code).execute()
    return InviteAcceptResult(kind=inv["kind"], inviter_id=inv["inviter_id"], group_id=group_id)
```

- [ ] **Step 3: import smoke**

Run:
```powershell
python -c "from app.services.invite_service import create_invite, accept_invite; print('ok')"
```
Expected: `ok`.

- [ ] **Step 4: Commit**

```powershell
git add MeetPod/backend/app/models/invite.py MeetPod/backend/app/services/invite_service.py
git commit -m "feat(backend): invite service (create + accept w/ friend|group branching)"
```

---

## Task 3: invites 라우터 + 테스트

**Files:**
- Create: `MeetPod/backend/app/routers/invites.py`
- Modify: `MeetPod/backend/app/main.py`
- Create: `MeetPod/backend/tests/test_invites.py`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `MeetPod/backend/tests/test_invites.py`:
```python
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.models.invite import Invite, InviteAcceptResult


def _inv(**kw):
    base = dict(
        code="abcd1234",
        inviter_id="u1",
        kind="friend",
        target_group_id=None,
        expires_at=datetime.now(timezone.utc) + timedelta(days=1),
        max_uses=10,
        used_count=0,
    )
    base.update(kw)
    return Invite(**base)


def test_create_friend_invite(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.invites.create_invite") as m:
            m.return_value = _inv()
            r = client.post("/api/invites", json={"kind": "friend"})
    assert r.status_code == 200
    assert r.json()["code"] == "abcd1234"


def test_accept_invite_friend(client, auth_as):
    with auth_as("u2"):
        with patch("app.routers.invites.accept_invite") as m:
            m.return_value = InviteAcceptResult(kind="friend", inviter_id="u1", group_id=None)
            r = client.post("/api/invites/abcd1234/accept")
    assert r.status_code == 200
    assert r.json() == {"kind": "friend", "inviter_id": "u1", "group_id": None}


def test_create_invite_requires_auth(client):
    assert client.post("/api/invites", json={"kind": "friend"}).status_code == 401
```

- [ ] **Step 2: 실패 확인**

Run:
```powershell
pytest tests/test_invites.py -v
```
Expected: 404 FAIL.

- [ ] **Step 3: 라우터**

Create `MeetPod/backend/app/routers/invites.py`:
```python
from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser, current_user
from app.models.invite import Invite, InviteAcceptResult, InviteCreate
from app.services.invite_service import accept_invite, create_invite

router = APIRouter(prefix="/api/invites", tags=["invites"])


@router.post("", response_model=Invite)
def create(body: InviteCreate, user: CurrentUser = Depends(current_user)) -> Invite:
    return create_invite(user.id, body)


@router.post("/{code}/accept", response_model=InviteAcceptResult)
def accept(code: str, user: CurrentUser = Depends(current_user)) -> InviteAcceptResult:
    return accept_invite(user.id, code)
```

- [ ] **Step 4: main.py include**

Edit `MeetPod/backend/app/main.py` — `create_app()` 안에 추가:
```python
    from app.routers import invites as invites_router
    app.include_router(invites_router.router)
```

- [ ] **Step 5: 통과**

Run:
```powershell
pytest tests/test_invites.py -v
```
Expected: 3 passed.

- [ ] **Step 6: Commit**

```powershell
git add MeetPod/backend/app/routers/invites.py MeetPod/backend/app/main.py MeetPod/backend/tests/test_invites.py
git commit -m "feat(backend): invites router (create + accept)"
```

---

## Task 4: friendships 라우터 (목록 조회)

**Files:**
- Create: `MeetPod/backend/app/models/friendship.py`
- Create: `MeetPod/backend/app/services/friendship_service.py`
- Create: `MeetPod/backend/app/routers/friendships.py`
- Modify: `MeetPod/backend/app/main.py`
- Create: `MeetPod/backend/tests/test_friendships.py`

- [ ] **Step 1: model**

Create `MeetPod/backend/app/models/friendship.py`:
```python
from pydantic import BaseModel


class FriendSummary(BaseModel):
    id: str
    handle: str | None
    display_name: str
    avatar_url: str | None
```

- [ ] **Step 2: service**

Create `MeetPod/backend/app/services/friendship_service.py`:
```python
from app.models.friendship import FriendSummary
from app.utils.supabase_client import get_supabase


def list_friends(user_id: str) -> list[FriendSummary]:
    sb = get_supabase()
    rows = sb.table("friendships").select("user_a_id, user_b_id") \
        .or_(f"user_a_id.eq.{user_id},user_b_id.eq.{user_id}").execute().data or []

    other_ids = [r["user_b_id"] if r["user_a_id"] == user_id else r["user_a_id"] for r in rows]
    if not other_ids:
        return []
    profiles = sb.table("profiles").select("id, handle, display_name, avatar_url") \
        .in_("id", other_ids).execute().data or []
    return [FriendSummary(**p) for p in profiles]
```

- [ ] **Step 3: 테스트 작성 (실패)**

Create `MeetPod/backend/tests/test_friendships.py`:
```python
from unittest.mock import patch

from app.models.friendship import FriendSummary


def test_list_friends_requires_auth(client):
    assert client.get("/api/friendships").status_code == 401


def test_list_friends_returns(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.friendships.list_friends") as m:
            m.return_value = [FriendSummary(id="u2", handle="bob", display_name="Bob", avatar_url=None)]
            r = client.get("/api/friendships")
    assert r.status_code == 200
    assert r.json()[0]["handle"] == "bob"
```

- [ ] **Step 4: 라우터**

Create `MeetPod/backend/app/routers/friendships.py`:
```python
from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser, current_user
from app.models.friendship import FriendSummary
from app.services.friendship_service import list_friends

router = APIRouter(prefix="/api/friendships", tags=["friendships"])


@router.get("", response_model=list[FriendSummary])
def list_(user: CurrentUser = Depends(current_user)) -> list[FriendSummary]:
    return list_friends(user.id)
```

- [ ] **Step 5: main.py include + 실행**

Edit `MeetPod/backend/app/main.py` — 추가:
```python
    from app.routers import friendships as friendships_router
    app.include_router(friendships_router.router)
```

Run:
```powershell
pytest tests/test_friendships.py -v
```
Expected: 2 passed.

- [ ] **Step 6: Commit**

```powershell
git add MeetPod/backend/app/models/friendship.py MeetPod/backend/app/services/friendship_service.py MeetPod/backend/app/routers/friendships.py MeetPod/backend/app/main.py MeetPod/backend/tests/test_friendships.py
git commit -m "feat(backend): list friends"
```

---

## Task 5: 권한 의존성 — require_group_role

**Files:**
- Create: `MeetPod/backend/app/dependencies/permissions.py`
- Create: `MeetPod/backend/tests/test_permissions.py`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `MeetPod/backend/tests/test_permissions.py`:
```python
from unittest.mock import patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.dependencies.auth import CurrentUser, current_user
from app.dependencies.permissions import require_group_role


def _app_with_route(role: str):
    app = FastAPI()

    @app.get("/g/{gid}")
    def view(gid: str, _: None = require_group_role(role)) -> dict:
        return {"ok": True}

    return app


@pytest.mark.parametrize("user_role,required,expected", [
    ("owner", "owner", 200),
    ("owner", "admin", 200),
    ("admin", "admin", 200),
    ("admin", "owner", 403),
    ("member", "admin", 403),
    ("member", "member", 200),
])
def test_role_gate(user_role, required, expected):
    app = _app_with_route(required)
    app.dependency_overrides[current_user] = lambda: CurrentUser(id="u1", email=None)

    with patch("app.dependencies.permissions._fetch_role") as m:
        m.return_value = user_role
        client = TestClient(app)
        r = client.get("/g/g1")
    assert r.status_code == expected


def test_no_membership_403():
    app = _app_with_route("member")
    app.dependency_overrides[current_user] = lambda: CurrentUser(id="u1", email=None)
    with patch("app.dependencies.permissions._fetch_role") as m:
        m.return_value = None
        client = TestClient(app)
        assert client.get("/g/g1").status_code == 403
```

- [ ] **Step 2: 실패 확인**

Run:
```powershell
pytest tests/test_permissions.py -v
```
Expected: ImportError FAIL.

- [ ] **Step 3: 구현**

Create `MeetPod/backend/app/dependencies/permissions.py`:
```python
from typing import Literal

from fastapi import Depends, HTTPException, Path, status

from app.dependencies.auth import CurrentUser, current_user
from app.utils.db import single
from app.utils.supabase_client import get_supabase

Role = Literal["owner", "admin", "member"]
_RANK: dict[str, int] = {"member": 0, "admin": 1, "owner": 2}


def _fetch_role(group_id: str, user_id: str) -> str | None:
    sb = get_supabase()
    row = single(sb.table("group_members").select("role")
                 .eq("group_id", group_id).eq("user_id", user_id))
    return row["role"] if row else None


def require_group_role(min_role: Role):
    def _dep(
        gid: str = Path(..., alias="gid"),
        user: CurrentUser = Depends(current_user),
    ) -> None:
        role = _fetch_role(gid, user.id)
        if role is None or _RANK[role] < _RANK[min_role]:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "insufficient group role")

    return Depends(_dep)
```

- [ ] **Step 4: 통과**

Run:
```powershell
pytest tests/test_permissions.py -v
```
Expected: 7 passed.

- [ ] **Step 5: Commit**

```powershell
git add MeetPod/backend/app/dependencies/permissions.py MeetPod/backend/tests/test_permissions.py
git commit -m "feat(backend): require_group_role dependency"
```

---

## Task 6: group 모델 + service

**Files:**
- Create: `MeetPod/backend/app/models/group.py`
- Create: `MeetPod/backend/app/services/group_service.py`

- [ ] **Step 1: 모델**

Create `MeetPod/backend/app/models/group.py`:
```python
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
```

- [ ] **Step 2: service**

Create `MeetPod/backend/app/services/group_service.py`:
```python
from fastapi import HTTPException, status

from app.models.group import Group, GroupCreate, GroupMember, GroupUpdate
from app.utils.db import single
from app.utils.supabase_client import get_supabase


def create_group(creator_id: str, body: GroupCreate) -> Group:
    sb = get_supabase()
    payload = body.model_dump()
    payload["owner_id"] = creator_id
    row = sb.table("groups").insert(payload).execute().data[0]
    sb.table("group_members").insert(
        {"group_id": row["id"], "user_id": creator_id, "role": "owner"}
    ).execute()
    return Group(**row)


def list_my_groups(user_id: str) -> list[Group]:
    sb = get_supabase()
    member_rows = sb.table("group_members").select("group_id").eq("user_id", user_id).execute().data or []
    gids = [r["group_id"] for r in member_rows]
    if not gids:
        return []
    rows = sb.table("groups").select("*").in_("id", gids).execute().data or []
    return [Group(**r) for r in rows]


def get_group(group_id: str) -> Group:
    sb = get_supabase()
    row = single(sb.table("groups").select("*").eq("id", group_id))
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "group not found")
    return Group(**row)


def update_group(group_id: str, body: GroupUpdate) -> Group:
    sb = get_supabase()
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if patch:
        sb.table("groups").update(patch).eq("id", group_id).execute()
    return get_group(group_id)


def list_members(group_id: str) -> list[GroupMember]:
    sb = get_supabase()
    rows = sb.table("group_members").select("user_id, role").eq("group_id", group_id).execute().data or []
    return [GroupMember(**r) for r in rows]


def set_role(group_id: str, user_id: str, role: str) -> None:
    sb = get_supabase()
    target = single(sb.table("group_members").select("role").eq("group_id", group_id).eq("user_id", user_id))
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "member not found")
    if target["role"] == "owner":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot change owner role; use transfer")
    sb.table("group_members").update({"role": role}).eq("group_id", group_id).eq("user_id", user_id).execute()


def transfer_owner(group_id: str, current_owner_id: str, new_owner_id: str) -> None:
    sb = get_supabase()
    new_member = single(sb.table("group_members").select("role").eq("group_id", group_id).eq("user_id", new_owner_id))
    if not new_member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "new owner is not a member")
    if new_owner_id == current_owner_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "already owner")
    # 단일 owner unique 인덱스 회피: 기존 owner를 admin으로 먼저 격하
    sb.table("group_members").update({"role": "admin"}) \
        .eq("group_id", group_id).eq("user_id", current_owner_id).execute()
    sb.table("group_members").update({"role": "owner"}) \
        .eq("group_id", group_id).eq("user_id", new_owner_id).execute()
    sb.table("groups").update({"owner_id": new_owner_id}).eq("id", group_id).execute()


def remove_member(group_id: str, target_user_id: str) -> None:
    sb = get_supabase()
    target = single(sb.table("group_members").select("role").eq("group_id", group_id).eq("user_id", target_user_id))
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "member not found")
    if target["role"] == "owner":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot remove owner; transfer first")
    sb.table("group_members").delete().eq("group_id", group_id).eq("user_id", target_user_id).execute()
```

- [ ] **Step 3: import smoke**

Run:
```powershell
python -c "from app.services.group_service import create_group, list_my_groups, transfer_owner; print('ok')"
```
Expected: `ok`.

- [ ] **Step 4: Commit**

```powershell
git add MeetPod/backend/app/models/group.py MeetPod/backend/app/services/group_service.py
git commit -m "feat(backend): group service (CRUD + role mgmt + owner transfer)"
```

---

## Task 7: groups 라우터 + 테스트

**Files:**
- Create: `MeetPod/backend/app/routers/groups.py`
- Modify: `MeetPod/backend/app/main.py`
- Create: `MeetPod/backend/tests/test_groups.py`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `MeetPod/backend/tests/test_groups.py`:
```python
from datetime import datetime, timezone
from unittest.mock import patch

from app.models.group import Group, GroupMember


def _g(**kw):
    base = dict(id="g1", name="G", description=None, avatar_url=None,
                owner_id="u1", created_at=datetime.now(timezone.utc))
    base.update(kw)
    return Group(**base)


def test_create_group(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.groups.create_group") as m:
            m.return_value = _g()
            r = client.post("/api/groups", json={"name": "G"})
    assert r.status_code == 200
    assert r.json()["id"] == "g1"


def test_list_my_groups(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.groups.list_my_groups") as m:
            m.return_value = [_g()]
            r = client.get("/api/groups")
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_get_group_requires_member(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._fetch_role") as fr, \
             patch("app.routers.groups.get_group") as gg:
            fr.return_value = None
            r = client.get("/api/groups/g1")
            assert r.status_code == 403
            fr.return_value = "member"
            gg.return_value = _g()
            r = client.get("/api/groups/g1")
            assert r.status_code == 200


def test_update_group_requires_admin(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._fetch_role") as fr, \
             patch("app.routers.groups.update_group") as ug:
            fr.return_value = "member"
            r = client.patch("/api/groups/g1", json={"name": "X"})
            assert r.status_code == 403
            fr.return_value = "admin"
            ug.return_value = _g(name="X")
            r = client.patch("/api/groups/g1", json={"name": "X"})
            assert r.status_code == 200


def test_list_members(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._fetch_role") as fr, \
             patch("app.routers.groups.list_members") as lm:
            fr.return_value = "member"
            lm.return_value = [GroupMember(user_id="u1", role="owner")]
            r = client.get("/api/groups/g1/members")
    assert r.status_code == 200
    assert r.json()[0]["role"] == "owner"


def test_set_role_requires_admin(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._fetch_role") as fr, \
             patch("app.routers.groups.set_role") as sr:
            fr.return_value = "admin"
            sr.return_value = None
            r = client.patch("/api/groups/g1/members/u2/role", json={"role": "admin"})
    assert r.status_code == 204


def test_remove_member_requires_admin(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._fetch_role") as fr, \
             patch("app.routers.groups.remove_member") as rm:
            fr.return_value = "admin"
            r = client.delete("/api/groups/g1/members/u2")
    assert r.status_code == 204


def test_transfer_owner_requires_owner(client, auth_as):
    with auth_as("u1"):
        with patch("app.dependencies.permissions._fetch_role") as fr, \
             patch("app.routers.groups.transfer_owner") as t:
            fr.return_value = "admin"
            r = client.post("/api/groups/g1/transfer", json={"new_owner_id": "u2"})
            assert r.status_code == 403
            fr.return_value = "owner"
            r = client.post("/api/groups/g1/transfer", json={"new_owner_id": "u2"})
            assert r.status_code == 204
            t.assert_called_with("g1", "u1", "u2")
```

- [ ] **Step 2: 실패 확인**

Run:
```powershell
pytest tests/test_groups.py -v
```
Expected: 404 / ImportError FAIL.

- [ ] **Step 3: 라우터 구현**

Create `MeetPod/backend/app/routers/groups.py`:
```python
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from app.dependencies.auth import CurrentUser, current_user
from app.dependencies.permissions import require_group_role
from app.models.group import (
    Group, GroupCreate, GroupMember, GroupUpdate, RoleUpdate,
)
from app.services.group_service import (
    create_group, get_group, list_members, list_my_groups,
    remove_member, set_role, transfer_owner, update_group,
)

router = APIRouter(prefix="/api/groups", tags=["groups"])


class TransferBody(BaseModel):
    new_owner_id: str


@router.post("", response_model=Group)
def create(body: GroupCreate, user: CurrentUser = Depends(current_user)) -> Group:
    return create_group(user.id, body)


@router.get("", response_model=list[Group])
def list_(user: CurrentUser = Depends(current_user)) -> list[Group]:
    return list_my_groups(user.id)


@router.get("/{gid}", response_model=Group)
def get_(gid: str, _: None = require_group_role("member")) -> Group:
    return get_group(gid)


@router.patch("/{gid}", response_model=Group)
def patch_(gid: str, body: GroupUpdate, _: None = require_group_role("admin")) -> Group:
    return update_group(gid, body)


@router.get("/{gid}/members", response_model=list[GroupMember])
def members(gid: str, _: None = require_group_role("member")) -> list[GroupMember]:
    return list_members(gid)


@router.patch("/{gid}/members/{uid}/role", status_code=status.HTTP_204_NO_CONTENT)
def patch_role(gid: str, uid: str, body: RoleUpdate, _: None = require_group_role("admin")) -> None:
    set_role(gid, uid, body.role)


@router.delete("/{gid}/members/{uid}", status_code=status.HTTP_204_NO_CONTENT)
def kick(gid: str, uid: str, _: None = require_group_role("admin")) -> None:
    remove_member(gid, uid)


@router.post("/{gid}/transfer", status_code=status.HTTP_204_NO_CONTENT)
def transfer(
    gid: str,
    body: TransferBody,
    user: CurrentUser = Depends(current_user),
    _: None = require_group_role("owner"),
) -> None:
    transfer_owner(gid, user.id, body.new_owner_id)
```

- [ ] **Step 4: main.py include**

Edit `MeetPod/backend/app/main.py` — 추가:
```python
    from app.routers import groups as groups_router
    app.include_router(groups_router.router)
```

- [ ] **Step 5: 통과**

Run:
```powershell
pytest tests/test_groups.py -v
```
Expected: 8 passed.

- [ ] **Step 6: Commit**

```powershell
git add MeetPod/backend/app/routers/groups.py MeetPod/backend/app/main.py MeetPod/backend/tests/test_groups.py
git commit -m "feat(backend): groups router (CRUD, members, role, transfer)"
```

---

## Task 8: 라이브 통합 검증 (옵션)

**Files:** (변경 없음)

- [ ] **Step 1: 두 사용자 토큰 준비**

Supabase Studio에서 `alice@x.test`, `bob@x.test` 생성. 각각 액세스 토큰 획득(Plan 2 Task 10 방식).

- [ ] **Step 2: alice 그룹 생성 + 초대 발급**

```powershell
$AT = "<alice-token>"
$BT = "<bob-token>"
$BASE = "http://127.0.0.1:8000/api"

# bootstrap
Invoke-RestMethod -Method Post -Uri "$BASE/auth/bootstrap" -Headers @{Authorization="Bearer $AT"} -Body (@{display_name='Alice'} | ConvertTo-Json) -ContentType 'application/json'
Invoke-RestMethod -Method Post -Uri "$BASE/auth/bootstrap" -Headers @{Authorization="Bearer $BT"} -Body (@{display_name='Bob'} | ConvertTo-Json) -ContentType 'application/json'

# alice creates group
$g = Invoke-RestMethod -Method Post -Uri "$BASE/groups" -Headers @{Authorization="Bearer $AT"} -Body (@{name='Friends'} | ConvertTo-Json) -ContentType 'application/json'

# alice creates group invite
$inv = Invoke-RestMethod -Method Post -Uri "$BASE/invites" -Headers @{Authorization="Bearer $AT"} -Body (@{kind='group'; target_group_id=$g.id} | ConvertTo-Json) -ContentType 'application/json'

# bob accepts
Invoke-RestMethod -Method Post -Uri "$BASE/invites/$($inv.code)/accept" -Headers @{Authorization="Bearer $BT"}

# verify members
Invoke-RestMethod -Method Get -Uri "$BASE/groups/$($g.id)/members" -Headers @{Authorization="Bearer $AT"}
```
Expected: 마지막 호출이 `[{user_id:<alice>, role:owner}, {user_id:<bob>, role:member}]` 반환.

- [ ] **Step 3: friend 초대 흐름도 동일하게 검증 후 commit**

```powershell
git commit --allow-empty -m "chore(backend): plan-3 verified end-to-end"
```

---

## Self-Review Notes

스펙 §6.2 친구 추가 / §6.3 그룹·약속 생성의 "그룹 부분" 커버 ✓
역할 위계: owner > admin > member, 단일 owner 인덱스 안전 위임 ✓
초대 멱등성: 친구 중복 / 그룹 멤버 중복 시 silent skip + used_count++ ✓

**의도적 제외:**
- 자신 그룹 탈퇴 엔드포인트 — 스펙 명시 없음. Plan 후속에서 필요 시 추가.
- 초대 코드 폐기(revoke) 엔드포인트 — 스펙 명시 없음.

---

## Execution Handoff

**Plan complete.** 1) Subagent-Driven 2) Inline.
