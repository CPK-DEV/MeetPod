# Plan 1 — Supabase 인프라 & 스키마

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MeetPod 전용 Supabase 프로젝트를 생성하고, 스펙 §4의 모든 테이블·인덱스·RLS 정책·Storage 버킷·pg_cron 잡을 마이그레이션 SQL로 정의·검증한다. 이후 모든 Plan(백엔드/모바일)이 이 스키마를 전제로 동작한다.

**Architecture:**
- 마이그레이션은 PickPod와 동일하게 `MeetPod/supabase/migrations/NNN_*.sql` 단일 트리에 번호 순으로 보관한다.
- 로컬 검증은 Supabase CLI(`supabase start`)의 로컬 Postgres에서 실행하고, 원격 적용은 `supabase db push`로 한다.
- RLS 정책은 SQL 시나리오 테스트(`supabase/tests/*.sql`)를 `pgTAP` 없이 순수 `psql` + `RAISE EXCEPTION` 패턴으로 검증한다(외부 의존 최소화).

**Tech Stack:** Supabase (Postgres 15 + Auth + Storage + Realtime + pg_cron + pg_net), Supabase CLI, psql.

---

## File Structure

신규 디렉터리/파일 (모두 `MeetPod/` 하위):

```
MeetPod/
├── supabase/
│   ├── config.toml                              # supabase init 결과물 (수정)
│   ├── migrations/
│   │   ├── 001_extensions.sql                   # pgcrypto, pg_cron, pg_net 활성화
│   │   ├── 002_profiles_friendships.sql         # §4.1
│   │   ├── 003_invites.sql                      # §4.2
│   │   ├── 004_groups.sql                       # §4.3
│   │   ├── 005_meetups.sql                      # §4.4
│   │   ├── 006_chat.sql                         # §4.5
│   │   ├── 007_location_pings.sql               # §4.6
│   │   ├── 008_storage_buckets.sql              # chat-images 버킷 + 정책
│   │   ├── 009_rls_policies.sql                 # §4.7 정책 일괄
│   │   ├── 010_realtime_publications.sql        # messages, location_pings를 supabase_realtime publication에 추가
│   │   └── 011_cron_jobs.sql                    # 약속 ended 전환 + location_pings 정리
│   ├── tests/
│   │   ├── README.md                            # 실행 방법 (1줄)
│   │   ├── helpers.sql                          # set_auth_uid(uuid) 헬퍼 + assert_fail/assert_ok
│   │   ├── test_profiles_rls.sql
│   │   ├── test_groups_rls.sql
│   │   ├── test_meetups_rls.sql
│   │   ├── test_chat_rls.sql
│   │   └── test_location_pings_rls.sql
│   └── seed.sql                                 # 로컬 개발용 더미 (선택, 비어둠)
└── .env.supabase.example                        # SUPABASE_URL/KEY/JWT_SECRET placeholder
```

**책임 분리 원칙:**
- 한 마이그레이션 = 한 도메인. 스키마 변경과 RLS는 분리(009에 모음) — 정책 변경 리뷰 용이.
- 테스트는 **테이블 단위**로 분리. RLS 정책은 양/음 케이스 모두 검증.

---

## Task 1: Supabase 프로젝트 생성 & CLI 초기화

**Files:**
- Create: `MeetPod/supabase/config.toml` (CLI 생성)
- Create: `MeetPod/.env.supabase.example`
- Create: `MeetPod/.gitignore` (없으면)

- [ ] **Step 1: Supabase 콘솔에서 신규 프로젝트 생성**

브라우저로 https://supabase.com/dashboard 접속 → "New project":
- Name: `meetpod`
- Region: `Northeast Asia (Seoul)` (한국 사용자 기준)
- DB password: 1Password 등에 저장
- Plan: Free

생성 후 다음 값을 메모:
- Project Ref (URL의 `https://<ref>.supabase.co`의 `<ref>`)
- `anon` key, `service_role` key (Settings → API)
- JWT secret (Settings → API → JWT Settings)

- [ ] **Step 2: Supabase CLI 설치 확인**

Run (PowerShell):
```powershell
supabase --version
```
Expected: `1.x` 이상 버전 출력. 미설치 시:
```powershell
scoop install supabase
```

- [ ] **Step 3: `MeetPod/supabase` 디렉터리 초기화**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod
supabase init
```
Expected: `supabase/config.toml` 생성 + `supabase/migrations/` 빈 디렉터리.

- [ ] **Step 4: 원격 프로젝트 link**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod
supabase link --project-ref <PROJECT_REF>
```
DB password 입력 프롬프트 → Step 1에서 저장한 값 입력.
Expected: `Finished supabase link.`

- [ ] **Step 5: `.env.supabase.example` 작성**

Create `MeetPod/.env.supabase.example`:
```
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_JWT_SECRET=replace-with-jwt-secret-from-dashboard
SUPABASE_DB_PASSWORD=replace-me
```

- [ ] **Step 6: `.gitignore` 갱신**

Create or append to `MeetPod/.gitignore`:
```
.env
.env.*
!.env.*.example
supabase/.branches/
supabase/.temp/
```

- [ ] **Step 7: Commit**

```powershell
cd d:\Workspace\CPKWorks\MeetPod
git add supabase/config.toml .env.supabase.example .gitignore
git commit -m "chore(meetpod): init supabase project skeleton"
```

---

## Task 2: 로컬 Supabase stack 기동 검증

**Files:** (변경 없음 — 환경 검증용)

- [ ] **Step 1: Docker 데몬 확인**

Run:
```powershell
docker info | Select-String "Server Version"
```
Expected: 버전 한 줄 출력. 미실행 시 Docker Desktop 시작.

- [ ] **Step 2: 로컬 stack 기동**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod
supabase start
```
Expected: 약 1~2분 후 `API URL`, `DB URL`, `Studio URL`, `JWT secret` 등 표 출력. 출력의 `DB URL`을 메모(이후 psql 접속용).

- [ ] **Step 3: 빈 DB에 마이그레이션이 적용 가능한지 dry-run**

Run:
```powershell
supabase migration list
```
Expected: 로컬/원격 모두 빈 테이블 (`Local | Remote | Name` 헤더만).

- [ ] **Step 4: stack 정지**

Run:
```powershell
supabase stop
```
Expected: `Stopped supabase local development setup.`

- [ ] **Step 5: Commit (변경 없으면 스킵)**

마이그레이션 파일이 추가되지 않았으므로 commit 없음. 다음 Task로.

---

## Task 3: 마이그레이션 001 — 확장 활성화

**Files:**
- Create: `MeetPod/supabase/migrations/001_extensions.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

