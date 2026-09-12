-- ═══════════════════════════════════════════════════════════════════════════
-- 0017 — the columns the chat actions and profile boosts actually need
-- ═══════════════════════════════════════════════════════════════════════════
-- `#/components/chat/chat-view.tsx` has always had a pin button, a pinned bar and
-- an "unpin" affordance, and it PATCHes `{action:"pin"|"unpin"|"edit"|"recall"}`
-- to `/api/messages/{id}`. None of that could work: the endpoint did not exist
-- *and* `public.messages` has no pin column, so `is_pinned` was always false —
-- a feature that looked implemented in the UI and was not in the schema.
-- Idempotent, additive, no backfill needed (default false / null).

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_pinned boolean not null default false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

-- The pinned strip reads "pinned messages of this conversation", which without a
-- partial index means a scan of the whole thread.
CREATE INDEX IF NOT EXISTS messages_pinned_idx
  ON public.messages (conversation_id, pinned_at DESC)
  WHERE is_pinned;

-- Pin before recall before time, so a thread's fixed points render first.
CREATE INDEX IF NOT EXISTS messages_conversation_pinned_idx
  ON public.messages (conversation_id, is_pinned DESC, created_at DESC);

-- Profile boost (`POST /api/boost`): a booster is consumed from
-- `consumables_inventory` and shows up here; discovery orders by it, so the
-- effect is visible instead of a stored flag nothing reads.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS boost_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS users_boost_idx
  ON public.users (boost_expires_at DESC)
  WHERE boost_expires_at IS NOT NULL;

-- Supabase allows phone-only accounts; `users.email text NOT NULL UNIQUE` (0010)
-- meant such an account could never create its own profile row, so onboarding
-- failed at the insert. Postgres permits many NULLs in a UNIQUE index, so the
-- constraint stays and the requirement goes.
ALTER TABLE public.users ALTER COLUMN email DROP NOT NULL;

ANALYZE public.messages;
ANALYZE public.users;
