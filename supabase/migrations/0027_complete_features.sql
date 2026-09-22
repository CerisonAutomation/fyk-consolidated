-- =============================================================================
-- FYK Consolidated — 0027_complete_features.sql
-- Complete feature set: social links, verification, stories, live, gifts,
-- referrals, vouchers, polls, analytics, content ratings, etc.
-- Production-grade, idempotent.
-- =============================================================================

-- ---------------------------------------------------------------- social links
alter table public.users add column if not exists social_links jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists auto_reply_config jsonb;
alter table public.users add column if not exists filter_presets jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists referral_code text;
alter table public.users add column if not exists coins integer not null default 0;
alter table public.users add column if not exists two_factor_enabled boolean not null default false;
alter table public.users add column if not exists boost_expires_at timestamptz;
alter table public.users add column if not exists onboarding_completed_at timestamptz;
alter table public.users add column if not exists age_verified_at timestamptz;
alter table public.users add column if not exists last_seen timestamptz;
alter table public.users add column if not exists lat_coarse double precision;
alter table public.users add column if not exists lng_coarse double precision;
alter table public.users add column if not exists display_name text;
alter table public.users add column if not exists handle text;
alter table public.users add column if not exists avatar text;
alter table public.users add column if not exists bio text;
alter table public.users add column if not exists age integer;
alter table public.users add column if not exists city text;
alter table public.users add column if not exists area text;
alter table public.users add column if not exists status text;
alter table public.users add column if not exists role text default 'user';
alter table public.users add column if not exists tier text default 'free';
alter table public.users add column if not exists verification integer not null default 0;
alter table public.users add column if not exists trust_score integer not null default 50;
alter table public.users add column if not exists profile_complete integer not null default 0;
alter table public.users add column if not exists online boolean not null default false;
alter table public.users add column if not exists visible boolean not null default true;
alter table public.users add column if not exists hidden boolean not null default false;
alter table public.users add column if not exists incognito boolean not null default false;
alter table public.users add column if not exists is_demo boolean not null default false;
alter table public.users add column if not exists is_suspended boolean not null default false;
alter table public.users add column if not exists exposure_level text not null default 'clean';
alter table public.users add column if not exists hide_distance boolean not null default false;
alter table public.users add column if not exists hide_online boolean not null default false;
alter table public.users add column if not exists hide_last_online boolean not null default false;
alter table public.users add column if not exists position jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists languages jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists looking_for jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists intents jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists tag_codes jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists interests jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists tribes jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.users add column if not exists last_active_at timestamptz not null default now();
alter table public.users add column if not exists onboarding_done boolean not null default false;
alter table public.users add column if not exists email text;
alter table public.users add column if not exists lat double precision;
alter table public.users add column if not exists lng double precision;
alter table public.users add column if not exists height integer;
alter table public.users add column if not exists weight integer;
alter table public.users add column if not exists body_type text;
alter table public.users add column if not exists pronouns text;
alter table public.users add column if not exists occupation text;
alter table public.users add column if not exists relationship_status text;
alter table public.users add column if not exists description text;
alter table public.users add column if not exists pseudo text;
alter table public.users add column if not exists nick text;

create unique index if not exists users_referral_code_key on public.users(referral_code) where referral_code is not null;

-- ---------------------------------------------------------------- verification
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  pose text not null,
  selfie_url text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired')),
  confidence double precision,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now()
);
create index if not exists verification_user_idx on public.verification_requests(user_id, status);
create index if not exists verification_status_idx on public.verification_requests(status, created_at desc);

-- ---------------------------------------------------------------- content rating
create table if not exists public.content_ratings (
  id uuid primary key default gen_random_uuid(),
  media_id text not null,
  owner_id uuid not null references public.users(id) on delete cascade,
  url text not null,
  rating text not null default 'UNPROCESSED' check (rating in ('NEUTRAL','EROTIC','HARDCORE','ILLEGAL','UNPROCESSED','QUEUED','REJECTED','BLACKLISTED','DELETING','APP_SAFE')),
  confidence double precision not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  requires_human_review boolean not null default false,
  cdn_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_ratings_owner_idx on public.content_ratings(owner_id, rating);
create index if not exists content_ratings_media_idx on public.content_ratings(media_id);

-- ---------------------------------------------------------------- stories
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('image','video','text')),
  media_url text,
  text text check (char_length(text) <= 500),
  view_count integer not null default 0,
  viewers jsonb not null default '[]'::jsonb,
  expires_at timestamptz not null default now() + interval '24 hours',
  view_once boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists stories_author_idx on public.stories(author_id, created_at desc);
create index if not exists stories_expires_idx on public.stories(expires_at) where expires_at is not null;

-- ---------------------------------------------------------------- live rooms
create table if not exists public.live_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text check (char_length(description) <= 500),
  type text not null default 'video' check (type in ('video','audio')),
  status text not null default 'live' check (status in ('live','ended')),
  viewer_count integer not null default 0,
  peak_viewers integer not null default 0,
  total_coins integer not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
create index if not exists live_rooms_host_idx on public.live_rooms(host_id, status);
create index if not exists live_rooms_status_idx on public.live_rooms(status, viewer_count desc) where status = 'live';

