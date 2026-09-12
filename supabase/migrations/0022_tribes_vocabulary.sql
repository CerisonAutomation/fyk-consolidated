-- 0022_tribes_vocabulary.sql
--
-- Two halves, one subject: the tribe/interest *counters* and the vocabulary they are
-- computed from. §0 fixes two derived-count triggers that cannot run; §1 normalises
-- `users.tribes`; §2 recounts from the data.
--
-- `users.tribes` held two vocabularies at once, and the second one matched nothing.
--
-- THE MEASUREMENT (AUDIT §3.9)
-- ---------------------------
-- `public.tribes` (0010) is `id uuid, name text unique, description, icon,
-- member_count`, and `0019` §7 derives `member_count` from `users.tribes` by
-- matching `jsonb_build_array(t.name)` **or** `jsonb_build_array(t.id::text)`,
-- because the audit had found both spellings in the data: `/tribes` writes names,
-- while an older profile editor wrote numeric ids. Three consequences, all silent:
--   1. `#/lib/compatibility.ts` scores two people by `tagOverlap(me.tribes,
--      row.tribes)` — plain string intersection. A user holding `3` and a user
--      holding `"Hiking"` share a tribe and score zero overlap, and nobody can see
--      why: the number is displayed as a percentage and the deck reshuffles.
--   2. `users_tribes_idx` is a GIN index over the array, so a filter for `"Hiking"`
--      never finds the account that stores `3` — the same person, invisible.
--   3. There is **no `tags` table anywhere in the migration set**. The numeric ids
--      in `users.tribes` were never foreign keys to anything: they are not a
--      different vocabulary that is merely inconvenient, they are unresolvable
--      tokens. Nothing can map `3` back to a name, because no name lives there.
--
-- WHAT THIS FILE DOES — and what it deliberately does not
-- ------------------------------------------------------
-- Normalise every token that *can* be resolved onto the canonical `tribes.name`,
-- case- and whitespace-insensitively (so "hiking", " HIKING " and "Hiking" collapse
-- to one entry), dedupe what that collapses, and leave the rest of the array alone.
--
-- Unresolvable tokens are **kept**. Dropping them is not the migration's call to
-- make: the array is user-entered, a token may be a tribe an admin deleted last week
-- (the FK never existed), and silently emptying part of someone's profile while
-- "fixing formatting" is the kind of change an audit should not make on its own
-- authority. What is fixed here is the *matching*: after this file, a token either
-- names a tribe or is inert in exactly the way it always was, and no new inert
-- vocabulary can arrive, because `#/lib/tribes.server.ts` resolves names on write and
-- the screen's chips only ever render catalogue entries.
--
-- The counts are recomputed at the end, since the trigger only fires on a `users`
-- update and this file rewrites `users.tribes` through an UPDATE (so it *does* fire —
-- the recount is here anyway, to catch rows whose tokens resolved to a tribe that
-- was renamed by hand in the catalogue).

-- ---------------------------------------------------------------------------
-- 0. `tribes_recount()` (0019 §7) is broken twice, and both breaks are in scope
--    for a file that recomputes these counts.
-- ---------------------------------------------------------------------------
-- (a) `if tg_op <> 'DELETE' and new.tribes is not distinct from old.tribes` is
--     evaluated for INSERT rows too, where `OLD` is not assigned: in plpgsql a
--     reference to an unassigned record raises
--     `record "old" is not assigned yet`. So the first INSERT into `public.users`
--     after 0019 — i.e. every signup — aborts. 0019 was never executed here, which
--     is the only reason nobody has hit it.
-- (b) The `names` CTE unions a query with *itself*:
--         select ... case when tg_op = 'DELETE' then old.tribes else new.tribes end
--         union
--         select ... case when tg_op = 'DELETE' then old.tribes else new.tribes end
--     Both branches read the same side, so the "old side of the update" the header
--     comment promises is never enumerated: leave a tribe and its count stays where
--     it was, and `member_count` only ever grows.
-- The replacement keeps the same name, signature and bypass GUC, and takes the
-- `case`/`tg_op` route so an unassigned record is never touched.
create or replace function public.tribes_recount()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  if tg_op = 'UPDATE' and new.tribes is not distinct from old.tribes then
    return new;
  end if;

  -- The counter is derived, so this write must be allowed to look like the other
  -- derived-counter triggers (0019): the guard checks the GUC, not the role.
  perform set_config('fyk.server_write', 'on', true);

  with names as (
    select jsonb_array_elements_text(
             case when tg_op in ('DELETE', 'UPDATE')
                  then coalesce(old.tribes, '[]'::jsonb)
                  else '[]'::jsonb end
           ) as name
    union
    select jsonb_array_elements_text(
             case when tg_op in ('INSERT', 'UPDATE')
                  then coalesce(new.tribes, '[]'::jsonb)
                  else '[]'::jsonb end
           ) as name
  )
  update public.tribes t
     set member_count = (
       select count(*) from public.users u
        where coalesce(u.tribes, '[]'::jsonb) @> jsonb_build_array(t.name)
           or coalesce(u.tribes, '[]'::jsonb) @> jsonb_build_array(t.id::text)
     )
   where t.name in (select name from names)
      or t.id::text in (select name from names);

  return coalesce(new, old);
