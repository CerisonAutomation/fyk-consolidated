-- 0023_optimizations_reordered.sql
--
-- The statements `0009_optimizations.sql` could not run, moved to a file where they
-- can — plus the two jobs the repository described but never wired.
--
-- WHY THIS FILE EXISTS (P0, found while adding a static ordering check)
-- ---------------------------------------------------------------------
-- `0009_optimizations.sql` opened with five `ALTER SYSTEM SET` statements, which the
-- SQL role on Supabase cannot execute: `supabase db push` aborted on the *first
-- statement of file nine*, so nothing after it — `0010_remaining_tables.sql` first and
-- foremost, i.e. `users`, `taps`, `notifications`, `stories`, `favorites`, `groups`,
-- `shouts`, `tribes`, the whole second half of the product — had ever been applied on a
-- project that followed the documented path. The same file then created fifteen indexes
-- on those not-yet-existing tables and a materialized view joining
-- `matches.user1_id`/`user2_id`, columns `matches` has never had (0000 calls them
-- `user_a`/`user_b`). And because that view could not be created, neither did anyone
-- ever write the `refresh_user_stats()` function that
-- `supabase/functions/cron-cleanup` calls every day: the RPC does not exist.
--
-- 0009 keeps the six indexes whose tables exist at that point and explains the rest in
-- its own header. Everything that had to move is here, verified column by column
-- against the migrations that create them, with the two `matches` join columns
-- corrected. `src/lib/migration-invariants.test.ts` fails when a migration references a
-- table a later migration creates, so the class cannot come back unnoticed: this was
-- invisible for the entire life of the repository because no CI ran `db push`.

begin;

-- ---------------------------------------------------------------------------
-- 1. the indexes 0009 wanted, on tables that now exist
-- ---------------------------------------------------------------------------
-- Partial predicates are kept exactly as written: they are the point of three of these
-- (`users_visible_idx` is what makes the discoverability filter an index scan,
-- `notifications_user_unread_idx` is the bell's query, `users_geo_idx` skips the rows
-- without a fix rather than indexing nulls).
create index if not exists users_last_active_idx on public.users (last_active_at desc);
create index if not exists users_geo_idx on public.users (lat, lng)
  where lat is not null and lng is not null;
create index if not exists users_city_idx on public.users (city);
create index if not exists users_tier_idx on public.users (tier);
create index if not exists users_tribes_idx on public.users using gin (tribes);
create index if not exists users_interests_idx on public.users using gin (interests);
create index if not exists users_looking_for_idx on public.users using gin (looking_for);
create index if not exists users_online_idx on public.users (last_seen desc)
  where online = true;
create index if not exists users_visible_idx on public.users (id)
  where not hidden and not incognito;

create index if not exists taps_tapper_idx on public.taps (tapper_id, created_at desc);
create index if not exists taps_tapped_idx on public.taps (tapped_id, created_at desc);

create index if not exists notifications_user_unread_idx on public.notifications (user_id, read)
  where not read;
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

create index if not exists stories_expires_idx on public.stories (expires_at);
create index if not exists story_views_story_idx on public.story_views (story_id);

-- ---------------------------------------------------------------------------
-- 2. `user_stats`, the way 0009 meant to build it
-- ---------------------------------------------------------------------------
-- `matches` is `user_a`/`user_b` with a `check (user_a < user_b)` canonical order
-- (0000), so the two joins below are one OR per match rather than the two-column
-- version the original file assumed. A materialized view is the right shape for this
-- particular number (three counts per user, read by nobody in the request path today),
-- and `user_stats_id_idx` is what makes `REFRESH ... CONCURRENTLY` possible at all —
-- without a unique index Postgres refuses to refresh concurrently, and a plain refresh
-- takes an access-exclusive lock, which is what a "periodic" job must not do to a
-- live schema.
create materialized view if not exists public.user_stats as
select
  u.id,
  u.pseudo,
  u.city,
  u.tier,
  count(distinct t.id) as tap_count,
  count(distinct f.id) as favorite_count,
  count(distinct m.id) as match_count,
  max(t.created_at) as last_tap
