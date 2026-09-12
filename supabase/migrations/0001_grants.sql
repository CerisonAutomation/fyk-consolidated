-- =============================================================================
-- FYK Consolidated — 0001_grants.sql
-- Run SECOND. Grants minimal table access to authenticated and service_role.
--
-- Design: RLS is already enabled from 0000_profiles.sql. These grants define
-- the MAXIMUM possible access. RLS policies in 002_rls.sql restrict further.
-- service_role bypasses RLS, so it gets full access for admin operations.
-- =============================================================================

-- authenticated: can read/write all tables (RLS restricts to own rows)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profile_private TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profile_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.private_album_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.private_albums TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.album_grants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.album_shares TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.likes TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.matches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blocks TO authenticated;
GRANT SELECT ON TABLE public.conversations TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.conversation_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.message_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.message_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.offers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.offer_joins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_rsvps TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.board_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.board_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.post_joins TO authenticated;
GRANT SELECT, INSERT ON TABLE public.reports TO authenticated;
GRANT SELECT ON TABLE public.premium_entitlements TO authenticated;
-- audit_events: NO grant to authenticated — cannot be read or written by clients

-- service_role: full access (bypasses RLS)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