end;
$$;

-- The same bug, independently, in the board counters (002_rls.sql:526). That trigger
-- is registered as two triggers — `post_join_count_insert` and `post_join_count_delete`
-- — and its body opens with:
--
--     target_id := coalesce(new.post_id, old.post_id);
--
-- In an INSERT row trigger `OLD` is not assigned, and plpgsql raises
-- `record "old" is not assigned yet` when a field of it is read, so *joining a board
-- post* fails outright: the coalesce evaluates both arguments. The DELETE half is fine.
-- Rewritten with the `tg_op` branch, keeping `security definer` and the pinned
-- `search_path`, and keeping the "count from the edges" semantics unchanged.
create or replace function public.refresh_post_join_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_id uuid;
begin
  target_id := case
    when tg_op = 'INSERT' then new.post_id
    when tg_op = 'DELETE' then old.post_id
    else coalesce(new.post_id, old.post_id)   -- UPDATE: both sides exist
  end;

  if target_id is null then
    return coalesce(new, old);
  end if;

  update public.board_posts p
     set join_count = (select count(*) from public.post_joins j where j.post_id = target_id)
   where p.id = target_id;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 1. normalise, in place, keeping the array order
-- ---------------------------------------------------------------------------
-- Only rows with at least one token whose spelling actually changes are updated, so
-- the trigger above runs for as few rows as possible and a user who has never seen a
-- tribe rename is not touched at all. `btrim` is not a data change; it is what the
-- comparison would do anyway.
with tokens as (
  select
    u.id as user_id,
    tok.ord,
    coalesce(t.name, btrim(tok.value)) as value
  from public.users u
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(u.tribes) = 'array' then u.tribes else '[]'::jsonb end
  ) with ordinality as tok(value, ord)
  left join lateral (
    -- `btrim` + `lower` on both sides: the catalogue is title case, users type what
    -- they type, and `citext` is not enabled in this project.
    select c.name
      from public.tribes c
     where lower(btrim(c.name)) = lower(btrim(tok.value))
     order by c.name
     limit 1
  ) t on true
  where jsonb_typeof(u.tribes) = 'array'
    and jsonb_array_length(u.tribes) > 0
),
first_seen as (
  -- Dedupe by keeping the lowest ordinal of each equal value: `jsonb_agg(distinct)`
  -- would silently reorder the array, and the order is what the profile editor shows.
  select d.user_id, d.ord, d.value
  from tokens d
  where d.value <> ''
    and not exists (
      select 1 from tokens p
       where p.user_id = d.user_id and p.ord < d.ord and p.value = d.value
    )
),
rebuilt as (
  select user_id, jsonb_agg(value order by ord) as tribes
  from first_seen
  group by user_id
)
update public.users u
   set tribes = r.tribes
  from rebuilt r
 where u.id = r.user_id
   and u.tribes is distinct from r.tribes;

-- ---------------------------------------------------------------------------
-- 2. recount the catalogue once, from the data
-- ---------------------------------------------------------------------------
-- The trigger above fires per row for everything step 1 changed. This sweep exists so
-- a tribe renamed by hand in the catalogue cannot leave a stale count behind, and so
-- an environment with no user activity still ends this file consistent. It writes a
-- derived column, so the bypass GUC has to be set in the same statement's transaction.
select set_config('fyk.server_write', 'on', true);

update public.tribes t
   set member_count = (
     select count(*)
       from public.users u
      where coalesce(u.tribes, '[]'::jsonb) @> jsonb_build_array(t.name)
         or coalesce(u.tribes, '[]'::jsonb) @> jsonb_build_array(t.id::text)
   )
 where t.member_count is distinct from (
     select count(*)
       from public.users u
      where coalesce(u.tribes, '[]'::jsonb) @> jsonb_build_array(t.name)
         or coalesce(u.tribes, '[]'::jsonb) @> jsonb_build_array(t.id::text)
   );

commit;
