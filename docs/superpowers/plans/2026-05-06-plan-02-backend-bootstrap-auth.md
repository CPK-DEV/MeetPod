# Plan 2 — Backend 부트스트랩 & 인증

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FastAPI 백엔드 스켈레톤(라우터/서비스/유틸/의존성 레이아웃)을 구축하고, Supabase JWT 검증 의존성과 `/api/auth/bootstrap`·핸들 설정 엔드포인트를 구현한다. 이후 모든 백엔드 Plan(3·4·5)이 이 기반 위에 도메인 라우터를 추가한다.

**Architecture:**
- PickPod 백엔드 레이아웃 그대로 모방: `routers / services / models / utils / dependencies`. 라우터는 thin, 비즈니스 로직은 `services/`.
- Supabase가 발급한 JWT를 `SUPABASE_JWT_SECRET`로 검증 (자체 JWT 미발급).
- DB 접근은 `supabase-py` service_role 클라이언트 + `app/utils/db.py::single()` 헬퍼 (PickPod의 `maybe_single()` 회피 패턴).
- 모든 라우트 prefix `/api`. Vercel serverless로 배포.

**Tech Stack:** FastAPI, Python 3.12, supabase-py 2.x, PyJWT, pydantic v2, uvicorn(개발), pytest + httpx(테스트), Vercel.

**전제:** Plan 1 완료 — `profiles` 테이블 + RLS 존재, `SUPABASE_JWT_SECRET`/`SUPABASE_SERVICE_KEY`/`SUPABASE_URL` 사용 가능.

---

## File Structure

```
MeetPod/backend/
├── api/
│   └── index.py                          # Vercel entrypoint (FastAPI -> Mangum)
├── app/
│   ├── __init__.py
│   ├── main.py                           # FastAPI app, CORS, router include, healthz
│   ├── config.py                         # Settings (pydantic-settings)
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py                       # POST /api/auth/bootstrap
│   │   └── profiles.py                   # GET /api/profiles/me, PATCH .../handle
│   ├── services/
│   │   ├── __init__.py
│   │   └── profile_service.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── profile.py                    # pydantic schemas
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── supabase_client.py            # service_role client (singleton)
│   │   ├── db.py                         # single() 헬퍼
│   │   └── jwt_utils.py                  # decode_supabase_jwt(token)
│   └── dependencies/
│       ├── __init__.py
│       └── auth.py                       # current_user dependency
├── tests/
│   ├── __init__.py
│   ├── conftest.py                       # TestClient + mocked auth
│   ├── test_healthz.py
│   ├── test_auth_bootstrap.py
│   └── test_profiles_handle.py
├── requirements.txt
├── requirements-dev.txt
├── vercel.json
├── .env.example
└── pytest.ini
```

---

## Task 1: 프로젝트 스캐폴딩

**Files:**
- Create: `MeetPod/backend/requirements.txt`
- Create: `MeetPod/backend/requirements-dev.txt`
- Create: `MeetPod/backend/.env.example`
- Create: `MeetPod/backend/pytest.ini`
- Create: `MeetPod/backend/app/__init__.py` (empty)

- [ ] **Step 1: requirements.txt**

Create `MeetPod/backend/requirements.txt`:
```
fastapi==0.115.0
uvicorn[standard]==0.30.6
pydantic==2.9.2
pydantic-settings==2.5.2
supabase==2.8.1
PyJWT==2.9.0
mangum==0.17.0
python-dotenv==1.0.1
httpx==0.27.2
```

- [ ] **Step 2: requirements-dev.txt**

Create `MeetPod/backend/requirements-dev.txt`:
```
-r requirements.txt
pytest==8.3.3
pytest-asyncio==0.24.0
pytest-mock==3.14.0
respx==0.21.1
```

- [ ] **Step 3: .env.example**

Create `MeetPod/backend/.env.example`:
```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=eyJ...service-role...
SUPABASE_JWT_SECRET=replace-with-jwt-secret-from-dashboard
FRONTEND_URL=meetpod://
ENV=development
```

- [ ] **Step 4: pytest.ini**

Create `MeetPod/backend/pytest.ini`:
```ini
[pytest]
testpaths = tests
asyncio_mode = auto
addopts = -ra -q
```

- [ ] **Step 5: 빈 패키지 init**

