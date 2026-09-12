-- 0026: make the privacy switches mean something, in both directions.
--
-- WHY THIS FILE EXISTS (P0, found by asking "where does the mobile settings screen write?")
-- -----------------------------------------------------------------------------------------
-- This repository had two parallel vocabularies for the same handful of privacy decisions.
--
--   * `src/routes/api/settings/index.ts` — `GET/PUT /api/settings` — writes real columns on
--     `public.users` (`hide_online`, `hide_distance`, `incognito`, `visible`, `dnd_mode`,
--     `notif_prefs`, …) behind a strict allow-list, and `src/lib/api-helpers.ts` *reads*
--     them when shaping every profile card (`status`, `online`, `distance`, `lastSeen`).
--   * `src/routes/settings/privacy/index.tsx` and `src/routes/settings/app/index.tsx` — the
--     screens a phone actually opens — wrote the same five decisions into `localStorage`
--     under `fyk:app-data:preferences.data` and nowhere else.
--
-- So "Hide my online status" rendered a green "Saved ✓", survived a relaunch, and changed
-- nothing: the server kept broadcasting `status: "online"` to everyone in discovery, on
-- another device, and after a browser-data clear. That is the worst shape a privacy control
-- can have, because on this app the reason for the switch is usually somebody who must not
-- find out. The screens are rewired to `/api/settings` (see `src/lib/settings-map.ts`); this
-- file supplies the one thing the screen promised that no table had, and then closes the hole
-- on the server's side of the same pair.
--
-- 1. `hide_last_online` — the "Show my 'last online'" row had no column, so there was
--    nothing for the screen to write. `hide_online` masks `status`/`online`, but `lastSeen`
--    was returned *unconditionally* beside it, which leaks the same fact in a different
--     field ("offline, last seen 4 minutes ago" is exactly the information the switch was
--     for). The column and its consumer (`toProfileCard`) are added together so a switch and
--     its meaning cannot drift apart; `0018` revokes `select`/DML on `users` for both
--     client roles, so the new column is server-writable only, like its siblings.
--
-- 2. The push trigger ignored every notification preference. `0023` defined
--    `enqueue_push_notification()` and `0025` made it reachable, but both fire on
--    *every* `notifications` insert, while `settings-client.tsx` has four switches (push,
--    matches, messages, events) writing `notif_prefs` through `/api/settings` — plus
--    `dnd_mode`. Nothing on the server read those columns, so "Do not disturb" silenced the
--    in-app list and the lock screen kept buzzing: a toggle whose only effect was to make
--    the user believe it worked. The trigger is redefined here to consult them.
--
--    The exception is deliberate and is the reason this is a migration rather than
--    application code: the safety types are exempt from Do Not Disturb and from the
--    category switches. A timer that can be muted by the same screen that offers "quiet
--    notifications" is not a safety timer, and a mute for dinner is not consent to miss an
--    alarm. `pushNotifications: false` still covers everything, including them: that switch
--    is the device-level opt-out, a different decision from a temporary mute, and the inbox
--    row is written either way — the record and its audit trail survive, and only the buzz
--    on the lock screen is withheld.
--
-- The rule for absent settings is "deliver": only an explicit JSON `false` suppresses. A
-- user who has never opened Settings must keep receiving exactly what they received before
-- this file, or a migration would turn an unset preference into a silent delivery outage.
--
-- Idempotent: one guarded `add column if not exists`, one `create or replace function`.

-- ---------------------------------------------------------------------------
-- 1. The column "Show my 'last online'" needed in order to exist
-- ---------------------------------------------------------------------------

alter table public.users
  add column if not exists hide_last_online boolean not null default false;

comment on column public.users.hide_last_online is
  'Privacy switch owned by /settings/privacy. When true, toProfileCard() drops `lastSeen` '
  'and collapses "active within 48h" to "offline", because both state when this person was '
  'last here. Separate from hide_online, which only masks live presence: a user may be fine '
  'with "online" and refuse "last seen 6 minutes ago".';

-- ---------------------------------------------------------------------------
-- 2. Delivery policy: notifications reach a lock screen only when the row says they may
-- ---------------------------------------------------------------------------

create or replace function public.enqueue_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_url   text := nullif(btrim(coalesce(current_setting('fyk.push_notify_url', true), '')), '');
  v_token text := nullif(btrim(coalesce(current_setting('fyk.push_notify_token', true), '')), '');
  v_pref  jsonb := '{}'::jsonb;
  v_dnd   boolean := false;
  v_gate  text;
