-- =============================================================================
-- FYK Consolidated — 0003_security_rls.sql
-- Run THIRD, after 0000_profiles.sql and 0001_grants.sql. Idempotent.
--
-- Design rules applied throughout:
--   * Default is deny. Every policy grants the minimum.
--   * Blocking is mutual and enforced in SQL, not in a client array filter.
--   * `audit_events` has NO client write policy — the log cannot be forged.
--   * Private album access is decided here, then Storage enforces the file itself.
-- =============================================================================

-- ------------------------------------------------------------- helpers -----

-- Mutual block test. SECURITY DEFINER so it can read `blocks` regardless of
-- the caller's own policies; STABLE so the planner can cache it per statement.
create or replace function public.is_blocked(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = other)
       or (b.blocker_id = other      and b.blocked_id = auth.uid())
  );
$$;

-- Conversation membership test, used by message policies.
create or replace function public.is_conversation_member(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = conv and m.profile_id = auth.uid()
  );
$$;

-- Approved-album test. This single function is the ONE source of truth for
-- private album access, shared by the profile path and the chat path.
create or replace function public.has_album_access(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select owner = auth.uid()
      or exists (
        select 1 from public.album_grants g
        where g.owner_id = owner
          and g.grantee_id = auth.uid()
          and g.status = 'approved'
      );
$$;

-- Has the caller completed the age gate?
create or replace function public.is_age_verified()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.profile_private private on private.id = p.id
    where p.id = auth.uid()
      and p.age_verified_at is not null
      and private.dob <= (current_date - interval '18 years')
  );
$$;

-- Safe UUID cast (returns null for invalid input)
create or replace function public.safe_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin return value::uuid; exception when others then return null; end $$;

revoke all on function public.is_blocked(uuid)             from public, anon;
revoke all on function public.is_conversation_member(uuid) from public, anon;
revoke all on function public.has_album_access(uuid)       from public, anon;
revoke all on function public.is_age_verified()            from public, anon;
revoke all on function public.safe_uuid(text)              from public, anon;
grant execute on function public.is_blocked(uuid)             to authenticated;
grant execute on function public.is_conversation_member(uuid) to authenticated;
grant execute on function public.has_album_access(uuid)       to authenticated;
grant execute on function public.is_age_verified()            to authenticated;
grant execute on function public.safe_uuid(text)              to authenticated;

-- --------------------------------------------------------------- macro -----
-- Drop-then-create keeps this file re-runnable.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname='public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ------------------------------------------------------------ profiles -----
-- Readable by any signed-in, age-verified user who is not blocked, excluding
-- suspended accounts. anon gets NOTHING.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (
      public.is_age_verified()
      and onboarding_completed_at is not null
      and not is_suspended
      and not public.is_blocked(id)
    )
  );

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No delete policy: account deletion goes through auth.users cascade.

create policy profile_private_own on public.profile_private
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- -------------------------------------------------------------- photos -----
create policy photos_select on public.profile_photos
  for select to authenticated
  using (owner_id = auth.uid() or not public.is_blocked(owner_id));

create policy photos_write on public.profile_photos
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- PRIVATE ALBUMS — the row is invisible unless a grant exists.
create policy album_items_select on public.private_album_items
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (album_id is not null and public.can_access_album(album_id))
    or public.has_album_access(owner_id)
  );

create policy album_items_write on public.private_album_items
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Private albums themselves
create policy private_albums_select on public.private_albums
  for select to authenticated
  using (owner_id = auth.uid() or public.can_access_album(id));

create policy private_albums_write on public.private_albums
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Grants: requester may create/see their own request; owner may see and resolve.
create policy grants_select on public.album_grants
  for select to authenticated
  using (owner_id = auth.uid() or grantee_id = auth.uid());

create policy grants_request on public.album_grants
  for insert to authenticated
  with check (grantee_id = auth.uid() and status = 'pending' and not public.is_blocked(owner_id));

create policy grants_resolve on public.album_grants
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy grants_withdraw on public.album_grants
  for delete to authenticated
  using (owner_id = auth.uid() or grantee_id = auth.uid());

-- Album shares
create policy album_shares_select on public.album_shares
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy album_shares_insert on public.album_shares
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_member(conversation_id)
    and exists (select 1 from public.private_albums a where a.id = album_id and a.owner_id = auth.uid())
  );

create policy album_shares_sender_update on public.album_shares
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

create policy album_shares_sender_delete on public.album_shares
  for delete to authenticated
  using (sender_id = auth.uid() and status = 'pending');

create policy album_shares_recipient_update on public.album_shares
  for update to authenticated
  using (recipient_id = auth.uid() and status = 'pending')
  with check (recipient_id = auth.uid() and status in ('active','declined'));

-- -------------------------------------------------------- social graph -----
create policy likes_select on public.likes
  for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

create policy likes_insert on public.likes
  for insert to authenticated
  with check (from_id = auth.uid() and not public.is_blocked(to_id));

create policy likes_delete on public.likes
  for delete to authenticated
  using (from_id = auth.uid());