Create `MeetPod/backend/app/__init__.py` — 빈 파일.

- [ ] **Step 6: 가상환경 + 설치**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
```
Expected: 설치 에러 없음.

- [ ] **Step 7: Commit**

```powershell
git add MeetPod/backend/requirements*.txt MeetPod/backend/.env.example MeetPod/backend/pytest.ini MeetPod/backend/app/__init__.py
git commit -m "chore(backend): scaffold MeetPod fastapi project"
```

---

## Task 2: Settings & Supabase client

**Files:**
- Create: `MeetPod/backend/app/config.py`
- Create: `MeetPod/backend/app/utils/__init__.py` (empty)
- Create: `MeetPod/backend/app/utils/supabase_client.py`
- Create: `MeetPod/backend/app/utils/db.py`

- [ ] **Step 1: config.py**

Create `MeetPod/backend/app/config.py`:
```python
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    SUPABASE_JWT_SECRET: str
    FRONTEND_URL: str = "meetpod://"
    ENV: str = "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 2: supabase_client.py**

Create `MeetPod/backend/app/utils/__init__.py` (empty), then `MeetPod/backend/app/utils/supabase_client.py`:
```python
from functools import lru_cache
from supabase import Client, create_client

from app.config import get_settings


@lru_cache
def get_supabase() -> Client:
    s = get_settings()
    return create_client(s.SUPABASE_URL, s.SUPABASE_SERVICE_KEY)
```

- [ ] **Step 3: db.py**

Create `MeetPod/backend/app/utils/db.py`:
```python
from typing import Any


def single(query) -> dict[str, Any] | None:
    """supabase-py의 maybe_single()이 일관성 없게 동작하므로 직접 처리.
    `.execute()` 결과의 data 리스트에서 첫 행을 반환하거나 None.
    """
    result = query.execute()
    rows = result.data or []
    return rows[0] if rows else None
```

- [ ] **Step 4: import smoke test**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\backend
$env:SUPABASE_URL="http://x"; $env:SUPABASE_SERVICE_KEY="x"; $env:SUPABASE_JWT_SECRET="x"
python -c "from app.config import get_settings; from app.utils.supabase_client import get_supabase; from app.utils.db import single; print('ok')"
```
Expected: `ok`

- [ ] **Step 5: Commit**

```powershell
git add MeetPod/backend/app/config.py MeetPod/backend/app/utils
git commit -m "feat(backend): settings + supabase service client + single() helper"
```

---

## Task 3: JWT 유틸 — 단위 테스트 우선

**Files:**
- Create: `MeetPod/backend/app/utils/jwt_utils.py`
- Create: `MeetPod/backend/tests/__init__.py` (empty)
- Create: `MeetPod/backend/tests/test_jwt_utils.py`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `MeetPod/backend/tests/__init__.py` (empty), then `MeetPod/backend/tests/test_jwt_utils.py`:
```python
import jwt
import pytest

from app.utils.jwt_utils import decode_supabase_jwt, JWTError

SECRET = "test-secret"


def make_token(claims: dict) -> str:
    return jwt.encode(claims, SECRET, algorithm="HS256")


def test_decode_valid_token(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    monkeypatch.setenv("SUPABASE_URL", "http://x")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "x")
    from app.config import get_settings
    get_settings.cache_clear()

    token = make_token({"sub": "abc", "aud": "authenticated", "exp": 9999999999})
    claims = decode_supabase_jwt(token)
    assert claims["sub"] == "abc"


def test_decode_expired_raises(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)
    monkeypatch.setenv("SUPABASE_URL", "http://x")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "x")
    from app.config import get_settings
    get_settings.cache_clear()

    token = make_token({"sub": "abc", "aud": "authenticated", "exp": 1})
    with pytest.raises(JWTError):
        decode_supabase_jwt(token)


def test_decode_bad_signature(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "other-secret")
    monkeypatch.setenv("SUPABASE_URL", "http://x")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "x")
    from app.config import get_settings
    get_settings.cache_clear()

    token = make_token({"sub": "abc", "aud": "authenticated", "exp": 9999999999})
    with pytest.raises(JWTError):
        decode_supabase_jwt(token)
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\backend
pytest tests/test_jwt_utils.py -v
```
Expected: `ImportError: cannot import name 'decode_supabase_jwt'` 등으로 FAIL.

- [ ] **Step 3: 구현**

Create `MeetPod/backend/app/utils/jwt_utils.py`:
```python
import jwt