from public.users u
left join public.taps t on t.tapper_id = u.id
left join public.favorites f on f.user_id = u.id
left join public.matches m on m.user_a = u.id or m.user_b = u.id
group by u.id, u.pseudo, u.city, u.tier;

create unique index if not exists user_stats_id_idx on public.user_stats (id);

comment on materialized view public.user_stats is
  'Per-user tap/favorite/match counts, refreshed by cron (0023). Not read by any API
   route today: it is the aggregate the dashboard and the moderation queue want. If a
   screen ever needs one of these numbers live, compute it from the edges instead of
   from this view — a stale count on a profile is a bug report, a stale count in an
   admin list is a Tuesday.';

-- The function `supabase/functions/cron-cleanup` has called since it was written, and
-- which has never existed. `security definer` because the refresher must be the view's
-- owner, and the caller (service_role, over the RPC) is not.
create or replace function public.refresh_user_stats()
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- No transaction may be open around this: `REFRESH ... CONCURRENTLY` refuses one,
  -- which is why the function does nothing else and why `db push` running this file
  -- inside a transaction only *defines* it.
  refresh materialized view concurrently public.user_stats;
exception
  when others then
    -- The documented reasons a concurrent refresh refuses are a missing unique index
    -- and a view that has never been populated; both are fixed by a plain refresh,
    -- which takes the lock for the length of one statement. A failure *after* that is
    -- reported rather than swallowed, because the cron function is the only thing that
    -- keeps these numbers honest and a silent no-op is how 0009 ended up refreshing
    -- nothing for the life of the project.
    begin
      refresh materialized view public.user_stats;
    exception
      when others then
        raise exception 'refresh_user_stats failed: %', sqlerrm using errcode = 'P0001';
    end;
end;
$fn$;

revoke all on function public.refresh_user_stats() from public;
grant execute on function public.refresh_user_stats() to service_role, authenticated;

-- ---------------------------------------------------------------------------
-- 3. the check-in sweep, so "overdue" does not depend on opening the app
-- ---------------------------------------------------------------------------
-- 0021 §"lazy" deliberately materialised an expired check-in on the *read* path,
-- because the app has no scheduler. That is honest but incomplete: the contact learns
-- nothing until the user looks at the screen. This function is the version a schedule
-- can call, and it is also what the read-path sweep shares its semantics with —
-- exactly-once via `alerted_at`, so running both is not double-alerting.
create or replace function public.sweep_checkins_overdue()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_rows integer := 0;
  v_contact_user uuid;
  v_pseudo text;
  r record;
begin
  -- The same single-winner statement #/lib/safety.server.ts uses: only the update that
  -- actually flips a row is allowed to notify, so the read-path sweep and this job can
  -- run against the same due check-in without the contact hearing about it twice.
  for r in
    update public.safety_checkins
       set status = 'missed',
           resolved_at = now(),
           alerted_at = now()
     where status = 'armed'
       and alerted_at is null
       and due_at < now()
    returning id, user_id, contact_id, place, due_at
  loop
    v_rows := v_rows + 1;

    select sc.contact_user_id into v_contact_user
      from public.safety_contacts sc where sc.id = r.contact_id;
    select u.pseudo into v_pseudo from public.users u where u.id = r.user_id;

    -- An on-platform contact is told; otherwise the notice stays with the user, whose
    -- screen then says what happened instead of implying somebody was paged.
    insert into public.notifications (user_id, type, title, body, href, actor_id)
    values (
      coalesce(v_contact_user, r.user_id),
      'check_in_overdue',
      case
        when v_contact_user is null then 'Missed safety check-in'
        else coalesce(nullif(btrim(v_pseudo), ''), 'Someone') || ' missed a safety check-in'
      end,
      json_build_object(
        'check_in_id', r.id,
        'place', r.place,
        'due_at', r.due_at,
        'source', 'sweep_checkins_overdue()'
      )::text,
      '/safety',
      r.user_id
    );

    update public.safety_checkins c
       set alerted_contact = coalesce(v_contact_user, r.user_id)
     where c.id = r.id;
  end loop;

  return v_rows;
