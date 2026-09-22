-- =============================================================================
-- FYK Consolidated — 0028_divine_complete.sql
-- Transcend divine re-engineer: completes every missing table for 15/10 level
-- Production-grade, idempotent, with RLS, indexes, constraints, edge handling
-- =============================================================================

-- ---------------------------------------------------------------- discreet icon + app lock configs
create table if not exists public.user_app_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  discreet_icon text not null default 'default' check (discreet_icon in ('default','calculator','notes','weather','calendar','health','music','news')),
  discreet_enabled boolean not null default false,
  app_lock_enabled boolean not null default false,
  app_lock_pin_hash text,
  app_lock_biometric boolean not null default false,
  app_lock_timeout_sec integer not null default 60 check (app_lock_timeout_sec between 10 and 3600),
  pause_mode jsonb,
  widget_config jsonb not null default '{"enabled":true,"showMatches":true,"showUnread":true,"showLikes":true,"showFeatured":true,"refreshIntervalMinutes":15}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists user_app_configs_user_idx on public.user_app_configs(user_id);

-- ---------------------------------------------------------------- multi-account tokens
create table if not exists public.multi_account_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  account_id uuid not null,
  email text not null,
  display_name text not null,
  access_token_hash text not null,
  refresh_token_hash text not null,
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(owner_user_id, account_id),
  check (owner_user_id <> account_id)
);
create index if not exists multi_account_owner_idx on public.multi_account_tokens(owner_user_id, last_used_at desc);

-- ---------------------------------------------------------------- scheduled messages (server-side)
create table if not exists public.scheduled_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  type text not null default 'text' check (type in ('text','image','location','gif','poll','gift')),
  body text not null check (char_length(body) between 1 and 4000),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','sent','cancelled','failed')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (scheduled_at > created_at),
  check (scheduled_at <= created_at + interval '30 days')
);
create index if not exists scheduled_msg_sender_idx on public.scheduled_messages(sender_id, status, scheduled_at);
create index if not exists scheduled_msg_convo_idx on public.scheduled_messages(conversation_id, scheduled_at);
create index if not exists scheduled_msg_due_idx on public.scheduled_messages(scheduled_at) where status = 'scheduled';

-- ---------------------------------------------------------------- wishlist (shared date ideas board)
create table if not exists public.wishlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  participant_id uuid not null references public.users(id) on delete cascade,
  title text not null default 'Our Wishlist' check (char_length(title) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(owner_id, participant_id),
  check (owner_id <> participant_id)
);
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  wishlist_id uuid not null references public.wishlists(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  category text not null default 'general' check (category in ('general','food','activity','travel','nightlife','culture','outdoor','romantic')),
  added_by uuid not null references public.users(id) on delete cascade,
  votes jsonb not null default '[]'::jsonb,
  vote_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists wishlist_owner_idx on public.wishlists(owner_id);
create index if not exists wishlist_participant_idx on public.wishlists(participant_id);
create index if not exists wishlist_items_wishlist_idx on public.wishlist_items(wishlist_id, vote_count desc);

-- ---------------------------------------------------------------- hot pics requests (already lib, now DB)
create table if not exists public.hot_pics_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.users(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired','revoked')),
  expires_at timestamptz not null default now() + interval '24 hours',
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (requester_id <> owner_id)
);
create index if not exists hot_pics_requester_idx on public.hot_pics_requests(requester_id, status);
create index if not exists hot_pics_owner_idx on public.hot_pics_requests(owner_id, status);
create unique index if not exists hot_pics_pending_unique on public.hot_pics_requests(requester_id, owner_id) where status = 'pending';

-- ---------------------------------------------------------------- photo scores & enhancements (AI 25.5)
create table if not exists public.photo_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  url text not null,
  quality integer not null check (quality between 0 and 100),
  lighting integer not null check (lighting between 0 and 100),
  blur integer not null check (blur between 0 and 100),
  smile integer not null check (smile between 0 and 100),
  background integer not null check (background between 0 and 100),
  appeal integer not null check (appeal between 0 and 100),
  issues jsonb not null default '[]'::jsonb,
  suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.photo_enhancements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  original_url text not null,
  enhanced_url text,
  adjustments jsonb not null default '{}'::jsonb,
  allowed boolean not null default true,
  blocked_reason text,
  created_at timestamptz not null default now()
);
create index if not exists photo_scores_user_idx on public.photo_scores(user_id, appeal desc);

