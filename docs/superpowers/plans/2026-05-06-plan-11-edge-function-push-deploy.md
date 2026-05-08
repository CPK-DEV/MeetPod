# Plan 11 — Edge Function 푸시 워커 + 배포

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Supabase Edge Function `push-worker`를 작성해 `meetup_reminders.notify_at <= now()` 행을 1분 주기로 처리(Expo Push 발송 후 행 DELETE)한다. 그리고 백엔드를 Vercel 프로덕션에 배포하고, 모바일을 Expo EAS로 빌드해 TestFlight/Internal testing 트랙에 올린다.

**Architecture:**
- Edge Function: Deno + supabase-js. 자체 cron이 없으므로 Supabase의 `pg_cron`이 `pg_net`으로 Edge Function URL을 1분마다 POST. (스펙 §6.5 — Edge Function 1분 주기.)
- Push 발송: Expo Push API(`https://exp.host/--/api/v2/push/send`)에 batch 100개 제한. expo-push 토큰만 필터.
- 멱등성: 처리한 reminder는 즉시 DELETE. 동시 실행 방지를 위해 `SELECT ... FOR UPDATE SKIP LOCKED` 패턴.
- 배포:
  - Backend: Vercel CLI `vercel --prod --yes` (`MeetPod/backend/`에서). 환경변수 5개 설정.
  - Mobile: EAS Build (`eas build -p ios|android --profile preview`). app.json에 EAS projectId 입력.

**Tech Stack:** Supabase Edge Functions (Deno), pg_cron + pg_net, Vercel, Expo EAS.

**전제:** Plan 1-10 모두 완료. `meetup_reminders` 테이블 + Plan 1 011 cron 잡. `profiles.expo_push_token` (Plan 10).

---

## File Structure

```
MeetPod/
├── supabase/
│   ├── functions/
│   │   └── push-worker/
│   │       ├── index.ts                     # Deno entry
│   │       └── deno.json
│   └── migrations/
│       └── 012_cron_invoke_push_worker.sql  # pg_cron + pg_net
├── backend/
│   └── (기존 그대로 — 환경변수만 Vercel 콘솔에 추가)
└── mobile/
    └── eas.json                              # EAS build profiles
```

---

## Task 1: Edge Function 작성

**Files:**
- Create: `MeetPod/supabase/functions/push-worker/index.ts`
- Create: `MeetPod/supabase/functions/push-worker/deno.json`

- [ ] **Step 1: deno.json**

Create `MeetPod/supabase/functions/push-worker/deno.json`:
```json
{
  "imports": {
    "supabase": "https://esm.sh/@supabase/supabase-js@2.45.0"
  }
}
```

- [ ] **Step 2: index.ts**

Create `MeetPod/supabase/functions/push-worker/index.ts`:
```ts
// supabase/functions/push-worker/index.ts
import { createClient } from 'supabase';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const CRON_SECRET = Deno.env.get('PUSH_WORKER_SECRET') ?? '';

interface DueRow {
  meetup_id: string;
  user_id: string;
  minutes_before: number;
  notify_at: string;
}

Deno.serve(async (req) => {
  if (CRON_SECRET) {
    const auth = req.headers.get('x-cron-secret') ?? '';
    if (auth !== CRON_SECRET) return new Response('forbidden', { status: 403 });
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // 처리 대상 로드 (최대 200건/분)
  const { data: due, error } = await sb
    .from('meetup_reminders')
    .select('meetup_id, user_id, minutes_before, notify_at')
    .lte('notify_at', new Date().toISOString())
    .limit(200);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  if (!due || due.length === 0) return new Response(JSON.stringify({ sent: 0 }));

  const userIds = [...new Set(due.map((d: DueRow) => d.user_id))];
  const meetupIds = [...new Set(due.map((d: DueRow) => d.meetup_id))];

  const { data: profiles } = await sb
    .from('profiles')
    .select('id, display_name, expo_push_token')
    .in('id', userIds);
  const tokenById: Record<string, string | null> = {};
  for (const p of profiles ?? []) tokenById[p.id] = p.expo_push_token ?? null;

  const { data: meetups } = await sb
    .from('meetups')
    .select('id, title, starts_at')
    .in('id', meetupIds);
  const meetupById: Record<string, { title: string; starts_at: string }> = {};
  for (const m of meetups ?? []) meetupById[m.id] = { title: m.title, starts_at: m.starts_at };

  const messages: any[] = [];
  for (const r of due as DueRow[]) {
    const tok = tokenById[r.user_id];
    if (!tok) continue;
    const m = meetupById[r.meetup_id];
    if (!m) continue;
    messages.push({
      to: tok,
      sound: 'default',
      title: m.title,
      body: `${r.minutes_before}분 후 시작`,
      data: { meetup_id: r.meetup_id },
    });
  }

  // Expo는 100개/배치
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    await fetch(EXPO_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'accept-encoding': 'gzip, deflate' },
      body: JSON.stringify(batch),
    });
  }

  // 처리 완료 행 삭제 (멀티 PK)
  for (const r of due as DueRow[]) {
    await sb.from('meetup_reminders').delete()
      .eq('meetup_id', r.meetup_id).eq('user_id', r.user_id).eq('minutes_before', r.minutes_before);
  }

  return new Response(JSON.stringify({ processed: due.length, sent: messages.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

- [ ] **Step 3: 로컬 함수 serve**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod
supabase start
supabase functions serve push-worker --env-file .\.env.functions.local
```

