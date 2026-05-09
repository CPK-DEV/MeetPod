-- 007_location_pings.sql

CREATE TABLE location_pings (
  id          BIGSERIAL PRIMARY KEY,
  meetup_id   UUID NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lat         DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90  AND 90),
  lng         DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy_m  REAL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX location_pings_meetup_recorded_idx
  ON location_pings (meetup_id, recorded_at DESC);

CREATE INDEX location_pings_user_recorded_idx
  ON location_pings (user_id, recorded_at DESC);