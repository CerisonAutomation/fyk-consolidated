-- =============================================================================
-- FYK Consolidated — 004_functions.sql
-- Run FIFTH. Helper functions, media access control, and album sharing.
--
-- This file adds:
--   - can_access_album() — album-level access check for storage policies
--   - can_access_chat_media() — chat media access check for storage policies
--   - register_media_open() — increment open counter for view-once/timed media
--   - register_album_open() — increment open counter for album shares
-- =============================================================================

-- ----------------------------------------------- Album access function ------
-- Used by 003_storage.sql and RLS policies to check album access.
create or replace function public.can_access_album(target_album uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.private_albums a where a.id = target_album and a.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.album_shares s
    where s.album_id = target_album and s.recipient_id = auth.uid()
      and s.status = 'active' and s.revoked_at is null
      and (s.expires_at is null or s.expires_at > now())
      and (s.max_opens is null or s.opens_used < s.max_opens)
  );
$$;

-- ------------------------------------------- Chat media access function -----
-- Used by 003_storage.sql to check chat media access.
create or replace function public.can_access_chat_media(path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.message_attachments a
    where a.storage_path = path and public.is_conversation_member(a.conversation_id)
      and (a.sender_id = auth.uid() or (
        a.status = 'active' and a.revoked_at is null
        and (a.expires_at is null or a.expires_at > now())
        and (a.max_opens is null or a.opens_used < a.max_opens)
      ))
  );
$$;

revoke all on function public.can_access_album(uuid) from public, anon;
revoke all on function public.can_access_chat_media(text) from public, anon;
grant execute on function public.can_access_album(uuid) to authenticated;
grant execute on function public.can_access_chat_media(text) to authenticated;

-- --------------------------------------- Media open counter functions -------
-- These counters control future in-app access. They cannot delete a copy a
-- recipient already downloaded, and the UI must say so.

-- Register a media attachment open (increments opens_used, may set status='consumed')
create or replace function public.register_media_open(target uuid)
returns public.message_attachments
language plpgsql
security definer
set search_path = public
as $$
declare row public.message_attachments%rowtype;
begin
  select * into row from public.message_attachments where id = target for update;
  if row.id is null or row.sender_id = auth.uid() or not public.is_conversation_member(row.conversation_id)
    or row.status <> 'active' or row.revoked_at is not null
    or (row.expires_at is not null and row.expires_at <= now())
    or (row.max_opens is not null and row.opens_used >= row.max_opens)
  then raise exception 'media_not_available'; end if;
  update public.message_attachments set
    opens_used = opens_used + 1,
    opened_at = coalesce(opened_at, now()),
    status = case when max_opens is not null and opens_used + 1 >= max_opens then 'consumed' else status end
  where id = target returning * into row;
  return row;
end $$;

-- Register an album share open (increments opens_used, may set status='consumed')
create or replace function public.register_album_open(target uuid)
returns public.album_shares
language plpgsql
security definer
set search_path = public
as $$
declare row public.album_shares%rowtype;
begin
  select * into row from public.album_shares where id = target and recipient_id = auth.uid() for update;
  if row.id is null or row.status <> 'active' or row.revoked_at is not null
    or (row.expires_at is not null and row.expires_at <= now())
    or (row.max_opens is not null and row.opens_used >= row.max_opens)
  then raise exception 'album_not_available'; end if;
  update public.album_shares set
    opens_used = opens_used + 1,
    opened_at = coalesce(opened_at, now()),
    status = case when max_opens is not null and opens_used + 1 >= max_opens then 'consumed' else status end
  where id = target returning * into row;
  return row;
end $$;

revoke all on function public.register_media_open(uuid) from public, anon;
revoke all on function public.register_album_open(uuid) from public, anon;
grant execute on function public.register_media_open(uuid) to authenticated;
grant execute on function public.register_album_open(uuid) to authenticated;

-- ====================================== VERIFY ==============================
-- Verify all functions exist
select routine_name, routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'is_blocked', 'is_conversation_member', 'has_album_access',
    'is_age_verified', 'safe_uuid', 'handle_new_user',
    'handle_mutual_like', 'touch_updated_at', 'validate_post_join',
    'refresh_post_join_count', 'protect_message_update',
    'protect_attachment_update', 'protect_album_share_update',
    'can_access_album', 'can_access_chat_media',
    'register_media_open', 'register_album_open'
  )
order by routine_name;
