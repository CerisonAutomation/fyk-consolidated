-- ═══════════════════════════════════════════════════════════════════════════
-- 0015 — make the `public.users` lineage match what the JSON API reads
-- ═══════════════════════════════════════════════════════════════════════════
-- Everything here is additive and idempotent: safe to re-run, and a no-op on a
-- database created with `prisma db push` (where the columns already exist).
--
-- WHY: `0010_remaining_tables.sql` was generated from an older copy of the
-- Prisma schema. Since then the API grew to read `users.avatar`, and
-- `meetnow_posts` is queried by `status`/`lat`/`lng`/`type`/`place`/`tags`
-- while the table only has `category`/`note`/`location`/`active`. Those reads
-- were `500`s on a fresh database and only worked on dev databases that had
-- been patched by hand.

-- ── users ───────────────────────────────────────────────────────────────────
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS relationship_status text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pronouns text;
-- `last_active_at` drives presence; keep it fresh for the `online` derivation.
CREATE INDEX IF NOT EXISTS users_last_active_at_idx
  ON public.users (last_active_at DESC);
CREATE INDEX IF NOT EXISTS users_online_idx ON public.users (online) WHERE online;

-- ── meetnow_posts ───────────────────────────────────────────────────────────
-- The API stores the author's own fix so a viewer can sort by distance and the
-- map can centre on the post. The table had no coordinates at all, so every
-- card was a text blob.
ALTER TABLE public.meetnow_posts ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE public.meetnow_posts ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE public.meetnow_posts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS meetnow_posts_user_idx ON public.meetnow_posts (user_id);

-- ── notifications ───────────────────────────────────────────────────────────
-- `PATCH /api/notifications` hides rows for one user; there was no column for
-- it, so the "hide" action either 500'd or silently marked everything read.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;
CREATE INDEX IF NOT EXISTS notifications_user_hidden_idx
  ON public.notifications (user_id, hidden)
  WHERE hidden = false;

-- ── integrity: users.id must be the auth uid, or the API cannot map callers ──
-- Every API route resolves `caller.id` from the Supabase access token and looks
-- the row up by primary key, which only works if the ids are the same value.
DO $$ begin
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.users'::regclass AND contype = 'f'
       AND confrelid = 'auth.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_id_fkey FOREIGN KEY (id)
      REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END $$;

-- Passwords are verified by Supabase Auth; the legacy NOT NULL column blocks
-- the `sign-up` flow (which has no hash to write), so relax it.
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.users ALTER COLUMN password_hash SET DEFAULT '';

COMMENT ON COLUMN public.users.password_hash IS
  'Legacy. Supabase Auth owns credentials; the API never reads or writes this.';

ANALYZE public.users;
ANALYZE public.meetnow_posts;
ANALYZE public.notifications;
