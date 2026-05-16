-- 013_push_worker_hardcode_config.sql
-- ALTER DATABASE cannot be run by the postgres role on Supabase (no superuser).
-- Replace app.invoke_push_worker() with hardcoded URL + secret so the cron job works.
-- SECRET stored here is the same value stored in Supabase Secrets as PUSH_WORKER_SECRET.

CREATE OR REPLACE FUNCTION app.invoke_push_worker()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  worker_url    TEXT := COALESCE(
                          current_setting('app.push_worker_url', TRUE),
                          'https://pogblwrknxxufckdfwaa.supabase.co/functions/v1/push-worker'
                        );
  worker_secret TEXT := COALESCE(
                          current_setting('app.push_worker_secret', TRUE),
                          'g8sZdADQVj2FIqxLvEk4tWHlMrf67Pwb'
                        );
BEGIN
  PERFORM net.http_post(
    url     := worker_url,
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-cron-secret',  worker_secret
    ),
    body    := '{}'::jsonb
  );
END;
$$;
