-- ═══════════════════════════════════════════════════════════════════════════
-- 0016 — indexes for the discovery / interest / note endpoints
-- ═══════════════════════════════════════════════════════════════════════════
-- `GET /api/discover` and `GET /api/interest/*` are the hottest reads in the app
-- and every one of them was a sequential scan. Additive + idempotent.

-- Deck query: visible, not hidden, not suspended, ordered by activity.
CREATE INDEX IF NOT EXISTS users_discoverable_idx
  ON public.users (last_active_at DESC)
  WHERE visible AND NOT hidden AND NOT is_suspended;

-- "Likes you" / "taps sent" counters and the match check on tap.
CREATE INDEX IF NOT EXISTS taps_tapped_id_idx      ON public.taps (tapped_id, created_at DESC);
CREATE INDEX IF NOT EXISTS taps_tapper_id_idx      ON public.taps (tapper_id, created_at DESC);

-- Favourites tab + the toggle's existence probe.
CREATE INDEX IF NOT EXISTS favorites_user_id_idx   ON public.favorites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS favorites_target_id_idx ON public.favorites (target_id);

-- Visitors tab.
CREATE INDEX IF NOT EXISTS footprints_visited_idx  ON public.footprints (visited_id, created_at DESC);

-- Notes (one per pair; the unique constraint already covers the lookup, this
-- serves "list my notes").
CREATE INDEX IF NOT EXISTS user_notes_owner_idx    ON public.user_notes (note_owner_id, updated_at DESC);

-- Conversation list: members drive authorisation, so the member index matters.
CREATE INDEX IF NOT EXISTS conversation_members_profile_idx
  ON public.conversation_members (profile_id);
CREATE INDEX IF NOT EXISTS messages_conversation_idx
  ON public.messages (conversation_id, created_at DESC);

-- Two concurrent DM creations used to mint two conversations for the same pair
-- (there is no pair key on `conversations`). Backfill a deterministic key so the
-- unique index below can exist; `match_id` stays NULL for hand-created threads.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS member_key text;

UPDATE public.conversations c
   SET member_key = (
     SELECT string_agg(m.profile_id::text, '-' ORDER BY m.profile_id)
       FROM public.conversation_members m
      WHERE m.conversation_id = c.id
   )
 WHERE c.member_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_member_key_key
  ON public.conversations (member_key)
  WHERE member_key IS NOT NULL;

ANALYZE public.users;
ANALYZE public.taps;
ANALYZE public.favorites;
ANALYZE public.footprints;
ANALYZE public.user_notes;
ANALYZE public.conversations;
ANALYZE public.messages;
