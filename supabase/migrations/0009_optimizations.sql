-- Connection pooling hints
ALTER SYSTEM SET max_connections = '100';
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '768MB';
ALTER SYSTEM SET work_mem = '16MB';
ALTER SYSTEM SET maintenance_work_mem = '256MB';

-- Query performance indexes
CREATE INDEX IF NOT EXISTS users_last_active_idx ON public.users (last_active_at DESC);
CREATE INDEX IF NOT EXISTS users_geo_idx ON public.users (lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS users_city_idx ON public.users (city);
CREATE INDEX IF NOT EXISTS users_tier_idx ON public.users (tier);
CREATE INDEX IF NOT EXISTS users_tribes_idx ON public.users USING GIN (tribes);
CREATE INDEX IF NOT EXISTS users_interests_idx ON public.users USING GIN (interests);
CREATE INDEX IF NOT EXISTS users_looking_for_idx ON public.users USING GIN (looking_for);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS messages_type_idx ON public.messages (type);

CREATE INDEX IF NOT EXISTS taps_tapper_idx ON public.taps (tapper_id, created_at DESC);
CREATE INDEX IF NOT EXISTS taps_tapped_idx ON public.taps (tapped_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications (user_id, read) WHERE NOT read;
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS events_starts_idx ON public.events (start_time);
CREATE INDEX IF NOT EXISTS events_city_idx ON public.events (city, start_time);

CREATE INDEX IF NOT EXISTS stories_expires_idx ON public.stories (expires_at);
CREATE INDEX IF NOT EXISTS story_views_story_idx ON public.story_views (story_id);

-- Partial indexes for common queries
CREATE INDEX IF NOT EXISTS users_online_idx ON public.users (last_seen DESC) WHERE online = true;
CREATE INDEX IF NOT EXISTS users_visible_idx ON public.users (id) WHERE NOT hidden AND NOT incognito;
CREATE INDEX IF NOT EXISTS conversations_active_idx ON public.conversations (last_message_at DESC);

-- Materialized view for user stats (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS public.user_stats AS
SELECT
  u.id,
  u.pseudo,
  u.city,
  u.tier,
  COUNT(DISTINCT t.id) AS tap_count,
  COUNT(DISTINCT f.id) AS favorite_count,
  COUNT(DISTINCT m.id) AS match_count,
  MAX(t.created_at) AS last_tap
FROM public.users u
LEFT JOIN public.taps t ON t.tapper_id = u.id
LEFT JOIN public.favorites f ON f.user_id = u.id
LEFT JOIN public.matches m ON m.user1_id = u.id OR m.user2_id = u.id
GROUP BY u.id, u.pseudo, u.city, u.tier;

CREATE UNIQUE INDEX IF NOT EXISTS user_stats_id_idx ON public.user_stats (id);
