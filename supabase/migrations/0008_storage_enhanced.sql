INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('photos', 'photos', true, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('albums', 'albums', false, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('chat-media', 'chat-media', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'audio/webm', 'audio/mpeg']),
  ('event-media', 'event-media', true, 15728640, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('stories', 'stories', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id IN ('avatars', 'photos', 'event-media'));
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
CREATE POLICY "Users can update own avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
CREATE POLICY "Users can delete own avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
CREATE POLICY "Users can upload photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'photos' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
CREATE POLICY "Album owner access" ON storage.objects FOR SELECT USING (bucket_id = 'albums' AND (auth.uid()::text = (string_to_array(name, '/'))[1] OR public.has_album_access((string_to_array(name, '/'))[2]::uuid, auth.uid())));
CREATE POLICY "Users can upload to albums" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'albums' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
CREATE POLICY "Conversation members can read chat media" ON storage.objects FOR SELECT USING (bucket_id = 'chat-media' AND public.is_conversation_member((string_to_array(name, '/'))[1]::uuid, auth.uid()));
CREATE POLICY "Conversation members can upload chat media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-media' AND public.is_conversation_member((string_to_array(name, '/'))[1]::uuid, auth.uid()));
CREATE POLICY "Story owners can manage stories" ON storage.objects FOR ALL USING (bucket_id = 'stories' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
