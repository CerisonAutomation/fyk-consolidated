-- =============================================================================
-- FYK Consolidated — 0000_profiles.sql
-- Core schema: enums, profiles, photos, social graph, messaging, events,
-- board, safety, and entitlements.
--
-- Run FIRST in the Supabase SQL Editor. Idempotent: safe to re-run.
--
-- Every table is created with RLS ENABLED and NO POLICIES, which means it is
-- deny-all until 002_rls.sql runs. That ordering is deliberate: there is no
-- window where data is exposed.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums ----
do $$ begin
  create type exposure_level as enum ('clean','mature','explicit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type like_kind as enum ('like','tap','woof');
exception when duplicate_object then null; end $$;

do $$ begin
  create type grant_status as enum ('pending','approved','denied','revoked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type rsvp_status as enum ('going','maybe','declined');
exception when duplicate_object then null; end $$;

do $$ begin
  create type message_type as enum ('text','image','video','audio','system','album_request','album_share');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_status as enum ('open','in_review','action_taken','dismissed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type post_kind as enum ('invite','offer','ask','photo','text');
exception when duplicate_object then null; end $$;

do $$ begin
  create type where_mode as enum ('out','mine','yours','either');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_tier as enum ('free','plus');
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_access_policy as enum ('standard','timed','view_once','open_count');
exception when duplicate_object then null; end $$;

do $$ begin
  create type shared_media_status as enum ('pending','active','declined','expired','revoked','consumed','failed');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------- profiles ----
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique,
  display_name text,
  first_name text,
  last_name text,
  bio text,
  headline text,
  avatar_url text,
  -- Only the derived age is discoverable. DOB lives in profile_private below.
  age integer,
  age_verified_at timestamptz,
  city text,
  area text,
  -- Coarsened to ~250 m by the client BEFORE insert. Never store a raw fix.
  lat_coarse double precision,
  lng_coarse double precision,
  exposure_level exposure_level not null default 'clean',
  height_cm integer,
  body_type text,
  position_role text,
  pronouns text,
  hide_distance boolean not null default false,
  hide_online boolean not null default false,
  incognito boolean not null default false,
  is_demo boolean not null default false,
  is_suspended boolean not null default false,
  onboarding_completed_at timestamptz,
  last_active_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Hard 18+ constraint at the database level, not just in the UI.
do $$ begin
  alter table public.profiles
    add constraint profiles_adults_only
    check (age is null or age between 18 and 120);
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles
    add constraint profiles_handle_format
    check (handle is null or handle ~ '^[a-z0-9_]{3,24}$');
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.profiles add constraint profiles_bio_len check (char_length(bio) <= 1000);
exception when duplicate_object then null; end $$;

create index if not exists profiles_city_idx        on public.profiles (city);
create index if not exists profiles_last_active_idx on public.profiles (last_active_at desc);
create index if not exists profiles_geo_idx         on public.profiles (lat_coarse, lng_coarse);

-- Sensitive identity data is isolated from discoverable profile columns.
create table if not exists public.profile_private (
  id         uuid primary key references public.profiles(id) on delete cascade,
  dob        date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (dob <= (current_date - interval '18 years'))
);

-- --------------------------------------------------------------- photos ----
create table if not exists public.profile_photos (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  position     integer not null default 0,
  is_primary   boolean not null default false,
  width        integer,
  height       integer,
  created_at   timestamptz not null default now()
);
create index if not exists profile_photos_owner_idx on public.profile_photos (owner_id, position);

create table if not exists public.private_album_items (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  position     integer not null default 0,
  album_id     uuid,
  media_kind   text not null default 'image',
  caption      text,
  created_at   timestamptz not null default now()
);
create index if not exists private_album_owner_idx on public.private_album_items (owner_id, position);
create index if not exists private_album_items_album_idx on public.private_album_items(album_id, position);

-- Single source of truth for album access, shared by profile AND chat paths.
create table if not exists public.album_grants (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  grantee_id  uuid not null references public.profiles(id) on delete cascade,
  status      grant_status not null default 'pending',
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (owner_id, grantee_id),
  check (owner_id <> grantee_id)
);
create index if not exists album_grants_grantee_idx on public.album_grants (grantee_id, status);

-- --------------------------------------------------------- social graph ----
create table if not exists public.likes (
  id         uuid primary key default gen_random_uuid(),
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  kind       like_kind not null default 'like',
  created_at timestamptz not null default now(),
  unique (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists likes_to_idx on public.likes (to_id, created_at desc);

create table if not exists public.matches (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references public.profiles(id) on delete cascade,
  user_b       uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unmatched_at timestamptz,
  unique (user_a, user_b),
  check (user_a < user_b)  -- canonical ordering prevents duplicate pairs
);

create table if not exists public.blocks (
  id         uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- ------------------------------------------------------------ messaging ----
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid references public.matches(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  last_read_at    timestamptz,
  archived_at     timestamptz,
  primary key (conversation_id, profile_id)
);
create index if not exists conv_members_profile_idx on public.conversation_members (profile_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  type            message_type not null default 'text',
  body            text,
  storage_path    text,
  reply_to_id     uuid references public.messages(id) on delete set null,
  album_share_id  uuid,
  -- Server-side lifecycle for disappearing media.
  expires_at      timestamptz,
  unsent_at       timestamptz,
  edited_at       timestamptz,
  created_at      timestamptz not null default now(),
  check (char_length(body) <= 4000)
);
create index if not exists messages_conv_idx    on public.messages (conversation_id, created_at desc);
create index if not exists messages_expiry_idx  on public.messages (expires_at) where expires_at is not null;

-- Message reactions
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null check (emoji in ('heart','fire','laugh','wow','like')),
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);

-- Message attachments
create table if not exists public.message_attachments (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  storage_path    text not null unique,
  media_kind      text not null check (media_kind in ('image','video','audio')),
  mime_type       text not null,
  caption         text,
  width           integer,
  height          integer,
  bytes           integer,
  access_policy   media_access_policy not null default 'standard',
  expires_at      timestamptz,
  max_opens       integer,
  opens_used      integer not null default 0,
  opened_at       timestamptz,
  revoked_at      timestamptz,
  status          shared_media_status not null default 'active',
  created_at      timestamptz not null default now(),
  check (char_length(caption) <= 500),
  check (max_opens is null or max_opens between 1 and 20),
  check (opens_used >= 0 and (max_opens is null or opens_used <= max_opens)),
  check (
    (access_policy = 'standard' and expires_at is null and max_opens is null)
    or (access_policy = 'timed' and expires_at is not null)
    or (access_policy = 'view_once' and max_opens = 1)
    or (access_policy = 'open_count' and max_opens is not null)
  )
);
create index if not exists message_attachments_message_idx on public.message_attachments(message_id, created_at);

-- Private albums
create table if not exists public.private_albums (
  id                       uuid primary key default gen_random_uuid(),
  owner_id                 uuid not null references public.profiles(id) on delete cascade,
  name                     text not null default 'Private album',
  default_access_policy    media_access_policy not null default 'standard',
  default_duration_seconds integer,
  default_max_opens        integer,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (char_length(name) between 1 and 60),
  check (default_duration_seconds is null or default_duration_seconds between 60 and 604800),
  check (default_max_opens is null or default_max_opens between 1 and 20)
);
create index if not exists private_albums_owner_idx on public.private_albums(owner_id, created_at desc);

-- Album shares
create table if not exists public.album_shares (
  id              uuid primary key default gen_random_uuid(),
  album_id        uuid not null references public.private_albums(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  recipient_id    uuid not null references public.profiles(id) on delete cascade,
  access_policy   media_access_policy not null default 'standard',
  expires_at      timestamptz,
  max_opens       integer,
  opens_used      integer not null default 0,
  opened_at       timestamptz,
  revoked_at      timestamptz,
  status          shared_media_status not null default 'pending',
  created_at      timestamptz not null default now(),
  check (sender_id <> recipient_id),
  check (max_opens is null or max_opens between 1 and 20),
  check (opens_used >= 0 and (max_opens is null or opens_used <= max_opens)),
  check (
    (access_policy = 'standard' and expires_at is null and max_opens is null)
    or (access_policy = 'timed' and expires_at is not null)
    or (access_policy = 'view_once' and max_opens = 1)
    or (access_policy = 'open_count' and max_opens is not null)
  )
);
create index if not exists album_shares_conversation_idx on public.album_shares(conversation_id, created_at desc);

-- Add foreign key from messages to album_shares
do $$ begin
  alter table public.messages
    add constraint messages_album_share_fk
    foreign key (album_share_id) references public.album_shares(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Add foreign key from private_album_items to private_albums
do $$ begin
  alter table public.private_album_items
    add constraint album_items_album_fk
    foreign key (album_id) references public.private_albums(id) on delete cascade;
exception when duplicate_object then null; end $$;

-- ------------------------------------------------- offers / availability ---
create table if not exists public.offers (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  activity_ids text[] not null default '{}',
  note         text,
  where_mode   where_mode not null default 'out',
  spots        integer,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  check (char_length(note) <= 200),
  check (expires_at > created_at)
);
create index if not exists offers_live_idx on public.offers (expires_at desc);

create table if not exists public.offer_joins (
  offer_id   uuid not null references public.offers(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'requested',
  created_at timestamptz not null default now(),
  primary key (offer_id, profile_id)
);

-- --------------------------------------------------------------- events ----
create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  host_id      uuid not null references public.profiles(id) on delete cascade,
  title        text not null,
  description  text,
  activity_id  text,
  scale        text not null default 'casual',
  cost         text,
  venue        text,
  address      text,
  city         text,
  lat          double precision,
  lng          double precision,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  capacity     integer,
  explicitness exposure_level not null default 'clean',
  status       text not null default 'published',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (char_length(title) between 3 and 120),
  check (char_length(description) <= 2000)
);
create index if not exists events_starts_idx on public.events (starts_at);
create index if not exists events_city_idx   on public.events (city, starts_at);

create table if not exists public.event_rsvps (
  event_id   uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status     rsvp_status not null default 'going',
  created_at timestamptz not null default now(),
  primary key (event_id, profile_id)
);

-- ---------------------------------------------------------------- board ----
create table if not exists public.board_posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references public.profiles(id) on delete cascade,
  kind         post_kind not null default 'text',
  body         text not null,
  activity_id  text,
  storage_path text,
  city         text,
  area         text,
  spots        integer,
  join_count   integer not null default 0,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  check (char_length(body) between 1 and 400),
  check (spots is null or spots between 1 and 50),
  check (join_count >= 0)
);
create index if not exists board_posts_live_idx on public.board_posts (expires_at desc, created_at desc);

create table if not exists public.board_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.board_posts(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  check (char_length(body) between 1 and 500)
);
create index if not exists board_comments_post_idx on public.board_comments (post_id, created_at);

create table if not exists public.post_joins (
  post_id    uuid not null references public.board_posts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, profile_id)
);

-- -------------------------------------------------- safety & entitlement ---
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,
  target_id   uuid not null,
  reason      text not null,
  details     text,
  status      report_status not null default 'open',
  created_at  timestamptz not null default now(),
  check (char_length(details) <= 1000)
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);

-- Client may READ its own row. Client may NOT write: no INSERT/UPDATE policy
-- is granted in 002_rls.sql, so nobody can self-grant Plus.
create table if not exists public.premium_entitlements (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  tier       plan_tier not null default 'free',
  source     text not null default 'none',
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Written by triggers/service-role only. No client INSERT policy.
create table if not exists public.audit_events (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  target_type text,
  target_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_events (created_at desc);

-- ============================ RLS ON, DENY-ALL ==============================
-- Enabling RLS with zero policies = nothing is readable or writable.
-- 002_rls.sql then grants the minimum necessary.
alter table public.profiles               enable row level security;
alter table public.profile_private        enable row level security;
alter table public.profile_photos         enable row level security;
alter table public.private_album_items    enable row level security;
alter table public.private_albums         enable row level security;
alter table public.album_grants           enable row level security;
alter table public.album_shares           enable row level security;
alter table public.likes                  enable row level security;
alter table public.matches                enable row level security;
alter table public.blocks                 enable row level security;
alter table public.conversations          enable row level security;
alter table public.conversation_members   enable row level security;
alter table public.messages               enable row level security;
alter table public.message_reactions      enable row level security;
alter table public.message_attachments    enable row level security;
alter table public.offers                 enable row level security;
alter table public.offer_joins            enable row level security;
alter table public.events                 enable row level security;
alter table public.event_rsvps            enable row level security;
alter table public.board_posts            enable row level security;
alter table public.board_comments         enable row level security;
alter table public.post_joins             enable row level security;
alter table public.reports                enable row level security;
alter table public.premium_entitlements   enable row level security;
alter table public.audit_events           enable row level security;

-- =========================== VERIFY (paste output back) =====================
-- Expect all FYK public tables, every one rowsecurity = true.
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