-- Matches are READ-ONLY to clients; created by the trigger below.
create policy matches_select on public.matches
  for select to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

create policy matches_unmatch on public.matches
  for update to authenticated
  using (user_a = auth.uid() or user_b = auth.uid())
  with check (user_a = auth.uid() or user_b = auth.uid());

create policy blocks_all on public.blocks
  for all to authenticated
  using (blocker_id = auth.uid())
  with check (blocker_id = auth.uid());

-- ----------------------------------------------------------- messaging -----
create policy conversations_select on public.conversations
  for select to authenticated
  using (public.is_conversation_member(id));

create policy conv_members_select on public.conversation_members
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy conv_members_update on public.conversation_members
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy messages_select on public.messages
  for select to authenticated
  using (
    public.is_conversation_member(conversation_id)
    and (expires_at is null or expires_at > now())   -- expired = invisible immediately
    and unsent_at is null
  );

create policy messages_insert on public.messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));

create policy messages_update on public.messages
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- Message reactions
create policy message_reactions_select on public.message_reactions
  for select to authenticated
  using (exists (
    select 1 from public.messages m
    where m.id = message_id and public.is_conversation_member(m.conversation_id)
  ));

create policy message_reactions_write on public.message_reactions
  for all to authenticated
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id and public.is_conversation_member(m.conversation_id)
    )
  );

-- Message attachments
create policy message_attachments_select on public.message_attachments
  for select to authenticated
  using (public.is_conversation_member(conversation_id));

create policy message_attachments_insert on public.message_attachments
  for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id));

create policy message_attachments_sender_update on public.message_attachments
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- ------------------------------------------------------------- offers ------
create policy offers_select on public.offers
  for select to authenticated
  using (owner_id = auth.uid() or (expires_at > now() and not public.is_blocked(owner_id)));

create policy offers_write on public.offers
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy offer_joins_select on public.offer_joins
  for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.offers o where o.id = offer_id and o.owner_id = auth.uid())
  );

create policy offer_joins_write on public.offer_joins
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- ------------------------------------------------------------- events ------
create policy events_select on public.events
  for select to authenticated
  using (host_id = auth.uid() or (status = 'published' and not public.is_blocked(host_id)));

create policy events_write on public.events
  for all to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

create policy rsvps_select on public.event_rsvps
  for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.events e where e.id = event_id and e.host_id = auth.uid())
  );

create policy rsvps_write on public.event_rsvps
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- -------------------------------------------------------------- board ------
create policy posts_select on public.board_posts
  for select to authenticated
  using (author_id = auth.uid() or (expires_at > now() and not public.is_blocked(author_id)));

create policy posts_write on public.board_posts
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy comments_select on public.board_comments
  for select to authenticated
  using (
    not public.is_blocked(author_id)
    and exists (
      select 1 from public.board_posts post
      where post.id = post_id
        and (post.author_id = auth.uid() or post.expires_at > now())
    )
  );

create policy comments_write on public.board_comments
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.board_posts post
      where post.id = post_id and post.expires_at > now()
    )
  );

create policy comments_delete on public.board_comments
  for delete to authenticated
  using (author_id = auth.uid());

create policy post_joins_select_own on public.post_joins
  for select to authenticated
  using (profile_id = auth.uid());

create policy post_joins_insert_own on public.post_joins
  for insert to authenticated
  with check (profile_id = auth.uid());

create policy post_joins_delete_own on public.post_joins
  for delete to authenticated
  using (profile_id = auth.uid());

-- ------------------------------------------------------------ reports ------
create policy reports_insert on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

create policy reports_select_own on public.reports
  for select to authenticated
  using (reporter_id = auth.uid());

-- ------------------------------------------- audit log --------------------
-- audit_events: no policy at all => no client access in either direction.

-- ====================== TRIGGERS: server-side invariants ====================

-- 1. New auth user -> profile row.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (
    new.id,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name'
  ) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Mutual like -> match + conversation. Clients can never forge a match.
create or replace function public.handle_mutual_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid; b uuid; m_id uuid; c_id uuid;
begin
  if not exists (
    select 1 from public.likes l where l.from_id = new.to_id and l.to_id = new.from_id
  ) then
    return new;
  end if;

  a := least(new.from_id, new.to_id);
  b := greatest(new.from_id, new.to_id);

  insert into public.matches (user_a, user_b) values (a, b)
    on conflict (user_a, user_b) do nothing
    returning id into m_id;

  if m_id is null then return new; end if;

  insert into public.conversations (match_id) values (m_id) returning id into c_id;
  insert into public.conversation_members (conversation_id, profile_id) values (c_id, a), (c_id, b);
  return new;
end $$;

drop trigger if exists on_like_created on public.likes;
create trigger on_like_created
  after insert on public.likes
  for each row execute function public.handle_mutual_like();

-- 3. Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists profile_private_touch on public.profile_private;
create trigger profile_private_touch before update on public.profile_private
  for each row execute function public.touch_updated_at();

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

drop trigger if exists private_albums_touch on public.private_albums;
create trigger private_albums_touch before update on public.private_albums
  for each row execute function public.touch_updated_at();

