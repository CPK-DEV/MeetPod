-- 006_chat.sql

CREATE TABLE chat_rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind        TEXT NOT NULL CHECK (kind IN ('group', 'meetup')),
  ref_id      UUID NOT NULL,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, ref_id)
);

CREATE TABLE messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  kind          TEXT NOT NULL CHECK (kind IN ('text', 'image', 'place')),
  body          TEXT,
  image_url     TEXT,
  place_payload JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at     TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  CHECK (
    (kind = 'text'  AND body IS NOT NULL AND image_url IS NULL AND place_payload IS NULL) OR
    (kind = 'image' AND image_url IS NOT NULL AND body IS NULL AND place_payload IS NULL) OR
    (kind = 'place' AND place_payload IS NOT NULL AND body IS NULL AND image_url IS NULL)
  )
);

CREATE INDEX messages_room_created_idx ON messages (room_id, created_at DESC);