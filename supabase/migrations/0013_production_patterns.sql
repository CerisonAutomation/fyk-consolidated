-- =============================================================================
-- FYK Consolidated — 0013_production_patterns.sql
-- Fixes based on postgresql.md, postgis.md, pgvector.md, database-indexing.md,
-- and query-optimization.md documentation audit.
--
-- This migration fixes:
--   1. pgvector: IVFFlat -> HNSW indexes, missing indexes, function fixes
--   2. PostGIS: Add geography columns and spatial indexes
--   3. Indexing: Missing partial/composite/GIN indexes
--   4. Query optimization: Fix vector search functions
--   5. Constraints: Add CHECK constraints for data integrity
--   6. Autovacuum: Tune for high-update and vector tables
-- =============================================================================

-- ===========================================
-- 1. PGVECTOR: Replace IVFFlat with HNSW
-- ===========================================
-- Per pgvector.md: "HNSW indexes are recommended for production"
-- IVFFlat degrades with incremental inserts, needs REINDEX.
-- HNSW handles inserts well and has better recall (~99% vs ~95%).

-- Drop old IVFFlat indexes
DROP INDEX IF EXISTS public.profile_embeddings_idx;
DROP INDEX IF EXISTS public.message_embeddings_idx;

-- HNSW index for profile embeddings (m=16, ef_construction=64 per docs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profile_embeddings_hnsw
  ON public.profile_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- HNSW index for message embeddings
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_embeddings_hnsw
  ON public.message_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- HNSW index for tag embeddings (was missing entirely)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tag_embeddings_hnsw
  ON public.tag_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ===========================================
-- 2. POSTGIS: Add spatial columns and indexes
-- ===========================================
-- Per postgis.md: Use GEOGRAPHY(POINT, 4326) for web apps with GPS coordinates.
-- GEOGRAPHY gives meter-based distances and correct results across projections.

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography column to profiles (convert from plain lat/lng doubles)
-- Using GEOGRAPHY not GEOMETRY for correct meter-based distance calculations
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD COLUMN location GEOGRAPHY(POINT, 4326);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Populate location from existing lat_coarse/lng_coarse if present
UPDATE public.profiles
SET location = ST_SetSRID(ST_MakePoint(lng_coarse, lat_coarse), 4326)::geography
WHERE location IS NULL AND lat_coarse IS NOT NULL AND lng_coarse IS NOT NULL;

-- GiST index for spatial queries (KNN, DWithin, containment)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_location_gist
  ON public.profiles USING GIST (location);

-- Add geography to events table
DO $$ BEGIN
  ALTER TABLE public.events
    ADD COLUMN location GEOGRAPHY(POINT, 4326);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

UPDATE public.events
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE location IS NULL AND lat IS NOT NULL AND lng IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_location_gist
  ON public.events USING GIST (location);

-- Add geography to board_posts
DO $$ BEGIN
  ALTER TABLE public.board_posts
    ADD COLUMN location GEOGRAPHY(POINT, 4326);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_board_posts_location_gist
  ON public.board_posts USING GIST (location);

-- ===========================================
-- 3. MISSING INDEXES
-- ===========================================
-- Per database-indexing.md: partial indexes for common query patterns,
-- composite indexes with equality before range, GIN for JSONB.

-- --- profiles table indexes ---

-- Partial index: visible, non-suspended, onboarding-complete profiles (most common browse query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_browseable
  ON public.profiles (city, last_active_at DESC)
  WHERE onboarding_completed_at IS NOT NULL
    AND NOT is_suspended
    AND NOT incognito;

-- Partial index: active profiles (online or recently active)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_active
  ON public.profiles (last_active_at DESC)
  WHERE onboarding_completed_at IS NOT NULL
    AND NOT is_suspended;

-- Expression index for case-insensitive handle lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_handle_lower
  ON public.profiles (LOWER(handle))
  WHERE handle IS NOT NULL;

-- --- events indexes ---

-- Composite: city-filtered upcoming events sorted by start time
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_events_upcoming
  ON public.events (city, starts_at DESC)
  WHERE status = 'published' AND starts_at > now();

-- --- board_posts indexes ---

-- Partial: only live (non-expired) posts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_board_posts_active
  ON public.board_posts (created_at DESC)
  WHERE expires_at > now();

-- --- messages indexes ---

-- Partial index: unread messages (most common notification query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_unsent
  ON public.messages (conversation_id, created_at DESC)
  WHERE unsent_at IS NULL AND (expires_at IS NULL OR expires_at > now());

-- --- likes indexes ---

-- Composite for mutual-like check (used by handle_mutual_like trigger)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_likes_from_to
  ON public.likes (from_id, to_id);

-- --- offers indexes ---

-- Partial: live (non-expired) offers
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offers_active
  ON public.offers (owner_id, created_at DESC)
  WHERE expires_at > now();

-- --- notification indexes ---

-- Partial: unread notifications (most common query)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read = false;

-- --- 0010_remaining_tables indexes (add missing ones) ---

-- taps: mutual-tap check (used for match logic)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_taps_mutual
  ON public.taps (tapped_id, tapper_id);

-- sessions: expiry cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expiry
  ON public.sessions (expires_at)
  WHERE expires_at < now();

-- footprints: per-user browse history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_footprints_visitor
  ON public.footprints (visitor_id, created_at DESC);

-- message_reads: check if message was read
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_reads_message
  ON public.message_reads (message_id);

-- stories: active stories per user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stories_active
  ON public.stories (user_id, created_at DESC)
  WHERE expires_at > now();

-- shout_likes: per-shout like count
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shout_likes_shout
  ON public.shout_likes (shout_id);

-- consumables_inventory: active items per user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consumables_active
  ON public.consumables_inventory (user_id, type)
  WHERE expires_at IS NULL OR expires_at > now();

-- wallet_transactions: per-wallet history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wallet_tx_wallet
  ON public.wallet_transactions (wallet_id, created_at DESC);

-- subscriptions: active subscription per user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_active
  ON public.subscriptions (user_id, status)
  WHERE status = 'active';

-- ai_match_scores: lookup by user pair
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_match_scores_reverse
  ON public.ai_match_scores (user2_id, user1_id);

-- ai_memory: per-user memory lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_memory_user
  ON public.ai_memory (user_id, kind, created_at DESC);

-- ai_suggestions: pending suggestions per user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_suggestions_pending
  ON public.ai_suggestions (user_id, created_at DESC)
  WHERE accepted = false;

-- event_waitlist: per-event position
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_waitlist_event
  ON public.event_waitlist (event_id, position);

-- saved_filters: per-user filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_saved_filters_user
  ON public.saved_filters (user_id);

-- typing_indicators: cleanup of stale indicators
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_typing_indicators_stale
  ON public.typing_indicators (created_at)
  WHERE created_at < now() - interval '10 seconds';

-- push_subscriptions: per-user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_push_subs_user
  ON public.push_subscriptions (user_id);

-- group_messages: per-group message history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_group_messages_group
  ON public.group_messages (group_id, created_at DESC);

-- group_members: per-user group membership
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_group_members_user
  ON public.group_members (user_id);

-- user_notes: per-user notes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_notes_owner
  ON public.user_notes (note_owner_id);

-- ===========================================
-- 4. QUERY OPTIMIZATION: Fix vector functions
-- ===========================================
-- Per pgvector.md: filter with WHERE before ORDER BY for efficiency.
-- The old functions referenced public.users which may not exist in the
-- new schema. Fix to use public.profiles.

CREATE OR REPLACE FUNCTION public.find_similar_profiles(
  query_embedding vector(384),
  match_count int DEFAULT 20,
  match_threshold float DEFAULT 0.5
)
RETURNS TABLE (
  profile_id uuid,
  similarity float,
  display_name text,
  avatar_url text,
  age int,
  city text
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    pe.profile_id,
    1 - (pe.embedding <=> query_embedding) AS similarity,
    p.display_name,
    p.avatar_url,
    p.age,
    p.city
  FROM public.profile_embeddings pe
  JOIN public.profiles p ON p.id = pe.profile_id
  WHERE 1 - (pe.embedding <=> query_embedding) > match_threshold  -- Filter FIRST (docs: "Only return results with similarity > 0.80")
    AND p.id != auth.uid()
    AND NOT p.is_suspended
    AND p.onboarding_completed_at IS NOT NULL
  ORDER BY pe.embedding <=> query_embedding  -- Then sort
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.find_similar_messages(
  query_embedding vector(384),
  conv_id uuid,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  message_id uuid,
  similarity float,
  content text,
  sender_id uuid,
  created_at timestamptz
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    me.message_id,
    1 - (me.embedding <=> query_embedding) AS similarity,
    m.body AS content,
    m.sender_id,
    m.created_at
  FROM public.message_embeddings me
  JOIN public.messages m ON m.id = me.message_id
  WHERE m.conversation_id = conv_id
    AND (m.expires_at IS NULL OR m.expires_at > now())  -- Exclude expired messages
    AND m.unsent_at IS NULL                               -- Exclude unsent messages
  ORDER BY me.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ===========================================
-- 5. CONSTRAINTS: Add CHECK constraints
-- ===========================================
-- Per postgresql.md: "Hard constraint at the database level, not just in the UI"

-- wallet_transactions.type constraint
DO $$ BEGIN
  ALTER TABLE public.wallet_transactions
    ADD CONSTRAINT wallet_tx_type_check
    CHECK (type IN ('earn', 'spend', 'refund', 'bonus', 'streak', 'adventure', 'gift'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- wallet_transactions.amount: must be positive
DO $$ BEGIN
  ALTER TABLE public.wallet_transactions
    ADD CONSTRAINT wallet_tx_amount_check
    CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- subscriptions.status constraint
DO $$ BEGIN
  ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'expired'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- subscriptions.tier constraint
DO $$ BEGIN
  ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_tier_check
    CHECK (tier IN ('free', 'plus', 'premium'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- stories.media_type constraint
DO $$ BEGIN
  ALTER TABLE public.stories
    ADD CONSTRAINT stories_media_type_check
    CHECK (media_type IN ('image', 'video', 'text'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- group_messages.type constraint
DO $$ BEGIN
  ALTER TABLE public.group_messages
    ADD CONSTRAINT group_messages_type_check
    CHECK (type IN ('text', 'image', 'video', 'system'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- group_members.role constraint
DO $$ BEGIN
  ALTER TABLE public.group_members
    ADD CONSTRAINT group_members_role_check
    CHECK (role IN ('member', 'moderator', 'admin', 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- groups.privacy constraint
DO $$ BEGIN
  ALTER TABLE public.groups
    ADD CONSTRAINT groups_privacy_check
    CHECK (privacy IN ('public', 'private', 'secret'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- offers.spots: must be positive when set
DO $$ BEGIN
  ALTER TABLE public.offers
    ADD CONSTRAINT offers_spots_check
    CHECK (spots IS NULL OR spots > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- events.capacity: must be positive when set
DO $$ BEGIN
  ALTER TABLE public.events
    ADD CONSTRAINT events_capacity_check
    CHECK (capacity IS NULL OR capacity > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- board_posts.spots: must be positive when set
DO $$ BEGIN
  ALTER TABLE public.board_posts
    ADD CONSTRAINT board_posts_spots_check
    CHECK (spots IS NULL OR spots > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- notifications.type constraint
DO $$ BEGIN
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN ('like', 'match', 'message', 'event', 'mention', 'system', 'grant', 'report'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- consumables_inventory.type constraint
DO $$ BEGIN
  ALTER TABLE public.consumables_inventory
    ADD CONSTRAINT consumables_type_check
    CHECK (type IN ('boost', 'super_like', 'profile_spotlight', 'read_receipt', 'incognito'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- king_pet.stage constraint
DO $$ BEGIN
  ALTER TABLE public.king_pet
    ADD CONSTRAINT king_pet_stage_check
    CHECK (stage IN ('baby', 'juvenile', 'adult', 'elder'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- king_pet.mood constraint
DO $$ BEGIN
  ALTER TABLE public.king_pet
    ADD CONSTRAINT king_pet_mood_check
    CHECK (mood IN ('happy', 'sad', 'hungry', 'playful', 'sleepy', 'excited'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================
-- 6. AUTOVACUUM TUNING
-- ===========================================
-- Per postgresql.md: "Table-specific for high-update tables"

-- messages: high write volume, needs aggressive autovacuum
ALTER TABLE public.messages SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_vacuum_cost_delay = 0
);

-- notifications: high write volume
ALTER TABLE public.notifications SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.01,
  autovacuum_vacuum_cost_delay = 0
);

-- taps: high write volume (matches trigger)
ALTER TABLE public.taps SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01
);

-- likes: high write volume (mutual like trigger)
ALTER TABLE public.likes SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.01
);

-- profile_embeddings: vector table, needs fresh stats for HNSW
ALTER TABLE public.profile_embeddings SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- message_embeddings: vector table
ALTER TABLE public.message_embeddings SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02
);

-- ===========================================
-- 7. STATISTICS TARGETS
-- ===========================================
-- Per postgresql.md: "Increase for columns with complex distributions"

-- profiles: city has high cardinality, used in browse queries
ALTER TABLE public.profiles ALTER COLUMN city SET STATISTICS 200;

-- events: starts_at is critical for range queries
ALTER TABLE public.events ALTER COLUMN starts_at SET STATISTICS 200;

-- messages: conversation_id is the primary access pattern
ALTER TABLE public.messages ALTER COLUMN conversation_id SET STATISTICS 200;

-- ===========================================
-- 8. CONCURRENTLY index creation fallback
-- ===========================================
-- Note: CONCURRENTLY cannot run inside a transaction block.
-- If running via Supabase CLI (which wraps in a transaction), remove
-- CONCURRENTLY and run indexes in a separate migration step.
-- The indexes above use CONCURRENTLY for production safety.

-- Run ANALYZE on all modified tables to update planner statistics
ANALYZE public.profiles;
ANALYZE public.events;
ANALYZE public.messages;
ANALYZE public.board_posts;
ANALYZE public.likes;
ANALYZE public.taps;
ANALYZE public.notifications;
ANALYZE public.profile_embeddings;
ANALYZE public.message_embeddings;
ANALYZE public.tag_embeddings;
ANALYZE public.wallet_transactions;
ANALYZE public.subscriptions;
ANALYZE public.stories;
ANALYZE public.footprints;
ANALYZE public.message_reads;
ANALYZE public.consumables_inventory;
ANALYZE public.group_messages;
ANALYZE public.group_members;
ANALYZE public.user_notes;
ANALYZE public.ai_match_scores;
ANALYZE public.ai_memory;
ANALYZE public.ai_suggestions;
ANALYZE public.event_waitlist;
ANALYZE public.saved_filters;
ANALYZE public.push_subscriptions;
ANALYZE public.typing_indicators;
ANALYZE public.shout_likes;
ANALYZE public.offers;
ANALYZE public.sessions;
ANALYZE public.king_pet;
ANALYZE public.wallet;

-- =============================================================================
-- VERIFICATION QUERIES (paste output back)
-- =============================================================================

-- A) Verify HNSW indexes exist (should show 3 rows)
SELECT indexname, indexdef
FROM pg_indexes
WHERE indexname LIKE '%hnsw%'
  AND schemaname = 'public';

-- B) Verify spatial indexes (should show 3 rows)
SELECT indexname, indexdef
FROM pg_indexes
WHERE indexdef LIKE '%gist%'
  AND schemaname = 'public'
  AND indexname LIKE '%location%';

-- C) Verify partial indexes (should show many rows)
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexdef LIKE '%WHERE%';

-- D) Verify constraints (should show new CHECK constraints)
SELECT conname, contype, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND contype = 'c'
ORDER BY conname;

-- E) Verify ANALYZE ran (no pending stats)
SELECT relname, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;