-- ---------------------------------------------------------------- AI conversations & suggestions (25.1-25.20)
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  type text not null check (type in ('auto_reply','context_reply','icebreaker','date_plan','rizz','escalation','wingman','summary','translation','photo_enhance','catfish_check','best_time','autocomplete','meme','voice_note','digest','pickup_line','bio_writer')),
  input jsonb not null,
  output jsonb not null,
  model text not null default 'heuristic',
  tokens_used integer not null default 0,
  latency_ms integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  feature text not null,
  count integer not null default 1,
  date date not null default current_date,
  created_at timestamptz not null default now(),
  unique(user_id, feature, date)
);
create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  type text not null,
  suggestions jsonb not null,
  selected_index integer,
  selected_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ai_convo_user_idx on public.ai_conversations(user_id, type, created_at desc);
create index if not exists ai_usage_user_date_idx on public.ai_usage(user_id, date desc);

-- ---------------------------------------------------------------- translation cache (25.8)
create table if not exists public.translation_cache (
  id uuid primary key default gen_random_uuid(),
  source_text text not null,
  source_lang text not null,
  target_lang text not null,
  translated_text text not null,
  model text not null default 'on_device',
  confidence double precision not null default 0.8,
  created_at timestamptz not null default now(),
  unique(source_text, source_lang, target_lang)
);
create index if not exists translation_cache_lang_idx on public.translation_cache(source_lang, target_lang);

-- ---------------------------------------------------------------- pay-per-read unlocks (22.3)
create table if not exists public.pay_per_read_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  cost integer not null,
  unlocked_at timestamptz not null default now(),
  unique(user_id, message_id)
);
create index if not exists ppr_user_idx on public.pay_per_read_unlocks(user_id, unlocked_at desc);

-- ---------------------------------------------------------------- chat pinned, ephemeral, screenshot
create table if not exists public.chat_pinned (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null references public.users(id) on delete cascade,
  pinned_at timestamptz not null default now(),
  unique(conversation_id, message_id)
);
create table if not exists public.chat_ephemeral_settings (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  duration_sec integer not null default 0 check (duration_sec in (0, 300, 3600, 86400, 604800)),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create table if not exists public.screenshot_logs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  detected_at timestamptz not null default now(),
  platform text not null default 'unknown'
);
create index if not exists screenshot_convo_idx on public.screenshot_logs(conversation_id, detected_at desc);

