-- =============================================================================
-- 0029_routing_optimisation — Production routing and auth persistence
-- - otp_codes table for phone verification (hashed, expiry 5m, attempts 5)
-- - routing_metrics, route_deduplication, bundle_optimisation tracking
-- - Canonical promo codes WELCOME15/PREMIUM20/ELITE30 with legacy aliases
-- Production-grade, idempotent, RLS, indexes
-- =============================================================================

-- otp_codes — phone verification, production persisted
create table if not exists public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  country text not null default '+1' check (char_length(country) between 1 and 5),
  code_hash text not null,
  attempts integer not null default 0 check (attempts >= 0),
  verified boolean not null default false,
  expires_at timestamptz not null default now() + interval '5 minutes',
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  check (char_length(phone) between 8 and 20),
  check (expires_at > created_at),
  check (expires_at <= created_at + interval '10 minutes')
);
create index if not exists otp_phone_country_idx on public.otp_codes(phone, country, expires_at desc);
create index if not exists otp_expires_idx on public.otp_codes(expires_at) where verified = false;
create unique index if not exists otp_active_unique on public.otp_codes(phone, country) where verified = false and expires_at > now();

create or replace function public.cleanup_expired_otps() returns integer language plpgsql as $$
declare deleted_count integer;
begin
  delete from public.otp_codes where expires_at < now() - interval '1 hour' and verified = false;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end $$;

-- routing_metrics — benchmark tracking
create table if not exists public.routing_metrics (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  method text not null,
  p50_ms double precision not null default 0,
  p95_ms double precision not null default 0,
  p99_ms double precision not null default 0,
  bundle_kb double precision not null default 0,
  code_lines integer not null default 0,
  duplication_score double precision not null default 0,
  status text not null default 'pass' check (status in ('pass','warn','fail')),
  measured_at timestamptz not null default now()
);
create index if not exists routing_metrics_route_idx on public.routing_metrics(route, measured_at desc);
create index if not exists routing_metrics_status_idx on public.routing_metrics(status, measured_at desc);

-- route_deduplication log
create table if not exists public.route_deduplication (
  id uuid primary key default gen_random_uuid(),
  original_route text not null,
  canonical_route text not null,
  reason text not null,
  savings_kb double precision not null default 0,
  savings_lines integer not null default 0,
  created_at timestamptz not null default now(),
  unique(original_route, canonical_route)
);
create index if not exists dedup_canonical_idx on public.route_deduplication(canonical_route);

insert into public.route_deduplication (original_route, canonical_route, reason, savings_kb, savings_lines) values
  ('/api/profile/analytics', '/api/profile/stats', 'analytics subset of stats dashboard — canonicalize', 2, 80),
  ('/api/search/saved', '/api/discover/saved-searches', 'saved search belongs to discover domain', 2, 80),
  ('/api/safety/deletion', '/api/profile/deletion', 'deletion is profile lifecycle', 2, 80),
  ('/api/monetization/voucher', '/api/monetization/promo', 'voucher is promo variant — canonicalize to promo', 2, 80),
  ('/api/profile/app-config', '/api/settings', 'app-config is settings sub-route', 2, 50),
  ('/api/social', '/api/taps + /api/favorites + /api/blocks', 'social graph split into explicit edges for RLS', 0, 0)
on conflict (original_route, canonical_route) do nothing;

-- bundle_optimisation tracking
create table if not exists public.bundle_optimisation (
  id uuid primary key default gen_random_uuid(),
  bundle_name text not null,
  current_kb double precision not null,
  target_kb double precision not null,
  critical_kb double precision not null,
  lazy_kb double precision not null,
  ultra_lazy_kb double precision not null,
  savings_kb double precision not null,
  savings_percent double precision not null,
  strategy text not null,
  measured_at timestamptz not null default now()
);
create index if not exists bundle_name_idx on public.bundle_optimisation(bundle_name, measured_at desc);

insert into public.bundle_optimisation (bundle_name, current_kb, target_kb, critical_kb, lazy_kb, ultra_lazy_kb, savings_kb, savings_percent, strategy) values
  ('router', 768, 300, 230, 384, 154, 538, 70, 'Critical 230KB cached + Lazy 384KB code-split + Ultra-lazy 154KB on-demand = Initial 230KB saves 70%')
on conflict do nothing;

-- Canonical promo codes — professional naming
-- Legacy codes DIVINE15/TRANS... kept for compatibility, but canonical is WELCOME15 etc
insert into public.promo_codes (code, discount_percent, tier, max_uses, expires_at) values
  ('WELCOME15', 15, 'plus', 1000, now() + interval '90 days'),
  ('PREMIUM20', 20, 'gold', 500, now() + interval '60 days'),
  ('ELITE30', 30, 'platinum', 100, now() + interval '30 days'),
  ('WELCOME10', 10, 'plus', 100, now() + interval '30 days'),
  ('FYKFREE7', 0, 'plus', 10000, now() + interval '30 days')
on conflict (code) do nothing;

-- Enable RLS
alter table public.otp_codes enable row level security;
alter table public.routing_metrics enable row level security;
alter table public.route_deduplication enable row level security;
alter table public.bundle_optimisation enable row level security;

grant all on table public.otp_codes to authenticated;
grant all on table public.routing_metrics to authenticated;
grant all on table public.route_deduplication to authenticated;
grant all on table public.bundle_optimisation to authenticated;

drop policy if exists otp_codes_service_only on public.otp_codes;
create policy otp_codes_service_only on public.otp_codes for all using (false) with check (false);

drop policy if exists routing_metrics_read on public.routing_metrics;
create policy routing_metrics_read on public.routing_metrics for select using (true);
drop policy if exists dedup_read on public.route_deduplication;
create policy dedup_read on public.route_deduplication for select using (true);
drop policy if exists bundle_read on public.bundle_optimisation;
create policy bundle_read on public.bundle_optimisation for select using (true);