Create `MeetPod/.env.functions.local` (gitignored):
```
SUPABASE_URL=http://kong:8000
SUPABASE_SERVICE_ROLE_KEY=<from-supabase-start-output>
PUSH_WORKER_SECRET=local-dev-secret
```

별도 창:
```powershell
curl -X POST -H "x-cron-secret: local-dev-secret" http://127.0.0.1:54321/functions/v1/push-worker
```
Expected: `{"sent":0}` (due 행 없음).

- [ ] **Step 4: 더미 reminder 추가 후 재호출**

Studio SQL Editor:
```sql
-- 본인 user_id로 1초 전 notify_at 행 삽입 (테스트용)
INSERT INTO meetup_reminders (meetup_id, user_id, minutes_before, notify_at)
SELECT id, '<my-uuid>', 30, NOW() - INTERVAL '1 second'
FROM meetups LIMIT 1;
```

```powershell
curl -X POST -H "x-cron-secret: local-dev-secret" http://127.0.0.1:54321/functions/v1/push-worker
```
Expected: `{"processed":1,"sent":1}` (또는 토큰 없으면 `sent:0`). 이후 `meetup_reminders` 0행.

- [ ] **Step 5: Commit**

```powershell
git add MeetPod/supabase/functions MeetPod/.env.functions.local.example
git commit -m "feat(supabase): push-worker edge function"
```

(.env.functions.local은 .gitignore에 이미 포함되어 있어야 함 — Plan 1 Task 1 Step 6 참조)

---

## Task 2: Edge Function 배포

- [ ] **Step 1: 배포**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod
supabase functions deploy push-worker --no-verify-jwt
```
Expected: `Deployed function push-worker`.

`--no-verify-jwt`: pg_cron이 호출하므로 사용자 JWT 부재.

- [ ] **Step 2: 함수 시크릿 설정**

Run:
```powershell
supabase secrets set PUSH_WORKER_SECRET=<강한-랜덤-문자열-32자>
```
값을 1Password 등에 저장(다음 Task에서 cron이 같은 값을 사용).

- [ ] **Step 3: 원격 호출 sanity**

```powershell
$SECRET = "<위에서-설정한-값>"
$URL = "https://<ref>.supabase.co/functions/v1/push-worker"
Invoke-RestMethod -Method Post -Uri $URL -Headers @{ "x-cron-secret" = $SECRET }
```
Expected: JSON 응답.

---

## Task 3: pg_cron으로 Edge Function 1분 주기 호출

**Files:**
- Create: `MeetPod/supabase/migrations/012_cron_invoke_push_worker.sql`

- [ ] **Step 1: 마이그레이션**

Create `MeetPod/supabase/migrations/012_cron_invoke_push_worker.sql`:
```sql
-- 012_cron_invoke_push_worker.sql
-- pg_cron이 1분마다 push-worker Edge Function을 POST로 호출.
-- URL과 시크릿은 데이터베이스 GUC로 보관(원격 콘솔에서 한 번 설정).
--   ALTER DATABASE postgres SET app.push_worker_url    = 'https://<ref>.supabase.co/functions/v1/push-worker';
--   ALTER DATABASE postgres SET app.push_worker_secret = '<same-as-edge-secret>';

CREATE OR REPLACE FUNCTION app.invoke_push_worker()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  worker_url    TEXT := current_setting('app.push_worker_url', TRUE);
  worker_secret TEXT := current_setting('app.push_worker_secret', TRUE);
BEGIN
  IF worker_url IS NULL OR worker_url = '' THEN RETURN; END IF;
  PERFORM net.http_post(
    url     := worker_url,
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-cron-secret',  COALESCE(worker_secret, '')
    ),
    body    := '{}'::jsonb
  );
END;
$$;

SELECT cron.schedule(
  'meetpod-invoke-push-worker',
  '* * * * *',
  $$ SELECT app.invoke_push_worker(); $$
);
```

- [ ] **Step 2: 원격 적용 + GUC 설정**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod
supabase db push
```
Expected: `Applying migration 012...` 성공.

Studio SQL Editor에서:
```sql
ALTER DATABASE postgres SET app.push_worker_url    = 'https://<ref>.supabase.co/functions/v1/push-worker';
ALTER DATABASE postgres SET app.push_worker_secret = '<same-secret>';
SELECT pg_reload_conf();
```

- [ ] **Step 3: 1분 후 sanity**

Studio:
```sql
SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
```
Expected: 가장 최근 행이 push-worker URL을 호출하고 200 응답을 받음.

- [ ] **Step 4: Commit**

```powershell
git add MeetPod/supabase/migrations/012_cron_invoke_push_worker.sql
git commit -m "feat(db): pg_cron invokes push-worker every minute via pg_net"
```

---

## Task 4: Backend Vercel 배포

