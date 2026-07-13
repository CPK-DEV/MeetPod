# MeetPod — System Design

**Date:** 2026-05-03
**Status:** Initial (MVP)
**Companion docs:**
- [브랜드 스펙](./superpowers/specs/2026-05-02-meetpod-mvp-design.md)
- [테이블 스펙](./table_specification.md)
- [화면 설계 PPT](./MeetPod_화면설계.pptx)

---

## 1. 아키텍처 개요

### 1.1 컴포넌트 다이어그램

```
                           ┌──────────────────────────┐
                           │     Mobile (Expo RN)      │
                           │  ┌──────────────────────┐ │
                           │  │ UI / Screens         │ │
                           │  │ Navigation (RN Nav)  │ │
                           │  │ Zustand stores       │ │
                           │  └─────────┬────────────┘ │
                           │   ┌────────▼────────┐     │
                           │   │ api/ (axios)    │     │
                           │   │ lib/supabase    │     │
                           │   │ lib/location    │     │
                           │   │ lib/push        │     │
                           │   │ lib/deep_link   │     │
                           │   └────┬───┬────────┘     │
                           └───────┼───┼───────────────┘
                                   │   │
                          HTTPS    │   │ WS / HTTPS / OAuth
                                   │   │
                  ┌────────────────▼┐  │
                  │  Backend         │  │
                  │  (FastAPI on     │  │
                  │   Vercel SLS)    │  │
                  │  ┌────────────┐  │  │
                  │  │ routers/   │  │  │
                  │  │ services/  │  │  │
                  │  │ deps/auth  │  │  │
                  │  │ utils/db   │  │  │
                  │  └─────┬──────┘  │  │
                  │        │ supabase-py    │
                  └────────┼─────────┘  │
                           │            │
                  ┌────────▼────────────▼─────────┐
                  │     Supabase Cloud            │
                  │  ┌─────────┐ ┌─────────────┐  │
                  │  │  Auth   │ │  Postgres   │  │
                  │  │ (OAuth) │ │  + RLS      │  │
                  │  └─────────┘ └──────┬──────┘  │
                  │  ┌─────────┐ ┌──────▼──────┐  │
                  │  │ Storage │ │  Realtime   │  │
                  │  └─────────┘ └─────────────┘  │
                  │  ┌──────────────────────────┐ │
                  │  │ pg_cron + Edge Functions │ │
                  │  └──────────┬───────────────┘ │
                  └─────────────┼─────────────────┘
                                │
                       ┌────────▼────────┐
                       │ Expo Push API   │
                       └─────────────────┘
```

### 1.2 트래픽 라우팅 원칙

| 동작 | 경로 | 이유 |
|------|------|------|
| 회원가입/로그인 | Mobile ↔ Supabase Auth | OAuth는 Supabase가 직접 처리 |
| profile 부트스트랩 | Mobile → FastAPI | handle 충돌 검증, 트랜잭션 |
| 그룹/약속 CRUD | Mobile → FastAPI | 권한 검증, 멤버 default 채움, chat_room/reminder 생성 묶음 트랜잭션 |
| 초대 코드 발급/소비 | Mobile → FastAPI | 코드 충돌·만료·max_uses 원자성 |
| 채팅 송신 | Mobile → FastAPI | 권한, archived 체크, 메시지 INSERT 직후 FastAPI가 동기로 Expo Push 발송 |
| 채팅 수신 | Mobile ← Supabase Realtime | WS 직결 (FastAPI 우회) |
| 위치 핑 송신 | Mobile → Supabase 직접 INSERT | 짧은 주기 (10s), latency 민감 |
| 위치 핑 수신 | Mobile ← Supabase Realtime | 동일 |
| 약속 초대 푸시 | FastAPI → Expo Push | 약속 생성/멤버 추가 직후 FastAPI가 동기 호출 (Edge Function 아님) |
| 약속 리마인더 푸시 | pg_cron → Edge Function(`push-worker`) → Expo Push | 매분 폴링, `meetup_reminders` 큐 발송 후 DELETE |
| 이미지 업로드 | Mobile → Supabase Storage | 직접 (signed URL 또는 RLS) |

### 1.3 인증 흐름

