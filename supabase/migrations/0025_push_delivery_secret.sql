-- 0025: make the push delivery trigger able to authenticate, and stop it calling a
-- function that would reject the notification anyway.
--
-- Two defects, both invisible to every check this repository had:
--
--   1. `supabase/functions/notify` is a Supabase Edge Function, and `supabase/config.toml`
--      declared no `[functions.*]` section, so `notify` inherited the platform default
--      `verify_jwt = true`. A `pg_net` request from a trigger carries no user JWT, so every
--      delivery attempt was answered 401 by the platform. Push was not "flaky": it could not
--      run. Opening the function (config.toml now does) is only safe with a shared secret,
--      because a function that will send text of your choosing to another user's lock screen
--      is a phishing primitive the moment its URL is public.
--   2. `notify` also *inserted* a row into `public.notifications` (`type: "push"`). That
--      violates `notifications_type_check` as 0019/0024 define it, and — had it passed — the
--      insert re-fires `notifications_enqueue_push_trg`, which is an `after insert` trigger on
--      the same table. The inbox row is the record and the push is a copy of it; the insert is
--      deleted in the function, and this file gives it a trigger that only fires when there is
--      somebody to deliver to.
--
-- `fyk.push_notify_token` is a *role setting*, not a process env, for the same reason
-- `fyk.push_notify_url` is: a migration must not change how the server runs (the
-- `ALTER SYSTEM` that aborted 0009 is the precedent, recorded in AUDIT §2.15), and the
-- trigger executes as the inserting role. Both settings must be present or nothing leaves
-- the database — an absent token means "no push", not "push with an empty secret".
--
-- Idempotent: every statement here is a `create or replace` or a guarded `drop`.

-- ---------------------------------------------------------------------------
-- 1. The delivery trigger: authenticated, and only for users who can receive it
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
begin
  -- Not configured: silent no-op, the safe default.
  if v_url is null or v_token is null then
    return new;
  end if;

  if not exists (select 1 from pg_catalog.pg_namespace where nspname = 'net') then
    return new;
  end if;

  -- No subscriptions means nobody to deliver to, and this trigger runs inside the
  -- transaction that is inserting the inbox row. The lookup uses the leading column of
  -- `push_subscriptions_user_id_endpoint_key` (0014), so it is an index scan for a user
  -- with at most 20 rows — cheaper than an HTTP round trip that the function would answer
  -- with `{sent:0}`.
  if not exists (
    select 1 from public.push_subscriptions s where s.user_id = new.user_id
  ) then
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
    -- A delivery side effect must never roll back the notification itself: the inbox
    -- row is the record, the push is a copy of it. This is also what keeps a misconfigured
    -- `fyk.push_notify_url` (a typo'd host, a revoked secret) from becoming "users cannot
    -- post" — the failure shows up in the function's logs, not in the app's write path.
    return new;
end;
$fn$;

revoke all on function public.enqueue_push_notification() from public;
grant execute on function public.enqueue_push_notification() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Runbook (commented, because these are per-project and cannot live in a migration)
-- ---------------------------------------------------------------------------
--
--   # 1. a secret, once, shared by Postgres and the function:
--   #    openssl rand -hex 32
--   supabase secrets set PUSH_INTERNAL_TOKEN=<the same value>
--
--   # 2. tell the database where to call and with what:
--   alter role authenticated set fyk.push_notify_url   =
--     'https://YOUR-PROJECT-REF.functions.supabase.co/v1/notify';
--   alter role authenticated set fyk.push_notify_token = '<the same value>';
--
--   # 3. deploy, then prove it with one row:
--   supabase functions deploy notify --no-verify-jwt
--   insert into public.notifications (user_id, type, title, body)
--     values ('<a user with a subscription>', 'system', 'test', 'hello');
--
-- `alter role … set` is session/role-scoped, so it needs no superuser and touches no other
-- database on the instance — the difference from `ALTER SYSTEM` that 0009 got wrong.
--
-- Verification queries, worth running once after a deploy:
--   select setting from pg_settings where name in ('fyk.push_notify_url','fyk.push_notify_token');
--   select count(*) from public.push_subscriptions;                 -- 0 means nothing to deliver
--   select sent, failed, removed from <your function logs>;         -- not the database's
