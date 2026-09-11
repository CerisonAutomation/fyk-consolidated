-- Minimal RLS: service role bypasses everything, authenticated can read public
-- This is a development-friendly policy. Tighten for production.

-- Enable RLS on key tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.king_pet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role bypass
CREATE POLICY "sr_users" ON public.users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "sr_profiles" ON public.profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "sr_notifications" ON public.notifications FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "sr_wallet" ON public.wallet FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "sr_pet" ON public.king_pet FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "sr_subs" ON public.subscriptions FOR ALL USING (auth.role() = 'service_role');

-- Authenticated read access
CREATE POLICY "auth_read" ON public.users FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "auth_read" ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

-- User own data
CREATE POLICY "own_users" ON public.users FOR ALL USING (auth.uid() = id);
