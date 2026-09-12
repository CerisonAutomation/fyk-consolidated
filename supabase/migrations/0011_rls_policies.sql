-- =============================================================================
-- FYK Consolidated — 0011_rls_policies.sql (development-friendly RLS)
--
-- This file provides minimal, development-friendly RLS policies.
-- For production, the comprehensive policies in 002_rls.sql take precedence.
--
-- Key patterns applied per Supabase documentation:
--   - Use (select auth.uid()) in policies for performance (prevents re-evaluation)
--   - service_role key bypasses RLS by definition — no explicit policy needed
--   - Enable RLS on every table in exposed schemas
-- =============================================================================

-- Enable RLS on key tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.king_pet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- NOTE: service_role bypasses RLS entirely (per docs). No explicit policies needed.

-- Authenticated read access (per docs: "Use (select auth.uid()) for performance")
CREATE POLICY "auth_read_users" ON public.users
  FOR SELECT TO authenticated USING ((select auth.uid()) = id);

CREATE POLICY "auth_read_profiles" ON public.profiles
  FOR SELECT TO authenticated USING ((select auth.uid()) = id);

-- User own data — per-operation policies instead of FOR ALL (per docs)
CREATE POLICY "own_users_select" ON public.users
  FOR SELECT TO authenticated USING ((select auth.uid()) = id);

CREATE POLICY "own_users_insert" ON public.users
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "own_users_update" ON public.users
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);
