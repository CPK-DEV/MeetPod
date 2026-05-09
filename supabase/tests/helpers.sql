-- helpers.sql
CREATE SCHEMA IF NOT EXISTS test;

CREATE OR REPLACE FUNCTION test.set_uid(u UUID) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', u::text, TRUE);
  PERFORM set_config('role', 'authenticated', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION test.assert(cond BOOLEAN, msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT cond THEN
    RAISE EXCEPTION 'ASSERT FAILED: %', msg;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION test.mk_user(email TEXT) RETURNS UUID
LANGUAGE plpgsql AS $$
DECLARE uid UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (id, email, instance_id, aud, role)
  VALUES (uid, email, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');
  INSERT INTO profiles (id, display_name) VALUES (uid, split_part(email,'@',1));
  RETURN uid;
END;
$$;