-- 4. Board joins: serialize on the post row, enforce expiry/capacity, then
-- publish only an aggregate count. Member IDs stay owner-only under RLS.
create or replace function public.validate_post_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.board_posts%rowtype;
  used integer;
begin
  select * into target from public.board_posts where id = new.post_id for update;
  if target.id is null then raise exception 'post_not_found'; end if;
  if target.expires_at <= now() then raise exception 'post_expired'; end if;
  if target.author_id = new.profile_id then raise exception 'owner_cannot_join'; end if;
  if target.spots is not null then
    select count(*) into used from public.post_joins where post_id = new.post_id;
    if used >= target.spots then raise exception 'post_full'; end if;
  end if;
  return new;
end $$;

create or replace function public.refresh_post_join_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target_id uuid;
begin
  target_id := coalesce(new.post_id, old.post_id);
  update public.board_posts
  set join_count = (select count(*) from public.post_joins where post_id = target_id)
  where id = target_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists post_join_validate on public.post_joins;
create trigger post_join_validate before insert on public.post_joins
  for each row execute function public.validate_post_join();

drop trigger if exists post_join_count_insert on public.post_joins;
create trigger post_join_count_insert after insert on public.post_joins
  for each row execute function public.refresh_post_join_count();

drop trigger if exists post_join_count_delete on public.post_joins;
create trigger post_join_count_delete after delete on public.post_joins
  for each row execute function public.refresh_post_join_count();

-- 5. Protect message identity and immutability after send.
create or replace function public.protect_message_update()
returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.conversation_id <> old.conversation_id
    or new.sender_id <> old.sender_id or new.type <> old.type
    or new.storage_path is distinct from old.storage_path
    or new.album_share_id is distinct from old.album_share_id
    or new.reply_to_id is distinct from old.reply_to_id
    or new.created_at <> old.created_at
  then raise exception 'message_identity_is_immutable'; end if;
  return new;
end $$;

drop trigger if exists message_update_guard on public.messages;
create trigger message_update_guard before update on public.messages
  for each row execute function public.protect_message_update();

-- 6. Protect attachment immutability.
create or replace function public.protect_attachment_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id <> old.id or new.message_id <> old.message_id
    or new.conversation_id <> old.conversation_id or new.sender_id <> old.sender_id
    or new.storage_path <> old.storage_path or new.access_policy <> old.access_policy
    or new.expires_at is distinct from old.expires_at or new.max_opens is distinct from old.max_opens
    or new.created_at <> old.created_at
  then raise exception 'attachment_policy_is_immutable'; end if;
  if auth.uid() = old.sender_id and new.status = 'revoked' and old.opened_at is not null
  then raise exception 'opened_media_cannot_be_revoked'; end if;
  if current_user = 'authenticated' and auth.uid() = old.sender_id and (
    new.opens_used <> old.opens_used or new.opened_at is distinct from old.opened_at
    or new.status <> 'revoked' or new.revoked_at is null
  ) then raise exception 'sender_may_only_revoke_unopened_media'; end if;
  return new;
end $$;

drop trigger if exists attachment_update_guard on public.message_attachments;
create trigger attachment_update_guard before update on public.message_attachments
  for each row execute function public.protect_attachment_update();

-- 7. Protect album share immutability.
create or replace function public.protect_album_share_update()
returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.album_id <> old.album_id
    or new.conversation_id <> old.conversation_id or new.sender_id <> old.sender_id
    or new.recipient_id <> old.recipient_id or new.access_policy <> old.access_policy
    or new.expires_at is distinct from old.expires_at or new.max_opens is distinct from old.max_opens
    or new.created_at <> old.created_at
  then raise exception 'album_share_policy_is_immutable'; end if;
  if current_user = 'authenticated' and auth.uid() = old.sender_id and (
    new.opens_used <> old.opens_used or new.opened_at is distinct from old.opened_at
    or new.status <> 'revoked' or new.revoked_at is null
  ) then raise exception 'sender_may_only_unshare'; end if;
  if current_user = 'authenticated' and auth.uid() = old.recipient_id and (
    old.status <> 'pending' or new.status not in ('active','declined')
    or new.opens_used <> old.opens_used or new.opened_at is distinct from old.opened_at
  ) then raise exception 'recipient_may_only_accept_or_decline'; end if;
  return new;
end $$;

drop trigger if exists album_share_update_guard on public.album_shares;
create trigger album_share_update_guard before update on public.album_shares
  for each row execute function public.protect_album_share_update();

-- =========================== VERIFY (paste output back) =====================
-- A) every public table has RLS on and at least one policy (except audit_events)
select t.tablename,
       t.rowsecurity as rls_on,
       count(p.policyname) as policies
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public'
group by t.tablename, t.rowsecurity
order by t.tablename;

-- B) CRITICAL: these must ALL return 0 rows.
select 'audit writable', count(*) from pg_policies
  where schemaname='public' and tablename='audit_events'
union all
select 'anon has any policy', count(*) from pg_policies
  where schemaname='public' and 'anon' = any(roles);
