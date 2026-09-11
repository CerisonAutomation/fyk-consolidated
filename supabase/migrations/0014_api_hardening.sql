-- ═══════════════════════════════════════════════════════════════════════════
-- 0014 — constraints & indexes the JSON API depends on
-- ═══════════════════════════════════════════════════════════════════════════
-- POST /api/push/subscribe upserts on (user_id, endpoint). Without a unique
-- constraint that upsert is impossible to express, and two devices registering
-- the same endpoint created duplicate rows that both received pushes.
--
-- Idempotent: safe to re-run, and safe on a database created by `pnpm db:push`
-- (where Prisma already added the constraint under the same name).

-- ── push_subscriptions ──────────────────────────────────────────────────────
-- De-duplicate before adding the constraint, keeping the newest registration.
DELETE FROM public.push_subscriptions a
 USING public.push_subscriptions b
 WHERE  a.user_id = b.user_id
    AND a.endpoint = b.endpoint
    AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_id_endpoint_key
  ON public.push_subscriptions (user_id, endpoint);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON public.push_subscriptions (user_id);

-- ── meetnow_posts ───────────────────────────────────────────────────────────
-- GET /api/meetnow filters (active AND expires_at > now()) and orders by
-- created_at; without this index the "who is around right now" poll is a full
-- scan on every client tick. `active` (not `status`) is the column the table
-- actually has in 0010_remaining_tables.sql.
CREATE INDEX IF NOT EXISTS meetnow_posts_active_expiry_idx
  ON public.meetnow_posts (active, expires_at DESC, created_at DESC)
  WHERE active;

CREATE INDEX IF NOT EXISTS meetnow_posts_created_at_idx
  ON public.meetnow_posts (created_at DESC);

-- ── event_rsvps ─────────────────────────────────────────────────────────────
-- "am I attending" is now a per-user lookup across a page of events; the
-- composite PK (event_id, profile_id) cannot serve profile_id-first queries.
CREATE INDEX IF NOT EXISTS event_rsvps_profile_event_idx
  ON public.event_rsvps (profile_id, event_id);

-- ── notifications ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read = false;

ANALYZE public.push_subscriptions;
ANALYZE public.meetnow_posts;
ANALYZE public.event_rsvps;
ANALYZE public.notifications;
