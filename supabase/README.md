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