- [ ] **Step 1: Vercel 프로젝트 생성**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\backend
vercel link
```
프롬프트:
- Set up and link? Yes
- Scope: 본인 팀
- Link to existing project? No
- Project name: `meetpod-api`

- [ ] **Step 2: 환경변수 설정**

Run (각각):
```powershell
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_KEY production
vercel env add SUPABASE_JWT_SECRET production
vercel env add FRONTEND_URL production
vercel env add ENV production
```
프롬프트에 값 붙여넣기. preview/development는 동일 값 사용.

- [ ] **Step 3: 배포**

Run:
```powershell
vercel --prod --yes
```
Expected: 배포 URL 출력 (`https://meetpod-api-xxx.vercel.app`).

- [ ] **Step 4: 프로덕션 healthz**

Run:
```powershell
$URL = "https://<배포-도메인>"
Invoke-RestMethod "$URL/api/healthz"
```
Expected: `{ ok: True }`.

- [ ] **Step 5: 모바일 .env에 prod URL 적용**

Edit `MeetPod/mobile/.env` (개발용은 .env.development, EAS는 .env.production 분리):
```
EXPO_PUBLIC_API_BASE_URL=https://<배포-도메인>/api
```

- [ ] **Step 6: Commit (vercel.json 변경 없음 — 빈 commit)**

```powershell
cd d:\Workspace\CPKWorks\MeetPod
git commit --allow-empty -m "chore(deploy): meetpod-api deployed to vercel production"
```

---

## Task 5: Mobile EAS Build

**Files:**
- Create: `MeetPod/mobile/eas.json`

- [ ] **Step 1: EAS CLI 설치 + login**

Run:
```powershell
npm install -g eas-cli
eas login
```

- [ ] **Step 2: 프로젝트 init**

Run:
```powershell
cd d:\Workspace\CPKWorks\MeetPod\mobile
eas init
```
Expected: `app.json`의 `extra.eas.projectId`가 자동 추가됨.

- [ ] **Step 3: eas.json 작성**

Create `MeetPod/mobile/eas.json`:
```json
{
  "cli": { "version": ">= 7.0.0" },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "ios": { "simulator": false },
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://<배포-도메인>/api"
      }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": {},
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://<배포-도메인>/api"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

> `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`는 Expo Secret으로 별도 설정:
> ```powershell
> eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://<ref>.supabase.co"
> eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<anon>"
> eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY --value "<key>"
> ```

- [ ] **Step 4: Android preview 빌드**

Run:
```powershell
eas build -p android --profile preview
```
Expected: EAS 클라우드에서 빌드 → 완료 후 APK 다운로드 URL 출력.

- [ ] **Step 5: iOS preview (Apple developer 계정 필요)**

Run:
```powershell
eas build -p ios --profile preview
```
크리덴셜 자동 생성 동의 → 완료 후 ipa 또는 TestFlight 링크.

- [ ] **Step 6: Commit**

```powershell
cd d:\Workspace\CPKWorks\MeetPod
git add MeetPod/mobile/eas.json MeetPod/mobile/app.json
git commit -m "chore(deploy): eas build profiles + project init"
```

---

## Task 6: end-to-end 시나리오 검증

- [ ] **Step 1: 프로덕션 풀 시나리오**

실기기 2대(iOS+Android 권장)에 EAS preview 빌드 설치:
1. 둘 다 Google 로그인 → 핸들 설정
2. A가 그룹 생성 → B 초대 → B 수락
3. A가 약속 생성(시작 5분 후, share 5분 전 = 즉시 트래킹 시작 조건), B 자동 참여
4. 채팅으로 텍스트/이미지/장소 송수신
5. 위치: 두 디바이스가 서로의 핀을 본다
6. 약속 시작 X분 전 자동 푸시 알림 도착

- [ ] **Step 2: 모니터링 sanity**

Studio:
```sql
SELECT jobname, last_run, last_status FROM cron.job_run_details ORDER BY runid DESC LIMIT 5;
SELECT created, status_code FROM net._http_response ORDER BY created DESC LIMIT 10;
```
모든 cron 잡이 매분 실행, push-worker HTTP 200 일관.

- [ ] **Step 3: 마무리 commit**

```powershell
git commit --allow-empty -m "chore: meetpod mvp end-to-end verified in production"
```

---

## Self-Review Notes

§6.5 Edge Function 1분 주기 푸시 발송 ✓
Vercel/EAS 배포 wiring ✓
pg_cron → pg_net → Edge Function 호출(시크릿 검증) ✓

**제외 / 후속 가능 항목:**
- 푸시 발송 결과 추적 (Expo receipt API). MVP는 발송 후 행 즉시 삭제.
- Edge Function 멀티 인스턴스 동시 실행 — 1분 주기/짧은 처리이므로 사실상 충돌 없음. 필요 시 advisory lock 추가.
- App Store/Play Store submit (`eas submit`) — 내부 테스트 후 별도 진행.

---

## Execution Handoff

1) Subagent-Driven (각 배포 Task는 사람의 콘솔 작업이 끼므로 inline이 더 매끄러울 수 있음)
2) Inline Execution
