# MeetPod MVP — Design Spec

**Date:** 2026-05-02
**Status:** Approved (brainstorming)
**Owner:** Harry Kim

## 1. Purpose

친구들끼리 약속을 잡고, 약속 시간 동안 서로의 위치를 공유하며, 그룹/약속 단위로 채팅하는 모바일 앱.

PickPod(부모-자녀 픽업)와 같은 워크스페이스 컨벤션을 따르되, 사용 대상은 **친구 간 평등 관계**이며 **프라이버시 친화적 위치 공유**가 핵심 차별점.

## 2. Scope

### MVP에 포함
- 소셜 로그인 (Google / Apple / Kakao)
- 핸들(@) 기반 프로필, 초대 링크/QR로만 친구 추가 (검색 없음)
- 그룹: 생성, 방장 + 관리자 위임, 멤버 초대/추방
- 약속: 그룹 약속 또는 1회성 약속, 미니멀 필드(제목·일시·장소·참여자), 사용자별 개인 알림
- 그룹 약속 생성 시 기본은 전체 멤버 선택, 빠질 멤버 해제 가능
- 위치 공유: 약속 시작 N분 전 자동 ON, 종료 시 자동 OFF (기본 20분, 약속별 수정 가능)
- 채팅: 그룹 상시 채팅방 + 약속별 채팅방(종료 시 아카이브). 텍스트 + 이미지 + Google Maps 장소 공유
- 백그라운드 위치 트래킹 (Expo background location)

### MVP에서 제외
- RSVP(가/불가/미정) — 추가 시 'going' 단순 처리
- 비용 분담, 사진 갤러리, 반복 일정
- Yelp 연동 (Google만)
- 핸들 검색 / 연락처 동기화
- 음성/영상 통화

## 3. Architecture

```
┌────────────────────────┐         ┌──────────────────────┐
│  Mobile (Expo + RN)    │ ──HTTPS─►  Backend (FastAPI)   │
│                        │         │  - REST /api/*       │
│                        │         │  - JWT verify        │
└────────┬───────────────┘         └─────────┬────────────┘
         │                                    │
         │ Realtime WS / Auth OAuth           │ supabase-py
         ▼                                    ▼
                       ┌──────────────────────────┐
                       │   Supabase               │
                       │  - Auth (Google/Apple/   │
                       │    Kakao)                │
                       │  - Postgres + RLS        │
                       │  - Realtime              │
                       │  - Storage (images)      │
                       │  - pg_cron + Edge Fn     │
                       └──────────────────────────┘
```

**트래픽 분할 원칙:**
- **FastAPI 경유**: 권한 검증·서버 권위가 필요한 쓰기 (그룹/약속 CRUD, 초대 코드 발급/소비, 알림 등록, 메시지 전송)
- **Supabase 직결**: 채팅 메시지 수신(Realtime), 위치 핑 수신(Realtime), 단순 SELECT (RLS로 보호)
- **이유**: Vercel serverless는 WS 부적합. Realtime을 백엔드로 프록시하면 latency·복잡성 증가.

**스택:**
- Mobile: Expo + React Native + TypeScript
- Backend: FastAPI + Python 3.12
- DB/Auth/Realtime/Storage: Supabase
- Maps: Google Maps SDK (Place Picker 포함)
- Push: Expo Notifications
- 배포: Backend → Vercel, Mobile → Expo EAS

## 4. Data Model

### 4.1 사용자 / 친구
```
profiles
  id            uuid PK (= auth.users.id)
  handle        text unique  -- @handle, 가입 직후 1회 설정
  display_name  text
  avatar_url    text nullable
  expo_push_token text nullable
  created_at    timestamptz

friendships
  user_a_id  uuid → profiles  -- a < b 정규화
  user_b_id  uuid → profiles
  created_at timestamptz
  PRIMARY KEY (user_a_id, user_b_id)
  CHECK (user_a_id < user_b_id)
```

### 4.2 초대
```
invites
  code           text PK              -- 8-char URL-safe
  inviter_id     uuid → profiles
  kind           text CHECK IN ('friend','group')
  target_group_id uuid → groups nullable  -- kind='group'일 때만
  expires_at     timestamptz
  max_uses       int default 10
  used_count     int default 0
  created_at     timestamptz
```

### 4.3 그룹
```
groups
  id           uuid PK
  name         text
  description  text nullable
  avatar_url   text nullable
  owner_id     uuid → profiles  -- 위임 시 변경
  created_at   timestamptz

group_members
  group_id   uuid → groups
  user_id    uuid → profiles
  role       text CHECK IN ('owner','admin','member')
  joined_at  timestamptz
  PRIMARY KEY (group_id, user_id)
```