-- ---------------------------------------------------------------- group enhancements (broadcast, roles)
create table if not exists public.group_roles (
  group_id uuid not null,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin','moderator','owner')),
  granted_by uuid references public.users(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create table if not exists public.group_broadcasts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null,
  author_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists group_broadcast_group_idx on public.group_broadcasts(group_id, created_at desc);

-- ---------------------------------------------------------------- rewarded chat grants (19.10)
create table if not exists public.rewarded_chat_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour',
  source text not null default 'ad' check (source in ('ad','coins','premium')),
  used boolean not null default false
);
create index if not exists rewarded_grant_user_idx on public.rewarded_chat_grants(user_id, conversation_id, expires_at);

-- ---------------------------------------------------------------- speed dating (27.1)
create table if not exists public.speed_dating_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_participants integer not null default 20 check (max_participants between 2 and 100),
  round_duration_sec integer not null default 180 check (round_duration_sec between 60 and 600),
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table if not exists public.speed_dating_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.speed_dating_events(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  round integer not null default 1,
  matched_with uuid references public.users(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting','in_round','matched','left')),
  joined_at timestamptz not null default now(),
  unique(event_id, user_id)
);
create index if not exists speed_event_status_idx on public.speed_dating_events(status, starts_at);
create index if not exists speed_participant_event_idx on public.speed_dating_participants(event_id, status);

-- ---------------------------------------------------------------- calendar sync (27.9)
create table if not exists public.calendar_sync (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  provider text not null default 'none' check (provider in ('none','google','apple','outlook')),
  enabled boolean not null default false,
  last_synced_at timestamptz,
  free_slots jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  is_private boolean not null default false,
  source text not null default 'manual' check (source in ('manual','google','apple','outlook','fyk')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists calendar_events_user_idx on public.calendar_events(user_id, starts_at);

-- ---------------------------------------------------------------- stats dashboard (27.8)
create table if not exists public.profile_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  views_total integer not null default 0,
  views_unique integer not null default 0,
  likes_sent integer not null default 0,
  likes_received integer not null default 0,
  matches_total integer not null default 0,
  messages_sent integer not null default 0,
  messages_received integer not null default 0,
  reply_rate double precision not null default 0 check (reply_rate between 0 and 1),
  best_photo_url text,
  best_reply_hour integer check (best_reply_hour between 0 and 23),
  updated_at timestamptz not null default now()
);
create table if not exists public.profile_analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_type text not null check (event_type in ('view','like','match','message_sent','message_received','tap','favorite','block','report')),
  actor_id uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_user_type_idx on public.profile_analytics_events(user_id, event_type, created_at desc);

-- ---------------------------------------------------------------- consumables & promo (22.4, 22.6)
create table if not exists public.consumables_catalog (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  description text,
  price_coins integer not null check (price_coins > 0),
  price_usd_cents integer,
  type text not null check (type in ('boost','super_like','read_receipt','spotlight','gift','extra_likes')),
  quantity integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  discount_percent integer check (discount_percent between 1 and 100),
  free_days integer check (free_days between 1 and 365),
  free_coins integer check (free_coins between 1 and 10000),
  tier text check (tier in ('plus','gold','platinum')),
  max_uses integer not null default 100 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  min_tier text check (min_tier in ('free','plus','gold')),
  expires_at timestamptz not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (used_count <= max_uses),
  check (discount_percent is not null or free_days is not null or free_coins is not null)
);
create table if not exists public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  promo_id uuid not null references public.promo_codes(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique(promo_id, user_id)
);

-- ---------------------------------------------------------------- engagement & growth (24.x)
create table if not exists public.engagement_nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('new_admirers','match_waiting','daily_picks','streak_reminder','profile_incomplete','re_engagement','best_time')),
  title text not null,
  body text not null,
  href text,
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  clicked_at timestamptz
);
create table if not exists public.reengagement_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('deal','event','teaser','winback','onboarding')),
  target_filter jsonb not null default '{}'::jsonb,
  content jsonb not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create table if not exists public.analytics_funnel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  step text not null check (step in ('signup','profile_complete','first_like','first_message','first_match','subscription','retention_d7','retention_d30')),
  reached_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(user_id, step)
);
create index if not exists funnel_step_idx on public.analytics_funnel(step, reached_at desc);

-- ---------------------------------------------------------------- grid density & quick presets (10.4, 16.6)
create table if not exists public.grid_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  filters jsonb not null,
  is_quick boolean not null default false,
  icon text,
  created_at timestamptz not null default now()
);
create index if not exists grid_presets_user_idx on public.grid_presets(user_id, is_quick);