Create `MeetPod/supabase/migrations/001_extensions.sql`:
```sql
-- 001_extensions.sql
-- MeetPod에서 사용하는 Postgres 확장 활성화

CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_cron;        -- 주기 잡 (location_pings 정리, meetup ended 전환)
CREATE EXTENSION IF NOT EXISTS pg_net;         -- Edge Function HTTP 호출 (push 워커용 예비)
```

- [ ] **Step 2: 로컬 적용**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod
supabase start
supabase db reset
```
Expected: `Applying migration 001_extensions.sql...` 후 `Finished supabase db reset.`

- [ ] **Step 3: 확장 적용 확인**

Run:
```powershell
supabase db dump --local --schema extensions | Select-String "pg_cron|pg_net|pgcrypto"
```
Expected: 세 확장 이름이 모두 한 번 이상 출현.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/001_extensions.sql
git commit -m "feat(db): enable pgcrypto, pg_cron, pg_net extensions"
```

---

## Task 4: 마이그레이션 002 — profiles & friendships

**Files:**
- Create: `MeetPod/supabase/migrations/002_profiles_friendships.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `MeetPod/supabase/migrations/002_profiles_friendships.sql`:
```sql
-- 002_profiles_friendships.sql

CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle          TEXT UNIQUE,
  display_name    TEXT NOT NULL,
  avatar_url      TEXT,
  expo_push_token TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- handle: 영문/숫자/_, 3~20자. 가입 직후 1회 설정이므로 NULL 허용 후 partial unique
CREATE UNIQUE INDEX profiles_handle_lower_idx
  ON profiles (LOWER(handle))
  WHERE handle IS NOT NULL;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_handle_format_chk
  CHECK (handle IS NULL OR handle ~ '^[A-Za-z0-9_]{3,20}$');

CREATE TABLE friendships (
  user_a_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)
);

CREATE INDEX friendships_user_b_idx ON friendships (user_b_id);
```

- [ ] **Step 2: 적용 & 검증**

Run:
```powershell
supabase db reset
supabase db dump --local --schema public | Select-String "CREATE TABLE (profiles|friendships)"
```
Expected: 두 테이블 모두 출현.

- [ ] **Step 3: 제약 양성/음성 케이스 수동 검증 (psql)**

Run:
```powershell
$env:PGPASSWORD="postgres"
psql "postgresql://postgres@127.0.0.1:54322/postgres" -c "INSERT INTO profiles (id, display_name, handle) VALUES (gen_random_uuid(), 'A', 'bad handle');"
```
Expected: `ERROR: new row for relation "profiles" violates check constraint "profiles_handle_format_chk"`

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/002_profiles_friendships.sql
git commit -m "feat(db): profiles + friendships tables with handle constraints"
```

---

## Task 5: 마이그레이션 003 — invites

**Files:**
- Create: `MeetPod/supabase/migrations/003_invites.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `MeetPod/supabase/migrations/003_invites.sql`:
```sql
-- 003_invites.sql

CREATE TABLE invites (
  code            TEXT PRIMARY KEY,                    -- 8-char URL-safe, 앱 레이어에서 생성
  inviter_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('friend', 'group')),
  target_group_id UUID,                                -- groups 생성 후 FK 추가 (004에서)
  expires_at      TIMESTAMPTZ NOT NULL,
  max_uses        INT  NOT NULL DEFAULT 10 CHECK (max_uses > 0),
  used_count      INT  NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (kind = 'group' AND target_group_id IS NOT NULL) OR
    (kind = 'friend' AND target_group_id IS NULL)
  ),
  CHECK (used_count <= max_uses),
  CHECK (LENGTH(code) BETWEEN 6 AND 16)
);

CREATE INDEX invites_inviter_idx ON invites (inviter_id);
CREATE INDEX invites_target_group_idx ON invites (target_group_id) WHERE target_group_id IS NOT NULL;
```

- [ ] **Step 2: 적용**

Run:
```powershell
supabase db reset
```
Expected: 003까지 적용 완료.

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/003_invites.sql
git commit -m "feat(db): invites table with friend/group kind constraint"
```

---

## Task 6: 마이그레이션 004 — groups & group_members + invites FK

**Files:**
- Create: `MeetPod/supabase/migrations/004_groups.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `MeetPod/supabase/migrations/004_groups.sql`:
```sql
-- 004_groups.sql

CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (LENGTH(name) BETWEEN 1 AND 80),
  description TEXT,
  avatar_url  TEXT,
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX group_members_user_idx ON group_members (user_id);

-- 그룹당 owner 정확히 1명을 강제
CREATE UNIQUE INDEX group_members_one_owner_per_group
  ON group_members (group_id)
  WHERE role = 'owner';

-- 003에서 미뤄둔 invites.target_group_id FK 부여
ALTER TABLE invites
  ADD CONSTRAINT invites_target_group_fk
  FOREIGN KEY (target_group_id) REFERENCES groups(id) ON DELETE CASCADE;
```

- [ ] **Step 2: 적용 & 검증**

Run:
```powershell
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d group_members"
```
Expected: `group_members_one_owner_per_group` UNIQUE 인덱스가 출력에 포함됨.

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/004_groups.sql
git commit -m "feat(db): groups + group_members with single-owner constraint"
```

---

## Task 7: 마이그레이션 005 — meetups, participants, reminders

**Files:**
- Create: `MeetPod/supabase/migrations/005_meetups.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `MeetPod/supabase/migrations/005_meetups.sql`:
```sql
-- 005_meetups.sql