### 4.4 약속
```
meetups
  id                            uuid PK
  group_id                      uuid → groups nullable  -- null이면 1회성
  creator_id                    uuid → profiles
  title                         text
  starts_at                     timestamptz
  ends_at                       timestamptz
  place_name                    text
  place_lat                     double precision
  place_lng                     double precision
  place_address                 text nullable
  place_google_id               text nullable
  location_share_minutes_before int default 20
  status                        text CHECK IN ('scheduled','active','ended','cancelled')
  created_at                    timestamptz

meetup_participants
  meetup_id  uuid → meetups
  user_id    uuid → profiles
  status     text default 'going'
  joined_at  timestamptz
  PRIMARY KEY (meetup_id, user_id)

meetup_reminders
  meetup_id      uuid → meetups
  user_id        uuid → profiles
  minutes_before int
  notify_at      timestamptz  -- starts_at - minutes_before, 푸시 발송 후 삭제
  PRIMARY KEY (meetup_id, user_id, minutes_before)
```

### 4.5 채팅
```
chat_rooms
  id          uuid PK
  kind        text CHECK IN ('group','meetup')
  ref_id      uuid                  -- group_id 또는 meetup_id
  archived_at timestamptz nullable
  created_at  timestamptz
  UNIQUE (kind, ref_id)

messages
  id           uuid PK
  room_id      uuid → chat_rooms
  sender_id    uuid → profiles
  kind         text CHECK IN ('text','image','place')
  body         text nullable                    -- text
  image_url    text nullable                    -- image (Supabase Storage)
  place_payload jsonb nullable                  -- {name,lat,lng,google_id,address,url}
  created_at   timestamptz
  edited_at    timestamptz nullable
  deleted_at   timestamptz nullable
```

### 4.6 위치
```
location_pings
  meetup_id    uuid → meetups
  user_id      uuid → profiles
  lat          double precision
  lng          double precision
  accuracy_m   real nullable
  recorded_at  timestamptz
  -- 인덱스: (meetup_id, recorded_at DESC)
  -- pg_cron: 약속 ends_at + 24h 지난 행 DELETE
```

### 4.7 RLS 핵심 정책
- `profiles`: 본인 행 + 같은 그룹·약속의 다른 사용자만 SELECT
- `groups`, `group_members`: 멤버만 SELECT; owner/admin만 멤버 변경; owner만 owner 위임
- `meetups`, `meetup_participants`: 참여자만 SELECT; creator 또는 그룹 owner/admin만 UPDATE
- `chat_rooms`, `messages`: 해당 room의 멤버만 SELECT/INSERT; 본인 메시지만 UPDATE/DELETE(soft)
- `location_pings`: 같은 meetup 참여자만 SELECT; 본인만 INSERT

## 5. Modules

### 5.1 Backend (`MeetPod/backend/app/`)
PickPod와 동일 레이아웃.
```
routers/    auth, profiles, invites, friendships, groups, meetups, reminders, chat
services/   invite_service, group_service, meetup_service, chat_service,
            reminder_service, push_service
utils/      jwt_utils, db (single 헬퍼), supabase_client, invite_code
dependencies/ auth (현재 사용자), permissions (그룹 owner/admin/멤버 체크)
```

라우터는 thin, 비즈니스 로직은 `services/`. 모든 라우트 prefix `/api`.

### 5.2 Mobile (`MeetPod/mobile/src/`)
```
api/         axios 클라이언트 (auth, groups, meetups, invites, chat, reminders, profiles)
lib/         supabase, location_tracker, push_registrar, deep_link
store/       authStore, meetupsStore, chatStore (Zustand)
navigation/  Root → Auth stack | Main tab (Meetups / Groups / Chats / Me)
screens/
  auth/      LoginScreen, OnboardingHandleScreen
  meetups/   MeetupListScreen, MeetupDetailScreen, MeetupCreateScreen, MeetupMapScreen
  groups/    GroupListScreen, GroupDetailScreen, GroupCreateScreen,
             GroupMembersScreen, GroupInviteScreen
  chats/     ChatListScreen, ChatRoomScreen, PlacePickerScreen
  invites/   InviteAcceptScreen
  me/        ProfileScreen, RemindersDefaultScreen
components/  Avatar, MemberPicker, MapPin, MessageBubble, PlaceCard
```

## 6. Key Flows

### 6.1 가입
1. 소셜 로그인 → Supabase Auth가 `auth.users` 생성
2. Backend `/api/auth/bootstrap`이 `profiles` 행 upsert
3. 핸들 미설정 시 `OnboardingHandleScreen`에서 unique handle 입력
4. Expo push token 등록 → `profiles.expo_push_token`

### 6.2 친구 추가
1. A: `POST /api/invites { kind: 'friend' }` → 8자 코드 + 만료 7일
2. A가 링크/QR 공유 → B 앱에서 딥링크 수신 → `InviteAcceptScreen`
3. B: `POST /api/invites/{code}/accept` → `friendships` INSERT, `used_count++`

