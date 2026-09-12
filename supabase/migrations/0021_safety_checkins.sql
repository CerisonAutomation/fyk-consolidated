-- 0021_safety_checkins.sql
--
-- A safety check-in needs two things this schema never had: a table to be the
-- record, and a *somebody* to be late to.
--
-- WHAT WAS ACTUALLY BROKEN (AUDIT §3.11)
-- -------------------------------------
-- 1. `#/integrations/supabase/safety.ts` armed a check-in by inserting a
--    `notifications` row of type 'check_in' whose text body carried
--    `{contact_id, place, due_at, status}`. `notifications_type_check` (0013) never
--    allowed that type, so the insert was rejected, the module read an id back from
--    a row that did not exist, and the timer lived only in `#/lib/store.ts`: a
--    reload lost it. 0019 §1b widened the CHECK and `POST /api/safety/check-in`
--    became the writer, which fixed the *silence* but kept the shape.
-- 2. That shape is the wrong storage for this fact, and the defect is measurable:
--      - no index on `due_at`, so "who is overdue right now" is a scan of the
--        whole notification history of every account;
--      - a check-in disappears when its notification is hidden or deleted, which
--        the inbox lets the user do at any moment (0019 §5 removed only client
--        *inserts*, `hidden` stays user-writable);
--      - there is no room for the coordinates the screen already collects, nor for
--        the resolution, so `resolve` writes JSON into a body it must parse first.
-- 3. The contact was fictional. `safety-client.tsx` called
--    `createCheckIn(userId, userId, ...)`: the route then had no picker to trust and
--    stored the user as their own emergency contact, under copy that reads "share
--    your approximate location with a trusted contact". Nothing in the schema
--    described an emergency contact at all — `contactId` was validated against
--    `public.users`, i.e. any account, including a stranger's.
--
-- WHAT THIS FILE DOES
-- -------------------
-- `safety_contacts` is the user's own private list (own full DML, like `user_notes`
-- in 0019 §5: it is data about *them*, not privilege, and it must be editable
-- offline-ish without a round trip through a route). `safety_checkins` is the
-- record: the owner may read it, nobody may write it but the server (the API owns
-- arming, confirming and marking overdue, because each of those transitions alerts a
-- third party). A notification stays a *projection*: the inbox shows the check-in,
-- the table is what it means, and one writer (the API) keeps them in step inside
-- one transaction.
--
-- Nothing in this repository schedules work: `pg_cron` appears in no migration,
-- `UPSTASH_REDIS_REST_*` is rate limiting rather than a queue, and while
-- `supabase/functions/cron-cleanup` exists it has no schedule committed anywhere (not
-- in config.toml, not in package.json), so it runs only if a project opts in by hand.
-- The overdue transition is therefore materialised lazily: the first read or write
-- after `due_at` marks the row 'missed' and alerts the contact exactly once, guarded
-- by `alerted_at`. If a schedule is ever added, a sweep becomes a single UPDATE with
-- the same `alerted_at is null` predicate — no new state, no second writer.
-- That is deterministic, needs no scheduler, and cannot double-alert because the
-- status change and the flag land in the same statement.

begin;

-- ---------------------------------------------------------------------------
-- 1. emergency contacts
-- ---------------------------------------------------------------------------
create table if not exists public.safety_contacts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  -- A contact may be a person on FYK (then a notification can reach them) or only
  -- reachable off-platform (then we can at least show their number on the screen).
  contact_user_id uuid references public.users(id) on delete set null,
  name            text not null,
  phone           text,
  email           text,
  note            text,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint safety_contacts_name_len
    check (char_length(btrim(name)) between 1 and 80),
  -- "Reachable" is the whole point of the row: an on-platform account, a phone
  -- number, or an address. Anything else is a note, and notes belong in `note`.
  constraint safety_contacts_reachable
    check (
      contact_user_id is not null
      or nullif(btrim(coalesce(phone, '')), '') is not null
      or nullif(btrim(coalesce(email, '')), '') is not null
    ),
  constraint safety_contacts_email_shape
    check (email is null or position('@' in email) > 1),
  constraint safety_contacts_note_len
    check (note is null or char_length(note) <= 280),
  -- Not yourself. Arming against yourself is the bug this file exists to remove,
  -- and it must be impossible at the row, not just in the form.
  constraint safety_contacts_not_self
    check (contact_user_id is null or contact_user_id <> user_id),
  constraint safety_contacts_owner_is_unique
    unique (id, user_id)
);

create index if not exists safety_contacts_owner_idx
  on public.safety_contacts (user_id, is_default desc, created_at);