CREATE TABLE meetups (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id                      UUID REFERENCES groups(id) ON DELETE CASCADE,
  creator_id                    UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  title                         TEXT NOT NULL CHECK (LENGTH(title) BETWEEN 1 AND 120),
  starts_at                     TIMESTAMPTZ NOT NULL,
  ends_at                       TIMESTAMPTZ NOT NULL,
  place_name                    TEXT NOT NULL,
  place_lat                     DOUBLE PRECISION NOT NULL,
  place_lng                     DOUBLE PRECISION NOT NULL,
  place_address                 TEXT,
  place_google_id               TEXT,
  location_share_minutes_before INT NOT NULL DEFAULT 20
                                  CHECK (location_share_minutes_before IN (10, 20, 30, 60)),
  status                        TEXT NOT NULL DEFAULT 'scheduled'
                                  CHECK (status IN ('scheduled','active','ended','cancelled')),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  CHECK (place_lat BETWEEN -90  AND 90),
  CHECK (place_lng BETWEEN -180 AND 180)
);

CREATE INDEX meetups_group_starts_idx ON meetups (group_id, starts_at) WHERE group_id IS NOT NULL;
CREATE INDEX meetups_status_ends_idx  ON meetups (status, ends_at);

CREATE TABLE meetup_participants (
  meetup_id UUID NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status    TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (meetup_id, user_id)
);

CREATE INDEX meetup_participants_user_idx ON meetup_participants (user_id);

CREATE TABLE meetup_reminders (
  meetup_id      UUID NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  minutes_before INT  NOT NULL CHECK (minutes_before > 0),
  notify_at      TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (meetup_id, user_id, minutes_before)
);

CREATE INDEX meetup_reminders_due_idx ON meetup_reminders (notify_at);
```

- [ ] **Step 2: 적용 & 제약 검증**

Run:
```powershell
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "INSERT INTO meetups (creator_id, title, starts_at, ends_at, place_name, place_lat, place_lng) VALUES (gen_random_uuid(), 't', NOW(), NOW() - INTERVAL '1 hour', 'p', 0, 0);"
```
Expected: `ERROR: ... violates check constraint` (ends_at > starts_at). 그리고 `creator_id` FK 위반도 가능 — 둘 중 하나의 ERROR면 통과.

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/005_meetups.sql
git commit -m "feat(db): meetups, participants, reminders tables"
```

---

## Task 8: 마이그레이션 006 — chat_rooms & messages

**Files:**
- Create: `MeetPod/supabase/migrations/006_chat.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `MeetPod/supabase/migrations/006_chat.sql`:
```sql
-- 006_chat.sql

CREATE TABLE chat_rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT NOT NULL CHECK (kind IN ('group', 'meetup')),
  ref_id      UUID NOT NULL,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, ref_id)
);

CREATE TABLE messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  kind          TEXT NOT NULL CHECK (kind IN ('text', 'image', 'place')),
  body          TEXT,
  image_url     TEXT,
  place_payload JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at     TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  CHECK (
    (kind = 'text'  AND body IS NOT NULL AND image_url IS NULL AND place_payload IS NULL) OR
    (kind = 'image' AND image_url IS NOT NULL AND body IS NULL AND place_payload IS NULL) OR
    (kind = 'place' AND place_payload IS NOT NULL AND body IS NULL AND image_url IS NULL)
  )
);

CREATE INDEX messages_room_created_idx ON messages (room_id, created_at DESC);
```

- [ ] **Step 2: 적용 & 페이로드 분기 검증**

Run:
```powershell
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "INSERT INTO chat_rooms (kind, ref_id) VALUES ('group', gen_random_uuid()) RETURNING id;"
```
Expected: UUID 한 줄 반환.

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/006_chat.sql
git commit -m "feat(db): chat_rooms + messages with per-kind payload check"
```

---

## Task 9: 마이그레이션 007 — location_pings

**Files:**
- Create: `MeetPod/supabase/migrations/007_location_pings.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `MeetPod/supabase/migrations/007_location_pings.sql`:
```sql
-- 007_location_pings.sql

CREATE TABLE location_pings (
  id          BIGSERIAL PRIMARY KEY,                   -- 고빈도 INSERT, surrogate PK
  meetup_id   UUID NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90  AND 90),
  lng         DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy_m  REAL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX location_pings_meetup_recorded_idx
  ON location_pings (meetup_id, recorded_at DESC);

CREATE INDEX location_pings_user_recorded_idx
  ON location_pings (user_id, recorded_at DESC);
```

- [ ] **Step 2: 적용**

Run:
```powershell
supabase db reset
```
Expected: 007까지 모두 적용.

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/007_location_pings.sql
git commit -m "feat(db): location_pings table"
```

---

## Task 10: 마이그레이션 008 — Storage 버킷 (chat-images)

**Files:**
- Create: `MeetPod/supabase/migrations/008_storage_buckets.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `MeetPod/supabase/migrations/008_storage_buckets.sql`:
```sql
-- 008_storage_buckets.sql
-- chat-images 버킷: 인증 사용자 업로드, 같은 room 멤버만 다운로드.
-- 객체 키 컨벤션: <room_id>/<message_id>.<ext>  (앱이 생성)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images',
  'chat-images',
  FALSE,
  10 * 1024 * 1024,                                    -- 10 MiB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 업로드: 인증 사용자만, 첫 segment(=room_id)가 본인이 속한 채팅방이어야 함
CREATE POLICY "chat_images_insert_room_member"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-images'
    AND EXISTS (
      SELECT 1
      FROM chat_rooms r
      WHERE r.id = (split_part(name, '/', 1))::uuid
        AND (
          (r.kind = 'group'  AND EXISTS (
              SELECT 1 FROM group_members gm
              WHERE gm.group_id = r.ref_id AND gm.user_id = auth.uid()))
          OR
          (r.kind = 'meetup' AND EXISTS (
              SELECT 1 FROM meetup_participants mp
              WHERE mp.meetup_id = r.ref_id AND mp.user_id = auth.uid()))
        )
    )
  );

-- 다운로드/조회: 같은 room 멤버
CREATE POLICY "chat_images_select_room_member"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-images'
    AND EXISTS (
      SELECT 1
      FROM chat_rooms r
      WHERE r.id = (split_part(name, '/', 1))::uuid
        AND (
          (r.kind = 'group'  AND EXISTS (
              SELECT 1 FROM group_members gm
              WHERE gm.group_id = r.ref_id AND gm.user_id = auth.uid()))
          OR
          (r.kind = 'meetup' AND EXISTS (
              SELECT 1 FROM meetup_participants mp
              WHERE mp.meetup_id = r.ref_id AND mp.user_id = auth.uid()))
        )
    )
  );
