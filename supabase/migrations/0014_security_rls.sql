-- =============================================================================
-- FYK Consolidated — 0014_security_rls.sql
-- Security hardening: sessions RLS, anti-self-promotion trigger
--
-- 1. Sessions table: Enable RLS + restrict to owner-only access
-- 2. Users table: Trigger to prevent authenticated users from self-promoting
--    role or tier (privilege escalation defense)
-- =============================================================================

-- ===========================================
-- 1. SESSIONS: Row Level Security
-- ===========================================
-- Sessions contain sensitive tokens. Without RLS, any authenticated user
-- could read/modify/deploy another user's session tokens.

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Users can only SELECT their own sessions
CREATE POLICY "sessions_select_own" ON public.sessions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- Users can only INSERT sessions for themselves
CREATE POLICY "sessions_insert_own" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Users can only UPDATE their own sessions (e.g., extend expiry)
CREATE POLICY "sessions_update_own" ON public.sessions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Users can only DELETE their own sessions (logout)
CREATE POLICY "sessions_delete_own" ON public.sessions
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- ===========================================
-- 2. USERS: Anti-self-promotion trigger
-- ===========================================
-- Prevents authenticated users from escalating their own role or tier.
-- Only service_role (which bypasses RLS) or SECURITY DEFINER functions
-- should modify these privilege columns.

CREATE OR REPLACE FUNCTION public.prevent_self_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only enforce for authenticated users (service_role bypasses this)
  IF current_user = 'authenticated' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'privilege_escalation_denied: role cannot be changed by authenticated users';
    END IF;
    IF NEW.tier IS DISTINCT FROM OLD.tier THEN
      RAISE EXCEPTION 'privilege_escalation_denied: tier cannot be changed by authenticated users';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_promotion ON public.users;
CREATE TRIGGER prevent_self_promotion
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_promotion();

-- ===========================================
-- 3. AUTH_RATE_LIMITS: Enable RLS (defense in depth)
-- ===========================================
-- The auth_rate_limits table was created without RLS. Lock it down:
-- service_role manages it; authenticated users cannot read/write it directly.

ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies => no client access. service_role bypasses RLS.

-- ===========================================
-- VERIFICATION
-- ===========================================
-- A) Verify sessions RLS is on and has policies
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  count(p.policyname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.schemaname = n.nspname AND p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relname IN ('sessions', 'auth_rate_limits')
GROUP BY c.relname, c.relrowsecurity;

-- B) Verify trigger exists
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'users'
  AND trigger_name = 'prevent_self_promotion';
