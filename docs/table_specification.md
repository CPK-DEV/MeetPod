# MeetPod — Table Specification

**Date:** 2026-05-03
**DB:** Supabase (PostgreSQL 15)
**Status:** Initial spec (Phase 1~4)

이 문서는 MVP 데이터 모델의 전체 스키마, 인덱스, RLS 정책, 트리거, cron 작업을 정의한다. SQL 마이그레이션은 이 문서를 따라 작성한다.

---

## 0. 공통 규약

| 항목 | 규칙 |
|------|------|
| ID | `uuid PRIMARY KEY DEFAULT gen_random_uuid()` (예외: `auth.users.id`, `invites.code`) |
| 시간 | `timestamptz` 통일. 기본값 `now()` |
| 삭제 | 기본 hard delete. 사용자 콘텐츠(messages)만 soft delete (`deleted_at`) |
| 외래 키 | `ON DELETE CASCADE` 기본, 단 사용자 참조는 `ON DELETE RESTRICT` |
| 명명 | 테이블/컬럼 snake_case. boolean은 `is_*`, `has_*` 접두 |
| 인덱스 | `idx_<table>_<col>(_col2...)` 명명 |
| 트리거 | `trg_<table>_<event>` 명명 |
| RLS | 모든 public 테이블 활성화. 정책명 `<verb>_<who>` (예: `select_member`) |

확장:
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;
```

---

## 1. profiles

`auth.users`와 1:1. 가입 직후 트리거로 행 생성, 핸들은 OnboardingHandleScreen에서 채움.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | `uuid` | PK, FK→`auth.users.id` ON DELETE CASCADE | 사용자 ID |
| `handle` | `text` | UNIQUE NOT NULL | `@handle`. 소문자 영숫자·언더스코어. 4~20자 |
| `display_name` | `text` | NOT NULL | 화면 표시 이름. 1~30자 |
| `avatar_url` | `text` | NULL | Supabase Storage URL |
| `expo_push_token` | `text` | NULL | 푸시 발송용 |
| `default_reminder_minutes` | `int` | DEFAULT 30 | 새 약속의 기본 개인 알림 (분) |
| `locale` | `text` | DEFAULT 'ko' | 'ko' / 'en' |
| `created_at` | `timestamptz` | DEFAULT now() | |
| `updated_at` | `timestamptz` | DEFAULT now() | 트리거로 자동 갱신 |

**제약:**
```sql
CHECK (handle ~ '^[a-z0-9_]{4,20}$')
CHECK (char_length(display_name) BETWEEN 1 AND 30)
```

**인덱스:**
- PK on `id`
- UNIQUE on `handle`

**트리거:**
- `trg_profiles_updated_at` BEFORE UPDATE → `updated_at = now()`
- `trg_users_after_insert` (on `auth.users`): INSERT new row into `profiles` with `display_name = '사용자'`, handle null. 핸들은 클라이언트가 PATCH로 채움.

**RLS:**
- `SELECT`: `auth.uid() = id` OR `EXISTS (같은 group_members)` OR `EXISTS (같은 meetup_participants)`
- `UPDATE`: `auth.uid() = id` (단, `id`/`created_at` 변경 금지)
- `INSERT`/`DELETE`: 트리거 외 차단

---

## 2. friendships

A↔B 친구 관계. 정규화로 양방향 한 행만 저장.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `user_a_id` | `uuid` | NOT NULL, FK→`profiles.id` | 작은 쪽 ID |
| `user_b_id` | `uuid` | NOT NULL, FK→`profiles.id` | 큰 쪽 ID |
| `created_at` | `timestamptz` | DEFAULT now() | |

**제약:**
```sql
PRIMARY KEY (user_a_id, user_b_id)
CHECK (user_a_id < user_b_id)
```

**인덱스:**
- `idx_friendships_b` on `(user_b_id, user_a_id)` — 역방향 조회용

**RLS:**
- `SELECT`: `auth.uid() IN (user_a_id, user_b_id)`
- `INSERT`/`DELETE`: backend service role 전용 (초대 수락 시 `invite_service` 가 처리)

**Helper SQL:**
```sql
CREATE OR REPLACE FUNCTION upsert_friendship(u1 uuid, u2 uuid)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO friendships(user_a_id, user_b_id)
  VALUES (LEAST(u1,u2), GREATEST(u1,u2))
  ON CONFLICT DO NOTHING;
