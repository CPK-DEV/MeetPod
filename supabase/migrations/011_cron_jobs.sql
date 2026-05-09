-- 011_cron_jobs.sql

CREATE OR REPLACE FUNCTION app.tick_meetup_status()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE meetups
     SET status = 'active'
   WHERE status = 'scheduled'
     AND starts_at <= NOW()
     AND ends_at   >  NOW();

  WITH ended AS (
    UPDATE meetups
       SET status = 'ended'
     WHERE status IN ('scheduled','active')
       AND ends_at <= NOW()
     RETURNING id
  )
  UPDATE chat_rooms r
     SET archived_at = NOW()
   FROM ended e
   WHERE r.kind = 'meetup' AND r.ref_id = e.id AND r.archived_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION app.purge_old_location_pings()
RETURNS VOID LANGUAGE SQL SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM location_pings p
  USING meetups m
  WHERE p.meetup_id = m.id
    AND m.ends_at < NOW() - INTERVAL '24 hours';
$$;

SELECT cron.schedule(
  'meetpod-tick-meetup-status',
  '* * * * *',
  $$ SELECT app.tick_meetup_status(); $$
);

SELECT cron.schedule(
  'meetpod-purge-location-pings',
  '17 * * * *',
  $$ SELECT app.purge_old_location_pings(); $$
);