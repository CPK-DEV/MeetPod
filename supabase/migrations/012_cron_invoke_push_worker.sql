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
