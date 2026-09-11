-- =============================================================================
-- FYK Consolidated — 0005_storage.sql
-- Run AFTER 0004_functions.sql (its policies depend on those functions). Idempotent.
--
-- This is what makes "private" actually mean private. `albums-private` and
-- `chat-media-private` are non-public buckets: the only way to read a file is a
-- short-TTL signed URL, and a signed URL is only mintable if the storage policy
-- below passes. A CSS blur is not involved.
--
-- Path convention (enforced, not conventional): <owner_uuid>/<filename>
-- so `(storage.foldername(name))[1]` is the owner id.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars-public',      'avatars-public',      true,   5 * 1024 * 1024,
     array['image/jpeg','image/png','image/webp']),
  ('photos-public',       'photos-public',       true,  15 * 1024 * 1024,
     array['image/jpeg','image/png','image/webp']),
  ('albums-private',      'albums-private',      false, 15 * 1024 * 1024,
     array['image/jpeg','image/png','image/webp']),
  ('chat-media-private',  'chat-media-private',  false, 50 * 1024 * 1024,
     array['image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/webm','audio/mpeg','audio/mp4']),
  ('event-media-public',  'event-media-public',  true,  15 * 1024 * 1024,
     array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Clear prior FYK policies so this file re-runs cleanly.
do $$
declare r record;
begin
  for r in select policyname from pg_policies
           where schemaname='storage' and tablename='objects' and policyname like 'fyk_%'
  loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

-- ------------------------------------------------------ public buckets -----
create policy fyk_public_read on storage.objects
  for select to authenticated
  using (bucket_id in ('avatars-public','photos-public','event-media-public'));

create policy fyk_public_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('avatars-public','photos-public','event-media-public')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fyk_public_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('avatars-public','photos-public','event-media-public')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fyk_public_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('avatars-public','photos-public','event-media-public')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------- PRIVATE ALBUMS (real) -----
-- Read requires an approved grant. This is the fix for the client-side
-- "paywall/blur" that previously shipped full-resolution bytes to everyone.
create policy fyk_album_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'albums-private'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.has_album_access(public.safe_uuid((storage.foldername(name))[2]))
    )
  );

create policy fyk_album_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'albums-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy fyk_album_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'albums-private'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ------------------------------------------------------- CHAT MEDIA --------
-- Readable only by members of the conversation the file belongs to.
-- Path: <conversation_uuid>/<filename>
create policy fyk_chat_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media-private'
    and public.can_access_chat_media(name)
  );

create policy fyk_chat_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media-private'
    and public.is_conversation_member(((storage.foldername(name))[1])::uuid)
  );

-- =========================== VERIFY (paste output back) =====================
-- A) buckets: albums-private and chat-media-private MUST show public = false
select id, public, file_size_limit, array_length(allowed_mime_types,1) as mime_count
from storage.buckets order by id;

-- B) policies present
select policyname, cmd from pg_policies
where schemaname='storage' and tablename='objects' and policyname like 'fyk_%'
order by policyname;