### 6.3 그룹 약속 생성
1. `MeetupCreateScreen` → 그룹 선택(or 1회성)
2. `MemberPicker`: 그룹 선택 시 전체 멤버 default 체크 → 빼고 싶은 사람 해제
3. `PlacePickerScreen`: Google Place autocomplete → lat/lng/place_id 저장
4. 위치 공유 시작 시각: 기본 20분 전, 변경 가능 (10/20/30/60분)
5. 개인 알림 시각 입력 (선택)
6. `POST /api/meetups` → meetup + meetup_participants + chat_room(`kind='meetup'`) + 본인 reminder 생성

### 6.4 약속 진행 (위치 공유)
1. 모바일이 자체 스케줄러로 `starts_at - location_share_minutes_before` 도달 감지
2. `expo-location` background task 시작 → 10초 간격으로 `location_pings` INSERT (Supabase 직결, RLS 본인만 INSERT)
3. 다른 참여자는 `MeetupMapScreen`에서 Realtime 구독 → 핀 업데이트
4. `ends_at` 도달 → 모바일이 background task 자체 종료 (클라이언트 책임)
5. 백엔드 pg_cron(1분 주기): `status='active'` & `ends_at < now()` 약속을 `'ended'`로 전환하면서 해당 `chat_room.archived_at` 세팅
6. ends_at + 24h 후 `location_pings` 삭제 (pg_cron)

### 6.5 알림
- 약속 생성/수정 시 `meetup_reminders.notify_at` 계산
- Supabase Edge Function이 1분 주기로 `notify_at <= now()` 조회 → Expo Push 발송 → 행 DELETE
- 사유: Vercel cron보다 timezone/지연 안정적, DB 가까움

### 6.6 채팅
- 송신: `POST /api/chat/{room_id}/messages` (이미지·장소 포함). 백엔드는 권한 검증 후 INSERT
- 수신: 모바일이 `messages` 테이블을 room_id 필터로 Realtime 구독
- 이미지: 모바일이 Supabase Storage에 직접 업로드 → 반환된 URL을 메시지로 전송
- 장소: `PlacePickerScreen`에서 선택 → `place_payload` jsonb로 전송, `PlaceCard` 컴포넌트로 렌더

## 7. Infrastructure

- **Supabase 프로젝트**: 신규 생성 (PickPod와 분리)
- **Storage 버킷**: `chat-images` (인증 사용자만 업로드, 본인 메시지의 이미지만 읽기 가능 정책)
- **Backend**: Vercel serverless (`MeetPod/backend/api/index.py`)
- **Mobile**: Expo EAS Build. 백그라운드 위치 권한 사용 사유 문구 준비 (iOS Info.plist, Android manifest)
- **Push**: Expo Notifications (개발은 Expo go, 프로덕션은 EAS build + APNs/FCM)
- **딥링크**: `meetpod://invite/{code}` + Universal Link

### 환경변수 (backend)
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `SUPABASE_JWT_SECRET` — Supabase가 발급한 JWT를 백엔드에서 검증할 때 사용 (별도 자체 JWT 미발급)
- `EXPO_ACCESS_TOKEN` (push 발송)
- `FRONTEND_URL` (딥링크 fallback 웹 페이지)
- `GOOGLE_PLACES_API_KEY` (장소 검색 — 모바일 키와 분리하여 서버 측 검증/프록시 시 사용)

### 환경변수 (mobile)
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

## 8. Testing Strategy

- **Backend**: pytest. 라우터 권한 테스트(=RLS 우회 시도) 필수. 초대 코드 만료/소진, 그룹 권한 위임 케이스.
- **RLS**: Supabase로컬 + pgTAP 또는 직접 SQL 시나리오 테스트로 정책 검증
- **Mobile**: Jest + React Native Testing Library — store 로직 + 핵심 화면. E2E는 MVP에서 제외.
- **수동 검증**: 위치 공유 백그라운드 동작은 실기기 테스트 필수 (시뮬레이터 부정확)

## 9. Open Questions / Risks

- **백그라운드 위치 권한**: iOS "Always Allow" 거부 시 fallback UX 정의 필요 (구현 단계에서 다룰 것)
- **Apple 로그인 서버 검증**: identity token 검증 라이브러리 선정
- **Kakao 로그인**: Supabase가 native Kakao 미지원 → Custom OIDC 또는 Backend가 Kakao 토큰 검증 후 Supabase admin API로 사용자 발급
- **Place Picker 비용**: Google Places API 호출 빈도 모니터링 필요

## 10. Out of Scope (Phase 2 후보)

- RSVP, 반복 일정, 비용 분담
- Yelp 등 추가 장소 소스
- 음성/영상 통화
- 핸들 검색, 연락처 동기화
- 약속 사진 갤러리
- 푸시 알림 채널 세분화 (방해 금지 시간 등)