from app.config import get_settings


class JWTError(Exception):
    pass


def decode_supabase_jwt(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as e:
        raise JWTError(str(e)) from e
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```powershell
pytest tests/test_jwt_utils.py -v
```
Expected: 3 passed.

- [ ] **Step 5: Commit**

```powershell
git add MeetPod/backend/app/utils/jwt_utils.py MeetPod/backend/tests/__init__.py MeetPod/backend/tests/test_jwt_utils.py
git commit -m "feat(backend): supabase JWT decode + tests"
```

---

## Task 4: 인증 의존성 (current_user)

**Files:**
- Create: `MeetPod/backend/app/dependencies/__init__.py` (empty)
- Create: `MeetPod/backend/app/dependencies/auth.py`

- [ ] **Step 1: 의존성 구현**

Create `MeetPod/backend/app/dependencies/__init__.py` (empty), then `MeetPod/backend/app/dependencies/auth.py`:
```python
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status

from app.utils.jwt_utils import JWTError, decode_supabase_jwt


@dataclass(frozen=True)
class CurrentUser:
    id: str          # uuid
    email: str | None


def current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = decode_supabase_jwt(token)
    except JWTError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"invalid token: {e}")
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "token missing sub")
    return CurrentUser(id=sub, email=claims.get("email"))


def require_auth() -> "Depends":
    return Depends(current_user)
```

- [ ] **Step 2: Commit (테스트는 conftest와 함께 다음 Task에서)**

```powershell
git add MeetPod/backend/app/dependencies
git commit -m "feat(backend): current_user dependency from supabase JWT"
```

---

## Task 5: FastAPI 앱 + healthz + 테스트 인프라

**Files:**
- Create: `MeetPod/backend/app/main.py`
- Create: `MeetPod/backend/tests/conftest.py`
- Create: `MeetPod/backend/tests/test_healthz.py`

- [ ] **Step 1: main.py**

Create `MeetPod/backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(title="MeetPod API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],          # 모바일 전용이라 사실상 미사용. 좁히지 않음.
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/healthz")
    def healthz() -> dict:
        return {"ok": True}

    return app


app = create_app()
```

- [ ] **Step 2: conftest.py — env + auth override 헬퍼**

Create `MeetPod/backend/tests/conftest.py`:
```python
import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "http://x")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "x")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
    monkeypatch.setenv("ENV", "test")
    from app.config import get_settings
    get_settings.cache_clear()


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app)


@pytest.fixture
def auth_as():
    """사용법:
        def test_x(client, auth_as):
            with auth_as("user-uuid-1"):
                client.get("/api/profiles/me")
    """
    from contextlib import contextmanager

    from app.dependencies.auth import CurrentUser, current_user
    from app.main import app

    @contextmanager
    def _ctx(user_id: str, email: str | None = None):
        app.dependency_overrides[current_user] = lambda: CurrentUser(id=user_id, email=email)
        try:
            yield
        finally:
            app.dependency_overrides.pop(current_user, None)

    return _ctx
```

- [ ] **Step 3: healthz 테스트**

Create `MeetPod/backend/tests/test_healthz.py`:
```python
def test_healthz(client):
    r = client.get("/api/healthz")
    assert r.status_code == 200
    assert r.json() == {"ok": True}
```

- [ ] **Step 4: 실행**

Run:
```powershell
pytest tests/test_healthz.py -v
```
Expected: 1 passed.

- [ ] **Step 5: 로컬 서버 기동 sanity**

Run (PowerShell, 백그라운드 별도 창에서):
```powershell
cd d:\Workspace\CPKWorks\MeetPod\backend
.\.venv\Scripts\Activate.ps1
$env:SUPABASE_URL="http://x"; $env:SUPABASE_SERVICE_KEY="x"; $env:SUPABASE_JWT_SECRET="x"
uvicorn app.main:app --reload
```
별도 창:
```powershell
curl http://127.0.0.1:8000/api/healthz
```
Expected: `{"ok": true}`. 서버 종료(Ctrl+C).

- [ ] **Step 6: Commit**

```powershell
git add MeetPod/backend/app/main.py MeetPod/backend/tests/conftest.py MeetPod/backend/tests/test_healthz.py
git commit -m "feat(backend): fastapi app + healthz + test fixtures"
```

---

## Task 6: profile 모델 & service

**Files:**
- Create: `MeetPod/backend/app/models/__init__.py` (empty)
- Create: `MeetPod/backend/app/models/profile.py`
- Create: `MeetPod/backend/app/services/__init__.py` (empty)
- Create: `MeetPod/backend/app/services/profile_service.py`

- [ ] **Step 1: models/profile.py**

Create `MeetPod/backend/app/models/__init__.py` (empty), then `MeetPod/backend/app/models/profile.py`:
```python
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
```

- [ ] **Step 2: profile_service.py**

Create `MeetPod/backend/app/services/__init__.py` (empty), then `MeetPod/backend/app/services/profile_service.py`:
```python
from fastapi import HTTPException, status

from app.models.profile import Profile
from app.utils.db import single
from app.utils.supabase_client import get_supabase


def get_profile(user_id: str) -> Profile | None:
    sb = get_supabase()
    row = single(sb.table("profiles").select("*").eq("id", user_id))
    return Profile(**row) if row else None


def upsert_profile_on_bootstrap(
    user_id: str, display_name: str, avatar_url: str | None
) -> Profile:
    sb = get_supabase()
    existing = get_profile(user_id)
    if existing:
        return existing
    payload = {"id": user_id, "display_name": display_name, "avatar_url": avatar_url}
    sb.table("profiles").insert(payload).execute()
    return Profile(**payload)


def set_handle(user_id: str, handle: str) -> Profile:
    sb = get_supabase()
    existing = get_profile(user_id)
    if not existing:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "profile not found; bootstrap first")
    if existing.handle:
        raise HTTPException(status.HTTP_409_CONFLICT, "handle already set")

    # 중복 체크 (case-insensitive — DB unique index와 일관)
    dup = single(sb.table("profiles").select("id").ilike("handle", handle))
    if dup and dup["id"] != user_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "handle taken")

    sb.table("profiles").update({"handle": handle}).eq("id", user_id).execute()
    return existing.model_copy(update={"handle": handle})
```

- [ ] **Step 3: import smoke**

Run:
```powershell
python -c "from app.services.profile_service import get_profile, upsert_profile_on_bootstrap, set_handle; print('ok')"
```
Expected: `ok`.

- [ ] **Step 4: Commit**

```powershell
git add MeetPod/backend/app/models MeetPod/backend/app/services
git commit -m "feat(backend): profile models + service (bootstrap upsert, set handle)"
```

---

## Task 7: auth 라우터 + 테스트

**Files:**
- Create: `MeetPod/backend/app/routers/__init__.py` (empty)
- Create: `MeetPod/backend/app/routers/auth.py`
- Modify: `MeetPod/backend/app/main.py`
- Create: `MeetPod/backend/tests/test_auth_bootstrap.py`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `MeetPod/backend/tests/test_auth_bootstrap.py`:
```python
from unittest.mock import patch

from app.models.profile import Profile


def test_bootstrap_requires_auth(client):
    r = client.post("/api/auth/bootstrap", json={"display_name": "Harry"})
    assert r.status_code == 401


def test_bootstrap_creates_profile(client, auth_as):
    with auth_as("user-1", email="h@x.test"):
        with patch("app.routers.auth.upsert_profile_on_bootstrap") as m:
            m.return_value = Profile(id="user-1", display_name="Harry")
            r = client.post("/api/auth/bootstrap", json={"display_name": "Harry"})
    assert r.status_code == 200
    assert r.json()["id"] == "user-1"
    m.assert_called_once_with("user-1", "Harry", None)
```

- [ ] **Step 2: 테스트 실행 — FAIL**

Run:
```powershell
pytest tests/test_auth_bootstrap.py -v
```
Expected: 404 / ImportError로 FAIL.

- [ ] **Step 3: auth 라우터 구현**

Create `MeetPod/backend/app/routers/__init__.py` (empty), then `MeetPod/backend/app/routers/auth.py`:
```python
from fastapi import APIRouter, Depends

from app.dependencies.auth import CurrentUser, current_user
from app.models.profile import BootstrapRequest, Profile
from app.services.profile_service import upsert_profile_on_bootstrap

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/bootstrap", response_model=Profile)
def bootstrap(body: BootstrapRequest, user: CurrentUser = Depends(current_user)) -> Profile:
    return upsert_profile_on_bootstrap(user.id, body.display_name, body.avatar_url)
```

- [ ] **Step 4: main.py에 라우터 include**

Edit `MeetPod/backend/app/main.py` — `create_app()` 내부, healthz 위에 추가:
```python
    from app.routers import auth as auth_router
    app.include_router(auth_router.router)
```

- [ ] **Step 5: 테스트 통과**

Run:
```powershell
pytest tests/test_auth_bootstrap.py -v
```
Expected: 2 passed.

- [ ] **Step 6: Commit**

```powershell
git add MeetPod/backend/app/routers MeetPod/backend/app/main.py MeetPod/backend/tests/test_auth_bootstrap.py
git commit -m "feat(backend): POST /api/auth/bootstrap"
```

---

## Task 8: profiles 라우터 (me 조회 + handle 설정)

**Files:**
- Create: `MeetPod/backend/app/routers/profiles.py`
- Modify: `MeetPod/backend/app/main.py`
- Create: `MeetPod/backend/tests/test_profiles_handle.py`

- [ ] **Step 1: 테스트 작성 (실패)**

Create `MeetPod/backend/tests/test_profiles_handle.py`:
```python
from unittest.mock import patch

from app.models.profile import Profile


def test_get_me_requires_auth(client):
    assert client.get("/api/profiles/me").status_code == 401


def test_get_me_returns_profile(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.profiles.get_profile") as m:
            m.return_value = Profile(id="u1", display_name="Harry", handle="harry")
            r = client.get("/api/profiles/me")
    assert r.status_code == 200
    assert r.json()["handle"] == "harry"


def test_get_me_404_when_not_bootstrapped(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.profiles.get_profile") as m:
            m.return_value = None
            r = client.get("/api/profiles/me")
    assert r.status_code == 404


def test_set_handle_validates_format(client, auth_as):
    with auth_as("u1"):
        r = client.patch("/api/profiles/me/handle", json={"handle": "ab"})
    assert r.status_code == 422


def test_set_handle_calls_service(client, auth_as):
    with auth_as("u1"):
        with patch("app.routers.profiles.set_handle") as m:
            m.return_value = Profile(id="u1", display_name="Harry", handle="harry")
            r = client.patch("/api/profiles/me/handle", json={"handle": "harry"})
    assert r.status_code == 200
    m.assert_called_once_with("u1", "harry")
```

- [ ] **Step 2: 실패 확인**

Run:
```powershell
pytest tests/test_profiles_handle.py -v
```
Expected: 404/ImportError FAIL.

- [ ] **Step 3: profiles 라우터 구현**

Create `MeetPod/backend/app/routers/profiles.py`:
```python
from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth import CurrentUser, current_user
from app.models.profile import HandleUpdate, Profile
from app.services.profile_service import get_profile, set_handle

router = APIRouter(prefix="/api/profiles", tags=["profiles"])


@router.get("/me", response_model=Profile)
def get_me(user: CurrentUser = Depends(current_user)) -> Profile:
    p = get_profile(user.id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "profile not found")
    return p


@router.patch("/me/handle", response_model=Profile)
def patch_handle(body: HandleUpdate, user: CurrentUser = Depends(current_user)) -> Profile:
    return set_handle(user.id, body.handle)
```

- [ ] **Step 4: main.py에 include**

Edit `MeetPod/backend/app/main.py` — auth 라우터 include 아래에 추가:
```python
    from app.routers import profiles as profiles_router
    app.include_router(profiles_router.router)
```

- [ ] **Step 5: 통과 확인**

Run:
```powershell
pytest tests/test_profiles_handle.py -v
```
Expected: 5 passed.

- [ ] **Step 6: Commit**

```powershell
git add MeetPod/backend/app/routers/profiles.py MeetPod/backend/app/main.py MeetPod/backend/tests/test_profiles_handle.py
git commit -m "feat(backend): profiles me + handle endpoints"
```

---

## Task 9: Vercel 배포 설정

**Files:**
- Create: `MeetPod/backend/api/index.py`
- Create: `MeetPod/backend/vercel.json`

- [ ] **Step 1: api/index.py — Vercel entrypoint**

Create `MeetPod/backend/api/index.py`:
```python
from mangum import Mangum

from app.main import app

handler = Mangum(app, lifespan="off")
```

- [ ] **Step 2: vercel.json**

Create `MeetPod/backend/vercel.json`:
```json
{
  "version": 2,
  "builds": [
    { "src": "api/index.py", "use": "@vercel/python", "config": { "maxLambdaSize": "50mb" } }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "api/index.py" }
  ]
}
```

- [ ] **Step 3: 로컬 import sanity**

Run:
```powershell
python -c "from api.index import handler; print(type(handler).__name__)"
```
Expected: `Mangum`

- [ ] **Step 4: Commit**

```powershell
git add MeetPod/backend/api MeetPod/backend/vercel.json
git commit -m "chore(backend): vercel serverless entrypoint"
```

---

## Task 10: 전체 테스트 실행 + 라이브 검증

**Files:** (변경 없음)

- [ ] **Step 1: 전체 pytest**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\backend
pytest -v
```
Expected: `test_jwt_utils` 3 + `test_healthz` 1 + `test_auth_bootstrap` 2 + `test_profiles_handle` 5 = 11 passed.

- [ ] **Step 2: 실제 Supabase 토큰으로 라이브 sanity**

Supabase Studio → Authentication → Users → "Add user (email/password)"로 더미 유저 생성.
JWT를 직접 생성:
```powershell
$env:SUPABASE_URL="https://<ref>.supabase.co"
$env:SUPABASE_SERVICE_KEY="<service-role-key>"
$env:SUPABASE_JWT_SECRET="<jwt-secret>"
uvicorn app.main:app --reload
```
별도 창에서 Supabase Auth REST로 로그인하여 access_token 획득:
```powershell
$body = @{ email='dummy@x.test'; password='dummy123' } | ConvertTo-Json
$r = Invoke-RestMethod -Method Post -Uri "https://<ref>.supabase.co/auth/v1/token?grant_type=password" -Headers @{ apikey='<anon-key>'; 'Content-Type'='application/json' } -Body $body
$token = $r.access_token

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/api/auth/bootstrap" -Headers @{ Authorization="Bearer $token" } -Body (@{display_name='Test User'} | ConvertTo-Json) -ContentType 'application/json'
```
Expected: `id`, `display_name=Test User`인 Profile JSON 반환.

DB 직접 확인 (Studio SQL Editor):
```sql
SELECT id, handle, display_name FROM profiles;
```
Expected: 새 행 1개 (handle은 NULL).

- [ ] **Step 3: handle 설정 라이브 검증**

```powershell
Invoke-RestMethod -Method Patch -Uri "http://127.0.0.1:8000/api/profiles/me/handle" -Headers @{ Authorization="Bearer $token" } -Body (@{handle='testharry'} | ConvertTo-Json) -ContentType 'application/json'
```
Expected: `handle=testharry`. 두 번째 호출은 409 (already set).

- [ ] **Step 4: Commit (변경 없음 — 빈 commit으로 마일스톤 표시)**

```powershell
git commit --allow-empty -m "chore(backend): plan-2 verified end-to-end against live supabase"
```

---

## Self-Review Notes

스펙 §6.1 가입: bootstrap upsert + 핸들 설정 ✓
스펙 §5.1 레이아웃 (routers/services/utils/dependencies/models) ✓
JWT 검증은 SUPABASE_JWT_SECRET HS256 (Supabase 기본) ✓
Vercel serverless entrypoint ✓

**의도적으로 다음 Plan으로 미룸:**
- Expo push token 등록 엔드포인트 → Plan 10 (모바일에서 호출 시점 명확)
- Apple/Kakao 토큰 검증 → Plan 6 (모바일 로그인 흐름과 같이)
- profiles 검색 — MVP 범위 외 (스펙 §2)

---

## Execution Handoff

**Plan complete and saved to `MeetPod/docs/superpowers/plans/2026-05-06-plan-02-backend-bootstrap-auth.md`. Two execution options:**

**1. Subagent-Driven (recommended)**
**2. Inline Execution**