-- ---------------------------------------------------------------- gifts ledger
create table if not exists public.gift_transactions (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.users(id) on delete cascade,
  to_id uuid not null references public.users(id) on delete cascade,
  gift_id text not null,
  cost integer not null,
  creator_receives integer not null,
  context text not null default 'profile' check (context in ('profile','chat','live','post')),
  context_id text,
  message text check (char_length(message) <= 200),
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);
create index if not exists gifts_to_idx on public.gift_transactions(to_id, created_at desc);
create index if not exists gifts_from_idx on public.gift_transactions(from_id, created_at desc);

-- ---------------------------------------------------------------- referrals
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.users(id) on delete cascade,
  referee_id uuid references public.users(id) on delete set null,
  code text not null,
  clicks integer not null default 0,
  conversions integer not null default 0,
  reward_days integer not null default 7,
  reward_coins integer not null default 100,
  created_at timestamptz not null default now(),
  unique(referrer_id, code)
);
create index if not exists referrals_code_idx on public.referrals(code);

-- ---------------------------------------------------------------- vouchers
create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent integer check (discount_percent between 1 and 100),
  free_days integer check (free_days between 1 and 365),
  tier text check (tier in ('plus','gold','platinum')),
  max_uses integer not null default 100,
  used_count integer not null default 0,
  expires_at timestamptz not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (discount_percent is not null or free_days is not null),
  check (used_count <= max_uses)
);

-- ---------------------------------------------------------------- polls
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 200),
  options jsonb not null,
  total_votes integer not null default 0,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists polls_conversation_idx on public.polls(conversation_id, created_at desc);

-- ---------------------------------------------------------------- spotlight
create table if not exists public.spotlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists spotlights_user_idx on public.spotlights(user_id, active) where active = true;
create index if not exists spotlights_active_idx on public.spotlights(ends_at) where active = true;

-- ---------------------------------------------------------------- saved searches
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  filters jsonb not null,
  alerts_enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists saved_searches_user_idx on public.saved_searches(user_id, created_at desc);

-- ---------------------------------------------------------------- chat themes
create table if not exists public.chat_themes (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  background text,
  bubble_color text,
  wallpaper text,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- ---------------------------------------------------------------- blocked reports + appeals
create table if not exists public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('photo','profile','message','ban')),
  target_id text not null,
  reason text not null check (char_length(reason) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists appeals_user_idx on public.appeals(user_id, status);

-- ---------------------------------------------------------------- safety contacts
create table if not exists public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) >= 2),
  phone text not null,
  relationship text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists emergency_contacts_user_idx on public.emergency_contacts(user_id);

-- ---------------------------------------------------------------- data exports
create table if not exists public.data_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  includes jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','ready','expired')),
  download_url text,
  expires_at timestamptz,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists data_exports_user_idx on public.data_exports(user_id, status);

-- ---------------------------------------------------------------- video roulette
create table if not exists public.roulette_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting','matched','ended')),
  matched_with uuid references public.users(id) on delete set null,
  started_at timestamptz not null default now(),
  matched_at timestamptz,
  ended_at timestamptz
);
create index if not exists roulette_user_idx on public.roulette_sessions(user_id, status);

-- ---------------------------------------------------------------- RLS enable
alter table public.verification_requests enable row level security;
alter table public.content_ratings enable row level security;
alter table public.stories enable row level security;
alter table public.live_rooms enable row level security;
alter table public.gift_transactions enable row level security;
alter table public.referrals enable row level security;
alter table public.vouchers enable row level security;
alter table public.polls enable row level security;
alter table public.spotlights enable row level security;
alter table public.saved_searches enable row level security;
alter table public.chat_themes enable row level security;
alter table public.appeals enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.data_exports enable row level security;
alter table public.roulette_sessions enable row level security;

-- ---------------------------------------------------------------- grants (browser can read own rows, write via API)
-- For simplicity in this migration, grant authenticated full access; RLS policies in 002_rls.sql would restrict further.
grant all on table public.verification_requests to authenticated;
grant all on table public.content_ratings to authenticated;
grant all on table public.stories to authenticated;
grant all on table public.live_rooms to authenticated;
grant all on table public.gift_transactions to authenticated;
grant all on table public.referrals to authenticated;
grant all on table public.vouchers to authenticated;
grant all on table public.polls to authenticated;
grant all on table public.spotlights to authenticated;
grant all on table public.saved_searches to authenticated;
grant all on table public.chat_themes to authenticated;
grant all on table public.appeals to authenticated;
grant all on table public.emergency_contacts to authenticated;
grant all on table public.data_exports to authenticated;
grant all on table public.roulette_sessions to authenticated;

-- Seed vouchers
insert into public.vouchers (code, discount_percent, tier, max_uses, expires_at) values
  ('WELCOME10', 10, 'plus', 100, now() + interval '30 days'),
  ('FYKFREE7', null, 'plus', 50, now() + interval '7 days')
on conflict (code) do nothing;

update public.vouchers set free_days = 7 where code = 'FYKFREE7' and free_days is null;
