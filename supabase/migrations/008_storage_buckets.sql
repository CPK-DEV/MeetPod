-- 008_storage_buckets.sql

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images',
  'chat-images',
  FALSE,
  10 * 1024 * 1024,
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "chat_images_insert_room_member"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-images'
    AND EXISTS (
      SELECT 1
      FROM chat_rooms r
      WHERE r.id = (split_part(name, '/', 1))::uuid
        AND (
          (r.kind = 'group'  AND EXISTS (
              SELECT 1 FROM group_members gm
              WHERE gm.group_id = r.ref_id AND gm.user_id = auth.uid()))
          OR
          (r.kind = 'meetup' AND EXISTS (
              SELECT 1 FROM meetup_participants mp
              WHERE mp.meetup_id = r.ref_id AND mp.user_id = auth.uid()))
        )
    )
  );

CREATE POLICY "chat_images_select_room_member"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-images'
    AND EXISTS (
      SELECT 1
      FROM chat_rooms r
      WHERE r.id = (split_part(name, '/', 1))::uuid
        AND (
          (r.kind = 'group'  AND EXISTS (
              SELECT 1 FROM group_members gm
              WHERE gm.group_id = r.ref_id AND gm.user_id = auth.uid()))
          OR
          (r.kind = 'meetup' AND EXISTS (
              SELECT 1 FROM meetup_participants mp
              WHERE mp.meetup_id = r.ref_id AND mp.user_id = auth.uid()))
        )
    )
  );