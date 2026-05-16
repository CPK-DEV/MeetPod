# MeetPod — Project Notes

친구 간 약속 / 위치 공유 / 채팅 모바일 앱. 자세한 설계는 [docs/superpowers/specs/2026-05-02-meetpod-mvp-design.md](docs/superpowers/specs/2026-05-02-meetpod-mvp-design.md).

## Layout

```
MeetPod/
├── backend/        FastAPI + supabase-py
├── mobile/         Expo SDK 54 + RN + TypeScript
├── supabase/       migrations + RLS tests + push-worker edge function
└── docs/superpowers/{plans,specs}/
```

## Dev workflow

```powershell
# Supabase local stack (Docker required)
cd d:\Workspace\CPKWorks\MeetPod
supabase start
supabase db reset                  # apply all migrations + reset
supabase db push --password "..."  # to remote

# Backend (local dev)
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --port 8000
.\.venv\Scripts\pytest.exe -q

# Mobile
cd mobile
npx expo start --tunnel            # or --clear after .env changes
```

## Git

- **Repository**: https://github.com/CPK-DEV/MeetPod
- **Default branch**: `main`

## Production

- **Backend (Vercel)**: `https://backend-ochre-six-23.vercel.app` (project `backend` on team `austins-projects-be59bdd0`).
- **Supabase project ref**: `pogblwrknxxufckdfwaa`.
- **Edge Function**: `push-worker` invoked every minute by pg_cron via pg_net.

## Conventions

- Backend layout mirrors PickPod/EasyTaxDocs: `app/{routers,services,models,utils,dependencies}`. Routers are thin; logic in `services/`.
- All API routes prefixed `/api`.
- DB access: use `app/utils/db.py::single()` instead of supabase-py's `maybe_single()`.
- RLS test runner: `docker exec supabase_db_MeetPod psql ...` (psql isn't installed locally).

## Gotchas (learned the hard way)

### Supabase auth tokens are ES256, not HS256
Recent Supabase projects sign JWTs with **asymmetric ES256** keys (P-256). The "JWT secret" shown in dashboard (e.g., `9f040d07-...`) is the **key ID (kid)**, not an HMAC secret. Backend's `app/utils/jwt_utils.py` uses `PyJWKClient` to fetch `<url>/auth/v1/.well-known/jwks.json` and verify with the algorithm specified in the token header. HS256 path retained for tests + legacy.

### supabase-py 2.8.x has HTTP/2 disconnect bug
`httpx.RemoteProtocolError: Server disconnected` on writes. Fix: upgrade to **2.30.x+**. Pin in `backend/requirements.txt`.

### React Native: `fetch(file://).blob()` returns empty blob
Uploading images via signed URL + `axios.put(blob)` produces 0-byte objects. Fix: use `await fetch(uri).arrayBuffer()` then upload directly via `supabase.storage.from(BUCKET).upload(key, ab, { contentType })`. The backend's `create_image_upload_url` endpoint is currently unused (kept for future server-validated uploads).

### Expo Go SDK 53+ blocks remote push
`expo-notifications.getExpoPushTokenAsync` fails on Expo Go. Background location is also limited. Production app must use **EAS Build**. For dev testing, use **local notifications** (`Notifications.scheduleNotificationAsync`) — see `mobile/src/lib/local_notifications.ts`.

### Korean input + Places API (New)
PowerShell sends Korean strings as cp949, breaking direct POST tests. Axios in RN handles UTF-8 fine. Always send `regionCode: 'KR'` in body for Korean place search.

### FlatList inside ScrollView crashes
"VirtualizedLists should never be nested." MeetupCreateScreen uses ScrollView, so MemberPicker switched to plain `View + items.map(...)`. Don't put FlatList inside the ScrollView form.

### Stack navigator: passing data back loses screen state
`nav.goBack()` then `nav.navigate(prevName, params)` re-mounts the previous screen, losing local state. **Solution**: use a small zustand store (`placePickStore`) — the source screen reads via `useFocusEffect → consume()` when refocused.

### Zustand selector returning new array literal → infinite loop
```ts
const messages = useChatStore((s) => s.messages[roomId] ?? []);  // BUG: new [] every render
```
Use a stable empty constant: `const EMPTY: T[] = []` outside, then `?? EMPTY`.

### Supabase pg_cron can't ALTER DATABASE
Supabase's `postgres` role is not superuser. `ALTER DATABASE postgres SET app.foo = '...'` fails. Workaround in `migrations/013_*.sql`: hardcode URL/secret in the `app.invoke_push_worker()` function body with `COALESCE(current_setting(..., TRUE), '<hardcoded>')` so GUC takes precedence if ever granted.

### CRLF warnings on Windows
Cosmetic. `git config core.autocrlf true` keeps LF in repo but checks out CRLF locally. The warnings appear on first add — safe to ignore.

## Env files

| Path | Purpose |
|---|---|
| `backend/.env` | local backend dev (Supabase URL, service key, JWT secret) |
| `mobile/.env` | EXPO_PUBLIC_* baked into JS bundle (Supabase anon, API URL, Google Maps key) |
| `.env.supabase` | optional, for the user — not consumed by code |

All `.env*` ignored except `*.example`.

## Open items

- **Migration 013** hardcodes `PUSH_WORKER_SECRET` in plain SQL. Rotate after EAS Build is done and migrate to GUC if Supabase grants ALTER DATABASE permission.
- **Mobile push token** registration goes through `setPushToken(token)` but Expo Go ignores. Real push only works in EAS-built APK/IPA.
- **Apple/Kakao login** stubs are disabled buttons. Production needs Apple identity token verification + Kakao custom OIDC.