-- A unique (id, user_id) above exists so a check-in can point at (id, user_id) and
-- be provably the caller's own contact in one foreign key; a contact can only be
-- listed once per owner-account either way.
create unique index if not exists safety_contacts_one_default
  on public.safety_contacts (user_id)
  where is_default;

comment on table public.safety_contacts is
  'A user''s own emergency contacts (0021). Reachability is enforced by CHECK; a
   contact who is also an account can be notified, an off-platform one is only
   shown to the user.';

alter table public.safety_contacts enable row level security;
revoke all on table public.safety_contacts from anon;
grant select, insert, update, delete on table public.safety_contacts to authenticated;

drop policy if exists "safety_contacts_select_own" on public.safety_contacts;
create policy safety_contacts_select_own on public.safety_contacts
  for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "safety_contacts_insert_own" on public.safety_contacts;
create policy safety_contacts_insert_own on public.safety_contacts
  for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "safety_contacts_update_own" on public.safety_contacts;
create policy safety_contacts_update_own on public.safety_contacts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists "safety_contacts_delete_own" on public.safety_contacts;
create policy safety_contacts_delete_own on public.safety_contacts
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. the check-in itself
-- ---------------------------------------------------------------------------
create table if not exists public.safety_checkins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  -- (id, user_id) rather than (id): the composite key means a row cannot reference
  -- somebody else's contact even if a caller guessed the uuid.
  contact_id  uuid,
  place       text not null default '',
  lat         double precision,
  lng         double precision,
  armed_at    timestamptz not null default now(),
  due_at      timestamptz not null,
  resolved_at timestamptz,
  status      text not null default 'armed'
                constraint safety_checkins_status_check
                check (status in ('armed', 'safe', 'missed', 'cancelled')),
  -- When the overdue notice went out. `status = 'missed'` alone does not answer
  -- "has the contact been told", and a re-read must not tell them twice.
  alerted_at  timestamptz,
  -- Whose inbox the overdue notice landed in. It is not always
  -- `safety_contacts.contact_user_id`: an off-platform contact cannot be notified,
  -- and then the notice goes to the user themselves so the screen can say so.
  alerted_contact uuid references public.users(id) on delete set null,
  note        text,
  -- The notification that mirrors this row, so the projection can be re-pointed
  -- instead of duplicated, and so the backfill below is idempotent.
  notification_id uuid,
  constraint safety_checkins_due_after_armed
    check (due_at > armed_at),
  -- An unresolved check-in is armed, full stop: this is the constraint that makes
  -- "the timer survived a reload" true.
  constraint safety_checkins_resolution
    check (
      (status = 'armed' and resolved_at is null)
      or (status <> 'armed' and resolved_at is not null)
    ),
  constraint safety_checkins_place_len check (char_length(place) <= 200),
  constraint safety_checkins_lat check (lat is null or (lat between -90 and 90)),
  constraint safety_checkins_lng check (lng is null or (lng between -180 and 180)),
  -- A coordinate without its pair is a story, not a location.
  constraint safety_checkins_coords_together
    check ((lat is null) = (lng is null)),
  constraint safety_checkins_note_len check (note is null or char_length(note) <= 280),
  constraint safety_checkins_contact_owner
    foreign key (contact_id, user_id)
    references public.safety_contacts (id, user_id)
    on delete set null
);

-- "the one that is running" and "who is overdue" are the only two queries this
-- table gets on a hot path; both are index scans with these.
create index if not exists safety_checkins_owner_idx
  on public.safety_checkins (user_id, armed_at desc);
create index if not exists safety_checkins_armed_due_idx
  on public.safety_checkins (due_at)
  where status = 'armed';
create unique index if not exists safety_checkins_one_armed
  on public.safety_checkins (user_id)
  where status = 'armed';

comment on table public.safety_checkins is
  'The safety check-in record (0021). Server-owned: the owner reads it, only the API
   writes it, because arming, confirming and marking overdue all notify a third
   party. `notifications` rows of type check_in/check_in_resolved/check_in_overdue
   are projections of these rows.';

alter table public.safety_checkins enable row level security;
revoke all on table public.safety_checkins from anon;
-- Select-own for the browser, and nothing else: `#/integrations/supabase/safety.ts`
-- reads the history through this, while arming/confirming go through the routes.
grant select on table public.safety_checkins to authenticated;

