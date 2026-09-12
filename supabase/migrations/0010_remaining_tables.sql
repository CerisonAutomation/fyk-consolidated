-- Create all remaining tables from Prisma schema

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  phone text,
  password_hash text NOT NULL,
  pseudo text,
  nick text,
  birthday date,
  age integer,
  description text,
  occupation text,
  relationship_status text,
  ethnicity text,
  height integer,
  weight integer,
  body_type text,
  position jsonb DEFAULT '[]',
  languages jsonb DEFAULT '[]',
  looking_for jsonb DEFAULT '[]',
  intents jsonb DEFAULT '[]',
  tag_codes jsonb DEFAULT '[]',
  interests jsonb DEFAULT '[]',
  tribes jsonb DEFAULT '[]',
  photos jsonb DEFAULT '[]',
  geo_mode text,
  h3_index text,
  lat double precision,
  lng double precision,
  city text,
  area text,
  lat_coarse double precision,
  lng_coarse double precision,
  status text DEFAULT 'online',
  role text DEFAULT 'user',
  tier text DEFAULT 'free',
  verification integer DEFAULT 0,
  trust_score integer DEFAULT 50,
  profile_complete integer DEFAULT 0,
  online boolean DEFAULT false,
  visible boolean DEFAULT true,
  hidden boolean DEFAULT false,
  incognito boolean DEFAULT false,
  is_demo boolean DEFAULT false,
  is_suspended boolean DEFAULT false,
  exposure_level text DEFAULT 'clean',
  hide_distance boolean DEFAULT false,
  hide_online boolean DEFAULT false,
  theme text,
  accent text,
  font_size integer DEFAULT 16,
  grid_columns integer DEFAULT 2,
  card_style text,
  dnd_mode boolean DEFAULT false,
  colorblind_mode boolean DEFAULT false,
  language text DEFAULT 'en',
  notif_prefs jsonb DEFAULT '{}',
  ai_prefs jsonb DEFAULT '{}',
  pronouns text,
  apple_id text,
  google_id text,
  last_cursor text,
  last_seen timestamptz DEFAULT now(),
  last_active_at timestamptz DEFAULT now(),
  onboarding_done boolean DEFAULT false,
  onboarding_completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  device text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.taps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tapper_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tapped_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text DEFAULT 'like',
  is_super boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tapper_id, tapped_id)
);

CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, target_id)
);

CREATE TABLE IF NOT EXISTS public.footprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  visited_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  preset text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.typing_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saved_phrases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  cover_url text,
  icon text,
  privacy text DEFAULT 'public',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  member_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  type text DEFAULT 'text',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tribes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  icon text,
  member_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text DEFAULT 'image',
  caption text,
  background text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.story_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE(story_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.shouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  media_url text,
  likes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shout_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shout_id uuid NOT NULL REFERENCES public.shouts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(shout_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.fansites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  cover_url text,
  subscriber_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.meetnow_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  note text,
  location text,
  expires_at timestamptz NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.king_pet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text DEFAULT 'Kingsley',
  stage text DEFAULT 'baby',
  mood text DEFAULT 'happy',
  bones integer DEFAULT 50,
  experience integer DEFAULT 0,
  level integer DEFAULT 1,
  streak integer DEFAULT 0,
  wardrobe jsonb DEFAULT '[]',
  equipped jsonb DEFAULT '[]',
  adventures jsonb DEFAULT '[]',
  mood_log jsonb DEFAULT '[]',
  last_fed_at timestamptz,
  last_played_at timestamptz,
  last_adventure_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  balance integer DEFAULT 50,
  currency text DEFAULT 'bones',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallet(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount integer NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  tier text DEFAULT 'free',
  stripe_subscription_id text,
  status text DEFAULT 'active',
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consumables_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  quantity integer DEFAULT 1,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(note_owner_id, target_user_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  actor_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  href text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  content text NOT NULL,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_match_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dimensions jsonb NOT NULL,
  overall double precision NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS public.ai_safety_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  verdict text NOT NULL,
  confidence double precision NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_chat_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  health_score integer NOT NULL,
  trend text NOT NULL,
  flags jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  content jsonb NOT NULL,
  accepted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pet_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  emoji text,
  bone_cost integer NOT NULL,
  stage_required text DEFAULT 'baby'
);

CREATE TABLE IF NOT EXISTS public.pet_adventures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme text NOT NULL,
  description text,
  emoji text,
  duration_minutes integer DEFAULT 30,
  bone_cost integer NOT NULL,
  reward_type text DEFAULT 'xp',
  reward_amount integer DEFAULT 40
);

-- Create indexes
CREATE INDEX IF NOT EXISTS users_last_active_idx ON public.users (last_active_at DESC);
CREATE INDEX IF NOT EXISTS users_geo_idx ON public.users (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_city_idx ON public.users (city);
CREATE INDEX IF NOT EXISTS users_tribes_idx ON public.users USING GIN (tribes);
CREATE INDEX IF NOT EXISTS users_interests_idx ON public.users USING GIN (interests);
CREATE INDEX IF NOT EXISTS users_looking_for_idx ON public.users USING GIN (looking_for);
CREATE INDEX IF NOT EXISTS taps_tapper_idx ON public.taps (tapper_id, created_at DESC);
CREATE INDEX IF NOT EXISTS taps_tapped_idx ON public.taps (tapped_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS stories_expires_idx ON public.stories (expires_at);
CREATE INDEX IF NOT EXISTS messages_conv_idx ON public.messages (conversation_id, created_at DESC);