begin
  -- Not configured: silent no-op, the safe default (unchanged from 0025).
  if v_url is null or v_token is null then
    return new;
  end if;

  if not exists (select 1 from pg_catalog.pg_namespace where nspname = 'net') then
    return new;
  end if;

  -- Nobody to deliver to (0025). Kept, and kept first: it is an index scan and it makes
  -- the common case on a fresh project cost nothing.
  if not exists (
    select 1 from public.push_subscriptions s where s.user_id = new.user_id
  ) then
    return new;
  end if;

  -- The recipient's own settings, in the same statement, so a client cannot race a toggle
  -- into a stale decision. `security definer` is what makes this read possible at all:
  -- `authenticated` has no select on `users` since 0018, and a trigger that runs as the
  -- inserting role would otherwise fail — and be swallowed by the handler below — turning
  -- "cannot read preferences" into "no push for anyone". That failure mode is why the
  -- lookup is guarded by `if found` instead of a plain left join that could invent defaults.
  select coalesce(nullif(u.notif_prefs, 'null'::jsonb), '{}'::jsonb),
         coalesce(u.dnd_mode, false)
    into v_pref, v_dnd
    from public.users u
   where u.id = new.user_id;

  if not found then
    -- A notification row whose recipient has no user row cannot be delivered anyway (the
    -- subscription lookup above found nothing to send to), but the policy must not *invent*
    -- a suppression here either: absence of settings means absence of a rule.
    return new;
  end if;

  -- Which switch owns this notification type. `notif_prefs` keys are exactly the ones
  -- `notifSchema` in src/routes/api/settings/index.ts allows, so this case and that
  -- allow-list are pinned together by src/lib/migration-invariants.test.ts: a new type
  -- has to arrive with a decision about which switch may silence it, instead of
  -- defaulting to "silenceable" or "always pushes". The four types with no category
  -- switch of their own are listed rather than left to `else null`, so that decision
  -- lives in the code and not in a comment a later redefinition could delete.
  v_gate := case new.type
    when 'like'              then 'matchNotifications'
    when 'match'             then 'matchNotifications'
    when 'message'           then 'messageNotifications'
    when 'event'             then 'eventNotifications'
    when 'fansite_subscribe' then 'eventNotifications'
    when 'meetnow'           then 'eventNotifications'
    when 'mention'           then null
    when 'system'            then null
    when 'grant'             then null
    when 'report'            then null
    else null
  end;

  if lower(v_pref ->> 'pushNotifications') = 'false' then
    return new;
  end if;

  if v_gate is not null and lower(v_pref ->> v_gate) = 'false' then
    return new;
  end if;

  -- Do not disturb, with the safety exemption. Deliberately not a quiet-hours *window*:
  -- `dnd_mode` is a boolean the user turns on and off, and inventing an hour range here
  -- would silence a check-in alert that the person next to them has not agreed to mute.
  if v_dnd and new.type not in ('check_in', 'check_in_resolved', 'check_in_overdue') then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-fyk-push-token', v_token
    ),
    body := jsonb_build_object(
      'userId', new.user_id,
      'title', new.title,
      'body', coalesce(new.body, ''),
      'href', coalesce(new.href, '')
    )
  );
  return new;
exception
  when others then
    -- A delivery side effect must never roll back the notification itself (0025). Note what
    -- this also means: a policy error here reads as "no push", so the queries at the bottom
    -- of this file are the way to tell "suppressed on purpose" from "failing".
    return new;
end;
$fn$;

revoke all on function public.enqueue_push_notification() from public;
grant execute on function public.enqueue_push_notification() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The footprint half, for the record
-- ---------------------------------------------------------------------------
--
-- `incognito` (ghost mode) now also suppresses *recording*: `GET /api/profile/{id}` inserts
-- the `footprints` row that powers "who viewed me", and it does so with the preference test
-- inside the statement, so a browser cannot skip or forge the check by calling a different
-- endpoint. No schema change is needed for that — which is the point of keeping the check in
-- the one place that writes the row: a client-writable "I visited X" would make both the
-- visitors list and ghost mode whatever the caller said they were.
--
-- Verification, once the migrations are applied:
--
--   -- the column and its default
--   select column_name, column_default, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'users'
--      and column_name in ('hide_online', 'hide_last_online', 'hide_distance');
--
--   -- the policy is compiled into the trigger, not lost by an out-of-order file
--   select prosrc like '%matchNotifications%' and prosrc like '%check_in_overdue%' as has_policy
--     from pg_proc where proname = 'enqueue_push_notification';
--
--   -- suppressed on purpose vs silently failing, for one user:
--   select notif_prefs, dnd_mode from public.users where id = '<user>';