```

- [ ] **Step 2: 적용**

Run:
```powershell
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT id, public, file_size_limit FROM storage.buckets WHERE id='chat-images';"
```
Expected: `chat-images | f | 10485760` 한 줄.

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/008_storage_buckets.sql
git commit -m "feat(db): chat-images storage bucket with room-member policies"
```

---

## Task 11: 마이그레이션 009 — RLS 정책 일괄

**Files:**
- Create: `MeetPod/supabase/migrations/009_rls_policies.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `MeetPod/supabase/migrations/009_rls_policies.sql`:
```sql
-- 009_rls_policies.sql
-- 모든 도메인 테이블 RLS 활성화 + 정책. service_role은 RLS 우회(BYPASSRLS).

ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites             ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetups             ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetup_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetup_reminders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_pings      ENABLE ROW LEVEL SECURITY;

-- ===== 공통 헬퍼 함수 =====
CREATE OR REPLACE FUNCTION app.is_group_member(g UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM group_members WHERE group_id = g AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION app.is_group_admin(g UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM group_members
                 WHERE group_id = g AND user_id = auth.uid() AND role IN ('owner','admin'));
$$;

CREATE OR REPLACE FUNCTION app.is_meetup_participant(m UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM meetup_participants WHERE meetup_id = m AND user_id = auth.uid());
$$;

-- app 스키마는 정책 헬퍼 전용
CREATE SCHEMA IF NOT EXISTS app;
GRANT USAGE ON SCHEMA app TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO authenticated;

-- ===== profiles =====
CREATE POLICY profiles_select_self_or_co_member ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM group_members me
      JOIN group_members other ON other.group_id = me.group_id
      WHERE me.user_id = auth.uid() AND other.user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM meetup_participants me
      JOIN meetup_participants other ON other.meetup_id = me.meetup_id
      WHERE me.user_id = auth.uid() AND other.user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM friendships
      WHERE (user_a_id = auth.uid() AND user_b_id = profiles.id)
         OR (user_b_id = auth.uid() AND user_a_id = profiles.id)
    )
  );

CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- INSERT는 백엔드(service_role)가 bootstrap 시 처리 → 클라이언트 정책 없음

-- ===== friendships =====
CREATE POLICY friendships_select_self ON friendships
  FOR SELECT TO authenticated
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- INSERT/DELETE는 백엔드 전담

-- ===== invites =====
CREATE POLICY invites_select_inviter ON invites
  FOR SELECT TO authenticated
  USING (inviter_id = auth.uid());

-- 나머지(코드로 조회/소비)는 백엔드 전담

-- ===== groups =====
CREATE POLICY groups_select_member ON groups
  FOR SELECT TO authenticated
  USING (app.is_group_member(id));

-- INSERT/UPDATE/DELETE는 백엔드 전담 (owner/admin 검증 포함)

-- ===== group_members =====
CREATE POLICY group_members_select_co_member ON group_members
  FOR SELECT TO authenticated
  USING (app.is_group_member(group_id));

-- ===== meetups =====
CREATE POLICY meetups_select_participant ON meetups
  FOR SELECT TO authenticated
  USING (app.is_meetup_participant(id));

-- ===== meetup_participants =====
CREATE POLICY meetup_participants_select_co_participant ON meetup_participants
  FOR SELECT TO authenticated
  USING (app.is_meetup_participant(meetup_id));

-- ===== meetup_reminders =====
CREATE POLICY meetup_reminders_select_self ON meetup_reminders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY meetup_reminders_modify_self ON meetup_reminders
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ===== chat_rooms =====
CREATE POLICY chat_rooms_select_member ON chat_rooms
  FOR SELECT TO authenticated
  USING (
    (kind = 'group'  AND app.is_group_member(ref_id))
    OR
    (kind = 'meetup' AND app.is_meetup_participant(ref_id))
  );

-- ===== messages =====
CREATE POLICY messages_select_room_member ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_rooms r
      WHERE r.id = messages.room_id
        AND ((r.kind = 'group'  AND app.is_group_member(r.ref_id))
          OR (r.kind = 'meetup' AND app.is_meetup_participant(r.ref_id)))
    )
  );

CREATE POLICY messages_update_own_soft ON messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

-- INSERT는 백엔드 전담(권한 검증 후)

-- ===== location_pings =====
CREATE POLICY location_pings_select_co_participant ON location_pings
  FOR SELECT TO authenticated
  USING (app.is_meetup_participant(meetup_id));

CREATE POLICY location_pings_insert_self ON location_pings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND app.is_meetup_participant(meetup_id));
```

- [ ] **Step 2: 적용**

Run:
```powershell
supabase db reset
```
Expected: 009까지 모두 적용. 에러 없음.

- [ ] **Step 3: 정책 적용 카운트 확인**

Run:
```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT schemaname, tablename, COUNT(*) FROM pg_policies WHERE schemaname='public' GROUP BY 1,2 ORDER BY 2;"
```
Expected: 11개 도메인 테이블 모두 행이 있고, 합계가 13개 이상.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/009_rls_policies.sql
git commit -m "feat(db): RLS policies for all domain tables"
```

---

## Task 12: 마이그레이션 010 — Realtime publication

**Files:**
- Create: `MeetPod/supabase/migrations/010_realtime_publications.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `MeetPod/supabase/migrations/010_realtime_publications.sql`:
```sql
-- 010_realtime_publications.sql
-- Supabase Realtime은 supabase_realtime publication에 등록된 테이블만 스트림.

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE location_pings;
ALTER PUBLICATION supabase_realtime ADD TABLE meetups;        -- status 전환 알림용
```

- [ ] **Step 2: 적용 & 검증**

Run:
```powershell
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' ORDER BY 1;"
```
Expected: `location_pings`, `meetups`, `messages` 세 줄(그 외 supabase 내부 테이블이 더 있을 수 있음 — 위 3개 포함만 확인).

- [ ] **Step 3: Commit**

```powershell
git add supabase/migrations/010_realtime_publications.sql
git commit -m "feat(db): publish messages, location_pings, meetups to supabase_realtime"
```

---

## Task 13: 마이그레이션 011 — pg_cron 잡

**Files:**
- Create: `MeetPod/supabase/migrations/011_cron_jobs.sql`

- [ ] **Step 1: 마이그레이션 작성**

Create `MeetPod/supabase/migrations/011_cron_jobs.sql`:
```sql
-- 011_cron_jobs.sql
-- (1) 1분 주기: ends_at 지난 active 약속을 ended로 전환 + 채팅방 archive
-- (2) 1시간 주기: ends_at + 24h 지난 약속의 location_pings 삭제

