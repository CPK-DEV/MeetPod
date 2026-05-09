-- test_location_pings_rls.sql
BEGIN;

DO $$
DECLARE
  uid_a UUID := test.mk_user('a@test.dev');
  uid_b UUID := test.mk_user('b@test.dev');
  uid_x UUID := test.mk_user('x@test.dev');
  mid UUID; cnt INT;
BEGIN
  PERFORM set_config('role', 'postgres', TRUE);
  INSERT INTO meetups (creator_id, title, starts_at, ends_at, place_name, place_lat, place_lng)
  VALUES (uid_a, 'm', NOW(), NOW() + INTERVAL '1 hour', 'P', 37.5, 127.0)
  RETURNING id INTO mid;
  INSERT INTO meetup_participants (meetup_id, user_id) VALUES (mid, uid_a), (mid, uid_b);

  PERFORM test.set_uid(uid_a);
  INSERT INTO location_pings (meetup_id, user_id, lat, lng) VALUES (mid, uid_a, 37.5, 127.0);

  BEGIN
    INSERT INTO location_pings (meetup_id, user_id, lat, lng) VALUES (mid, uid_b, 37.5, 127.0);
    PERFORM test.assert(FALSE, 'A should NOT insert ping as B');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    NULL;
  END;

  PERFORM test.set_uid(uid_x);
  BEGIN
    INSERT INTO location_pings (meetup_id, user_id, lat, lng) VALUES (mid, uid_x, 37.5, 127.0);
    PERFORM test.assert(FALSE, 'outsider should NOT insert ping');
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  SELECT COUNT(*) INTO cnt FROM location_pings WHERE meetup_id = mid;
  PERFORM test.assert(cnt = 0, 'outsider sees no pings');

  PERFORM test.set_uid(uid_b);
  SELECT COUNT(*) INTO cnt FROM location_pings WHERE meetup_id = mid;
  PERFORM test.assert(cnt = 1, 'co-participant sees pings');

  RAISE NOTICE 'TEST PASSED: location_pings_rls';
END $$;

ROLLBACK;
