-- ═══════════════════════════════════════════════════════════════════════════
-- 0018 — Supabase as the single source of truth
-- ═══════════════════════════════════════════════════════════════════════════
-- Before this file the same person had three identities:
--
--   auth.users        Supabase Auth — credentials, email/phone, OAuth identities
--   public.users      0010 — what the Drizzle API reads and writes
--   public.profiles   0000 — what browser code reads, RLS-enabled
--
-- Nothing linked the last two, so the API and the browser could disagree about
-- the same human. Worse, `0012_grants.sql` gave `authenticated` SELECT/INSERT/
-- UPDATE/DELETE on `public.users`, which has *no* RLS: any signed-in client
-- could rewrite anyone's row, and `select("*")` on it pulls email, phone and
-- the precise fix into the browser.
--
-- Canonical model adopted here, one direction only:
--
--   auth.users ──1:1── public.users ──projection── public.profiles
--   (identity)         (server truth, Drizzle)      (RLS read surface, browser)
--
-- * `public.users` keeps the writes and is no longer reachable by `anon`/
--   `authenticated`; the API connects as the owner (`DATABASE_URL`).
-- * `public.profiles` stays a real table — its RLS policies and the
--   `profile_photos` / `message_reactions.profile_id` foreign keys keep working
--   — but it becomes *derived*. A trigger mirrors every write to `users`, so no
--   application code dual-writes and the two cannot drift.
-- * Direct writes to `profiles` are refused unless they come from the mirror
--   itself, so the projection cannot be shadowed by a browser PATCH.
-- * `users.password_hash`, `users.apple_id` and `users.google_id` are dropped:
--   Supabase Auth owns credentials and federated identities (`auth.identities`).
--
-- Idempotent: safe to re-run, and safe over a database built by `supabase db push`.

-- ---------------------------------------------------------------------------
-- 1. auth leftovers out of the app table; id becomes a rule, not a convention
-- ---------------------------------------------------------------------------
alter table public.users drop column if exists password_hash;
alter table public.users drop column if exists apple_id;
alter table public.users drop column if exists google_id;

do $$ begin
  alter table public.users
    add constraint users_id_fkey foreign key (id) references auth.users(id) on delete cascade;
exception when duplicate_object then null;
  when undefined_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2. what the projection needs that 0000 never had
--
-- `age_verified_at` used to live only on `profiles`. As of this migration it is
-- owned by the row and mirrored downwards, so onboarding can attest an age
-- through the API instead of writing the projection directly.
alter table public.users add column if not exists age_verified_at timestamptz;

-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists tribes jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists position jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists languages jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists interests jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists looking_for jsonb not null default '[]'::jsonb;
-- The grid filters and cards on tag codes, so the projection has to carry
-- them; otherwise the browser would still need public.users.
alter table public.profiles add column if not exists tag_codes jsonb not null default '[]'::jsonb;
alter table public.profiles add column if not exists weight integer;
alter table public.profiles add column if not exists verification integer not null default 0;
alter table public.profiles add column if not exists trust_score integer not null default 50;
alter table public.profiles add column if not exists relationship_status text;
alter table public.profiles add column if not exists occupation text;
alter table public.profiles add column if not exists online boolean not null default false;
alter table public.profiles add column if not exists discoverable boolean not null default true;
alter table public.profiles add column if not exists tier text;

comment on column public.profiles.discoverable is
  'visible AND not hidden AND not suspended, mirrored from users (0018) so a card list needs three flags less';

-- ---------------------------------------------------------------------------
-- 3. the projection itself
-- ---------------------------------------------------------------------------
create or replace function public.users_apply_projection(p_user_id uuid)
returns void
language plpgsql
as $fn$
declare
  u public.users%rowtype;
  v_handle text;
  v_age    integer;
