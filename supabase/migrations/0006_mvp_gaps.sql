-- =============================================================================
-- FYK Consolidated — 0006_mvp_gaps.sql
-- The minimum additional surface the shipping app needs and 0001 did not have.
--
-- Everything here is backed by a call site in src/server/handlers/. Nothing is
-- created "because the blueprint listed it": there are deliberately no wallets,
-- consumables, pets, fansites, shouts, groups, stories, tribes, embeddings or a
-- second `users` table, because nothing in the app can use them honestly yet.
--
-- Idempotent: safe to re-run.
-- =============================================================================

-- ------------------------------------------------------------- roles --------
-- Moderation rights live in the database, not in a client-supplied header.
do $$ begin
  create type public.moderation_role as enum ('user','moderator','admin');
exception when duplicate_object then null; end $$;

alter table public.profiles add column if not exists role public.moderation_role not null default 'user';

-- A user may never raise their own role, even through a permissive policy.
create or replace function public.block_role_escalation()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role
     and current_user = 'authenticated'
     and not public.is_admin()
  then
    raise exception 'role_change_requires_admin';
  end if;
  return new;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role in ('admin','moderator') from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;

drop trigger if exists profiles_block_role_escalation on public.profiles;
create trigger profiles_block_role_escalation
  before update on public.profiles
  for each row execute function public.block_role_escalation();

grant execute on function public.is_admin()      to authenticated;
grant execute on function public.is_moderator()  to authenticated;

-- ------------------------------------------------- discovery preferences ----
-- Board "right now" window + self-declared availability live on the profile;
-- these two columns are all the MVP needs (no weekly-grid scheduler table).
alter table public.profiles add column if not exists looking_for text[] not null default '{}';
alter table public.profiles add column if not exists interests   text[] not null default '{}';
alter table public.profiles add column if not exists headline     text;
alter table public.profiles add column if not exists open_to_meet boolean;
alter table public.profiles add column if not exists available_until timestamptz;

-- A coarse grid cell for nearby queries (~a few km). Written by the client from
-- its coarsened lat/lng; it is never a precise location.
alter table public.profiles add column if not exists geohash6 text;
do $$ begin
  alter table public.profiles
    add constraint profiles_geohash6_len
    check (geohash6 is null or char_length(geohash6) between 4 and 9);
exception when duplicate_object then null; end $$;
create index if not exists profiles_geohash_idx on public.profiles (geohash6);
create index if not exists profiles_available_idx on public.profiles (available_until desc nulls last);
create index if not exists profiles_looking_for_idx on public.profiles using gin (looking_for);
create index if not exists profiles_interests_idx   on public.profiles using gin (interests);

-- ------------------------------------------------------------- photos -------
-- A photo row must say which bucket holds it; without this the API cannot mint a
-- URL and the grid renders broken images.
alter table public.profile_photos add column if not exists bucket text not null default 'photos-public'
  check (bucket in ('avatars-public','photos-public'));
alter table public.profile_photos add column if not exists blurhash text;
alter table public.profile_photos add column if not exists nsfw_flag boolean not null default false;
create index if not exists profile_photos_primary_idx on public.profile_photos (owner_id, is_primary);

-- ------------------------------------------------------------- taps --------
-- `likes` already models a one-way tap. Two fixes:
--   1. a match must come from a *mutual tap*, not a mutual "like";
--   2. the pair key must be symmetric so a duplicate tap cannot re-fire the
--      match trigger.
drop trigger if exists on_like_created on public.likes;
create or replace function public.handle_mutual_tap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid; b uuid; m_id uuid; c_id uuid;
begin
  -- Only taps create matches. Favorites and "woof" are social signals.
  if new.kind <> 'tap' then return new; end if;

  if not exists (
    select 1 from public.likes l
    where l.from_id = new.to_id and l.to_id = new.from_id and l.kind = 'tap'
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

  insert into public.notifications (user_id, kind, title, body, deep_link)
  values
    (a, 'match', 'New match', 'You and them tapped each other.', '/chat/' || c_id::text),
    (b, 'match', 'New match', 'You and them tapped each other.', '/chat/' || c_id::text);
  return new;
end $$;

create trigger on_like_created
  after insert on public.likes
  for each row execute function public.handle_mutual_tap();

-- -------------------------------------------------------- notifications ----
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('match','message','event','board','system','safety')),
  title      text not null,
  body       text,
  deep_link  text,
  read       boolean not null default false,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  check (char_length(title) between 1 and 120),
  check (body is null or char_length(body) <= 400),
  -- deep_link is an in-app path only, so a notification can never be a
  -- vehicle for an off-domain redirect.
  check (deep_link is null or deep_link ~ '^/[a-z0-9/_?=&.-]{0,200}$')
);
create index if not exists notifications_unread_idx on public.notifications (user_id, created_at desc) where not read;

alter table public.notifications enable row level security;

do $$ begin
  create policy notifications_select_own on public.notifications
    for select to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy notifications_update_own on public.notifications
    for update to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
-- No INSERT/DELETE policy: only security-definer functions (match trigger,
-- event/board notices) create notifications, and a user clears only reads.