- Mobile: Supabase JS SDK로 OAuth (Google/Apple/Kakao)
- Supabase가 JWT 발급 (`access_token` + `refresh_token`)
- Mobile → FastAPI 호출 시 `Authorization: Bearer <access_token>`
- FastAPI는 `SUPABASE_JWT_SECRET`로 서명 검증, `sub` 클레임에서 user_id 추출
- FastAPI는 자체 JWT 발급 X (Supabase가 단일 진실 공급원)

**Kakao 예외:**
Supabase가 Kakao OIDC를 native로 지원하지 않을 수 있음. 두 가지 전략:
1. Custom OIDC provider 등록 (Supabase Dashboard)
2. Mobile이 Kakao SDK로 토큰 받기 → FastAPI가 검증 → Supabase Admin API로 user 발급/조회 → 자체 access_token 반환 (예외적 자체 JWT)

MVP는 (1) 시도, 실패 시 (2) fallback.

---

## 2. 시퀀스 다이어그램

### 2.1 그룹 약속 생성

```
사용자       Mobile         FastAPI         Postgres        Supabase Realtime
  │           │               │                │                  │
  │ "+ 새 약속"│               │                │                  │
  ├──────────►│               │                │                  │
  │           │ MeetupCreate  │                │                  │
  │           │ 화면 진입      │                │                  │
  │           │               │                │                  │
  │ 그룹 선택   │               │                │                  │
  ├──────────►│               │                │                  │
  │           │ GET /api/groups/{id}/members   │                  │
  │           ├──────────────►│                │                  │
  │           │               │ SELECT (RLS)   │                  │
  │           │               ├───────────────►│                  │
  │           │◄──────────────┤◄───────────────┤                  │
  │           │ 멤버 default 체크│                │                  │
  │           │               │                │                  │
  │ 장소 선택   │               │                │                  │
  ├──────────►│ PlacePicker→Google Places API  │                  │
  │           │                                │                  │
  │ 저장      │                                │                  │
  ├──────────►│ POST /api/meetups              │                  │
  │           ├──────────────►│                │                  │
  │           │               │ BEGIN          │                  │
  │           │               ├───────────────►│                  │
  │           │               │ INSERT meetups │                  │
  │           │               │ → trigger:     │                  │
  │           │               │   INSERT meetup_participants      │
  │           │               │   INSERT chat_rooms               │
  │           │               │   INSERT meetup_reminders         │
  │           │               │ INSERT participants for selected  │
  │           │               │ COMMIT         │                  │
  │           │               │◄───────────────┤                  │
  │           │◄──────────────┤ 201 + meetup   │                  │
  │           │               │                │ NOTIFY (insert)  │
  │           │               │                ├─────────────────►│
  │           │ 푸시 발송 큐 등록 │                │                  │
  │           │               │ Edge Fn polls reminders          │
  │           │ 약속 상세 화면  │                │                  │
  │◄──────────┤               │                │                  │
```

### 2.2 위치 공유 (백그라운드 시작)

```
Mobile (백그라운드)        Supabase           다른 멤버 Mobile
   │                         │                    │
   │ Local timer fires       │                    │
   │ (starts_at -            │                    │
   │  share_minutes_before)  │                    │
   │                         │                    │
   │ Start expo-location     │                    │
   │ background task         │                    │
   │                         │                    │
   │ every 10s ─────────────►│ INSERT location_pings
   │ (RLS: own user_id only) │ (RLS check)        │
   │                         │ Realtime publish   │
   │                         ├───────────────────►│ (구독 중)
   │                         │                    │ 지도 핀 업데이트
   │                         │                    │
   │ ... ends_at 도달 ...     │                    │
   │ Stop background task    │                    │
   │                         │                    │
   │                         │ pg_cron tick:      │
   │                         │ UPDATE meetups      │
   │                         │   SET status='ended'│
   │                         │ UPDATE chat_rooms   │
   │                         │   SET archived_at   │
```

### 2.3 채팅 메시지 (텍스트 + 장소)

```
사용자       Mobile           FastAPI       Postgres        Realtime    다른 멤버
  │           │                 │             │              │           │
  │ "장소 보냄" │                 │             │              │           │
  ├──────────►│ PlacePicker     │             │              │           │
  │           │ → place 선택     │             │              │           │
  │           │ POST /api/chat/{room_id}/messages            │           │
  │           ├────────────────►│             │              │           │
  │           │                 │ 권한 체크    │              │           │
  │           │                 │ archived 체크│              │           │
  │           │                 │ INSERT messages            │           │
  │           │                 ├────────────►│              │           │
  │           │                 │             │ NOTIFY ─────►│           │
  │           │                 │◄────────────┤              ├──────────►│
  │           │◄────────────────┤ 201        │              │           │ 메시지 수신
  │           │ 본인 화면에 즉시 │             │              │           │ + 푸시 알림
  │           │ optimistic add  │             │              │           │
```

