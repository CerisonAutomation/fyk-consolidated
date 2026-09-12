-- Custom claims function for JWT
CREATE OR REPLACE FUNCTION public.custom_claims()
RETURNS jsonb AS $$
DECLARE
  user_role text;
  user_tier text;
BEGIN
  SELECT role::text INTO user_role FROM public.users WHERE id = auth.uid();
  SELECT tier::text INTO user_tier FROM public.users WHERE id = auth.uid();
  RETURN jsonb_build_object(
    'role', COALESCE(user_role, 'user'),
    'tier', COALESCE(user_tier, 'free'),
    'email', (SELECT email FROM auth.users WHERE id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Auto-create profile on signup (enhanced)
CREATE OR REPLACE FUNCTION public.handle_new_user_enhanced()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, pseudo, status, tier, photos, online)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    'online',
    'free',
    '[]'::jsonb,
    true
  );
  
  -- Create wallet with starting balance
  INSERT INTO public.wallet (user_id, balance, currency)
  VALUES (NEW.id, 50, 'bones');
  
  -- Create pet
  INSERT INTO public.king_pet (user_id, name, stage, mood, bones)
  VALUES (NEW.id, 'Kingsley', 'baby', 'happy', 50);
  
  -- Create free subscription
  INSERT INTO public.subscriptions (user_id, tier, status, current_period_end)
  VALUES (NEW.id, 'free', 'active', now() + interval '100 years');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_enhanced();

-- Rate limiting for auth attempts
CREATE TABLE IF NOT EXISTS public.auth_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  attempts int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_email_idx ON public.auth_rate_limits (email, window_start);

-- Session management
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.sessions WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