-- ------------------------------------------------------ profile views -----
create table if not exists public.footprints (
  id          uuid primary key default gen_random_uuid(),
  visitor_id  uuid not null references public.profiles(id) on delete cascade,
  visited_id  uuid not null references public.profiles(id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  unique (visitor_id, visited_id)
);
create index if not exists footprints_visited_idx on public.footprints (visited_id, viewed_at desc);
alter table public.footprints enable row level security;

do $$ begin
  create policy footprints_select_visited on public.footprints
    for select to authenticated using (visited_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy footprints_insert_own on public.footprints
    for insert to authenticated with check (visitor_id = auth.uid());
exception when duplicate_object then null; end $$;
-- No update/delete policy: a view log is not editable by its author.

-- Someone viewing you is only recorded when they are not incognito and the
-- viewed profile has not opted out. Both checks run server-side in the API.
create or replace function public.record_view(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare viewer uuid := auth.uid();
begin
  if viewer is null or target is null or viewer = target then return; end if;
  if exists (select 1 from public.profiles p where p.id = viewer and (p.incognito or p.is_suspended)) then return; end if;
  if exists (select 1 from public.profiles p where p.id = target and p.hide_online) then return; end if;
  insert into public.footprints (visitor_id, visited_id) values (viewer, target)
    on conflict (visitor_id, visited_id) do update set viewed_at = now();
end $$;

create or replace function public.unblock(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.blocks where blocker_id = auth.uid() and blocked_id = target;
end $$;

-- ------------------------------------------------------- message pins -----
-- Pins are server-windowed: max 5 per conversation, enforced by a trigger so a
-- crafted request cannot exceed it.
alter table public.messages add column if not exists pinned_at timestamptz;
alter table public.messages add column if not exists pinned_by uuid references public.profiles(id) on delete set null;

create or replace function public.enforce_pin_limit()
returns trigger
language plpgsql
as $$
declare used integer;
begin
  if new.pinned_at is not null and old.pinned_at is null then
    select count(*) into used from public.messages
      where conversation_id = new.conversation_id and pinned_at is not null and id <> new.id;
    if used >= 5 then raise exception 'pin_limit_reached'; end if;
  end if;
  return new;
end $$;

drop trigger if exists message_pin_limit on public.messages;
create trigger message_pin_limit
  before update on public.messages
  for each row execute function public.enforce_pin_limit();

-- Edit and recall windows are enforced in the database, not only in the UI,
-- so a tampered client cannot edit or unsend an old message.
create or replace function public.enforce_message_window()
returns trigger
language plpgsql
as $$
begin
  if current_user <> 'authenticated' then return new; end if;

  if new.body is distinct from old.body then
    if old.edited_at is not null then raise exception 'already_edited'; end if;
    if old.created_at < now() - interval '15 minutes' then raise exception 'edit_window_closed'; end if;
    new.edited_at := now();
  end if;

  if new.unsent_at is not null and old.unsent_at is null then
    if old.created_at < now() - interval '60 minutes' then raise exception 'recall_window_closed'; end if;
  end if;

  -- A recall wipes content: body and media references must both go.
  if new.unsent_at is not null and old.unsent_at is null then
    new.body := null;
    new.storage_path := null;
    new.album_share_id := null;
    new.type := 'system';
  end if;

  return new;
end $$;

drop trigger if exists message_window_guard on public.messages;
create trigger message_window_guard
  before update on public.messages
  for each row execute function public.enforce_message_window();

-- ------------------------------------------------ report triage + mod ops ---
alter table public.reports add column if not exists severity text not null default 'normal'
  check (severity in ('normal','urgent'));
alter table public.reports add column if not exists reviewed_by uuid references public.profiles(id) on delete set null;
alter table public.reports add column if not exists reviewed_at timestamptz;
alter table public.reports add column if not exists resolution text
  check (resolution in ('no_action','content_removed','warning_issued','temporarily_suspended','permanently_banned'));
-- A report must point at something concrete.
do $$ begin
  alter table public.reports
    add constraint reports_target_type_allowed
    check (target_type in ('profile','message','board_post','event','album'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.reports
    add constraint reports_reason_allowed
    check (reason in ('harassment','spam','fake_profile','inappropriate_content','underage','threat','doxxing','other'));
exception when duplicate_object then null; end $$;
-- Anything alleging a minor is automatically urgent; the UI cannot downgrade it.
create or replace function public.mark_urgent_reports()
returns trigger
language plpgsql
as $$
begin
  if new.reason in ('underage','threat','doxxing') then new.severity := 'urgent'; end if;
  return new;
end $$;
drop trigger if exists reports_urgent on public.reports;
create trigger reports_urgent before insert on public.reports
  for each row execute function public.mark_urgent_reports();

create index if not exists reports_queue_idx on public.reports (status, severity desc, created_at asc);

create table if not exists public.moderation_actions (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid references public.reports(id) on delete set null,
  actor_id    uuid not null references public.profiles(id) on delete restrict,
  target_id   uuid not null references public.profiles(id) on delete cascade,
  action      text not null check (action in ('dismiss','warn','suspend','ban','reinstate')),
  note        text,
  created_at  timestamptz not null default now(),
  check (note is null or char_length(note) <= 1000)
);
create index if not exists moderation_actions_target_idx on public.moderation_actions (target_id, created_at desc);
alter table public.moderation_actions enable row level security;

do $$ begin
  create policy moderation_actions_read on public.moderation_actions
    for select to authenticated using (public.is_moderator());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy moderation_actions_insert on public.moderation_actions
    for insert to authenticated with check (public.is_moderator() and actor_id = auth.uid());
exception when duplicate_object then null; end $$;
-- No update/delete: a moderation trail is append-only.

-- Moderators may see the queue; only they may set report review state, and the
-- target of a sanction is suspended in the same transaction by RPC.
do $$ begin
  drop policy if exists reports_select_own on public.reports;
exception when others then null; end $$;
do $$ begin
  create policy reports_select_own on public.reports
    for select to authenticated using (reporter_id = auth.uid() or public.is_moderator());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy reports_update_moderator on public.reports
    for update to authenticated
    using (public.is_moderator())
    with check (public.is_moderator());
exception when duplicate_object then null; end $$;

-- Server-side transaction for the queue: one RPC per decision, so a moderator
-- cannot half-apply a sanction (status updated, profile not suspended).
create or replace function public.resolve_report(
  p_report_id uuid,
  p_action text,
  p_note text default null
)
returns table (report_id uuid, report_status report_status, suspended boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.reports%rowtype;
  target uuid;
  is_suspended boolean;
begin
  if not public.is_moderator() then
    raise exception 'moderator_only' using errcode = '42501';
  end if;

  select * into rec from public.reports where id = p_report_id for update;
  if rec.id is null then raise exception 'report_not_found'; end if;
  if rec.target_type <> 'profile' then
    raise exception 'only_profile_reports_can_be_resolved_here';
  end if;
  target := rec.target_id;

  update public.reports
    set status = case p_action
                   when 'dismiss' then 'dismissed'::report_status
                   else 'action_taken'::report_status
                 end,
        reviewed_by = auth.uid(),
        reviewed_at = now(),
        resolution = case p_action
                       when 'dismiss' then 'no_action'
                       when 'warn' then 'warning_issued'
                       when 'suspend' then 'temporarily_suspended'
                       when 'ban' then 'permanently_banned'
                     end
  where id = p_report_id;

  if p_action in ('suspend','ban') then
    update public.profiles set is_suspended = true where id = target;
  elsif p_action = 'reinstate' then
    update public.profiles set is_suspended = false where id = target;
  end if;

  select coalesce(is_suspended, false) into is_suspended from public.profiles where id = target;

  insert into public.moderation_actions (report_id, actor_id, target_id, action, note)
  values (p_report_id, auth.uid(), target, p_action, nullif(btrim(coalesce(p_note,'')), ''));

  insert into public.audit_events (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'report.' || p_action, 'report', p_report_id, jsonb_build_object('target', target));

  -- Re-read the row: `rec` was captured before the UPDATE, so returning its
  -- status would tell the caller the report is still open after they resolved it.
  return query select p_report_id, (select r.status from public.reports r where r.id = p_report_id), is_suspended;
end $$;

grant execute on function public.resolve_report(uuid, text, text) to authenticated;

-- NOTE: the discovery policy (`profiles_select`) already excludes suspended and
-- un-onboarded accounts and lives in 0003_security_rls.sql. It is intentionally
-- not touched here: a suspension therefore removes a profile from discovery and
-- from every other user's reads without any client-side cooperation.
-- ---------------------------------------------------------- rate limits -----
-- Durable fixed-window counter shared by every API instance.
create table if not exists public.rate_limits (
  bucket_key   text primary key,
  window_start timestamptz not null default now(),
  hits         integer not null default 0,
  blocked_until timestamptz
);

create or replace function public.rate_limit_hit(
  p_bucket_key text,
  p_window_seconds int,
  p_max_hits int
)
returns table (hits integer, blocked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.rate_limits%rowtype;
begin
  insert into public.rate_limits (bucket_key, window_start, hits)
  values (p_bucket_key, now(), 1)
  on conflict (bucket_key) do update
    set hits = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then 1
          else public.rate_limits.hits + 1
        end,
        window_start = case
          when public.rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then now()
          else public.rate_limits.window_start
        end
  returning * into row;

  return query select row.hits, row.hits > p_max_hits;
end $$;

grant execute on function public.rate_limit_hit(text, int, int) to anon, authenticated;

create or replace function public.prune_rate_limits()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limits where window_start < now() - interval '1 hour';
$$;

-- ------------------------------------------------------------- verify ------
-- Paste into the SQL editor after applying; every line must return 0 rows.
-- select 'role grant to authenticated on audit_events' as leak, count(*)
--   from information_schema.role_table_grants
--   where grantee='authenticated' and table_name='audit_events'
-- union all
-- select 'anon policy exists', count(*) from pg_policies where schemaname='public' and 'anon' = any(roles)
-- union all
-- select 'notifications writable', count(*) from pg_policies
--   where schemaname='public' and tablename='notifications' and cmd in ('INSERT','DELETE');
