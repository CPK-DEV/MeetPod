-- 005_meetups.sql

CREATE TABLE meetups (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id                      UUID REFERENCES groups(id) ON DELETE CASCADE,
  creator_id                    UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  title                         TEXT NOT NULL CHECK (LENGTH(title) BETWEEN 1 AND 120),
  starts_at                     TIMESTAMPTZ NOT NULL,
  ends_at                       TIMESTAMPTZ NOT NULL,
  place_name                    TEXT NOT NULL,
  place_lat                     DOUBLE PRECISION NOT NULL,
  place_lng                     DOUBLE PRECISION NOT NULL,
  place_address                 TEXT,
  place_google_id               TEXT,
  location_share_minutes_before INT NOT NULL DEFAULT 20
                                  CHECK (location_share_minutes_before IN (10, 20, 30, 60)),
  status                        TEXT NOT NULL DEFAULT 'scheduled'
                                  CHECK (status IN ('scheduled','active','ended','cancelled')),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  CHECK (place_lat BETWEEN -90  AND 90),
  CHECK (place_lng BETWEEN -180 AND 180)
);

CREATE INDEX meetups_group_starts_idx ON meetups (group_id, starts_at) WHERE group_id IS NOT NULL;
CREATE INDEX meetups_status_ends_idx  ON meetups (status, ends_at);

CREATE TABLE meetup_participants (
  meetup_id UUID NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status    TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (meetup_id, user_id)
);

CREATE INDEX meetup_participants_user_idx ON meetup_participants (user_id);

CREATE TABLE meetup_reminders (
  meetup_id      UUID NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  minutes_before INT  NOT NULL CHECK (minutes_before > 0),
  notify_at      TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (meetup_id, user_id, minutes_before)
);

CREATE INDEX meetup_reminders_due_idx ON meetup_reminders (notify_at);