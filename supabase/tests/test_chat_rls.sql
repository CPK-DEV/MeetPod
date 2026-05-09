-- test_chat_rls.sql
BEGIN;

DO $$
DECLARE
  uid_owner UUID := test.mk_user('o@test.dev');
  uid_mem   UUID := test.mk_user('m@test.dev');
  uid_out   UUID := test.mk_user('x@test.dev');
  gid UUID; rid UUID; cnt INT;
BEGIN
  PERFORM set_config('role', 'postgres', TRUE);
  INSERT INTO groups (name, owner_id) VALUES ('G', uid_owner) RETURNING id INTO gid;
  INSERT INTO group_members (group_id, user_id, role) VALUES
    (gid, uid_owner, 'owner'), (gid, uid_mem, 'member');
  INSERT INTO chat_rooms (kind, ref_id) VALUES ('group', gid) RETURNING id INTO rid;
  INSERT INTO messages (room_id, sender_id, kind, body) VALUES (rid, uid_owner, 'text', 'hi');

  PERFORM test.set_uid(uid_mem);
  SELECT COUNT(*) INTO cnt FROM messages WHERE room_id = rid;
  PERFORM test.assert(cnt = 1, 'member sees message');

  PERFORM test.set_uid(uid_out);
  SELECT COUNT(*) INTO cnt FROM chat_rooms WHERE id = rid;
  PERFORM test.assert(cnt = 0, 'outsider cannot see chat_room');
  SELECT COUNT(*) INTO cnt FROM messages WHERE room_id = rid;
  PERFORM test.assert(cnt = 0, 'outsider cannot see messages');

  PERFORM test.set_uid(uid_owner);
  UPDATE messages SET edited_at = NOW() WHERE room_id = rid;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  PERFORM test.assert(cnt = 1, 'owner can edit own message');

  PERFORM test.set_uid(uid_mem);
  UPDATE messages SET edited_at = NOW() WHERE room_id = rid;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  PERFORM test.assert(cnt = 0, 'member cannot edit others message');

  RAISE NOTICE 'TEST PASSED: chat_rls';
END $$;

ROLLBACK;