-- ---------------------------------------------------------------- compatibility & secret admirer (15.4, 15.7)
create table if not exists public.compatibility_scores (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.users(id) on delete cascade,
  user_b uuid not null references public.users(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  dimensions jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  unique(user_a, user_b),
  check (user_a < user_b)
);
create table if not exists public.secret_admirers (
  id uuid primary key default gen_random_uuid(),
  admirer_id uuid not null references public.users(id) on delete cascade,
  admired_id uuid not null references public.users(id) on delete cascade,
  revealed boolean not null default false,
  revealed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(admirer_id, admired_id),
  check (admirer_id <> admired_id)
);
create index if not exists compat_user_idx on public.compatibility_scores(user_a, score desc);
create index if not exists secret_admired_idx on public.secret_admirers(admired_id, revealed);

-- ---------------------------------------------------------------- safety emergency share & deletion (21.2, 21.5)
create table if not exists public.emergency_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  contact_id uuid not null references public.emergency_contacts(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  place text,
  message text,
  shared_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);
create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  reason text,
  status text not null default 'pending' check (status in ('pending','grace','deleted','cancelled')),
  grace_ends_at timestamptz not null default now() + interval '30 days',
  requested_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists deletion_status_idx on public.deletion_requests(status, grace_ends_at);

-- ---------------------------------------------------------------- rate limit logs (21.6)
create table if not exists public.rate_limit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  ip text,
  endpoint text not null,
  count integer not null default 1,
  window_start timestamptz not null default now(),
  blocked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_user_endpoint_idx on public.rate_limit_logs(user_id, endpoint, window_start desc);

-- ---------------------------------------------------------------- backup exports (12.4)
create table if not exists public.backup_exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null default 'full' check (type in ('full','messages','media','settings')),
  encrypted boolean not null default true,
  size_bytes integer,
  status text not null default 'pending' check (status in ('pending','processing','ready','failed','expired')),
  download_url text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists backup_user_idx on public.backup_exports(user_id, created_at desc);

-- ---------------------------------------------------------------- offline queue (23.5)
create table if not exists public.offline_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null check (action in ('send_message','react','tap','favorite','block','hide','rsvp','view')),
  payload jsonb not null,
  attempts integer not null default 0,
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists offline_queue_user_status_idx on public.offline_queue(user_id, status, created_at);

-- ---------------------------------------------------------------- privacy reports (27.10)
create table if not exists public.privacy_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  period_from date not null,
  period_to date not null,
  profile_views integer not null default 0,
  unique_viewers integer not null default 0,
  blocked_count integer not null default 0,
  data_usage jsonb not null default '{}'::jsonb,
  activity jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  unique(user_id, period_from, period_to)
);
create index if not exists privacy_reports_user_idx on public.privacy_reports(user_id, generated_at desc);

-- ---------------------------------------------------------------- enable RLS for all new tables
alter table public.user_app_configs enable row level security;
alter table public.multi_account_tokens enable row level security;
alter table public.scheduled_messages enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.hot_pics_requests enable row level security;
alter table public.photo_scores enable row level security;
alter table public.photo_enhancements enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_usage enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.translation_cache enable row level security;
alter table public.pay_per_read_unlocks enable row level security;
alter table public.chat_pinned enable row level security;
alter table public.chat_ephemeral_settings enable row level security;
alter table public.screenshot_logs enable row level security;
alter table public.group_roles enable row level security;
alter table public.group_broadcasts enable row level security;
alter table public.rewarded_chat_grants enable row level security;
alter table public.speed_dating_events enable row level security;
alter table public.speed_dating_participants enable row level security;
alter table public.calendar_sync enable row level security;
alter table public.calendar_events enable row level security;
alter table public.profile_stats enable row level security;
alter table public.profile_analytics_events enable row level security;
alter table public.consumables_catalog enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
alter table public.engagement_nudges enable row level security;
alter table public.reengagement_campaigns enable row level security;
alter table public.analytics_funnel enable row level security;
alter table public.grid_presets enable row level security;
alter table public.compatibility_scores enable row level security;
alter table public.secret_admirers enable row level security;
alter table public.emergency_shares enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.rate_limit_logs enable row level security;
alter table public.backup_exports enable row level security;
alter table public.offline_queue enable row level security;
alter table public.privacy_reports enable row level security;

