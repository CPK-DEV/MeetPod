-- 002_profiles_friendships.sql

CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle          TEXT UNIQUE,
  display_name    TEXT NOT NULL,
  avatar_url      TEXT,
  expo_push_token TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- handle: 영문/숫자/_, 3~20자. 가입 직후 1회 설정이므로 NULL 허용 후 partial unique
CREATE UNIQUE INDEX profiles_handle_lower_idx
  ON profiles (LOWER(handle))
  WHERE handle IS NOT NULL;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_handle_format_chk
  CHECK (handle IS NULL OR handle ~ '^[A-Za-z0-9_]{3,20}$');

CREATE TABLE friendships (
  user_a_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)
);

CREATE INDEX friendships_user_b_idx ON friendships (user_b_id);
