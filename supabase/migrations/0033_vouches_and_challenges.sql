-- 0033_vouches_and_challenges.sql
--
-- Storage for two features the app already has screens for: vouches and community
-- challenges.
--
-- THE GAP
-- -------
-- `/vouches` and `/community-challenges` were generated list screens fetching
-- `/api/vouches` and `/api/community-challenges`. Neither endpoint existed, so both
-- screens could only ever render the empty state of a request that 404s, and both sent
-- that request with `credentials: "include"` and no bearer token — the authentication
-- this API uses. A vouch, the feature the spec describes as one member standing behind
-- another's identity, had no table to live in. A challenge had nowhere to record that
-- somebody joined it or finished it, and the only counter the app could show came from
-- `/api/growth/streak`, which invented three timestamps and gave every account the same
-- three-day streak.
--
-- WHAT THIS FILE DOES
-- -------------------
-- `vouches` — one row per (voucher, profile) pair. The body has a floor of 20
-- characters because a vouch that says "good" vouches for nothing, and a ceiling of 500
-- because it is shown on a profile card. `revoked_at` makes withdrawal a state rather
-- than a delete, so "I vouched for this person and then took it back" is answerable.
--
-- `challenges` — staff-authored, time-boxed goals with a target and a reward in bones.
-- Nothing in the app can create one: Row Level Security is on with no write policy, so
-- a challenge comes from a migration or a service-role script, which is what keeps a
-- reward-bearing row out of reach of a client that guesses the endpoint.
--
-- `challenge_participants` — who joined, when they finished, and whether the reward was
-- paid. Progress is deliberately NOT stored. It is computed on read from the tables the
-- goal points at (`sessions` and `messages` for a streak, `users.profile_complete` for a
-- profile goal, `event_rsvps` for events, `group_roles` for community), because a stored
-- counter is a second copy of a fact that can disagree with the first — and the
-- disagreement always shows up as a user who did the thing and was not credited.
--
-- `reward_claimed_at` plus the `challenge:<id>:<user>` idempotency key on the ledger
-- entry means a reward can be paid once: claiming twice, or claiming from two devices at
-- once, credits one row.

create table if not exists public.vouches (
  id          uuid primary key default gen_random_uuid(),
  voucher_id  uuid not null references public.users(id) on delete cascade,
  profile_id  uuid not null references public.users(id) on delete cascade,
  body        text not null check (char_length(body) between 20 and 500),
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  constraint vouches_not_self check (voucher_id <> profile_id)
);

-- One vouch per pair: a second row from the same person about the same profile is a
-- retry, not a stronger endorsement.
create unique index if not exists vouches_one_per_pair on public.vouches (voucher_id, profile_id);
create index if not exists vouches_profile_recent on public.vouches (profile_id, created_at desc);

create table if not exists public.challenges (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null check (char_length(title) between 3 and 80),
  description   text not null check (char_length(description) between 10 and 500),
  -- What the goal counts, and therefore which table progress is read from.
  kind          text not null check (kind in ('streak','profile','events','community')),
  target_count  integer not null default 1 check (target_count between 1 and 1000),
  reward_bones  integer not null default 0 check (reward_bones between 0 and 10000),
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz not null,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint challenges_window check (ends_at > starts_at)
);

create index if not exists challenges_active on public.challenges (starts_at, ends_at);

create table if not exists public.challenge_participants (
  challenge_id       uuid not null references public.challenges(id) on delete cascade,
  user_id            uuid not null references public.users(id) on delete cascade,
  joined_at          timestamptz not null default now(),
  completed_at       timestamptz,
  reward_claimed_at  timestamptz,
  primary key (challenge_id, user_id)
);

create index if not exists challenge_participants_user on public.challenge_participants (user_id, joined_at desc);

alter table public.vouches enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;

