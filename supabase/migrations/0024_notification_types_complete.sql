-- 0024: the notification vocabulary, completed with the type one route has always written.
--
-- Why this file exists at all
-- -------------------------
-- `notifications.type` is not decoration: it is the only thing that lets the inbox tell a
-- match, a check-in and a tribe broadcast apart. 0013 made it a CHECK list, 0019 widened
-- that list after the safety and fansite flows were found to be writing values outside it,
-- and `src/lib/migration-invariants.test.ts` now pins the pair together — every `type` the
-- app writes into a constrained table has to be in the constraint the database enforces.
--
-- The guard's first run found one still-open case, from `meetnow`:
--
--   src/routes/api/meetnow/index.ts inserts
--     { userId: post.userId, type: "meetnow", title: "MeetNow join", ... }
--   and "meetnow" is in no CHECK list this file set has ever had.
--
-- What that means on the database: the insert is rejected with 23514, not ignored. The
-- route runs it inside the same transaction as the tap it is announcing, so the whole
-- `POST /api/meetnow` transaction aborts — the tap is rolled back too, and the caller sees
-- a 500 with a Postgres constraint name in it. A MeetNow join therefore did two bad things
-- at once: it notified nobody, and it lost the tap that justified it.
--
-- The fix is the missing value, not a substitute one. "match"/"message"/"system" would all
-- type-check and all be wrong in the inbox: "Someone is coming to your MeetNow spot" is its
-- own event, `src/components/Header.tsx` already renders an unknown type with a default
-- icon, and inventing a second meaning for a working value would make the column less
-- useful, not more.
--
-- Order of operations
-- -------------------
-- Drop, then re-add with one more value. That is safe on every project this schema has
-- ever been applied to, and worth stating because `alter table add constraint` *validates*
-- the rows it finds — a narrowed list would abort the migration on legacy data. The list
-- below is a strict superset of both lists that preceded it (0013's eight and the four
-- values 0019 added), so no row this application could have written is outside it.
--
-- Verified by reading, not by running: this repository has no Postgres in it, and
-- `0013`/`0019` are already-pushed migrations whose text is copied above rather than
-- changed. `meetnow` stays a CHECK value, not an enum value, for the reason 0019 records:
-- `alter type ... add value` cannot run inside the transaction `supabase db push` wraps a
-- file in, so the column is `text` and the vocabulary lives in the constraint.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like','match','message','event','mention','system','grant','report',
                  'fansite_subscribe','check_in','check_in_resolved','check_in_overdue',
                  'meetnow'));
