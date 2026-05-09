-- 003_invites.sql

CREATE TABLE invites (
  code            TEXT PRIMARY KEY,                    -- 8-char URL-safe, 앱 레이어에서 생성
  inviter_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('friend', 'group')),
  target_group_id UUID,                                -- groups 생성 후 FK 추가 (004에서)
  expires_at      TIMESTAMPTZ NOT NULL,
  max_uses        INT  NOT NULL DEFAULT 10 CHECK (max_uses > 0),
  used_count      INT  NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (kind = 'group' AND target_group_id IS NOT NULL) OR
    (kind = 'friend' AND target_group_id IS NULL)
  ),
  CHECK (used_count <= max_uses),
  CHECK (LENGTH(code) BETWEEN 6 AND 16)
);

CREATE INDEX invites_inviter_idx ON invites (inviter_id);
CREATE INDEX invites_target_group_idx ON invites (target_group_id) WHERE target_group_id IS NOT NULL;
