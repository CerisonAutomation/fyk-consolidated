-- =============================================================================
-- FYK Consolidated — 0020_security_rls.sql
-- Security hardening: sessions RLS, anti-self-promotion trigger
--
-- 1. Sessions table: Enable RLS + restrict to owner-only access
-- 2. Users table: Trigger to prevent authenticated users from self-promoting
--    role or tier (privilege escalation defense)
-- 3. auth_rate_limits: RLS on, no policies (server-only by definition)
--
-- WHY THIS FILE MOVED FROM 0014 TO 0020
-- --------------------------------------
-- It used to be `0014_security_rls.sql`, sitting next to `0014_api_hardening.sql`.
-- `supabase` keys a migration by the digits before the first `_`, so two files
-- shared version `0014`: `supabase migration list` reports a duplicate version
-- and `db push` either refuses or applies them in filesystem order, which is not
-- a defined order. Renumbering the later-written file is the smallest fix, and it
-- keeps `0014_api_hardening` (indexes the API depends on) in place.
--
-- Its own `CREATE POLICY` statements were also not re-runnable: on a database
-- where 0014 had already applied, re-applying after the rename would abort with
-- `policy ... for select on table sessions already exists`. Every statement below
-- is now idempotent, which is what the rest of the folder already promised.
--
-- `0019` revokes `select` on `public.sessions` from `anon`/`authenticated`
-- outright, because the Supabase-managed session lives in `auth`/cookies and
-- nothing reads this table from a browser. The owner-only policies are kept as
-- defence in depth for a database where that revoke is not applied.
-- =============================================================================

-- ===========================================
-- 1. SESSIONS: Row Level Security
-- ===========================================
-- Sessions contain sensitive tokens. Without RLS, any authenticated user
-- could read/modify/delete another user's session tokens.

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Users can only SELECT their own sessions
DROP POLICY IF EXISTS "sessions_select_own" ON public.sessions;
CREATE POLICY "sessions_select_own" ON public.sessions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- Users can only INSERT sessions for themselves
DROP POLICY IF EXISTS "sessions_insert_own" ON public.sessions;
CREATE POLICY "sessions_insert_own" ON public.sessions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Users can only UPDATE their own sessions (e.g., extend expiry)
DROP POLICY IF EXISTS "sessions_update_own" ON public.sessions;
CREATE POLICY "sessions_update_own" ON public.sessions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Users can only DELETE their own sessions (logout)
DROP POLICY IF EXISTS "sessions_delete_own" ON public.sessions;
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
AS $fn$
BEGIN
  -- Only enforce for authenticated users (service_role bypasses this).
  -- `0018` made `public.users` ungranted to `authenticated`, so this is now the
  -- backstop rather than the primary wall: it still fires for any future
  -- postgres-side code that writes the table as that role.
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'privilege_escalation_denied: role cannot be changed by % users', current_user;
    END IF;
    IF NEW.tier IS DISTINCT FROM OLD.tier THEN
      RAISE EXCEPTION 'privilege_escalation_denied: tier cannot be changed by % users', current_user;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS prevent_self_promotion ON public.users;
CREATE TRIGGER prevent_self_promotion
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_promotion();

-- ===========================================
-- 3. AUTH_RATE_LIMITS: Enable RLS (defense in depth)
-- ===========================================
-- The table was created without RLS. Lock it down: service_role manages it;
-- authenticated users cannot read or write it directly.
ALTER TABLE public.auth_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies => no client access. service_role bypasses RLS.

-- Verification queries were dropped: `db push` streams their result sets into
-- the deploy log for no benefit, and `pg_policies`/`information_schema.triggers`
-- can be read by hand when a deploy needs checking.