### 2.4 초대 수락 (그룹)

```
사용자        Mobile          FastAPI       Postgres
  │            │                │              │
  │ deep link  │                │              │
  ├───────────►│ /invite/abc123 │              │
  │            │ InviteAccept   │              │
  │            │ GET /api/invites/abc123       │
  │            ├───────────────►│              │
  │            │                │ SELECT       │
  │            │                ├─────────────►│
  │            │                │ 만료/소진/취소│
  │            │                │ 체크         │
  │            │◄───────────────┤ 200 + 메타   │
  │            │                │              │
  │ "수락"      │                │              │
  ├───────────►│ POST /api/invites/abc123/accept              │
  │            ├───────────────►│              │
  │            │                │ BEGIN        │
  │            │                ├─────────────►│
  │            │                │ SELECT FOR UPDATE invites    │
  │            │                │ INSERT group_members 또는    │
  │            │                │   friendships                │
  │            │                │ UPDATE invites SET used_count++│
  │            │                │ COMMIT       │
  │            │◄───────────────┤ 200          │
  │            │ GroupDetail로  │              │
  │◄───────────┤ 이동           │              │
```

---

## 3. 상태 전이 (약속)

```
            ┌──────────────────────────────────────────┐
            │                                          │
            ▼                                          │
       ┌─────────┐  starts_at <= now() ────►  ┌─────────┐
       │scheduled│ (pg_cron tick_meetup_status) │ active │
       └────┬────┘                              └───┬────┘
            │                                       │
            │ creator/admin                         │ ends_at <= now()
            │ "취소"                                │ (pg_cron)
            │                                       │
            ▼                                       ▼
       ┌─────────┐                              ┌─────────┐
       │cancelled│                              │  ended  │
       └─────────┘                              └─────────┘
```

부수 효과:
- `scheduled → active`: 별도 작업 없음 (모바일이 자체 트리거)
- `active → ended`: 해당 chat_room.archived_at = now()
- `* → cancelled`: chat_room.archived_at = now() + 참여자 푸시

---

## 4. 모듈 / 디렉토리 (백엔드)

```
MeetPod/backend/
├── api/index.py                # Vercel entry (FastAPI app)
├── app/
│   ├── main.py                 # FastAPI app + CORS + router include
│   ├── config.py               # env 변수 로딩
│   ├── routers/
│   │   ├── auth.py             # POST /api/auth/bootstrap, PATCH /api/auth/handle
│   │   ├── profiles.py         # GET/PATCH /api/profiles/me
│   │   ├── friendships.py      # GET /api/friends, DELETE /api/friends/{id}
│   │   ├── invites.py          # POST /api/invites, GET /api/invites/{code},
│   │   │                       # POST /api/invites/{code}/accept, DELETE
│   │   ├── groups.py           # GET/POST/PATCH/DELETE /api/groups[/{id}]
│   │   │                       # GET /api/groups/{id}/members
│   │   │                       # POST /api/groups/{id}/transfer-owner
│   │   │                       # PATCH /api/groups/{id}/members/{uid}/role
│   │   │                       # DELETE /api/groups/{id}/members/{uid}
│   │   ├── meetups.py          # GET/POST/PATCH/DELETE /api/meetups[/{id}]
│   │   │                       # POST /api/meetups/{id}/cancel
│   │   │                       # POST /api/meetups/{id}/participants (add/remove)
│   │   │                       # PATCH /api/meetups/{id}/share-location (본인 토글)
│   │   ├── reminders.py        # PUT /api/meetups/{id}/reminders/me
│   │   └── chat.py             # POST /api/chat/{room_id}/messages
│   │                           # PATCH /api/chat/messages/{id}
│   │                           # DELETE /api/chat/messages/{id}
│   ├── services/
│   │   ├── invite_service.py   # 코드 생성, 만료/소진 검증, accept 트랜잭션
│   │   ├── group_service.py    # 권한 체크 (owner/admin), 위임
│   │   ├── meetup_service.py   # 멤버 default, place 검증, RLS-bypass 트랜잭션
│   │   ├── chat_service.py     # 메시지 INSERT + push fanout 큐
│   │   ├── reminder_service.py # notify_at 재계산
│   │   ├── push_service.py     # Expo Push 발송 (Edge Function이 호출)
│   │   └── place_service.py    # Google Places 검증 (선택)
│   ├── dependencies/
│   │   ├── auth.py             # Bearer JWT → user_id (jose)
│   │   └── permissions.py      # require_group_owner_or_admin 등 데코
│   ├── utils/
│   │   ├── jwt_utils.py        # Supabase JWT 검증
│   │   ├── supabase_client.py  # service_role 클라이언트 싱글톤
│   │   ├── db.py               # single() 헬퍼 (PickPod 패턴)
│   │   └── invite_code.py      # Crockford base32 8자 생성
│   └── models/                 # Pydantic 스키마 (Request/Response)
│       ├── auth.py, profile.py, group.py, meetup.py, chat.py, invite.py
└── tests/
    ├── test_invites.py, test_groups.py, test_meetups.py,
    └── test_rls_*.sql          # Supabase RLS 시나리오 검증
```

