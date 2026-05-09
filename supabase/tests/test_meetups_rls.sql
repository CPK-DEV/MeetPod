-- test_meetups_rls.sql
BEGIN;

DO $$
DECLARE
  uid_creator UUID := test.mk_user('cr@test.dev');
  uid_part    UUID := test.mk_user('pt@test.dev');
  uid_out     UUID := test.mk_user('out@test.dev');
  mid UUID;
  cnt INT;
BEGIN
  PERFORM set_config('role', 'postgres', TRUE);
  INSERT INTO meetups (creator_id, title, starts_at, ends_at, place_name, place_lat, place_lng)
  VALUES (uid_creator, 'm', NOW(), NOW() + INTERVAL '1 hour', 'P', 37.5, 127.0)
  RETURNING id INTO mid;
  INSERT INTO meetup_participants (meetup_id, user_id) VALUES
    (mid, uid_creator), (mid, uid_part);

  PERFORM test.set_uid(uid_part);
  SELECT COUNT(*) INTO cnt FROM meetups WHERE id = mid;
  PERFORM test.assert(cnt = 1, 'participant sees meetup');

  PERFORM test.set_uid(uid_out);
  SELECT COUNT(*) INTO cnt FROM meetups WHERE id = mid;
  PERFORM test.assert(cnt = 0, 'outsider cannot see meetup');

  SELECT COUNT(*) INTO cnt FROM meetup_participants WHERE meetup_id = mid;
  PERFORM test.assert(cnt = 0, 'outsider cannot see participants');

  RAISE NOTICE 'TEST PASSED: meetups_rls';
END $$;

ROLLBACK;