CREATE OR REPLACE FUNCTION app.tick_meetup_status()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- scheduled → active
  UPDATE meetups
     SET status = 'active'
   WHERE status = 'scheduled'
     AND starts_at <= NOW()
     AND ends_at   >  NOW();

  -- active/scheduled → ended
  WITH ended AS (
    UPDATE meetups
       SET status = 'ended'
     WHERE status IN ('scheduled','active')
       AND ends_at <= NOW()
     RETURNING id
  )
  UPDATE chat_rooms r
     SET archived_at = NOW()
   FROM ended e
   WHERE r.kind = 'meetup' AND r.ref_id = e.id AND r.archived_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION app.purge_old_location_pings()
RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM location_pings p
  USING meetups m
  WHERE p.meetup_id = m.id
    AND m.ends_at < NOW() - INTERVAL '24 hours';
$$;

SELECT cron.schedule(
  'meetpod-tick-meetup-status',
  '* * * * *',
  $$ SELECT app.tick_meetup_status(); $$
);

SELECT cron.schedule(
  'meetpod-purge-location-pings',
  '17 * * * *',                        -- 매시 17분 (분산)
  $$ SELECT app.purge_old_location_pings(); $$
);
```

- [ ] **Step 2: 적용 & 잡 등록 확인**

Run:
```powershell
supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'meetpod-%' ORDER BY 1;"
```
Expected: 두 잡(`meetpod-purge-location-pings`, `meetpod-tick-meetup-status`)이 출력됨.

- [ ] **Step 3: 함수 직접 호출 동작 확인 (idempotent)**

Run:
```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT app.tick_meetup_status(); SELECT app.purge_old_location_pings();"
```
Expected: 두 호출 모두 에러 없이 종료(빈 DB이므로 0건 처리).

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations/011_cron_jobs.sql
git commit -m "feat(db): pg_cron jobs for meetup status tick and ping purge"
```

---

## Task 14: 테스트 헬퍼 작성

**Files:**
- Create: `MeetPod/supabase/tests/helpers.sql`
- Create: `MeetPod/supabase/tests/README.md`

- [ ] **Step 1: helpers.sql 작성**

Create `MeetPod/supabase/tests/helpers.sql`:
```sql
-- helpers.sql — 모든 RLS 테스트가 source 하는 공통 헬퍼.
-- psql 변수로 사용자 UUID를 받아 auth.uid()로 흉내내는 GUC 세팅.

-- 사용자 GUC 기반으로 auth.uid() 오버라이드 (테스트 트랜잭션 내부에서만)
CREATE OR REPLACE FUNCTION test.set_uid(u UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', u::text, TRUE);
  PERFORM set_config('role', 'authenticated', TRUE);
END;
$$;

-- 검증 매크로: 식이 true면 통과, 아니면 RAISE EXCEPTION
CREATE OR REPLACE FUNCTION test.assert(cond BOOLEAN, msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT cond THEN
    RAISE EXCEPTION 'ASSERT FAILED: %', msg;
  END IF;
END;
$$;

-- 더미 auth.users 행 생성 헬퍼 (FK 만족용)
CREATE OR REPLACE FUNCTION test.mk_user(email TEXT) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE uid UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, instance_id, aud, role)
  VALUES (uid, email, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  INSERT INTO profiles (id, display_name) VALUES (uid, split_part(email,'@',1));
  RETURN uid;
END;
$$;

-- test 스키마 준비
CREATE SCHEMA IF NOT EXISTS test;
```

> **Note:** 위 함수 정의는 `CREATE SCHEMA` 이후 재정의되어야 한다. 다음 Step에서 파일을 정정한다.

- [ ] **Step 2: helpers.sql 순서 수정**

Edit `MeetPod/supabase/tests/helpers.sql` — 파일 맨 위에 `CREATE SCHEMA IF NOT EXISTS test;`를 옮긴 최종본:
```sql
-- helpers.sql
CREATE SCHEMA IF NOT EXISTS test;

CREATE OR REPLACE FUNCTION test.set_uid(u UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', u::text, TRUE);
  PERFORM set_config('role', 'authenticated', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION test.assert(cond BOOLEAN, msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT cond THEN
    RAISE EXCEPTION 'ASSERT FAILED: %', msg;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION test.mk_user(email TEXT) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE uid UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, instance_id, aud, role)
  VALUES (uid, email, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  INSERT INTO profiles (id, display_name) VALUES (uid, split_part(email,'@',1));
  RETURN uid;
END;
$$;
```

- [ ] **Step 3: README.md 작성**

Create `MeetPod/supabase/tests/README.md`:
```markdown
# RLS Tests

로컬에서만 실행. 모든 테스트는 단일 트랜잭션 내에서 실행되며 끝에 `ROLLBACK`으로 상태를 되돌린다.

## Run all
```powershell
$env:PGPASSWORD="postgres"
$DB = "postgresql://postgres@127.0.0.1:54322/postgres"

psql $DB -f supabase/tests/helpers.sql
Get-ChildItem supabase/tests/test_*.sql | ForEach-Object {
  Write-Host "==> $($_.Name)"
  psql $DB -v ON_ERROR_STOP=1 -f $_.FullName
}
```

성공 시 각 파일이 `TEST PASSED: <name>` NOTICE를 출력. 실패 시 `ASSERT FAILED: ...` ERROR로 즉시 중단.
```

- [ ] **Step 4: helpers 적용 확인**

Run:
```powershell
supabase start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f d:\Workspace\CPKWorks\MeetPod\supabase\tests\helpers.sql
```
Expected: `CREATE SCHEMA` / `CREATE FUNCTION` NOTICE 출력, 에러 없음.

