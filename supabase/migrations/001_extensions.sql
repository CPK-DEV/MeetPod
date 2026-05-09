-- 001_extensions.sql
-- MeetPod에서 사용하는 Postgres 확장 활성화

CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_cron;        -- 주기 잡 (location_pings 정리, meetup ended 전환)
CREATE EXTENSION IF NOT EXISTS pg_net;         -- Edge Function HTTP 호출 (push 워커용 예비)
