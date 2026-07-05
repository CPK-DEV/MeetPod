-- 014_participant_rsvp.sql
-- 참가자가 약속 초대에 수락/거절할 수 있도록 status를 확장.
-- 기존 'going' 단일값 대신 pending(응답 대기) -> going/declined 흐름 지원.

ALTER TABLE meetup_participants DROP CONSTRAINT IF EXISTS meetup_participants_status_check;
ALTER TABLE meetup_participants ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE meetup_participants
  ADD CONSTRAINT meetup_participants_status_check CHECK (status IN ('pending', 'going', 'declined'));