- [ ] **Step 5: Commit**

```powershell
git add supabase/tests/helpers.sql supabase/tests/README.md
git commit -m "test(db): add RLS test helpers and runner README"
```

---

## Task 15: RLS 테스트 — profiles

**Files:**
- Create: `MeetPod/supabase/tests/test_profiles_rls.sql`

- [ ] **Step 1: 테스트 작성**

Create `MeetPod/supabase/tests/test_profiles_rls.sql`:
```sql
-- test_profiles_rls.sql
-- 시나리오: A가 B를 SELECT 가능한 조건은 (자신|친구|공통 그룹|공통 약속) 중 하나.

BEGIN;

DO $$
DECLARE
  uid_a UUID := test.mk_user('a@test.dev');
  uid_b UUID := test.mk_user('b@test.dev');
  uid_c UUID := test.mk_user('c@test.dev');
  cnt INT;
BEGIN
  -- A 시점에서 B가 보이지 않아야 함 (관계 없음)
  PERFORM test.set_uid(uid_a);
  SELECT COUNT(*) INTO cnt FROM profiles WHERE id = uid_b;
  PERFORM test.assert(cnt = 0, 'A should NOT see B without any relation');

  -- A는 자기 자신을 본다
  SELECT COUNT(*) INTO cnt FROM profiles WHERE id = uid_a;
  PERFORM test.assert(cnt = 1, 'A should see self');

  -- 친구 추가 → A가 B를 본다
  INSERT INTO friendships (user_a_id, user_b_id)
  VALUES (LEAST(uid_a, uid_b), GREATEST(uid_a, uid_b));
  SELECT COUNT(*) INTO cnt FROM profiles WHERE id = uid_b;
  PERFORM test.assert(cnt = 1, 'A should see B after friendship');

  -- C는 여전히 B를 못 본다
  PERFORM test.set_uid(uid_c);
  SELECT COUNT(*) INTO cnt FROM profiles WHERE id = uid_b;
  PERFORM test.assert(cnt = 0, 'C should NOT see B (no relation)');

  RAISE NOTICE 'TEST PASSED: profiles_rls';
END $$;

ROLLBACK;
```

- [ ] **Step 2: 실행**

Run:
```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f d:\Workspace\CPKWorks\MeetPod\supabase\tests\test_profiles_rls.sql
```
Expected: `NOTICE: TEST PASSED: profiles_rls`. ERROR 없음.

- [ ] **Step 3: Commit**

```powershell
git add supabase/tests/test_profiles_rls.sql
git commit -m "test(db): rls scenario for profiles visibility"
```

---

## Task 16: RLS 테스트 — groups

**Files:**
- Create: `MeetPod/supabase/tests/test_groups_rls.sql`

- [ ] **Step 1: 테스트 작성**

Create `MeetPod/supabase/tests/test_groups_rls.sql`:
```sql
-- test_groups_rls.sql
BEGIN;

DO $$
DECLARE
  uid_owner UUID := test.mk_user('owner@test.dev');
  uid_mem   UUID := test.mk_user('mem@test.dev');
  uid_out   UUID := test.mk_user('out@test.dev');
  gid UUID;
  cnt INT;
BEGIN
  -- service_role 컨텍스트(setup): 그룹 생성
  PERFORM set_config('role', 'postgres', TRUE);
  INSERT INTO groups (name, owner_id) VALUES ('G', uid_owner) RETURNING id INTO gid;
  INSERT INTO group_members (group_id, user_id, role) VALUES
    (gid, uid_owner, 'owner'),
    (gid, uid_mem,   'member');

  -- owner는 그룹을 본다
  PERFORM test.set_uid(uid_owner);
  SELECT COUNT(*) INTO cnt FROM groups WHERE id = gid;
  PERFORM test.assert(cnt = 1, 'owner sees group');

  -- member도 본다
  PERFORM test.set_uid(uid_mem);
  SELECT COUNT(*) INTO cnt FROM groups WHERE id = gid;
  PERFORM test.assert(cnt = 1, 'member sees group');

  -- 외부인은 못 본다
  PERFORM test.set_uid(uid_out);
  SELECT COUNT(*) INTO cnt FROM groups WHERE id = gid;
  PERFORM test.assert(cnt = 0, 'outsider cannot see group');

  -- 외부인은 group_members도 못 본다
  SELECT COUNT(*) INTO cnt FROM group_members WHERE group_id = gid;
  PERFORM test.assert(cnt = 0, 'outsider cannot see members');

  RAISE NOTICE 'TEST PASSED: groups_rls';
END $$;

ROLLBACK;
```

- [ ] **Step 2: 실행**

Run:
```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f d:\Workspace\CPKWorks\MeetPod\supabase\tests\test_groups_rls.sql
```
Expected: `NOTICE: TEST PASSED: groups_rls`.

- [ ] **Step 3: Commit**

```powershell
git add supabase/tests/test_groups_rls.sql
git commit -m "test(db): rls scenario for groups + group_members"
```

---

## Task 17: RLS 테스트 — meetups

**Files:**
- Create: `MeetPod/supabase/tests/test_meetups_rls.sql`

- [ ] **Step 1: 테스트 작성**

Create `MeetPod/supabase/tests/test_meetups_rls.sql`:
```sql
-- test_meetups_rls.sql
BEGIN;

DO $$
DECLARE
  uid_creator UUID := test.mk_user('cr@test.dev');
  uid_part    UUID := test.mk_user('pt@test.dev');
  uid_out     UUID := test.mk_user('out@test.dev');
  mid UUID;
  cnt INT;
BEGIN
  PERFORM set_config('role', 'postgres', TRUE);
  INSERT INTO meetups (creator_id, title, starts_at, ends_at, place_name, place_lat, place_lng)
  VALUES (uid_creator, 'm', NOW(), NOW() + INTERVAL '1 hour', 'P', 37.5, 127.0)
  RETURNING id INTO mid;
  INSERT INTO meetup_participants (meetup_id, user_id) VALUES
    (mid, uid_creator), (mid, uid_part);

  PERFORM test.set_uid(uid_part);
  SELECT COUNT(*) INTO cnt FROM meetups WHERE id = mid;
  PERFORM test.assert(cnt = 1, 'participant sees meetup');

  PERFORM test.set_uid(uid_out);
  SELECT COUNT(*) INTO cnt FROM meetups WHERE id = mid;
  PERFORM test.assert(cnt = 0, 'outsider cannot see meetup');

  SELECT COUNT(*) INTO cnt FROM meetup_participants WHERE meetup_id = mid;
  PERFORM test.assert(cnt = 0, 'outsider cannot see participants');

  RAISE NOTICE 'TEST PASSED: meetups_rls';
END $$;

ROLLBACK;
```

