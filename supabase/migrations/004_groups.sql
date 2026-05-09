-- 004_groups.sql

CREATE TABLE groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (LENGTH(name) BETWEEN 1 AND 80),
  description TEXT,
  avatar_url  TEXT,
  owner_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role      TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE INDEX group_members_user_idx ON group_members (user_id);

CREATE UNIQUE INDEX group_members_one_owner_per_group
  ON group_members (group_id)
  WHERE role = 'owner';

ALTER TABLE invites
  ADD CONSTRAINT invites_target_group_fk
  FOREIGN KEY (target_group_id) REFERENCES groups(id) ON DELETE CASCADE;