---

## 5. 모듈 / 디렉토리 (모바일)

```
MeetPod/mobile/
├── App.tsx
├── app.json                    # Expo config (background location, deep link scheme)
├── src/
│   ├── api/                    # axios 클라이언트
│   │   ├── client.ts           # baseURL, JWT 인터셉터, 401 → re-login
│   │   ├── auth.ts, profiles.ts, groups.ts, meetups.ts,
│   │   ├── invites.ts, chat.ts, reminders.ts
│   ├── lib/
│   │   ├── supabase.ts         # Supabase JS SDK 싱글톤
│   │   ├── location_tracker.ts # expo-location TaskManager 등록
│   │   ├── push_registrar.ts   # Expo Push token 등록 → backend
│   │   ├── deep_link.ts        # Linking 설정
│   │   └── time.ts             # day.js 래퍼
│   ├── store/                  # Zustand
│   │   ├── auth_store.ts       # session, profile
│   │   ├── meetups_store.ts    # 약속 목록 캐시
│   │   ├── chat_store.ts       # room별 메시지 캐시 + Realtime 구독 lifecycle
│   │   └── friends_store.ts
│   ├── navigation/
│   │   ├── root.tsx            # Auth or MainTab 분기
│   │   ├── auth_stack.tsx
│   │   └── main_tab.tsx        # Meetups/Groups/Chats/Me
│   ├── screens/
│   │   ├── auth/{Login,OnboardingHandle,InviteAccept}Screen.tsx
│   │   ├── meetups/{List,Detail,Create,Map}Screen.tsx
│   │   ├── groups/{List,Detail,Create,Members,Invite}Screen.tsx
│   │   ├── chats/{List,Room,PlacePicker}Screen.tsx
│   │   └── me/{Profile,RemindersDefault}Screen.tsx
│   ├── components/             # 재사용 (Avatar, Pill, MemberPicker, MapPin,
│   │                           #         MessageBubble, PlaceCard, FAB, ...)
│   └── theme/                  # design tokens (PPT의 Design System 동기화)
└── assets/
```

---

