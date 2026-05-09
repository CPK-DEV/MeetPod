# RLS Tests

로컬에서만 실행. 모든 테스트는 단일 트랜잭션 내에서 실행되며 끝에 `ROLLBACK`으로 상태를 되돌린다.

## Run all (psql via docker exec)

```powershell
docker cp supabase\tests\helpers.sql supabase_db_MeetPod:/tmp/helpers.sql
docker exec supabase_db_MeetPod psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/helpers.sql

Get-ChildItem supabase\tests\test_*.sql | ForEach-Object {
  Write-Host "==> $($_.Name)"
  docker cp $_.FullName "supabase_db_MeetPod:/tmp/$($_.Name)"
  docker exec supabase_db_MeetPod psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f "/tmp/$($_.Name)"
}
```

성공 시 각 파일이 `TEST PASSED: <name>` NOTICE를 출력. 실패 시 `ASSERT FAILED: ...` ERROR로 즉시 중단.