begin
  select * into u from public.users where id = p_user_id;
  if not found then
    return;
  end if;

  -- profiles.handle is CHECKed as ^[a-z0-9_]{3,24}$; users.nick makes no such
  -- promise, and an unsanitised mirror would abort the user's own save.
  v_handle := nullif(btrim(coalesce(u.nick, '')), '');
  if v_handle is not null then
    v_handle := left(regexp_replace(lower(v_handle), '[^a-z0-9_]', '', 'g'), 24);
    if char_length(coalesce(v_handle, '')) < 3 then
      v_handle := null;
    end if;
  end if;

  -- profiles enforces 18..120 at the database level. A legacy row outside that
  -- range publishes no age rather than failing the write.
  v_age := u.age;
  if v_age is not null and (v_age < 18 or v_age > 120) then
    v_age := null;
  end if;

  insert into public.profiles (id) values (u.id) on conflict (id) do nothing;

  update public.profiles set
    handle                  = v_handle,
    display_name            = nullif(btrim(coalesce(u.pseudo, '')), ''),
    bio                     = u.description,
    headline                = u.occupation,
    avatar_url              = u.avatar,
    photos                  = coalesce(u.photos, '[]'::jsonb),
    tribes                  = coalesce(u.tribes, '[]'::jsonb),
    position                = coalesce(u.position, '[]'::jsonb),
    languages               = coalesce(u.languages, '[]'::jsonb),
    interests               = coalesce(u.interests, '[]'::jsonb),
    looking_for             = coalesce(u.looking_for, '[]'::jsonb),
    tag_codes               = coalesce(u.tag_codes, '[]'::jsonb),
    age                     = v_age,
    city                    = u.city,
    area                    = u.area,
    -- Only the coarsened fix is ever projected: that is the whole point of
    -- `lat_coarse`, and the browser has no business holding a home address.
    lat_coarse              = u.lat_coarse,
    lng_coarse              = u.lng_coarse,
    height_cm               = u.height,
    -- Grams, exactly as users stores them; the grid's filter bounds
    -- arrive as kg * 1000 from #/domains/grid/store.ts.
    weight                  = u.weight,
    body_type               = u.body_type,
    pronouns                = u.pronouns,
    occupation              = u.occupation,
    relationship_status     = u.relationship_status,
    verification            = coalesce(u.verification, 0),
    trust_score             = coalesce(u.trust_score, 50),
    tier                    = u.tier,
    exposure_level          = case
                                when u.exposure_level::text in ('clean','mature','explicit')
                                  then u.exposure_level::exposure_level
                                else 'clean'::exposure_level
                              end,
    hide_distance           = coalesce(u.hide_distance, false),
    hide_online             = coalesce(u.hide_online, false),
    incognito               = coalesce(u.incognito, false),
    is_demo                 = coalesce(u.is_demo, false),
    is_suspended            = coalesce(u.is_suspended, false),
    discoverable            = coalesce(u.visible, true)
                              and not coalesce(u.hidden, false)
                              and not coalesce(u.is_suspended, false)
                              and not coalesce(u.incognito, false),
    online                  = coalesce(u.online, false),
    onboarding_completed_at = u.onboarding_completed_at,
    age_verified_at         = u.age_verified_at,
    last_active_at          = coalesce(u.last_active_at, now()),
    updated_at              = now()
  where id = u.id;
end;
$fn$;

create or replace function public.users_project_profile()
returns trigger
language plpgsql
as $fn$
begin
  -- The guard in profiles_reject_direct_write() below reads this; a
  -- transaction-local setting so a browser session can never set it.
  perform set_config('fyk.profile_projection', 'on', true);
  if (tg_op = 'DELETE') then
    delete from public.profiles where id = old.id;
    return old;
  end if;
  perform public.users_apply_projection(new.id);
  return new;
end;
$fn$;

drop trigger if exists users_project_profile_on_change on public.users;
create trigger users_project_profile_on_change
  after insert or update or delete on public.users
  for each row execute function public.users_project_profile();

-- ---------------------------------------------------------------------------
-- 4. the projection is write-protected
-- ---------------------------------------------------------------------------
create or replace function public.profiles_reject_direct_write()
returns trigger
language plpgsql
as $fn$
begin
  if coalesce(current_setting('fyk.profile_projection', true), '') = 'on' then
    return new;
  end if;
  raise exception
    'public.profiles is a projection of public.users (0018): write through the API'
    using errcode = '42809';
end;
$fn$;

drop trigger if exists profiles_reject_direct_write_trg on public.profiles;
create trigger profiles_reject_direct_write
  before insert or update or delete on public.profiles
  for each row execute function public.profiles_reject_direct_write();

-- ---------------------------------------------------------------------------
-- 5. the hide list the schema never had
-- ---------------------------------------------------------------------------
-- `/settings/hidden` lists people *I* hid. `users.hidden` is "my profile is
-- hidden from everyone", so reading that column produced someone else's privacy
-- switch. A per-viewer edge belongs next to `blocks`, with the same shape.
create table if not exists public.hides (
  id uuid primary key default gen_random_uuid(),
  hider_id  uuid not null references public.users(id) on delete cascade,
  hidden_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (hider_id, hidden_id),
  constraint hides_not_self check (hider_id <> hidden_id)
);

create index if not exists hides_hider_idx on public.hides (hider_id, created_at desc);
create index if not exists hides_hidden_idx on public.hides (hidden_id);

grant select, insert, delete on table public.hides to authenticated;

-- Discovery and the deck must drop anyone the viewer hid, and anyone who hid the
-- viewer's own row is dropped from *their* deck in return.
-- ---------------------------------------------------------------------------
-- 6. backfill, then close the side door
-- ---------------------------------------------------------------------------
select public.users_apply_projection(id) from public.users;

-- The API owns `public.users`; a browser token must not touch it at all.
revoke insert, update, delete on table public.users from anon, authenticated;
revoke select on table public.users from anon;

-- `profiles` is the readable surface, still behind its 0000 RLS policies.
grant select on table public.profiles to anon, authenticated;

-- A profile row now exists for every account, so the RLS "own row" policies and
-- `age_verified_at` bookkeeping live in one place.
create index if not exists profiles_discoverable_idx
  on public.profiles (last_active_at desc)
  where discoverable;

comment on table public.profiles is
  'Read-only projection of public.users for browser/RLS access (0018). Writes go through the API.';
comment on column public.users.lat is
  'Precise fix. Never projected into profiles, never returned by a list endpoint.';
comment on column public.users.onboarding_done is
  'Set by PUT /api/profile only once profile_complete >= 60; mirrored, never authoritative here.';

analyze public.profiles;
analyze public.users;