$$;
```

---

## 3. invites

친구 또는 그룹 초대 코드.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `code` | `text` | PK | 8자 URL-safe (Crockford base32) |
| `inviter_id` | `uuid` | NOT NULL, FK→`profiles.id` | 발급자 |
| `kind` | `text` | NOT NULL CHECK IN ('friend','group') | 종류 |
| `target_group_id` | `uuid` | FK→`groups.id` ON DELETE CASCADE NULL | kind='group'일 때 필수 |
| `expires_at` | `timestamptz` | NOT NULL | 발급 후 7일 기본 |
| `max_uses` | `int` | NOT NULL DEFAULT 10 | |
| `used_count` | `int` | NOT NULL DEFAULT 0 | |
| `created_at` | `timestamptz` | DEFAULT now() | |
| `revoked_at` | `timestamptz` | NULL | 발급자가 취소 시 |

**제약:**
```sql
CHECK (code ~ '^[A-HJ-NP-Z0-9]{8}$')
CHECK ((kind='group' AND target_group_id IS NOT NULL)
    OR (kind='friend' AND target_group_id IS NULL))
CHECK (used_count <= max_uses)
```

**인덱스:**
- PK on `code`
- `idx_invites_inviter` on `(inviter_id, created_at DESC)`
- `idx_invites_group` on `(target_group_id)` WHERE kind='group'

**RLS:**
- `SELECT`: anonymous도 코드로 조회 가능 (단일 row, 만료 체크는 service에서)
  - 정책: `expires_at > now() AND revoked_at IS NULL`
- `INSERT`: `auth.uid() = inviter_id` AND (kind='friend' OR group owner/admin)
- `UPDATE/DELETE`: `auth.uid() = inviter_id` (revoke만)

**관련 RPC:**
```sql
CREATE OR REPLACE FUNCTION accept_invite(p_code text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER ...
-- 백엔드가 호출. used_count++ + friendships/group_members INSERT 트랜잭션
```

---

## 4. groups

그룹 (영구 모임). 누구나 생성 가능, owner 1명 + admins.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | `uuid` | PK | |
| `name` | `text` | NOT NULL | 1~40자 |
| `description` | `text` | NULL | 0~200자 |
| `avatar_url` | `text` | NULL | |
| `owner_id` | `uuid` | NOT NULL, FK→`profiles.id` ON DELETE RESTRICT | |
| `created_at` | `timestamptz` | DEFAULT now() | |
| `updated_at` | `timestamptz` | DEFAULT now() | 트리거 |

**제약:**
```sql
CHECK (char_length(name) BETWEEN 1 AND 40)
CHECK (description IS NULL OR char_length(description) <= 200)
```

**인덱스:**
- PK on `id`
- `idx_groups_owner` on `(owner_id)`

**RLS:**
- `SELECT`: `EXISTS (group_members WHERE group_id = id AND user_id = auth.uid())`
- `INSERT`: `auth.uid() = owner_id`. 트리거로 owner를 group_members에 자동 추가.
- `UPDATE` (name/desc/avatar): owner 또는 admin
- `UPDATE` (owner_id 변경=위임): 현재 owner만
- `DELETE`: owner만

**트리거:**
```sql
trg_groups_after_insert: 새 그룹 생성 시 group_members(role='owner') INSERT
                        + chat_rooms(kind='group', ref_id=NEW.id) INSERT
```

---

## 5. group_members

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `group_id` | `uuid` | NOT NULL, FK→`groups.id` ON DELETE CASCADE | |
| `user_id` | `uuid` | NOT NULL, FK→`profiles.id` ON DELETE CASCADE | |
| `role` | `text` | NOT NULL CHECK IN ('owner','admin','member') | |
| `joined_at` | `timestamptz` | DEFAULT now() | |

**제약:**
```sql
PRIMARY KEY (group_id, user_id)
```

**인덱스:**
- PK
- `idx_group_members_user` on `(user_id, joined_at DESC)` — 내 그룹 목록

**RLS:**
- `SELECT`: 본인 멤버인 그룹만 (`EXISTS (group_members WHERE group_id = group_members.group_id AND user_id = auth.uid())`)
- `INSERT`: backend service (초대 수락 RPC)
- `UPDATE` (role 변경): owner만 (admin↔member). owner 위임은 `groups.owner_id` 갱신 트랜잭션.
- `DELETE`: owner/admin (멤버 추방), 또는 본인 (자기 탈퇴). 마지막 owner 탈퇴 차단.

**제약 트리거:**
- `trg_group_members_prevent_owner_leave`: owner role인 멤버는 DELETE 차단 (먼저 위임 필요)

---

## 6. meetups

약속 (단발 또는 그룹). 핵심 엔티티.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | `uuid` | PK | |
| `group_id` | `uuid` | FK→`groups.id` ON DELETE CASCADE NULL | NULL이면 1회성 |
| `creator_id` | `uuid` | NOT NULL, FK→`profiles.id` | |
| `title` | `text` | NOT NULL | 1~60자 |
| `starts_at` | `timestamptz` | NOT NULL | |
| `ends_at` | `timestamptz` | NOT NULL | |
| `place_name` | `text` | NOT NULL | |
| `place_lat` | `double precision` | NOT NULL | |
| `place_lng` | `double precision` | NOT NULL | |
| `place_address` | `text` | NULL | |
| `place_google_id` | `text` | NULL | Google Place ID |
| `location_share_minutes_before` | `int` | NOT NULL DEFAULT 20 CHECK (>=0 AND <=240) | |
| `status` | `text` | NOT NULL DEFAULT 'scheduled' CHECK IN ('scheduled','active','ended','cancelled') | |
| `created_at` | `timestamptz` | DEFAULT now() | |
| `updated_at` | `timestamptz` | DEFAULT now() | 트리거 |

**제약:**
```sql
CHECK (ends_at > starts_at)
CHECK (place_lat BETWEEN -90 AND 90)
CHECK (place_lng BETWEEN -180 AND 180)
CHECK (char_length(title) BETWEEN 1 AND 60)
```

**인덱스:**
- PK
- `idx_meetups_group_starts` on `(group_id, starts_at DESC)` WHERE group_id IS NOT NULL
- `idx_meetups_creator_starts` on `(creator_id, starts_at DESC)`
- `idx_meetups_status_ends` on `(status, ends_at)` — pg_cron status 전환용

**RLS:**
- `SELECT`: `EXISTS (meetup_participants WHERE meetup_id = id AND user_id = auth.uid())`
- `INSERT`: `auth.uid() = creator_id`. 트리거로 creator를 participants에 추가 + chat_rooms 생성.
- `UPDATE`: creator 또는 (group_id != NULL이면 그 그룹의 owner/admin)
- `DELETE`: 위 UPDATE 권한자만

**트리거:**
```sql
trg_meetups_after_insert:
  INSERT meetup_participants(meetup_id, user_id=creator_id, status='going')
  INSERT chat_rooms(kind='meetup', ref_id=NEW.id)
  INSERT meetup_reminders(meetup_id, user_id=creator_id,
                          minutes_before=profiles.default_reminder_minutes,
                          notify_at=NEW.starts_at - interval '...')
```

---

## 7. meetup_participants

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `meetup_id` | `uuid` | FK→`meetups.id` ON DELETE CASCADE | |
| `user_id` | `uuid` | FK→`profiles.id` ON DELETE CASCADE | |
| `status` | `text` | NOT NULL DEFAULT 'going' CHECK IN ('going') | MVP는 going만. RSVP는 Phase 2. |
| `share_location` | `boolean` | NOT NULL DEFAULT true | 시나리오 9: 본인이 위치공유 OFF |
| `joined_at` | `timestamptz` | DEFAULT now() | |

**제약:**
```sql
PRIMARY KEY (meetup_id, user_id)
```

**인덱스:**
- PK
- `idx_meetup_participants_user` on `(user_id, joined_at DESC)` — 내 약속 목록

**RLS:**
- `SELECT`: 본인이 참여 중인 meetup의 참여자 목록만 (`EXISTS (...same meetup...)`)
- `INSERT`: meetup creator/admin이 다른 사용자 추가, 본인은 자기 참여
- `UPDATE` (`share_location`): `auth.uid() = user_id` (본인만 토글)
- `DELETE`: meetup 권한자(creator/admin)가 추방 OR 본인이 탈퇴

---

## 8. meetup_reminders

사용자별 개인 알림. 푸시 발송 후 행 삭제.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `meetup_id` | `uuid` | FK→`meetups.id` ON DELETE CASCADE | |
| `user_id` | `uuid` | FK→`profiles.id` ON DELETE CASCADE | |
| `minutes_before` | `int` | NOT NULL CHECK (>=0 AND <=10080) | 0~7일 |
| `notify_at` | `timestamptz` | NOT NULL | starts_at - interval | 발송 큐 인덱스용 |

**제약:**
```sql
PRIMARY KEY (meetup_id, user_id, minutes_before)
```

**인덱스:**
- PK
- `idx_reminders_notify_at` on `(notify_at)` WHERE notify_at IS NOT NULL — Edge Function이 1분 주기 SELECT

**RLS:**
- `SELECT/INSERT/UPDATE/DELETE`: `auth.uid() = user_id`

**트리거:**
- `trg_meetups_update_reminders` (on `meetups` UPDATE of `starts_at`):
  관련 reminder의 `notify_at`을 `NEW.starts_at - minutes_before * interval '1 minute'`로 재계산

**Edge Function (1분 cron):**
```sql
SELECT meetup_id, user_id FROM meetup_reminders
WHERE notify_at <= now()
LIMIT 500;
-- 각 row에 대해 Expo push 발송 후 DELETE
```

---

## 9. chat_rooms

그룹 / 약속별 채팅방. 1:1 매핑.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | `uuid` | PK | |
| `kind` | `text` | NOT NULL CHECK IN ('group','meetup') | |
| `ref_id` | `uuid` | NOT NULL | groups.id 또는 meetups.id |
| `archived_at` | `timestamptz` | NULL | 약속 종료 시 세팅 |
| `created_at` | `timestamptz` | DEFAULT now() | |

**제약:**
```sql
UNIQUE (kind, ref_id)
```

**인덱스:**
- PK
- UNIQUE `(kind, ref_id)`

**RLS:**
- `SELECT`: 멤버십 체크
  - `kind='group'`: `EXISTS (group_members WHERE group_id = ref_id AND user_id = auth.uid())`
  - `kind='meetup'`: `EXISTS (meetup_participants WHERE meetup_id = ref_id AND user_id = auth.uid())`
- `INSERT`: 백엔드 트리거 외 차단
- `UPDATE`(`archived_at`): pg_cron service role 또는 약속 권한자
- `DELETE`: 차단 (메시지 보존)

---

## 10. messages

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | `uuid` | PK | |
| `room_id` | `uuid` | NOT NULL, FK→`chat_rooms.id` ON DELETE CASCADE | |
| `sender_id` | `uuid` | NOT NULL, FK→`profiles.id` | |
| `kind` | `text` | NOT NULL CHECK IN ('text','image','place','system') | system: 그룹 가입/탈퇴 알림 |
| `body` | `text` | NULL | text일 때 필수 |
| `image_url` | `text` | NULL | image일 때 필수 (Supabase Storage URL) |
| `place_payload` | `jsonb` | NULL | place일 때 필수: `{name,lat,lng,google_id,address,url}` |
| `reply_to_id` | `uuid` | FK→`messages.id` ON DELETE SET NULL NULL | 답장 |
| `created_at` | `timestamptz` | DEFAULT now() | |
| `edited_at` | `timestamptz` | NULL | 편집 시 갱신 |
| `deleted_at` | `timestamptz` | NULL | soft delete |

**제약:**
```sql
CHECK (
  (kind='text'   AND body IS NOT NULL AND char_length(body) BETWEEN 1 AND 4000) OR
  (kind='image'  AND image_url IS NOT NULL) OR
  (kind='place'  AND place_payload IS NOT NULL) OR
  (kind='system' AND body IS NOT NULL)
)
```

**인덱스:**
- PK
- `idx_messages_room_created` on `(room_id, created_at DESC)` — 채팅 페이지네이션
- `idx_messages_sender` on `(sender_id, created_at DESC)` — 본인 메시지 조회

**RLS:**
- `SELECT`: 해당 chat_room의 멤버 (chat_rooms RLS와 동일 로직 재사용)
- `INSERT`: 위 + `auth.uid() = sender_id` + `archived_at IS NULL` (아카이브 후도 가능하려면 이 체크 제거)
- `UPDATE` (body/edited_at/deleted_at): `auth.uid() = sender_id`. 다른 컬럼 변경 차단.
- `DELETE`: 차단 (soft delete만)

**Realtime:**
- 모바일이 `messages` 테이블을 `room_id` 필터로 INSERT/UPDATE 구독
- supabase realtime publication 활성화 필요: `ALTER PUBLICATION supabase_realtime ADD TABLE messages;`

---

## 11. location_pings

위치 핑. 짧은 TTL.

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | `bigserial` | PK | 핀 1건당 1 PK (uuid 비용 절감) |
| `meetup_id` | `uuid` | NOT NULL, FK→`meetups.id` ON DELETE CASCADE | |
| `user_id` | `uuid` | NOT NULL, FK→`profiles.id` ON DELETE CASCADE | |
| `lat` | `double precision` | NOT NULL CHECK (BETWEEN -90 AND 90) | |
| `lng` | `double precision` | NOT NULL CHECK (BETWEEN -180 AND 180) | |
| `accuracy_m` | `real` | NULL | 미터 단위 정확도 |
| `recorded_at` | `timestamptz` | NOT NULL DEFAULT now() | 클라이언트 타임스탬프 |

**인덱스:**
- PK
- `idx_pings_meetup_recorded` on `(meetup_id, recorded_at DESC)` — 최신 핀 조회 (멤버별 최신 1건)
- `idx_pings_meetup_user_recorded` on `(meetup_id, user_id, recorded_at DESC)` — 멤버별 trail

**RLS:**
- `SELECT`: 같은 meetup 참여자 (`EXISTS (meetup_participants WHERE ...)`)
- `INSERT`: `auth.uid() = user_id` AND 본인이 해당 meetup 참여자 AND `share_location=true`
  - + `meetups.status = 'active'` (안전장치)
- `UPDATE/DELETE`: 차단

**Realtime:**
- 모바일이 `location_pings` 테이블을 `meetup_id` 필터로 INSERT 구독
- 멤버별 최신 핀만 지도에 표시 (클라이언트 dedup)

**pg_cron 정리:**
```sql
SELECT cron.schedule('cleanup_location_pings', '0 * * * *', $$
  DELETE FROM location_pings p
  USING meetups m
  WHERE p.meetup_id = m.id
    AND m.ends_at + interval '24 hours' < now();
$$);
```

---

## 12. push_outbox (선택, Phase 2)

푸시 발송 idempotent 처리용 큐. Edge Function이 reminder 발송 시 활용.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK | |
| `kind` | `text` | reminder/invite/meetup_change/cancel |
| `payload` | `jsonb` | |
| `dedupe_key` | `text` UNIQUE | 중복 발송 방지 (예: `reminder:{meetup_id}:{user_id}:{minutes_before}`) |
| `sent_at` | `timestamptz` NULL | |
| `created_at` | `timestamptz` DEFAULT now() | |

(MVP에서 미구현 시 reminder 직접 DELETE로 갈음)

---

## 13. pg_cron 작업 요약

| 이름 | 주기 | 작업 |
|------|------|------|
| `tick_meetup_status` | 1분 | `scheduled→active` (starts_at <= now), `active→ended` (ends_at <= now) + 해당 chat_rooms `archived_at` 세팅 |
| `dispatch_reminders` | 1분 | meetup_reminders WHERE notify_at <= now → push 발송 후 DELETE (Edge Function) |
| `cleanup_location_pings` | 1시간 | ends_at + 24h 지난 meetup의 핑 DELETE |
| `cleanup_expired_invites` | 1일 | expires_at 지난 used_count=0 invites DELETE (선택) |

---

## 14. Storage 버킷

| 버킷 | 정책 |
|------|------|
| `chat-images` | INSERT: 인증 사용자. SELECT: 메시지의 chat_room 멤버만 (백엔드가 signed URL 발급 권장 또는 RLS-equivalent storage policies) |
| `avatars` | INSERT: 본인 폴더만. SELECT: 모든 인증 사용자 (앱 내 검색 노출이 없으므로 큰 위험 X) |

`chat-images/{room_id}/{uuid}.jpg` 형식 권장.

---

## 15. 마이그레이션 순서

```
001_init_extensions.sql      -- pgcrypto, pg_cron
002_profiles.sql             -- profiles + auth user 트리거
003_friendships.sql
004_groups.sql               -- groups + group_members + 트리거
005_invites.sql              -- + accept_invite RPC
006_meetups.sql              -- meetups + meetup_participants + 트리거
007_reminders.sql
008_chat.sql                 -- chat_rooms + messages + realtime publication
009_location.sql             -- location_pings + cron 등록
010_storage.sql              -- 버킷 + storage policies
```

각 파일 끝에 RLS 정책 포함. Supabase CLI 또는 SQL Editor로 순서대로 실행.

---

## 16. 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-03 | 최초 작성 (Phase 1~4 MVP 기준) |
