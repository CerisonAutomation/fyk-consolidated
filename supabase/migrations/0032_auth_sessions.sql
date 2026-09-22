-- 0032_auth_sessions.sql
--
-- Device sessions that can be listed and revoked, holding no bearer token.
--
-- THE GAP
-- -------
-- `public.sessions` (0010) existed and nothing used it: no Drizzle model, no route,
-- and `/api/auth/sessions` answered from a hard-coded array with `ip: "127.0.0.1"`
-- and `userAgent: "Current Device"`. So "Sign out of other devices" had nothing to
-- sign out, and the screen that listed devices listed one invented row.
--
-- The table also stored `token text unique not null` — a plaintext bearer token per
-- row. A session list is a convenience feature; a table of live credentials readable
-- by any query that reaches it is a breach waiting for one. Since nothing read that
-- column, this file replaces it rather than migrating it.
--
-- WHAT THIS FILE DOES
-- -------------------
-- `token_hash` (sha256, hex) becomes the identity of a session: enough to recognise
-- the request that owns a row, useless to replay. Adds the facts a device list needs
-- (user agent, ip, last seen), a `revoked_at` that makes revocation a state rather
-- than a delete — so an audit can show a session was ended, and when — and Row Level
-- Security that lets an account read and revoke its own rows and nobody else's.

alter table public.sessions add column if not exists token_hash text;
alter table public.sessions add column if not exists user_agent text;
alter table public.sessions add column if not exists ip text;
alter table public.sessions add column if not exists kind text not null default 'web'
  check (kind in ('web','ios','android','unknown'));
alter table public.sessions add column if not exists last_seen_at timestamptz;
alter table public.sessions add column if not exists revoked_at timestamptz;
alter table public.sessions add column if not exists updated_at timestamptz not null default now();

-- Backfill is a no-op on a table nothing ever wrote, and correct if it did.
update public.sessions
   set token_hash = encode(sha256(token::bytea), 'hex')
 where token_hash is null and token is not null;

-- The plaintext column goes. Dropping it is the point of the migration: leaving a
-- nullable credential column beside its hash invites the next caller to fill it.
alter table public.sessions drop column if exists token;
alter table public.sessions alter column token_hash set not null;

create unique index if not exists sessions_token_hash_key on public.sessions (token_hash);
create index if not exists sessions_user_active on public.sessions (user_id, revoked_at, last_seen_at desc);

alter table public.sessions enable row level security;

drop policy if exists sessions_select_own on public.sessions;
create policy sessions_select_own on public.sessions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists sessions_insert_own on public.sessions;
create policy sessions_insert_own on public.sessions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists sessions_update_own on public.sessions;
create policy sessions_update_own on public.sessions
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Revocation is an UPDATE (`revoked_at`), so no delete policy: a session list that
-- can silently lose rows cannot be used to answer "was I signed out on that phone".

grant all on table public.sessions to authenticated;

comment on table public.sessions is
  'One row per signed-in device. Identity is `token_hash` (sha256 of the bearer token), never the token: 0032 dropped the plaintext column. `revoked_at` is a state, not a delete. /api/auth/sessions lists and revokes; /api/auth/logout revokes the caller''s own row.';
comment on column public.sessions.token_hash is
  'sha256 hex of the access token this row was created from. Recognises the request that owns the row; cannot be replayed.';