drop policy if exists "safety_checkins_select_own" on public.safety_checkins;
create policy safety_checkins_select_own on public.safety_checkins
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. the contact of an armed check-in must be the owner's own, live contact
-- ---------------------------------------------------------------------------
-- `armed` rows are the only ones a transition can be applied to, so the trigger runs
-- on update only (an insert is validated by the routes plus the FK above; the check
-- below is what stops a resolved row's contact from being edited into someone
-- else's).
create or replace function public.safety_checkins_validate_contact()
returns trigger
language plpgsql
as $$
declare
  v_owner uuid;
begin
  if new.contact_id is null then
    return new;
  end if;

  select c.user_id into v_owner
    from public.safety_contacts c
   where c.id = new.contact_id;

  if v_owner is null then
    -- The FK already guarantees existence; this branch is for a contact deleted in
    -- the same statement (on delete set null has not run yet inside the trigger).
    new.contact_id := null;
    return new;
  end if;

  if v_owner <> new.user_id then
    raise exception 'safety check-in contact belongs to another account'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists safety_checkins_contact_trg on public.safety_checkins;
create trigger safety_checkins_contact_trg
  before insert or update on public.safety_checkins
  for each row execute function public.safety_checkins_validate_contact();

-- ---------------------------------------------------------------------------
-- 4. keep the projection honest: an alert must exist for the record that made it
-- ---------------------------------------------------------------------------
-- When the API marks a row 'missed' it writes a check_in_overdue notification to
-- the contact. If that notification is later deleted by its owner (an admin job, a
-- data-retention pass), the check-in keeps its history; only `notification_id` is
-- dropped, so a stale pointer never claims a projection exists.
create or replace function public.safety_checkins_clear_projection()
returns trigger
language plpgsql
as $$
begin
  update public.safety_checkins c
     set notification_id = null
   where c.notification_id = old.id;
  return old;
end;
$$;

drop trigger if exists safety_checkins_projection_trg on public.notifications;
create trigger safety_checkins_projection_trg
  before delete on public.notifications
  for each row execute function public.safety_checkins_clear_projection();

-- ---------------------------------------------------------------------------
-- 5. backfill: rows the old notification-shaped writer managed to create
-- ---------------------------------------------------------------------------
-- In practice there are none in a fresh project — `notifications_type_check` rejected
-- 'check_in' until 0019 — but any environment that ran 0019 and then the old screen
-- has real rows, and a check-in that a user believes is running must not vanish under
-- them. The body is `text`, so the cast is done per row with an exception handler: a
-- hand-edited or truncated body must skip, not abort the migration.
do $$
declare
  r record;
  j jsonb;
  v_due timestamptz;
  v_status text;
begin
  for r in
    select n.id, n.user_id, n.body, n.created_at
      from public.notifications n
     where n.type like 'check_in%'
       and not exists (
         select 1 from public.safety_checkins c where c.notification_id = n.id
       )
     order by n.created_at
  loop
    j := null;
    begin
      j := nullif(btrim(coalesce(r.body, '')), '')::jsonb;
    exception when others then
      j := null;
    end;

    if j is null or jsonb_typeof(j) <> 'object' then
      continue;
    end if;

    v_status := case lower(coalesce(j ->> 'status', ''))
                  when 'safe' then 'safe'
                  when 'missed' then 'missed'
                  when 'cancelled' then 'cancelled'
                  else 'armed'
                end;

    v_due := case
               when coalesce(j ->> 'due_at', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
                 then (j ->> 'due_at')::timestamptz
               else r.created_at + interval '4 hours'
             end;

    -- A due time in the past is history, not an alert: `alerted_at` is set so the
    -- lazy sweeper below does not notify a contact about a check-in that expired
    -- while nobody was looking.
    if v_due <= now() and v_status = 'armed' then
      v_status := 'missed';
    end if;

    -- `on conflict do nothing` covers the partial unique index on
    -- (user_id) where status = 'armed': a user whose old client managed to write two
    -- armed notifications gets one armed check-in, not an aborted migration.
    insert into public.safety_checkins (
      user_id, place, armed_at, due_at, status, resolved_at,
      alerted_at, notification_id
    ) values (
      r.user_id,
      left(coalesce(nullif(btrim(coalesce(j ->> 'place', '')), ''), ''), 200),
      r.created_at,
      -- The CHECK wants due_at > armed_at; a body written by the old client could
      -- carry a due time before its own insert time.
      greatest(v_due, r.created_at + interval '1 minute'),
      v_status,
      case when v_status = 'armed' then null else now() end,
      case when v_status = 'armed' then null else now() end,
      r.id
    )
    on conflict do nothing;
  end loop;
end;
$$;

-- An imported row carries its origin, so a screen reading the history later can
-- tell "this was never watched" from "this ran and was confirmed": the ones that
-- came from a notification projection have no `armed` future and no alert that was
-- actually delivered to anybody.
update public.safety_checkins c
   set note = 'Imported from a safety-check-in notification (0021); no contact was alerted.'
 where c.note is null
   and c.notification_id is not null
   and c.status <> 'armed';

commit;