- [ ] **Step 2: 실행**

Run:
```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f d:\Workspace\CPKWorks\MeetPod\supabase\tests\test_meetups_rls.sql
```
Expected: `NOTICE: TEST PASSED: meetups_rls`.

- [ ] **Step 3: Commit**

```powershell
git add supabase/tests/test_meetups_rls.sql
git commit -m "test(db): rls scenario for meetups + participants"
```

---

## Task 18: RLS 테스트 — chat

**Files:**
- Create: `MeetPod/supabase/tests/test_chat_rls.sql`

- [ ] **Step 1: 테스트 작성**

Create `MeetPod/supabase/tests/test_chat_rls.sql`:
```sql
-- test_chat_rls.sql
BEGIN;

DO $$
DECLARE
  uid_owner UUID := test.mk_user('o@test.dev');
  uid_mem   UUID := test.mk_user('m@test.dev');
  uid_out   UUID := test.mk_user('x@test.dev');
  gid UUID; rid UUID; cnt INT;
BEGIN
  PERFORM set_config('role', 'postgres', TRUE);
  INSERT INTO groups (name, owner_id) VALUES ('G', uid_owner) RETURNING id INTO gid;
  INSERT INTO group_members (group_id, user_id, role) VALUES
    (gid, uid_owner, 'owner'), (gid, uid_mem, 'member');
  INSERT INTO chat_rooms (kind, ref_id) VALUES ('group', gid) RETURNING id INTO rid;
  INSERT INTO messages (room_id, sender_id, kind, body) VALUES (rid, uid_owner, 'text', 'hi');

  -- 멤버는 메시지 본다
  PERFORM test.set_uid(uid_mem);
  SELECT COUNT(*) INTO cnt FROM messages WHERE room_id = rid;
  PERFORM test.assert(cnt = 1, 'member sees message');

  -- 외부인은 chat_rooms 자체가 안 보임
  PERFORM test.set_uid(uid_out);
  SELECT COUNT(*) INTO cnt FROM chat_rooms WHERE id = rid;
  PERFORM test.assert(cnt = 0, 'outsider cannot see chat_room');
  SELECT COUNT(*) INTO cnt FROM messages WHERE room_id = rid;
  PERFORM test.assert(cnt = 0, 'outsider cannot see messages');

  -- 본인 메시지 UPDATE 가능 / 타인 UPDATE 불가
  PERFORM test.set_uid(uid_owner);
  UPDATE messages SET edited_at = NOW() WHERE room_id = rid;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  PERFORM test.assert(cnt = 1, 'owner can edit own message');

  PERFORM test.set_uid(uid_mem);
  UPDATE messages SET edited_at = NOW() WHERE room_id = rid;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  PERFORM test.assert(cnt = 0, 'member cannot edit others message');

  RAISE NOTICE 'TEST PASSED: chat_rls';
END $$;

ROLLBACK;
```

- [ ] **Step 2: 실행**

Run:
```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f d:\Workspace\CPKWorks\MeetPod\supabase\tests\test_chat_rls.sql
```
Expected: `NOTICE: TEST PASSED: chat_rls`.

- [ ] **Step 3: Commit**

```powershell
git add supabase/tests/test_chat_rls.sql
git commit -m "test(db): rls scenario for chat_rooms + messages"
```

---

## Task 19: RLS 테스트 — location_pings

**Files:**
- Create: `MeetPod/supabase/tests/test_location_pings_rls.sql`

- [ ] **Step 1: 테스트 작성**

Create `MeetPod/supabase/tests/test_location_pings_rls.sql`:
```sql
-- test_location_pings_rls.sql
BEGIN;

DO $$
DECLARE
  uid_a UUID := test.mk_user('a@test.dev');
  uid_b UUID := test.mk_user('b@test.dev');
  uid_x UUID := test.mk_user('x@test.dev');
  mid UUID; cnt INT;
BEGIN
  PERFORM set_config('role', 'postgres', TRUE);
  INSERT INTO meetups (creator_id, title, starts_at, ends_at, place_name, place_lat, place_lng)
  VALUES (uid_a, 'm', NOW(), NOW() + INTERVAL '1 hour', 'P', 37.5, 127.0)
  RETURNING id INTO mid;
  INSERT INTO meetup_participants (meetup_id, user_id) VALUES (mid, uid_a), (mid, uid_b);

  -- 본인 핑 INSERT 성공
  PERFORM test.set_uid(uid_a);
  INSERT INTO location_pings (meetup_id, user_id, lat, lng) VALUES (mid, uid_a, 37.5, 127.0);

  -- 타인 사칭 INSERT 실패
  BEGIN
    INSERT INTO location_pings (meetup_id, user_id, lat, lng) VALUES (mid, uid_b, 37.5, 127.0);
    PERFORM test.assert(FALSE, 'A should NOT insert ping as B');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    NULL;
  END;

  -- 외부인 INSERT 실패
  PERFORM test.set_uid(uid_x);
  BEGIN
    INSERT INTO location_pings (meetup_id, user_id, lat, lng) VALUES (mid, uid_x, 37.5, 127.0);
    PERFORM test.assert(FALSE, 'outsider should NOT insert ping');
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  -- 외부인 SELECT 0건
  SELECT COUNT(*) INTO cnt FROM location_pings WHERE meetup_id = mid;
  PERFORM test.assert(cnt = 0, 'outsider sees no pings');

  -- 참여자 SELECT는 본인+동료 핑 모두 보임 (현재 a 1건)
  PERFORM test.set_uid(uid_b);
  SELECT COUNT(*) INTO cnt FROM location_pings WHERE meetup_id = mid;
  PERFORM test.assert(cnt = 1, 'co-participant sees pings');

  RAISE NOTICE 'TEST PASSED: location_pings_rls';
END $$;

ROLLBACK;
```