## 6. API 인터페이스 요약

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/api/auth/bootstrap` | Supabase 로그인 후 profile 행 보장 | self |
| PATCH | `/api/auth/handle` | 핸들 1회 설정/검증 | self |
| GET | `/api/profiles/me` | 내 프로필 | self |
| PATCH | `/api/profiles/me` | display_name/avatar/push_token 등 | self |
| GET | `/api/friends` | 친구 목록 | self |
| DELETE | `/api/friends/{user_id}` | 친구 끊기 | self |
| POST | `/api/invites` | 친구/그룹 초대 코드 발급 | self / group admin |
| GET | `/api/invites/{code}` | 코드 메타 (만료 등) | anonymous OK |
| POST | `/api/invites/{code}/accept` | 수락 | self |
| DELETE | `/api/invites/{code}` | 발급자 취소 | inviter |
| GET | `/api/groups` | 내 그룹 목록 | self |
| POST | `/api/groups` | 그룹 생성 | self |
| GET | `/api/groups/{id}` | 그룹 상세 | member |
| PATCH | `/api/groups/{id}` | 그룹 정보 수정 | owner/admin |
| DELETE | `/api/groups/{id}` | 그룹 해체 | owner |
| GET | `/api/groups/{id}/members` | 멤버 목록 | member |
| PATCH | `/api/groups/{id}/members/{uid}/role` | admin↔member | owner |
| DELETE | `/api/groups/{id}/members/{uid}` | 추방 | owner/admin |
| POST | `/api/groups/{id}/leave` | 본인 탈퇴 | self (not last owner) |
| POST | `/api/groups/{id}/transfer-owner` | owner 위임 | owner |
| GET | `/api/meetups` | 내 약속 (다가오는/오늘/지난) | self |
| POST | `/api/meetups` | 약속 생성 | self |
| GET | `/api/meetups/{id}` | 약속 상세 + 참여자 | participant |
| PATCH | `/api/meetups/{id}` | 정보 수정 | creator/group admin |
| POST | `/api/meetups/{id}/cancel` | 취소 | creator/group admin |
| GET | `/api/meetups/{id}/participants` | 참여자 목록 (이름/닉네임 포함) | participant |
| POST | `/api/meetups/{id}/participants` | 멤버 추가 (초대 푸시 발송) | creator/group admin |
| DELETE | `/api/meetups/{id}/participants/me` | 본인 탈퇴 | self |
| POST | `/api/meetups/{id}/rsvp` | 초대 응답 (`going`/`declined`) — 참여자는 `pending`으로 시작 | participant |
| PATCH | `/api/meetups/{id}/share-location` | 본인 위치공유 토글 | self |
| PUT | `/api/meetups/{id}/reminders/me` | 본인 알림 시각 | self |
| POST | `/api/chat/{room_id}/messages` | 메시지 전송 (text/image/place) | room member |
| PATCH | `/api/chat/messages/{id}` | 본인 메시지 편집 | sender |
| DELETE | `/api/chat/messages/{id}` | 본인 메시지 soft delete | sender |

표준 에러 응답:
```json
{ "error": { "code": "GROUP_NOT_FOUND", "message": "..." } }
```

---

## 7. 주요 비즈니스 규칙

| 규칙 | 강제 위치 |
|------|----------|
| 핸들 unique + 정규식 | DB UNIQUE + CHECK + API 검증 |
| 그룹은 owner 1명 필수 | trigger (마지막 owner 탈퇴 차단) |
| 1회성 약속은 그룹 없음 | meetups.group_id NULL 허용, API에서 조건부 분기 |
| 약속 종료는 ends_at + pg_cron | 트리거가 아니라 cron — 클라이언트가 시간 조작해도 영향 X |
| 위치 핑은 active 상태에서만 | RLS + meetups.status 체크 |
| 채팅은 archived 후도 송수신 가능 | API의 archived 체크 제거 (시나리오 11) |
| 푸시 중복 방지 | reminder 행 자체가 큐 → 발송 후 DELETE (idempotent by row 존재) |
| 초대 코드 충돌 방지 | DB UNIQUE + INSERT 충돌 시 재생성 (8자 base32 = 약 10억 공간) |

---

## 8. 비기능 요구사항

| 영역 | 목표 | 비고 |
|------|------|------|
| **응답 시간** | p95 API 300ms (Vercel cold 제외) | 단순 SELECT는 모바일 직결로 우회 |
| **위치 핑 latency** | end-to-end 2초 이내 | Supabase Realtime |
| **푸시 정확도** | reminder dispatch ±1분 | pg_cron 1분 주기 |
| **동시 접속** | MVP 1000명 | Supabase Free/Pro 충분 |
| **가용성** | 99.5% | Vercel + Supabase SLA |
| **데이터 보존** | location_pings: 24h, messages: 무기한, profiles: 사용자 탈퇴 시 즉시 익명화 |

---

## 9. 보안

| 위협 | 대응 |
|------|------|
| 타 사용자 위치 노출 | RLS (같은 meetup 참여자만 SELECT) + share_location 본인 토글 |
| 초대 코드 brute force | 8자 base32 (10억 공간) + invite 조회 rate limit (Vercel + Supabase) |
| JWT 탈취 | Refresh token rotation (Supabase 기본), 클라이언트 secure storage |
| RLS 우회 (service_role 키 노출) | 키는 backend env만, 클라이언트는 anon key만 |
| 채팅 첨부 악용 | Storage 정책 + 이미지 크기/타입 검증 (백엔드 또는 모바일 사전 압축) |
| 푸시 스팸 | 본인 알림은 사용자 설정, 변경/취소 알림은 약속당 최대 N회 (rate guard) |
| 핸들 squatting | 14일 미사용 시 회수 정책은 Phase 2 (지금은 영구) |

---

## 10. 관측 (Observability)

| 종류 | 방법 |
|------|------|
| Backend 로그 | Vercel logs (request/response, error) |
| DB 쿼리 모니터 | Supabase Studio 내장 |
| Realtime 연결 수 | Supabase Dashboard |
| 푸시 발송 성공률 | Edge Function 로그 + push_outbox 결과 컬럼 (Phase 2) |
| 위치 핑 INSERT 율 | Supabase 메트릭 (저장 비용 가시화) |
| 모바일 크래시 | Sentry (Expo SDK 통합) |
| 사용자 분석 | PostHog 또는 Amplitude (Phase 2) |

---

## 11. 배포 / 환경

### 11.1 환경 분리

| 환경 | Supabase 프로젝트 | Backend | Mobile |
|------|------------------|---------|--------|
| dev | `meetpod-dev` | local uvicorn | Expo Go |
| staging | `meetpod-staging` | Vercel Preview | EAS internal channel |
| prod | `meetpod-prod` | Vercel Production | EAS production |

### 11.2 환경 변수

**Backend (Vercel)**
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`
- `EXPO_ACCESS_TOKEN` (push)
- `FRONTEND_URL` (딥링크 fallback 웹 페이지)
- `GOOGLE_PLACES_API_KEY` (서버 검증용)