end;
$fn$;

revoke all on function public.sweep_checkins_overdue() from public;
grant execute on function public.sweep_checkins_overdue() to service_role;

-- ---------------------------------------------------------------------------
-- 4. push delivery: invoke `functions/notify` when the project has been told to
-- ---------------------------------------------------------------------------
-- `supabase/functions/notify` is a complete web-push sender and `push_subscriptions`
-- holds real endpoints and keys, but nothing in the repository ever calls the
-- function — so subscribing worked and no push was ever delivered (AUDIT §3.15). This
-- trigger is the missing edge, and it is *opt-in by configuration*: the URL is read
-- from a database setting rather than being written into a migration, because a
-- committed function URL is a project identifier and, with a service key nearby, a
-- secret.
--
--   alter database postgres set fyk.push_notify_url =
--     'https://<ref>.supabase.functions.dev/notify';
--
-- Until that is set, and wherever `pg_net` is not installed, the trigger is a no-op —
-- deliberately *not* an error: an unconfigured project must still be able to insert a
-- notification, which is the failure mode the whole audit is a fight against.
create or replace function public.enqueue_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_url text := nullif(btrim(coalesce(current_setting('fyk.push_notify_url', true), '')), '');
begin
  if v_url is null then
    return new;
  end if;

  if not exists (select 1 from pg_catalog.pg_namespace where nspname = 'net') then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := '{"Content-Type":"application/json"}'::jsonb,
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
    -- A delivery side effect must never roll back the notification itself: the inbox
    -- row is the record, the push is a copy of it.
    return new;
end;
$fn$;

revoke all on function public.enqueue_push_notification() from public;

drop trigger if exists notifications_enqueue_push_trg on public.notifications;
create trigger notifications_enqueue_push_trg
  after insert on public.notifications
  for each row execute function public.enqueue_push_notification();

-- ---------------------------------------------------------------------------
-- 5. schedule the two jobs when the project has pg_cron
-- ---------------------------------------------------------------------------
-- `pg_cron` is an infrastructure choice, not a schema one, so this file *uses it if it
-- is there* rather than installing it: `create extension` belongs in the dashboard or
-- `supabase/config.toml`, where the person who owns the database can see it. When it
-- is absent, the two schedules below are reported as skipped and the deploy story is
-- unchanged — which is also true of 0009's `ALTER SYSTEM` lines, and for the same
-- reason: a migration should not silently change how the server runs.
do $$
declare
  has_cron boolean;
begin
  select exists (
    select 1 from pg_catalog.pg_extension e
      join pg_catalog.pg_namespace n on n.oid = e.extnamespace
     where e.extname = 'pg_cron'
  ) into has_cron;

  if not has_cron then
    raise notice 'pg_cron is not installed: schedule supabase/functions/cron-cleanup externally, or enable pg_cron and re-run 0023 (0023 §5)';
    return;
  end if;

  -- 04:17 UTC daily, deliberately not on the hour: a fleet of projects refreshing at
  -- 00:00 is a self-inflicted thundering herd on shared infrastructure.
  perform cron.schedule(
    'fyk-refresh-user-stats',
    '17 4 * * *',
    $job$select public.refresh_user_stats();$job$
  );

  -- Every five minutes: the smallest interval that makes "you missed a check-in"
  -- reach a contact without turning a notification insert into a polling loop.
  perform cron.schedule(
    'fyk-sweep-checkins-overdue',
    '*/5 * * * *',
    $job$select public.sweep_checkins_overdue();$job$
  );
end;
$$;

commit;