-- A vouch is an endorsement shown on somebody's profile, so it is readable while that
-- profile is readable — plus always by the two people it concerns, including after the
-- profile is hidden, so withdrawing one is never blocked by visibility.
drop policy if exists vouches_select_visible on public.vouches;
create policy vouches_select_visible on public.vouches
  for select to authenticated
  using (
    voucher_id = auth.uid()
    or profile_id = auth.uid()
    or exists (
      select 1 from public.users u
       where u.id = vouches.profile_id
         and u.visible = true
         and u.is_suspended = false
    )
  );

drop policy if exists vouches_insert_own on public.vouches;
create policy vouches_insert_own on public.vouches
  for insert to authenticated
  with check (voucher_id = auth.uid() and profile_id <> auth.uid());

-- Withdrawal is an UPDATE of `revoked_at`, and only by the person who wrote it.
drop policy if exists vouches_revoke_own on public.vouches;
create policy vouches_revoke_own on public.vouches
  for update to authenticated
  using (voucher_id = auth.uid())
  with check (voucher_id = auth.uid());

-- No delete policy: a vouch that can silently vanish cannot be withdrawn on the record.

-- Challenges carry no personal data and are the same list for everybody.
drop policy if exists challenges_select on public.challenges;
create policy challenges_select on public.challenges
  for select to authenticated using (true);

-- Writing challenges is service-role only: RLS is on and no insert/update policy exists.

drop policy if exists challenge_participants_select_own on public.challenge_participants;
create policy challenge_participants_select_own on public.challenge_participants
  for select to authenticated using (user_id = auth.uid());

-- Joining and claiming happen through `/api/growth/challenges`, which writes with the
-- service role inside a transaction that also posts the ledger entry. A client-insert
-- policy here would let a row be created without its reward logic running.

grant select, insert, update on table public.vouches to authenticated;
grant select on table public.challenges to authenticated;
grant select on table public.challenge_participants to authenticated;
revoke all on table public.challenges from anon;
revoke all on table public.challenge_participants from anon;
revoke all on table public.vouches from anon;

comment on table public.vouches is
  'One member standing behind another''s identity. `revoked_at` is a withdrawal, not a delete; the unique (voucher_id, profile_id) index makes a second vouch from the same person impossible. /api/vouches reads and writes it.';
comment on column public.vouches.body is
  'Why this person is vouching, 20-500 characters. Shown on the vouched-for profile.';
comment on table public.challenges is
  'Staff-authored, time-boxed community goals. `kind` decides which table progress is read from: streak (sessions+messages), profile (users.profile_complete), events (event_rsvps), community (group_roles). No client role can write a row.';
comment on table public.challenge_participants is
  'Who joined a challenge, when they finished, and whether the reward was paid. Progress is not stored — it is computed on read, so it cannot disagree with the table it counts.';
comment on column public.challenge_participants.reward_claimed_at is
  'Set in the same transaction as the `challenge:<id>:<user>` ledger entry, which is what makes a reward unclaimable twice.';

-- The four goals that describe things this app can already do. Re-running the file is a
-- no-op: the slug is the identity and a challenge an operator edited is not overwritten.
insert into public.challenges (slug, title, description, kind, target_count, reward_bones, starts_at, ends_at)
values
  ('seven-day-streak', 'Seven days running',
   'Open FYK or send a message on seven consecutive days. Days are counted in UTC.',
   'streak', 7, 100, now(), now() + interval '365 days'),
  ('finish-your-profile', 'Finish your profile',
   'Reach 100% on the profile completeness meter: photos, bio, position, intents, interests and location.',
   'profile', 100, 60, now(), now() + interval '365 days'),
  ('three-events', 'Three events',
   'Say going to three events. Attendance is read from your RSVPs, so cancelling one lowers the count again.',
   'events', 3, 80, now(), now() + interval '365 days'),
  ('join-three-groups', 'Three groups',
   'Join three groups. Membership is read from group roles, so leaving one lowers the count again.',
   'community', 3, 80, now(), now() + interval '365 days')
on conflict (slug) do nothing;
