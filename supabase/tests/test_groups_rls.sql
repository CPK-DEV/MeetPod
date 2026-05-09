-- test_groups_rls.sql
BEGIN;

DO $$
DECLARE
  uid_owner UUID := test.mk_user('owner@test.dev');
  uid_mem   UUID := test.mk_user('mem@test.dev');
  uid_out   UUID := test.mk_user('out@test.dev');
  gid UUID;
  cnt INT;
BEGIN
  PERFORM set_config('role', 'postgres', TRUE);
  INSERT INTO groups (name, owner_id) VALUES ('G', uid_owner) RETURNING id INTO gid;
  INSERT INTO group_members (group_id, user_id, role) VALUES
    (gid, uid_owner, 'owner'),
    (gid, uid_mem,   'member');

  PERFORM test.set_uid(uid_owner);
  SELECT COUNT(*) INTO cnt FROM groups WHERE id = gid;
  PERFORM test.assert(cnt = 1, 'owner sees group');

  PERFORM test.set_uid(uid_mem);
  SELECT COUNT(*) INTO cnt FROM groups WHERE id = gid;
  PERFORM test.assert(cnt = 1, 'member sees group');

  PERFORM test.set_uid(uid_out);
  SELECT COUNT(*) INTO cnt FROM groups WHERE id = gid;
  PERFORM test.assert(cnt = 0, 'outsider cannot see group');

  SELECT COUNT(*) INTO cnt FROM group_members WHERE group_id = gid;
  PERFORM test.assert(cnt = 0, 'outsider cannot see members');

  RAISE NOTICE 'TEST PASSED: groups_rls';
END $$;

ROLLBACK;
