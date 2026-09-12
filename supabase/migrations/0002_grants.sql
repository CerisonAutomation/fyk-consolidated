-- =============================================================================
-- FYK Consolidated — 0002_grants.sql
-- Apply SECOND. Grants define the MAXIMUM reachable access; the policies in
-- 0003_security_rls.sql narrow it. Only tables that actually exist in
-- 0001_core_schema.sql are granted — a grant on a missing table aborts the
-- migration run, which is what the previous 0001_grants/0012_grants pair did.
--
-- Deliberately absent:
--   audit_events    — no grant at all. Clients can neither read nor write it.
--   profiles.role   — escalated only by an admin through RPCs in 0006, never by
--                     a client UPDATE (a trigger blocks self-promotion).
-- =============================================================================

grant select, insert, update, delete on table public.profiles             to authenticated;
grant select, insert, update, delete on table public.profile_private       to authenticated;
grant select, insert, update, delete on table public.profile_photos          to authenticated;
grant select, insert, update, delete on table public.private_album_items     to authenticated;
grant select, insert, update, delete on table public.private_albums          to authenticated;
grant select, insert, update, delete on table public.album_grants            to authenticated;
grant select, insert, update, delete on table public.album_shares            to authenticated;
grant select, insert, update, delete on table public.likes                   to authenticated;
grant select, update                 on table public.matches                 to authenticated;
grant select, insert, update, delete on table public.blocks                  to authenticated;
grant select                         on table public.conversations           to authenticated;
grant select, insert, update         on table public.conversation_members    to authenticated;
grant select, insert, update         on table public.messages                to authenticated;
grant select, insert, update, delete on table public.message_reactions       to authenticated;
grant select, insert, update         on table public.message_attachments     to authenticated;
grant select, insert, update, delete on table public.offers                  to authenticated;
grant select, insert, update, delete on table public.offer_joins             to authenticated;
grant select, insert, update, delete on table public.events                  to authenticated;
grant select, insert, update, delete on table public.event_rsvps             to authenticated;
grant select, insert, update, delete on table public.board_posts             to authenticated;
grant select, insert, update, delete on table public.board_comments          to authenticated;
grant select, insert, update, delete on table public.post_joins              to authenticated;
grant select, insert                 on table public.reports                 to authenticated;

-- Added by 0006_mvp_gaps.sql; harmless to grant early because these statements
-- run after that file on a fresh project and are re-runnable on an existing one.
do $$ begin
  execute 'grant select, insert, update, delete on table public.notifications to authenticated';
  execute 'grant select, insert             on table public.footprints       to authenticated';
  execute 'grant select                     on table public.rate_limits       to authenticated';
  execute 'grant select, insert             on table public.moderation_actions to authenticated';
exception when undefined_table then null; end $$;

-- Function grants live next to the functions that define them
-- (0003_security_rls.sql, 0004_functions.sql) and in 0006_mvp_gaps.sql.

-- service_role bypasses RLS by definition; it is never exposed to the browser and
-- the app refuses to boot if it is found in a client-visible env var.
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
