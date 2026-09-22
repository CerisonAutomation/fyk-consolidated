-- 0030_entity_promotions.sql
--
-- Paid visibility for a *thing* instead of a profile.
--
-- THE GAP
-- -------
-- `public.spotlights` (0010) buys a member top-of-deck placement for a number of
-- minutes, and `/api/boost` spends that. Nothing bought the same thing for the
-- entities the app also lists: a group, a shout, an event, a fansite, a tribe or a
-- board post. The generated screens therefore posted to `/api/<feature>/<id>/boost`
-- against endpoints that never existed, and the lists they refreshed had no
-- promotion ordering to show for it.
--
-- WHAT THIS FILE DOES
-- -------------------
-- One table for every entity kind, because the shape is identical and six
-- near-duplicate tables would each need their own RLS, index and cleanup job.
-- `entity_type` + `entity_id` is a soft reference on purpose: half of the targets
-- are rows in tables this migration set creates elsewhere (`groups`, `shouts`,
-- `fansites`, `tribes`, `board_posts`) and one of them — `activity` — is an `events`
-- row. A hard FK per kind is not expressible in Postgres, and the application
-- validates ownership and existence before it writes, inside the same transaction
-- that spends the bones.
--
-- Rows are never deleted by the app: an expired promotion is history, and the
-- `impressions` column is what makes the spend auditable afterwards.

create table if not exists public.entity_promotions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('group','shout','activity','fansite','tribe','board_post')),
  entity_id uuid not null,
  user_id uuid not null references public.users(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  cost integer not null default 0 check (cost >= 0),
  currency text not null default 'bones' check (currency in ('bones','eur')),
  impressions integer not null default 0 check (impressions >= 0),
  extended_at timestamptz,
  created_at timestamptz not null default now(),
  constraint entity_promotions_window check (ends_at > starts_at)
);

-- One live promotion per entity: a second purchase extends the row instead of
-- stacking, so two people cannot both be "first" on the same shout.
create unique index if not exists entity_promotions_one_live_per_entity
  on public.entity_promotions (entity_type, entity_id)
  where ends_at > now();
create index if not exists entity_promotions_lookup
  on public.entity_promotions (entity_type, ends_at);
create index if not exists entity_promotions_user
  on public.entity_promotions (user_id, created_at desc);

alter table public.entity_promotions enable row level security;

drop policy if exists entity_promotions_select on public.entity_promotions;
create policy entity_promotions_select on public.entity_promotions
  for select to authenticated using (true);

drop policy if exists entity_promotions_insert on public.entity_promotions;
create policy entity_promotions_insert on public.entity_promotions
  for insert to authenticated with check (user_id = auth.uid());

-- Updates and deletes stay server-side only: the app talks to Postgres with the
-- service role through `/api/*`, and a client that could edit `ends_at` could
-- extend a promotion it never paid for.

grant all on table public.entity_promotions to authenticated;