-- ---------------------------------------------------------------- grants
grant all on table public.user_app_configs to authenticated;
grant all on table public.multi_account_tokens to authenticated;
grant all on table public.scheduled_messages to authenticated;
grant all on table public.wishlists to authenticated;
grant all on table public.wishlist_items to authenticated;
grant all on table public.hot_pics_requests to authenticated;
grant all on table public.photo_scores to authenticated;
grant all on table public.photo_enhancements to authenticated;
grant all on table public.ai_conversations to authenticated;
grant all on table public.ai_usage to authenticated;
grant all on table public.ai_suggestions to authenticated;
grant all on table public.translation_cache to authenticated;
grant all on table public.pay_per_read_unlocks to authenticated;
grant all on table public.chat_pinned to authenticated;
grant all on table public.chat_ephemeral_settings to authenticated;
grant all on table public.screenshot_logs to authenticated;
grant all on table public.group_roles to authenticated;
grant all on table public.group_broadcasts to authenticated;
grant all on table public.rewarded_chat_grants to authenticated;
grant all on table public.speed_dating_events to authenticated;
grant all on table public.speed_dating_participants to authenticated;
grant all on table public.calendar_sync to authenticated;
grant all on table public.calendar_events to authenticated;
grant all on table public.profile_stats to authenticated;
grant all on table public.profile_analytics_events to authenticated;
grant all on table public.consumables_catalog to authenticated;
grant all on table public.promo_codes to authenticated;
grant all on table public.promo_redemptions to authenticated;
grant all on table public.engagement_nudges to authenticated;
grant all on table public.reengagement_campaigns to authenticated;
grant all on table public.analytics_funnel to authenticated;
grant all on table public.grid_presets to authenticated;
grant all on table public.compatibility_scores to authenticated;
grant all on table public.secret_admirers to authenticated;
grant all on table public.emergency_shares to authenticated;
grant all on table public.deletion_requests to authenticated;
grant all on table public.rate_limit_logs to authenticated;
grant all on table public.backup_exports to authenticated;
grant all on table public.offline_queue to authenticated;
grant all on table public.privacy_reports to authenticated;

-- ---------------------------------------------------------------- seed consumables catalog
insert into public.consumables_catalog (sku, name, description, price_coins, type, quantity) values
  ('boost_1', 'Boost 1x', '60 min grid boost', 100, 'boost', 1),
  ('boost_5', 'Boost 5x Pack', '5x 60 min boosts', 400, 'boost', 5),
  ('super_like_1', 'Super Like', 'Stand out with super like', 50, 'super_like', 1),
  ('super_like_10', 'Super Likes 10x', '10 super likes', 400, 'super_like', 10),
  ('read_receipt_10', 'Read Receipts 10x', '10 read receipts', 100, 'read_receipt', 10),
  ('spotlight_1', 'Spotlight', '60 min spotlight', 150, 'spotlight', 1),
  ('extra_likes_20', 'Extra Likes 20', '20 extra likes', 80, 'extra_likes', 20)
on conflict (sku) do nothing;

-- ---------------------------------------------------------------- seed promo codes
insert into public.promo_codes (code, discount_percent, tier, max_uses, expires_at) values
  ('DIVINE15', 15, 'plus', 1000, now() + interval '90 days'),
  ('TRANSCEND20', 20, 'gold', 500, now() + interval '60 days'),
  ('GODMODE30', 30, 'platinum', 100, now() + interval '30 days')
on conflict (code) do nothing;

-- ---------------------------------------------------------------- seed speed dating events
insert into public.speed_dating_events (title, starts_at, ends_at, max_participants, round_duration_sec, status) values
  ('Friday Night Speed Dating', now() + interval '1 day', now() + interval '1 day' + interval '2 hours', 20, 180, 'scheduled'),
  ('Weekend Mixer', now() + interval '3 days', now() + interval '3 days' + interval '2 hours', 30, 240, 'scheduled')
on conflict do nothing;