- [ ] **Step 2: 실행**

Run:
```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f d:\Workspace\CPKWorks\MeetPod\supabase\tests\test_location_pings_rls.sql
```
Expected: `NOTICE: TEST PASSED: location_pings_rls`.

- [ ] **Step 3: Commit**

```powershell
git add supabase/tests/test_location_pings_rls.sql
git commit -m "test(db): rls scenario for location_pings (insert as self only)"
```

---

## Task 20: 전체 테스트 일괄 실행 스크립트 검증

**Files:** (변경 없음)

- [ ] **Step 1: README의 일괄 실행 명령 그대로 수행**

Run (PowerShell):
```powershell
cd d:\Workspace\CPKWorks\MeetPod
supabase db reset
$env:PGPASSWORD="postgres"
$DB = "postgresql://postgres@127.0.0.1:54322/postgres"
psql $DB -f supabase/tests/helpers.sql
Get-ChildItem supabase/tests/test_*.sql | ForEach-Object {
  Write-Host "==> $($_.Name)"
  psql $DB -v ON_ERROR_STOP=1 -f $_.FullName
}
```
Expected: 5개 파일 모두 `TEST PASSED: <name>` NOTICE를 1회씩 출력하고 종료 코드 0.

- [ ] **Step 2: 실패 케이스 sanity check**

Edit `MeetPod/supabase/tests/test_profiles_rls.sql` — 한 줄을 임시로 망가뜨림:
```sql
PERFORM test.assert(cnt = 999, 'sanity: should fail');
```
Re-run profiles 테스트:
```powershell
psql $DB -v ON_ERROR_STOP=1 -f supabase/tests/test_profiles_rls.sql
```
Expected: `ASSERT FAILED: sanity: should fail` ERROR + 종료 코드 1.

원복:
```powershell
git checkout supabase/tests/test_profiles_rls.sql
```

- [ ] **Step 3: Commit (변경 없음 — 스킵)**

---

## Task 21: 원격 적용 & 검증

**Files:** (변경 없음)

- [ ] **Step 1: 원격 push (dry-run)**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod
supabase db push --dry-run
```
Expected: 011개 마이그레이션이 적용 대상으로 나열됨, 에러 없음.

- [ ] **Step 2: 원격 적용**

Run:
```powershell
supabase db push
```
Expected: `Applying migration ...` × 11, 마지막 `Finished supabase db push.`

- [ ] **Step 3: 원격 정책 카운트 sanity**

Supabase 대시보드 → SQL Editor에서:
```sql
SELECT tablename, COUNT(*) FROM pg_policies WHERE schemaname='public' GROUP BY 1 ORDER BY 1;
SELECT jobname FROM cron.job WHERE jobname LIKE 'meetpod-%';
SELECT id FROM storage.buckets WHERE id='chat-images';
```
Expected: 로컬에서 본 결과와 동일(테이블별 정책 수 동일, cron 잡 2개, 버킷 1개).

- [ ] **Step 4: 원격 적용 메모를 commit message에 남기는 빈 commit (선택)**

```powershell
git commit --allow-empty -m "chore(db): apply migrations 001-011 to remote (project-ref <ref>)"
```

---

## Task 22: 종료 — 후속 Plan에 전달할 산출물 정리

**Files:**
- Create: `MeetPod/supabase/README.md`

- [ ] **Step 1: README 작성**

Create `MeetPod/supabase/README.md`:
```markdown
# MeetPod — Supabase

## 마이그레이션 적용
```powershell
cd d:\Workspace\CPKWorks\MeetPod
supabase start              # 로컬 stack
supabase db reset           # 모든 마이그레이션 + seed 재적용
supabase db push            # 원격 적용
```

## RLS 테스트
`supabase/tests/README.md` 참고.

## 후속 Plan 전제
- `service_role` 키는 백엔드 전용 (`SUPABASE_SERVICE_KEY`). RLS 우회 → 권한 검증은 FastAPI 레이어 책임.
- `anon` 키는 모바일 전용 (`EXPO_PUBLIC_SUPABASE_ANON_KEY`). RLS 정책에 의해 데이터가 보호됨.
- Realtime 구독 가능 테이블: `messages`, `location_pings`, `meetups`.
- Storage 버킷: `chat-images` (객체 키 컨벤션 `<room_id>/<message_id>.<ext>`).

## 변경 절차
1. 새 마이그레이션 추가: `supabase migration new <name>`
2. SQL 작성 → `supabase db reset`로 검증 → 테스트 일괄 실행
3. `supabase db push`로 원격 적용
4. 새 정책이라면 `supabase/tests/`에 시나리오 추가
```

- [ ] **Step 2: Commit**

```powershell
git add supabase/README.md
git commit -m "docs(db): supabase migration + rls test workflow"
```

---

## Self-Review Notes

스펙 §4 모든 테이블 커버: profiles, friendships, invites, groups, group_members, meetups, meetup_participants, meetup_reminders, chat_rooms, messages, location_pings ✓
§4.7 RLS 정책 모두 009에 반영 + 5개 시나리오 테스트로 검증 ✓
§6.4 위치 공유 종료 후 cron 정리(`location_pings` 24h, meetup `ended` 전환 + chat 아카이브) → 011 ✓
§7 Storage `chat-images` 버킷 + 정책 → 008 ✓
Realtime 구독 대상 테이블 publication 등록 → 010 ✓

**의도적으로 다음은 후속 Plan에서 처리:**
- 초대 코드 생성 로직 (Plan 3 백엔드)
- Edge Function 푸시 발송 워커 (Plan 11)
- profiles INSERT 정책 — bootstrap은 service_role로 처리하므로 클라이언트 INSERT 정책 없음 (Plan 2)
- Apple/Kakao 로그인 Custom OIDC 설정 (Plan 6 모바일에서 다룸)

---

## Execution Handoff

**Plan complete and saved to `MeetPod/docs/superpowers/plans/2026-05-06-plan-01-supabase-infra-schema.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch with checkpoints

**Which approach?**