**Mobile (`.env` + EAS Secrets)**
- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

### 11.3 배포 명령

```bash
# Backend
cd MeetPod/backend && vercel --prod

# Mobile
cd MeetPod/mobile && eas build --profile production --platform all
eas submit -p ios   # TestFlight / App Store
eas submit -p android
```

---

## 12. 테스트 전략

| 레벨 | 도구 | 범위 |
|------|------|------|
| 단위 | pytest (backend) | service 함수, 유효성 검증 |
| RLS | pgTAP 또는 SQL 시나리오 | 권한 우회 시도, 정책 정합성 |
| 통합 | pytest + Supabase local | 라우터 ↔ DB ↔ RLS 연동 |
| 모바일 단위 | Jest + RNTL | store, util, 작은 컴포넌트 |
| 수동 E2E | TestFlight / EAS internal | 백그라운드 위치 (시뮬레이터 부정확) |
| 부하 | Locust | 채팅 fan-out, 위치 핑 INSERT |

---

## 13. 위험 요소 (Top 5)

| # | 위험 | 영향 | 대응 |
|---|------|------|------|
| 1 | iOS 백그라운드 위치 권한 거부 | 위치공유 동작 안 함 | OS 설정 가이드 + 포그라운드 fallback |
| 2 | Kakao 로그인 Supabase 비호환 | 가입 마찰 | Custom OIDC 또는 백엔드 검증 fallback |
| 3 | Google Places API 비용 폭증 | 운영비 | 디바운스, 캐싱, 일일 한도 알림 |
| 4 | 위치 핑 INSERT 양 폭증 | DB I/O | 인덱스, TTL 단축, 핑 주기 증가 옵션 |
| 5 | 푸시 알림 과다 → 사용자 이탈 | 리텐션 | 사용자별 채널 토글, 빈도 가이드 |

---

## 14. Open Questions

- 약속 기본 길이는 입력 단순화를 위해 자동 추정할까? (시작 + 2시간 등)
- "친구 차단" 기능은 MVP인가 Phase 2인가?
- 그룹/약속 검색 인덱싱 (PG full text vs 별도 인덱스)
- 위치공유 시 BLE/WiFi 최적화 사용 여부 (배터리 vs 정확도)
- 백엔드의 Vercel cold start가 사용자에게 보일 수준이면 Fly.io로 이전 검토

---

## 15. 변경 이력

| 일자 | 내용 |
|------|------|
| 2026-05-03 | 최초 작성 (MVP) |
| 2026-07-12 | 채팅 메시지·약속 초대 푸시를 FastAPI가 메시지/참여자 INSERT 직후 동기 호출로 구현 (Edge Function/큐 방식 아님). 리마인더 푸시만 기존 설계대로 pg_cron + `push-worker`. 약속 RSVP(`pending`/`going`/`declined`) 및 `/api/meetups/{id}/rsvp` 추가 |
