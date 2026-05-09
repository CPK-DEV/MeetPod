-- 009_rls_policies.sql

ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships         ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites             ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetups             ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetup_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetup_reminders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_rooms          ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_pings      ENABLE ROW LEVEL SECURITY;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.is_group_member(g UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM group_members WHERE group_id = g AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION app.is_group_admin(g UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM group_members
                 WHERE group_id = g AND user_id = auth.uid() AND role IN ('owner','admin'));
$$;

CREATE OR REPLACE FUNCTION app.is_meetup_participant(m UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM meetup_participants WHERE meetup_id = m AND user_id = auth.uid());
$$;

GRANT USAGE ON SCHEMA app TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO authenticated;

CREATE POLICY profiles_select_self_or_co_member ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM group_members me
      JOIN group_members other ON other.group_id = me.group_id
      WHERE me.user_id = auth.uid() AND other.user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM meetup_participants me
      JOIN meetup_participants other ON other.meetup_id = me.meetup_id
      WHERE me.user_id = auth.uid() AND other.user_id = profiles.id
    )
    OR EXISTS (
      SELECT 1 FROM friendships
      WHERE (user_a_id = auth.uid() AND user_b_id = profiles.id)
         OR (user_b_id = auth.uid() AND user_a_id = profiles.id)
    )
  );

CREATE POLICY profiles_update_self ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY friendships_select_self ON friendships
  FOR SELECT TO authenticated
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

CREATE POLICY invites_select_inviter ON invites
  FOR SELECT TO authenticated
  USING (inviter_id = auth.uid());

CREATE POLICY groups_select_member ON groups
  FOR SELECT TO authenticated
  USING (app.is_group_member(id));

CREATE POLICY group_members_select_co_member ON group_members
  FOR SELECT TO authenticated
  USING (app.is_group_member(group_id));

CREATE POLICY meetups_select_participant ON meetups
  FOR SELECT TO authenticated
  USING (app.is_meetup_participant(id));

CREATE POLICY meetup_participants_select_co_participant ON meetup_participants
  FOR SELECT TO authenticated
  USING (app.is_meetup_participant(meetup_id));

CREATE POLICY meetup_reminders_select_self ON meetup_reminders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY meetup_reminders_modify_self ON meetup_reminders
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY chat_rooms_select_member ON chat_rooms
  FOR SELECT TO authenticated
  USING (
    (kind = 'group'  AND app.is_group_member(ref_id))
    OR
    (kind = 'meetup' AND app.is_meetup_participant(ref_id))
  );

CREATE POLICY messages_select_room_member ON messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_rooms r
      WHERE r.id = messages.room_id
        AND ((r.kind = 'group'  AND app.is_group_member(r.ref_id))
          OR (r.kind = 'meetup' AND app.is_meetup_participant(r.ref_id)))
    )
  );

CREATE POLICY messages_update_own_soft ON messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid());

CREATE POLICY location_pings_select_co_participant ON location_pings
  FOR SELECT TO authenticated
  USING (app.is_meetup_participant(meetup_id));

CREATE POLICY location_pings_insert_self ON location_pings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND app.is_meetup_participant(meetup_id));