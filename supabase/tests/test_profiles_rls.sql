-- test_profiles_rls.sql
BEGIN;

DO $$
DECLARE
  uid_a UUID := test.mk_user('a@test.dev');
  uid_b UUID := test.mk_user('b@test.dev');
  uid_c UUID := test.mk_user('c@test.dev');
  cnt INT;
BEGIN
  PERFORM test.set_uid(uid_a);
  SELECT COUNT(*) INTO cnt FROM profiles WHERE id = uid_b;
  PERFORM test.assert(cnt = 0, 'A should NOT see B without any relation');

  SELECT COUNT(*) INTO cnt FROM profiles WHERE id = uid_a;
  PERFORM test.assert(cnt = 1, 'A should see self');

  PERFORM set_config('role', 'postgres', TRUE);
  INSERT INTO friendships (user_a_id, user_b_id)
  VALUES (LEAST(uid_a, uid_b), GREATEST(uid_a, uid_b));
  PERFORM test.set_uid(uid_a);
  SELECT COUNT(*) INTO cnt FROM profiles WHERE id = uid_b;
  PERFORM test.assert(cnt = 1, 'A should see B after friendship');

  PERFORM test.set_uid(uid_c);
  SELECT COUNT(*) INTO cnt FROM profiles WHERE id = uid_b;
  PERFORM test.assert(cnt = 0, 'C should NOT see B (no relation)');

  RAISE NOTICE 'TEST PASSED: profiles_rls';
END $$;

ROLLBACK;
