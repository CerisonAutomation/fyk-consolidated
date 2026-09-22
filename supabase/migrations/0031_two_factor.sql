-- 0031_two_factor.sql
--
-- Two-factor authentication that verifies something.
--
-- THE GAP
-- -------
-- `0027` added `users.two_factor_enabled`, and `/api/auth/2fa` turned it on. The
-- route generated a TOTP secret, returned it to the browser, and never stored it:
-- there was nowhere to put it. Verification was `code === "123456" || /^\d{6}$/`,
-- so every six-digit code passed, `enable` wrote the flag through a Drizzle
-- `as any` cast for a column the model did not declare, and `/api/safety/2fa`
-- advertised backup codes, a recovery flow and enforcement for staff that nothing
-- implemented. An account could show "Two-factor: on" and be one guessed digit
-- away from open — which is worse than off, because the member believes it.
--
-- WHAT THIS FILE DOES
-- -------------------
-- One server-only table holding the secret, the enabled flag, hashed recovery
-- codes and the attempt counter that makes brute force expensive. It has Row Level
-- Security enabled and *no* policies, and both client roles are revoked: the only
-- reader is the API, which connects with the service role. A TOTP secret is a
-- bearer credential for the second factor, so it never travels to a browser except
-- once, as the `otpauth://` URI during enrolment.
--
-- `users.two_factor_enabled` stays as the denormalised flag the profile and the
-- settings screens read without a join. It is written in the same transaction as
-- this table, and this table is the authority: if they ever disagree, `enabled`
-- here wins and the route reports that.

create table if not exists public.two_factor_credentials (
  user_id uuid primary key references public.users(id) on delete cascade,
  -- RFC 4648 base32, 20 bytes of entropy. Not encrypted at rest because the
  -- service role connection is the only path to it and a key this server holds
  -- would have to live beside the database it protects.
  secret text not null,
  enabled boolean not null default false,
  verified_at timestamptz,
  -- sha256 hex of each recovery code, normalised (upper case, separators
  -- removed). The plaintext codes are shown once, at enrolment or regeneration.
  recovery_codes jsonb not null default '[]'::jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists two_factor_credentials_enabled
  on public.two_factor_credentials (enabled) where enabled;

alter table public.two_factor_credentials enable row level security;

-- Deliberately no policies: RLS with none denies every client role, which is the
-- intent. Revoking as well means a future `grant ... to authenticated` elsewhere
-- in the set still cannot read this table.
revoke all on table public.two_factor_credentials from anon, authenticated;

comment on table public.two_factor_credentials is
  'Second-factor secrets. Server-only: RLS enabled with no policies and both client roles revoked (0031). `users.two_factor_enabled` is the denormalised flag; this table is the authority.';
comment on column public.two_factor_credentials.secret is
  'RFC 4648 base32 TOTP secret, 20 bytes of entropy. Returned to a browser exactly once, as an otpauth:// URI, during enrolment.';
comment on column public.two_factor_credentials.recovery_codes is
  'sha256 hex hashes, one per code, normalised to upper case without separators. Plaintext is shown once and never stored.';
comment on column public.two_factor_credentials.attempts is
  'Consecutive failed verifications. Reset on success; five locks the row for fifteen minutes.';
