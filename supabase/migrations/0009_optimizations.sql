-- ── Server settings are NOT a migration's business ─────────────────────────
-- This file used to open with five `ALTER SYSTEM SET` statements (max_connections,
-- shared_buffers, effective_cache_size, work_mem, maintenance_work_mem). Two things
-- were wrong with that, and the first made the whole chain unappliable:
--
--   1. `ALTER SYSTEM` writes postgresql.conf and requires a role with
--      `pg_write_server_files`; on Supabase the SQL role does not have it, so the
--      *first statement of this file* aborted `supabase db push` — which meant every
--      migration after 0009 (including the tables 0010 creates, i.e. most of the
--      product) had never been applied in any environment that used the documented
--      path. A migration that cannot run silently teaches a team to apply SQL by
--      hand, and hand-applied SQL is how schema and code part company.
--   2. Even where it is permitted, it is a cluster-wide change requiring a restart,
--      applied by an application deploy, with no rollback and no owner. Sizing belongs
--      to the project's infrastructure (Supabase dashboard → Database → Settings), not
--      to a versioned schema file.
--
-- The settings are therefore removed rather than moved: there is nothing here to
-- re-apply, and a comment in the dashboard is where the numbers live.

-- Query performance indexes

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_sender_idx ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS messages_type_idx ON public.messages (type);

CREATE INDEX IF NOT EXISTS events_starts_idx ON public.events (start_time);
CREATE INDEX IF NOT EXISTS events_city_idx ON public.events (city, start_time);

-- Partial indexes for common queries
CREATE INDEX IF NOT EXISTS conversations_active_idx ON public.conversations (last_message_at DESC);

-- ── What left this file, and why ───────────────────────────────────────────
-- Fifteen indexes and one materialized view referenced `public.users`, `taps`,
-- `notifications`, `stories`, `story_views` — tables that `0010_remaining_tables.sql`
-- creates, i.e. *one file later*. `CREATE INDEX` on a missing table is an error, not a
-- warning, so this file aborted on those statements even after the `ALTER SYSTEM`
-- problem above was removed. They now live in `0023_optimizations_reordered.sql`,
-- unchanged except for the materialized view's join columns, which were written against
-- a schema `matches` has never had (it is `user_a`/`user_b`, per 0000 — `user1_id`
-- appears in no migration, which is why `refresh_user_stats()`, the function
-- `supabase/functions/cron-cleanup` calls, does not exist either: the view it was meant
-- to refresh could never be created).
--
-- `src/lib/migration-invariants.test.ts` now fails the build on any forward reference of
-- this kind, because "apply the migrations in order" is only safe if the files agree
-- with each other about what exists yet.
