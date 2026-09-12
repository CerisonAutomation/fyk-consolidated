-- 0019 — the economy, the inbox and the social graph stop being client-owned
-- =============================================================================
--
-- Why this migration exists
-- -------------------------
-- `0018` made `public.users` server-owned and `public.profiles` the browser's
-- read surface. Running the same test over the rest of the schema showed the rest
-- of the app never got that treatment, and the gaps line up exactly with the
-- screens that "worked" in a demo and do nothing against a real database:
--
--   (a) WORLD-WRITABLE — RLS was never enabled on `wallet_transactions`,
--       `consumables_inventory`, `subscriptions`(+0011's `to authenticated`
--       grant), `shouts`, `shout_likes`, `groups`, `group_members`,
--       `group_messages`, `fansites`, `tribes`, `user_notes`, `favorites`,
--       `footprints`, `stories`, `story_views`, `typing_indicators`,
--       `message_reads`, `push_subscriptions`, `event_waitlist`, `meetnow_posts`,
--       `saved_filters`, `saved_phrases`, `pet_items`, `pet_adventures`,
--       `profile_embeddings`, `message_embeddings`, `king_pet`.
--       `0010`/`0011` granted `select, insert, update, delete` to
--       `authenticated`, so with any signed-in token you could: mint bones
--       (`insert` into `wallet_transactions` for any wallet), grant yourself
--       Premium (`insert` into `premium_entitlements`, whose `0011` SELECT-only
--       policy never stopped writes), read every user's private notes about you
--       (`user_notes` has no policy and no RLS), post into any group, and rewrite
--       the pet catalogue (`pet_items.bone_cost = 1`).
--
--   (b) DEAD-BY-ACCIDENT — `wallet`, `notifications`, `king_pet`, `sessions`,
--       `audit_events`, `auth_rate_limits` have `enable row level security` and
--       *zero* policies, so every browser read returns `[]` and every write
--       affects 0 rows without erroring. `src/integrations/supabase/wallet.ts`
--       and `king-pet.ts` are built on top of exactly those tables: they were
--       written to be filled by the same token that cannot fill them.
--
--   (c) THREE BALANCES, ONE CURRENCY — `wallet.balance`, `wallet_transactions`
--       (the ledger) and `king_pet.bones` all claim to be the number of bones an
--       account owns, and the client modules set the first two by hand.
--
-- The rule, same as 0018: the browser reads a projection and writes its own
-- edges; everything with a consequence — money, privilege, someone else's inbox,
-- someone else's privacy — is written by the API. The API connects as the table
-- owner (`DATABASE_URL` → `postgres.<ref>`), so RLS and these revokes do not
-- apply to it. Where a client keeps a right, a policy now says so explicitly.
--
-- Idempotent, and §6 repairs the drift the old layout had already caused.
--
-- Assumptions taken, stated: `PAYMENTS_DEV_MODE` (not `DEV_MODE`) gates premium
-- grants so a dev flag cannot mint entitlements in production; notifications are
-- minted by the API only (a client may mark its own read/hidden, never author
-- content); `king_pet.bones` is dropped rather than reconciled, because a mirror
-- of the wallet that a client can still write is the same bug with extra steps.

-- ---------------------------------------------------------------------------
-- 0. the write-context flag the guards read
-- ---------------------------------------------------------------------------
create or replace function public.fyk_server_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('fyk.server_write', true), '') = 'on'
$$;

comment on function public.fyk_server_write() is
  'True inside a server-owned write. Guards on derived columns and append-only tables use it to tell their own bookkeeping from a client''s. A browser token has no way to set a GUC: it only speaks PostgREST.';

-- ---------------------------------------------------------------------------
-- 1. the wallet is a ledger, not a number
-- ---------------------------------------------------------------------------
alter table public.wallet enable row level security;
alter table public.wallet_transactions enable row level security;

-- A policy would already refuse the write, but the grant is the honest border:
-- with a policy alone, `insert` "succeeds" as 0 rows affected, and the UI above
-- it reports success. `wallet.balance`, `wallet.currency` have no business being
-- settable by a browser at all.
revoke insert, update, delete on table public.wallet from anon, authenticated;
revoke insert, update, delete on table public.wallet_transactions from anon, authenticated;
revoke select on table public.wallet from anon;
revoke select on table public.wallet_transactions from anon;
grant select on table public.wallet to authenticated;
grant select on table public.wallet_transactions to authenticated;

drop policy if exists "wallet_select_own" on public.wallet;
create policy wallet_select_own on public.wallet
  for select to authenticated
  using (user_id = auth.uid());

-- `wallet_transactions` has no `user_id`, so the ledger is scoped through its
-- wallet. Two more columns, both server-only, so a retry cannot double-mint and
-- every entry says which product minted it.
alter table public.wallet_transactions add column if not exists source text not null default 'server';
alter table public.wallet_transactions add column if not exists idempotency_key text;
create unique index if not exists wallet_tx_idempotency_idx
  on public.wallet_transactions (idempotency_key) where idempotency_key is not null;
comment on column public.wallet_transactions.idempotency_key is
  'Client-supplied key for a money movement; a retry with the same key is a no-op instead of a second mint (0019).';

drop policy if exists "wallet_tx_select_own" on public.wallet_transactions;
create policy wallet_tx_select_own on public.wallet_transactions
  for select to authenticated
  using (exists (
    select 1 from public.wallet w
    where w.id = wallet_transactions.wallet_id and w.user_id = auth.uid()
  ));

-- One BEFORE trigger does validation and bookkeeping together, so the order
-- cannot depend on trigger names. It owns `wallet.balance`, which is why
-- `wallet_balance_is_derived` has to be able to tell its write from a client's.
create or replace function public.wallet_tx_before()
returns trigger
language plpgsql
as $$
declare
  v_next integer;
begin
  if tg_op in ('UPDATE', 'DELETE') and not public.fyk_server_write() then
    raise exception 'public.wallet_transactions is append-only: post a compensating row, never rewrite history';
  end if;

  if tg_op = 'DELETE' then
    -- Only the ledger itself may be unwound, and only by a compensating row;
    -- this path exists for the §6 backfill and for future server-side repair.
    update public.wallet set balance = greatest(0, balance - old.amount), updated_at = now()
      where id = old.wallet_id;
    return old;
  end if;

  if new.amount is null or new.amount = 0 then
    raise exception 'a wallet transaction must move a non-zero amount';
  end if;
  if not exists (select 1 from public.wallet w where w.id = new.wallet_id) then
    raise exception 'wallet % does not exist', new.wallet_id
      using hint = 'GET /api/wallet creates the wallet on first read.';
  end if;
  if new.type is null or btrim(new.type) = '' then
    new.type := 'adjustment';
  end if;
  if new.description is null or btrim(new.description) = '' then
    new.description := case when new.amount > 0 then 'Grant' else 'Spend' end;
  end if;

  -- Set the flag *before* touching the wallet: the guard on `wallet` fires in
  -- this same statement.
  perform set_config('fyk.server_write', 'on', true);

  select balance + new.amount into v_next from public.wallet where id = new.wallet_id for update;
  if v_next is null then
    raise exception 'wallet % disappeared mid-transaction', new.wallet_id;
  end if;
  if v_next < 0 then
    raise exception 'insufficient balance: not enough bones (balance %, cost %)',
      (select balance from public.wallet where id = new.wallet_id), -new.amount
      using errcode = 'P0001';
  end if;

  update public.wallet set balance = v_next, updated_at = now() where id = new.wallet_id;
  return new;
end;
$$;

drop trigger if exists wallet_tx_append_only_trg on public.wallet_transactions;
drop trigger if exists wallet_apply_ledger_trg on public.wallet_transactions;
drop trigger if exists wallet_tx_before_trg on public.wallet_transactions;
create trigger wallet_tx_before
  before insert or update or delete on public.wallet_transactions
  for each row execute function public.wallet_tx_before();

create or replace function public.wallet_balance_is_derived()
returns trigger
language plpgsql
as $$
begin
  if public.fyk_server_write() then
    return new;
  end if;
  if new.balance is distinct from old.balance then
    raise exception 'public.wallet.balance is derived from public.wallet_transactions (0019): insert a ledger row instead';
  end if;
  if new.user_id is distinct from old.user_id then
    raise exception 'a wallet belongs to one account for its lifetime';
  end if;
  return new;
end;
$$;

drop trigger if exists wallet_balance_is_derived_trg on public.wallet;
create trigger wallet_balance_is_derived
  before update on public.wallet
  for each row execute function public.wallet_balance_is_derived();

-- A wallet must exist for every account: `update … where user_id = X` on a
-- missing row is how "purchase succeeded, balance unchanged" was born.
insert into public.wallet (user_id, balance)
select u.id, 0 from public.users u
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 1b. the constraints that disagreed with the product
-- ---------------------------------------------------------------------------
-- `0013_production_patterns.sql` added CHECKs whose vocabularies no caller
-- matched, which is how a paid feature ends up as a silent no-op:
--
--   * `wallet_tx_type_check` allowed ('earn','spend','refund','bonus','streak',
--     'adventure','gift') while `wallet.ts`/`king-pet.ts` inserted 'credit' and
--     'debit' — every ledger row those screens wrote was rejected with 23514,
--     and the `await client.from(...).insert(...)` result was never checked.
--   * `wallet_tx_amount_check` required `amount > 0`, so a *debit* had to be
--     stored as a positive number tagged 'debit'. A ledger of unsigned numbers
--     plus a `direction` string is how `balance + amount` credits the wallet when
--     someone spends. Signed amounts, one convention, no direction column.
--   * `subscriptions_tier_check` allowed ('free','plus','premium') while the
--     premium screen sells plus/gold/platinum, and `premium_entitlements.tier` is
--     `plan_tier` = ('free','plus'): two of the three tiers could not be stored at
--     all, at the type level. The enum also cannot be extended and then used
--     inside the same transaction (`supabase db push` wraps a file in one), so the
--     column becomes `text` with a CHECK — the same 4-value list the product and
--     `/gamechangers` already speak.
--   * `notifications_type_check` allowed eight types and the app writes eleven.
--       `'fansite_subscribe'` (the fansite flow), `'check_in'`,
--       `'check_in_resolved'` and `'check_in_overdue'` (the safety flow, including
--       the ones `POST /api/safety/check-in/resolve` writes today) were all
--       rejected, so both features were silently inert. They are in the list now.
--   * `consumables_type_check` allowed only 5 types while the shop sold
--     tap_boost/gift_heart/gift_fire/gift_star: the bones were taken (that write
--     touched `wallet`, which had no CHECK) and the item was never granted.

alter table public.wallet_transactions drop constraint if exists wallet_tx_type_check;
alter table public.wallet_transactions
  add constraint wallet_tx_type_check
  check (type in ('earn','spend','refund','bonus','streak','adventure','gift',
                  'daily','topup','purchase','subscription','opening_balance','adjustment'));

alter table public.wallet_transactions drop constraint if exists wallet_tx_amount_check;
alter table public.wallet_transactions
  add constraint wallet_tx_amount_check
  check (amount <> 0);
comment on column public.wallet_transactions.amount is
  'Signed: positive credits the wallet, negative debits it (0019). The old positive-only rule plus a ''credit''/''debit'' tag is what let balance and ledger disagree.';

alter table public.subscriptions drop constraint if exists subscriptions_tier_check;
alter table public.subscriptions
  add constraint subscriptions_tier_check
  check (tier in ('free','plus','gold','platinum'));

alter table public.premium_entitlements alter column tier type text using tier::text;
alter table public.premium_entitlements drop constraint if exists premium_entitlements_tier_check;
alter table public.premium_entitlements
  add constraint premium_entitlements_tier_check
  check (tier in ('free','plus','gold','platinum'));

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check
  check (type in ('like','match','message','event','mention','system','grant','report',
                  'fansite_subscribe','check_in','check_in_resolved','check_in_overdue'));

alter table public.consumables_inventory drop constraint if exists consumables_type_check;
alter table public.consumables_inventory
  add constraint consumables_type_check
  check (type in ('boost','super_like','profile_spotlight','read_receipt','incognito',
                  'gift_heart','gift_fire','gift_star'));

-- Legacy rows, into the new conventions. 'premium' meant what the app now calls
-- Plus (the only paid value the enum had), and every debit was positive.
-- The ledger is append-only to everyone but a server write, and the rewrites
-- below are exactly that, so the guard is stood down for the duration.
select set_config('fyk.server_write', 'on', true);
update public.subscriptions set tier = 'plus' where tier = 'premium';
update public.premium_entitlements set tier = 'plus' where tier = 'premium';
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'wallet_tx_type_check') then
    update public.wallet_transactions
       set type = case type when 'credit' then 'earn' when 'debit' then 'spend' else type end
     where type in ('credit','debit');
  end if;
end $$;
update public.wallet_transactions set amount = -amount
 where type in ('spend','purchase','gift','adventure') and amount > 0;
select set_config('fyk.server_write', 'off', true);

-- ---------------------------------------------------------------------------
-- 2. consumables and the pet: the catalogue is the server's side of the bargain
-- ---------------------------------------------------------------------------
alter table public.consumables_inventory enable row level security;
alter table public.king_pet enable row level security;
alter table public.pet_items enable row level security;
alter table public.pet_adventures enable row level security;

revoke insert, update, delete on table public.consumables_inventory from anon, authenticated;
revoke insert, update, delete on table public.king_pet from anon, authenticated;
revoke insert, update, delete on table public.pet_items from anon, authenticated;
revoke insert, update, delete on table public.pet_adventures from anon, authenticated;
revoke select on table public.consumables_inventory from anon;

drop policy if exists "consumables_select_own" on public.consumables_inventory;
create policy consumables_select_own on public.consumables_inventory
  for select to authenticated
  using (user_id = auth.uid());

-- The King Pet screen keeps its read (it is the player's own row); its economy
-- and progression move to `POST /api/king-pet`, which writes through the ledger.
drop policy if exists "king_pet_select_own" on public.king_pet;
create policy king_pet_select_own on public.king_pet
  for select to authenticated
  using (user_id = auth.uid());

-- `bones` was the third copy of one number, and the pet screen was the only
-- writer. The wallet is the balance; the pet keeps only cosmetics here.
alter table public.king_pet drop column if exists bones;

-- `king_pet` is read-only for a browser token: even the cosmetic columns move
-- through `POST /api/king-pet`, because `equip` without a `wardrobe` the server
-- granted is how a player wears a crown they never bought. The trigger below is
-- therefore defence in depth — it is what keeps the row honest if a future
-- migration widens the grant.
-- An adventure takes real time (that is the entire point of one), while
-- `adventures` stays a list of completed theme names because that is what the
-- screen reads. The trip in flight needs its own slot: `last_adventure_at` alone
-- cannot say which adventure it is or what it pays.
alter table public.king_pet add column if not exists pending_adventure jsonb;
comment on column public.king_pet.pending_adventure is
  '{theme,startedAt,endsAt,rewardType,rewardAmount} while a trip is running, null otherwise. GET /api/king-pet resolves it once endsAt has passed, which is where the reward and the XP are applied (0019).';

/* Wardrobe and equipped are the player's cosmetic choices; progression is not. */
create or replace function public.king_pet_guard_columns()
returns trigger
language plpgsql
as $$
begin
  if public.fyk_server_write() then
    return new;
  end if;
  if new.stage            is distinct from old.stage
     or new.experience    is distinct from old.experience
     or new.level         is distinct from old.level
     or new.streak        is distinct from old.streak
     or new.mood          is distinct from old.mood
     or new.mood_log      is distinct from old.mood_log
     or new.adventures    is distinct from old.adventures
     or new.pending_adventure is distinct from old.pending_adventure
     or new.last_fed_at   is distinct from old.last_fed_at
     or new.last_played_at is distinct from old.last_played_at
     or new.last_adventure_at is distinct from old.last_adventure_at then
    raise exception 'king_pet progression is server-owned (0019): use POST /api/king-pet';
  end if;
  return new;
end;
$$;

drop trigger if exists king_pet_guard_columns_trg on public.king_pet;
create trigger king_pet_guard_columns
  before update on public.king_pet
  for each row execute function public.king_pet_guard_columns();

-- Catalogues: readable by everyone (prices are not a secret, and the shop UI
-- needs them), writable by nobody.
drop policy if exists "pet_items_read" on public.pet_items;
create policy pet_items_read on public.pet_items for select using (true);
drop policy if exists "pet_adventures_read" on public.pet_adventures;
create policy pet_adventures_read on public.pet_adventures for select using (true);

-- ---------------------------------------------------------------------------
-- 3. privilege: premium is granted by the server, never claimed
-- ---------------------------------------------------------------------------
alter table public.subscriptions enable row level security;

revoke insert, update, delete on table public.subscriptions from anon, authenticated;
revoke select on table public.subscriptions from anon;
grant select on table public.subscriptions to authenticated;
revoke insert, update, delete on table public.premium_entitlements from anon, authenticated;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid());

-- `premium_entitlements_select_own` (0011) already limits reads; the revoke is
-- what stops `wallet.ts`'s `upsert({ tier: 'premium', source: 'dev-mode' })`.
-- `0011` had also granted `insert, update` to `authenticated` "for webhook/dev
-- use" — with no webhook deployed, that grant is just a hole, so it is closed
-- and the API is the writer.
comment on table public.premium_entitlements is
  'Privilege. Select-own for the browser; the only writer is the API, and a grant requires PAYMENTS_DEV_MODE (dev) or a payment-provider webhook (prod) — 0019.';

-- ---------------------------------------------------------------------------
-- 4. the inbox: read and mute your own, never forge anyone else's
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;
revoke insert, delete on table public.notifications from anon, authenticated;
grant select, update on table public.notifications to authenticated;

drop policy if exists "notifications_select_own" on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid() and coalesce(hidden, false) = false)
  with check (user_id = auth.uid());

-- The reader owns `read`/`read_at`/`hidden`; the content belongs to whoever
-- caused the notification. A client that can edit `title` can plant "You
-- matched with a celebrity" in its own inbox — and screenshots are evidence.
create or replace function public.notifications_guard_columns()
returns trigger
language plpgsql
as $$
begin
  if public.fyk_server_write() then
    return new;
  end if;
  if new.type is distinct from old.type
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.actor_id is distinct from old.actor_id
     or new.href is distinct from old.href
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'notifications content is server-owned (0019): only read/read_at/hidden may change';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_guard_columns_trg on public.notifications;
create trigger notifications_guard_columns
  before update on public.notifications
  for each row execute function public.notifications_guard_columns();

-- ---------------------------------------------------------------------------
-- 5. private notes about someone: they were world-readable
-- ---------------------------------------------------------------------------
-- `0010` created `user_notes` with no RLS, so any signed-in account could
-- `select` every note anyone had written about anyone.
alter table public.user_notes enable row level security;
revoke all on table public.user_notes from anon;

drop policy if exists "user_notes_own_only" on public.user_notes;
create policy user_notes_own_only on public.user_notes
  for all to authenticated
  using (note_owner_id = auth.uid())
  with check (note_owner_id = auth.uid() and note_owner_id <> target_user_id);
comment on table public.user_notes is
  'A private note the viewer keeps about another user. Author-only, enforced by RLS since 0019 (the table had none).';

-- ---------------------------------------------------------------------------
-- 6. the social surface: public where it is public, member-only where it is not
-- ---------------------------------------------------------------------------
alter table public.shouts enable row level security;
alter table public.shout_likes enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.fansites enable row level security;
alter table public.tribes enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.typing_indicators enable row level security;
alter table public.message_reads enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.event_waitlist enable row level security;
alter table public.meetnow_posts enable row level security;
alter table public.saved_filters enable row level security;
alter table public.saved_phrases enable row level security;
alter table public.favorites enable row level security;
alter table public.footprints enable row level security;
alter table public.hides enable row level security;
alter table public.taps enable row level security;

-- Nothing reads configuration or vectors with a browser token: `site_config`
-- decides product flags, and the embedding tables feed the server's AI routes.
revoke all on table public.site_config from anon, authenticated;
revoke all on table public.profile_embeddings from anon, authenticated;
revoke all on table public.message_embeddings from anon, authenticated;
revoke all on table public.tag_embeddings from anon, authenticated;
revoke all on table public.ai_memory, public.ai_suggestions, public.ai_match_scores,
                      public.ai_safety_flags, public.ai_chat_health from anon, authenticated;
revoke all on table public.sessions from anon, authenticated;
revoke all on table public.audit_events from anon;
revoke all on table public.auth_rate_limits from anon;

-- An account's notification token and its rate-limit rows are its own; the
-- moderation log and audit trail are the server's alone, which is why they get
-- no policy at all.

-- shouts: public to read, own to write, and the content limit is the same 500
-- the form claims, enforced here rather than in a `maxLength` a curl ignores.
drop policy if exists "shouts_read" on public.shouts;
create policy shouts_read on public.shouts
  for select using (not public.is_blocked(user_id));
drop policy if exists "shouts_insert_own" on public.shouts;
create policy shouts_insert_own on public.shouts
  for insert to authenticated
  with check (user_id = auth.uid() and char_length(btrim(content)) between 1 and 500);
drop policy if exists "shouts_edit_own" on public.shouts;
create policy shouts_edit_own on public.shouts
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and char_length(btrim(content)) between 1 and 500);
drop policy if exists "shouts_delete_own" on public.shouts;
create policy shouts_delete_own on public.shouts
  for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "shout_likes_read" on public.shout_likes;
create policy shout_likes_read on public.shout_likes for select using (true);
drop policy if exists "shout_likes_own" on public.shout_likes;
create policy shout_likes_own on public.shout_likes
  for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "shout_likes_unlike_own" on public.shout_likes;
create policy shout_likes_unlike_own on public.shout_likes
  for delete to authenticated
  using (user_id = auth.uid());

-- groups: a public group is legible to everyone signed in; a private one only to
-- its members; the leader is whoever created it.
drop policy if exists "groups_read" on public.groups;
create policy groups_read on public.groups
  for select to authenticated
  using (
    privacy is distinct from 'private'
    or created_by = auth.uid()
    or exists (select 1 from public.group_members m
                where m.group_id = groups.id and m.user_id = auth.uid())
  );
drop policy if exists "groups_create_own" on public.groups;
create policy groups_create_own on public.groups
  for insert to authenticated
  with check (created_by = auth.uid() and char_length(btrim(name)) between 2 and 80);
drop policy if exists "groups_edit_leader" on public.groups;
create policy groups_edit_leader on public.groups
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
drop policy if exists "groups_delete_leader" on public.groups;
create policy groups_delete_leader on public.groups
  for delete to authenticated
  using (created_by = auth.uid());

drop policy if exists "group_members_read" on public.group_members;
create policy group_members_read on public.group_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.groups g
                where g.id = group_members.group_id and g.privacy is distinct from 'private')
  );
drop policy if exists "group_members_join_self" on public.group_members;
create policy group_members_join_self on public.group_members
  for insert to authenticated
  with check (user_id = auth.uid());
-- You may always leave; only the leader may remove someone else.
drop policy if exists "group_members_leave" on public.group_members;
create policy group_members_leave on public.group_members
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.groups g
                where g.id = group_members.group_id and g.created_by = auth.uid())
  );

drop policy if exists "group_messages_read_member" on public.group_messages;
create policy group_messages_read_member on public.group_messages
  for select to authenticated
  using (public.is_group_member(group_id, auth.uid()));
drop policy if exists "group_messages_write_member" on public.group_messages;
create policy group_messages_write_member on public.group_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_group_member(group_id, auth.uid())
    and char_length(btrim(content)) between 1 and 2000
  );
drop policy if exists "group_messages_delete_own" on public.group_messages;
create policy group_messages_delete_own on public.group_messages
  for delete to authenticated
  using (sender_id = auth.uid());

-- fansites -------------------------------------------------------------------
drop policy if exists "fansites_read" on public.fansites;
create policy fansites_read on public.fansites
  for select using (not public.is_blocked(user_id));
drop policy if exists "fansites_create_own" on public.fansites;
create policy fansites_create_own on public.fansites
  for insert to authenticated
  with check (user_id = auth.uid() and char_length(btrim(name)) between 2 and 80);
drop policy if exists "fansites_edit_own" on public.fansites;
create policy fansites_edit_own on public.fansites
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists "fansites_delete_own" on public.fansites;
create policy fansites_delete_own on public.fansites
  for delete to authenticated
  using (user_id = auth.uid());

-- A real subscription edge. `/fansites` had been *counting* notification rows of
-- type 'fansite_subscribe' as the subscriber list: clear your inbox and a
-- creator loses followers. The edge is now the truth, and the counter derives
-- from it (§7).
create table if not exists public.fansite_subscribers (
  id uuid primary key default gen_random_uuid(),
  fansite_id uuid not null references public.fansites(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (fansite_id, user_id),
  constraint fansite_subscribers_not_self check (
    user_id not in (select f.user_id from public.fansites f where f.id = fansite_id)
  )
);
alter table public.fansite_subscribers enable row level security;
grant select, insert, delete on table public.fansite_subscribers to authenticated;
revoke all on table public.fansite_subscribers from anon;
create index if not exists fansite_subscribers_fansite_idx
  on public.fansite_subscribers (fansite_id, created_at desc);

drop policy if exists "fansite_subs_read" on public.fansite_subscribers;
create policy fansite_subs_read on public.fansite_subscribers
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.fansites f
                where f.id = fansite_subscribers.fansite_id and f.user_id = auth.uid())
  );
drop policy if exists "fansite_subs_follow_self" on public.fansite_subscribers;
create policy fansite_subs_follow_self on public.fansite_subscribers
  for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "fansite_subs_unfollow_self" on public.fansite_subscribers;
create policy fansite_subs_unfollow_self on public.fansite_subscribers
  for delete to authenticated
  using (user_id = auth.uid());

-- tribes: the catalogue is shared, membership is a `users.tribes` fact --------
drop policy if exists "tribes_read" on public.tribes;
create policy tribes_read on public.tribes for select to authenticated using (true);
revoke insert, update, delete on table public.tribes from anon, authenticated;
grant select on table public.tribes to anon, authenticated;

-- stories --------------------------------------------------------------------
drop policy if exists "stories_read" on public.stories;
create policy stories_read on public.stories
  for select to authenticated
  using (expires_at > now() and not public.is_blocked(user_id));
drop policy if exists "stories_own" on public.stories;
create policy stories_own on public.stories
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and expires_at > now());

drop policy if exists "story_views_read" on public.story_views;
create policy story_views_read on public.story_views
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.stories s
                where s.id = story_views.story_id and s.user_id = auth.uid())
  );
drop policy if exists "story_views_record_self" on public.story_views;
create policy story_views_record_self on public.story_views
  for insert to authenticated
  with check (user_id = auth.uid());

-- chat presence and read receipts: members read, self writes ---------------
drop policy if exists "typing_read_members" on public.typing_indicators;
create policy typing_read_members on public.typing_indicators
  for select to authenticated
  using (public.is_conversation_member(conversation_id));
drop policy if exists "typing_write_self" on public.typing_indicators;
create policy typing_write_self on public.typing_indicators
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_conversation_member(conversation_id));

drop policy if exists "reads_read_members" on public.message_reads;
create policy reads_read_members on public.message_reads
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.messages m
                where m.id = message_reads.message_id
                  and public.is_conversation_member(m.conversation_id))
  );
drop policy if exists "reads_write_self" on public.message_reads;
create policy reads_write_self on public.message_reads
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "push_subs_own" on public.push_subscriptions;
create policy push_subs_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "event_waitlist_own" on public.event_waitlist;
create policy event_waitlist_own on public.event_waitlist
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "meetnow_read" on public.meetnow_posts;
create policy meetnow_read on public.meetnow_posts
  for select to authenticated
  using (coalesce(active, true) and expires_at > now() and not public.is_blocked(user_id));
drop policy if exists "meetnow_own" on public.meetnow_posts;
create policy meetnow_own on public.meetnow_posts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- own-only scratch tables ----------------------------------------------------
drop policy if exists "saved_filters_own" on public.saved_filters;
create policy saved_filters_own on public.saved_filters
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "saved_phrases_own" on public.saved_phrases;
create policy saved_phrases_own on public.saved_phrases
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- graph edges: your own, and never about yourself ---------------------------
drop policy if exists "favorites_own" on public.favorites;
create policy favorites_own on public.favorites
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and user_id <> target_id);
drop policy if exists "footprints_read_pair" on public.footprints;
create policy footprints_read_pair on public.footprints
  for select to authenticated
  using (visitor_id = auth.uid() or visited_id = auth.uid());
drop policy if exists "footprints_write_self" on public.footprints;
create policy footprints_write_self on public.footprints
  for insert to authenticated
  with check (visitor_id = auth.uid() and visitor_id <> visited_id);
drop policy if exists "hides_own" on public.hides;
create policy hides_own on public.hides
  for all to authenticated
  using (hider_id = auth.uid())
  with check (hider_id = auth.uid());

-- `taps` is the edge that creates a match: the API writes it inside a
-- transaction that also writes `matches` and posts a notification, so the
-- browser reads its own and writes none.
revoke insert, update, delete on table public.taps from anon, authenticated;
grant select on table public.taps to authenticated;
drop policy if exists "taps_select_own" on public.taps;
create policy taps_select_own on public.taps
  for select to authenticated
  using (tapper_id = auth.uid() or tapped_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 7. derived counters, so a counter can never disagree with its edges
-- ---------------------------------------------------------------------------
-- Every count a screen shows is computed at read time by an endpoint or by one
-- of these triggers, never typed in. `shouts.likes_count`, `groups.member_count`,
-- `fansites.subscriber_count`, `tribes.member_count`.
create or replace function public.count_from_edges()
returns trigger
language plpgsql
as $$
declare
  v_parent uuid;
begin
  perform set_config('fyk.server_write', 'on', true);

  if tg_table_name = 'shout_likes' then
    v_parent := case when tg_op = 'DELETE' then old.shout_id else new.shout_id end;
    update public.shouts s
       set likes_count = (select count(*) from public.shout_likes l where l.shout_id = v_parent)
     where s.id = v_parent;
  elsif tg_table_name = 'group_members' then
    v_parent := case when tg_op = 'DELETE' then old.group_id else new.group_id end;
    update public.groups g
       set member_count = (select count(*) from public.group_members m where m.group_id = v_parent)
     where g.id = v_parent;
  elsif tg_table_name = 'fansite_subscribers' then
    v_parent := case when tg_op = 'DELETE' then old.fansite_id else new.fansite_id end;
    update public.fansites f
       set subscriber_count = (select count(*) from public.fansite_subscribers s where s.fansite_id = v_parent)
     where f.id = v_parent;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists shout_like_count_trg on public.shout_likes;
create trigger shout_like_count
  after insert or delete on public.shout_likes
  for each row execute function public.count_from_edges();
drop trigger if exists group_member_count_trg on public.group_members;
create trigger group_member_count
  after insert or delete on public.group_members
  for each row execute function public.count_from_edges();
drop trigger if exists fansite_sub_count_trg on public.fansite_subscribers;
create trigger fansite_sub_count
  after insert or delete on public.fansite_subscribers
  for each row execute function public.count_from_edges();

-- Hand-editing a counter is refused for everyone but the triggers above.
create or replace function public.reject_counter_write(p_column text)
returns void
language plpgsql
as $$
begin
  if public.fyk_server_write() then
    return;
  end if;
  raise exception '% is derived from its edges (0019): write the edge, not the counter', p_column;
end;
$$;

create or replace function public.shouts_guard_counter()
returns trigger language plpgsql as $$
begin
  if new.likes_count is distinct from old.likes_count then
    perform public.reject_counter_write('shouts.likes_count');
  end if;
  return new;
end;
$$;
create or replace function public.groups_guard_counter()
returns trigger language plpgsql as $$
begin
  if new.member_count is distinct from old.member_count then
    perform public.reject_counter_write('groups.member_count');
  end if;
  return new;
end;
$$;
create or replace function public.fansites_guard_counter()
returns trigger language plpgsql as $$
begin
  if new.subscriber_count is distinct from old.subscriber_count then
    perform public.reject_counter_write('fansites.subscriber_count');
  end if;
  return new;
end;
$$;

drop trigger if exists shouts_guard_counter_trg on public.shouts;
create trigger shouts_guard_counter
  before update on public.shouts
  for each row execute function public.shouts_guard_counter();
drop trigger if exists groups_guard_counter_trg on public.groups;
create trigger groups_guard_counter
  before update on public.groups
  for each row execute function public.groups_guard_counter();
drop trigger if exists fansites_guard_counter_trg on public.fansites;
create trigger fansites_guard_counter
  before update on public.fansites
  for each row execute function public.fansites_guard_counter();

-- A `users.tribes` change moves the membership counts of every tribe named on
-- either side of the update. Names are the join key today (`0016` and AUDIT §3.9
-- record the vocab split), so both spellings are tried rather than silently
-- leaving a stale count.
create or replace function public.tribes_recount()
returns trigger
language plpgsql
as $$
declare
  v_name text;
begin
  if tg_op <> 'DELETE' and new.tribes is not distinct from old.tribes then
    return new;
  end if;
  perform set_config('fyk.server_write', 'on', true);

  with names as (
    select jsonb_array_elements_text(coalesce(case when tg_op = 'DELETE' then old.tribes else new.tribes end, '[]'::jsonb)) as name
    union
    select jsonb_array_elements_text(coalesce(case when tg_op = 'DELETE' then old.tribes else new.tribes end, '[]'::jsonb))
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

drop trigger if exists tribes_recount_trg on public.users;
create trigger tribes_recount
  after insert or update or delete on public.users
  for each row execute function public.tribes_recount();

-- A group's creator is a member, or `member_count` starts at 0 for the one
-- person who is certainly there.
insert into public.group_members (group_id, user_id, role)
select g.id, g.created_by, 'owner' from public.groups g
 where g.created_by is not null
on conflict (group_id, user_id) do update set role = 'owner';

-- ---------------------------------------------------------------------------
-- 8. repair what three balances and no-ledger had already broken
-- ---------------------------------------------------------------------------
select set_config('fyk.server_write', 'on', true);

-- 8a. `wallet_transactions` is the truth. A wallet with history gets the sum of
-- that history; a wallet with none gets an opening-balance entry so the number it
-- already showed is not simply overwritten with 0.
insert into public.wallet_transactions (wallet_id, type, amount, description, source)
select w.id, 'opening_balance', w.balance,
       'Backfilled by 0019: the balance recorded before the ledger was authoritative',
       'migration-0019'
  from public.wallet w
 where coalesce(w.balance, 0) <> 0
   and not exists (select 1 from public.wallet_transactions t where t.wallet_id = w.id);

-- 8b. drift: recompute from the ledger. The trigger keeps them equal from here.
update public.wallet w
   set balance = coalesce((select sum(t.amount) from public.wallet_transactions t where t.wallet_id = w.id), 0)
 where w.balance is distinct from coalesce((select sum(t.amount) from public.wallet_transactions t where t.wallet_id = w.id), 0);

-- 8c. counters, from the edges.
update public.shouts s set likes_count = x.n
  from (select shout_id, count(*)::int as n from public.shout_likes group by shout_id) x
 where s.id = x.shout_id and s.likes_count is distinct from x.n;
update public.shouts set likes_count = 0
 where likes_count is null
    or likes_count <> (select count(*) from public.shout_likes l where l.shout_id = shouts.id);

update public.groups g set member_count = x.n
  from (select group_id, count(*)::int as n from public.group_members group by group_id) x
 where g.id = x.group_id and g.member_count is distinct from x.n;
update public.groups set member_count = greatest(coalesce(member_count, 0), 1)
 where not exists (select 1 from public.group_members m where m.group_id = groups.id);

-- The notification-only "subscriptions" become real edges before the counter is
-- recomputed from them.
insert into public.fansite_subscribers (fansite_id, user_id, created_at)
select n.user_id, n.actor_id, n.created_at
  from public.notifications n
 where n.type = 'fansite_subscribe' and n.actor_id is not null
on conflict (fansite_id, user_id) do nothing;

update public.fansites f set subscriber_count = x.n
  from (select fansite_id, count(*)::int as n from public.fansite_subscribers group by fansite_id) x
 where f.id = x.fansite_id and f.subscriber_count is distinct from x.n;

update public.tribes t
   set member_count = (
     select count(*) from public.users u
      where coalesce(u.tribes, '[]'::jsonb) @> jsonb_build_array(t.name)
         or coalesce(u.tribes, '[]'::jsonb) @> jsonb_build_array(t.id::text)
   );

select set_config('fyk.server_write', 'off', true);

-- Every account gets a pet row, or the screen shows a pet that does not exist.
insert into public.king_pet (user_id)
select u.id from public.users u
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- 9. the catalogues the product needs, and never had
-- ---------------------------------------------------------------------------
-- `pet_items`, `pet_adventures` and `tribes` were created empty by `0010`, and
-- nothing in the repository ever inserted into them (`scripts/seed.mjs` is demo
-- data, not product config). The visible result: `/king-pet`'s wardrobe tab read
-- "Nothing here yet" over a pet card that already *draws* five items
-- (`king-pet-client.tsx` renders 👑 🕶️ 🧣 👟 🦸 when `equipped` holds those exact
-- names), the adventures tab had nothing to start, and `/tribes` — a screen whose
-- whole premise is joining one — listed zero tribes while onboarding and
-- `/profile` were already writing tribe *names* into `users.tribes`.
--
-- These are product configuration, so they belong in the migration history, not
-- in a script someone has to remember to run. Every insert is guarded by a
-- not-exists on the natural key, so re-running and hand-added rows both survive.

insert into public.pet_items (name, type, emoji, bone_cost, stage_required)
select x.name, x.type, x.emoji, x.bone_cost, x.stage_required
  from (values
    ('Golden Crown', 'headwear',  '👑', 240, 'juvenile'),
    ('Sunglasses',   'eyewear',   '🕶️',  90, 'baby'),
    ('Bandana',      'neckwear',  '🧣',  60, 'baby'),
    ('Sneakers',     'footwear',  '👟', 120, 'baby'),
    ('Cape',         'outerwear', '🦸', 300, 'adult')
  ) as x(name, type, emoji, bone_cost, stage_required)
 where not exists (select 1 from public.pet_items p where p.name = x.name);

insert into public.pet_adventures (theme, description, emoji, duration_minutes, bone_cost, reward_type, reward_amount)
select x.theme, x.description, x.emoji, x.duration_minutes, x.bone_cost, x.reward_type, x.reward_amount
  from (values
    ('Morning Walk',   'A short loop around the park. Easy, free, good for a streak.', '🌳',  15,  0, 'xp',    25),
    ('Beach Day',      'Sand, swim, nap. The classic.',                                  '🏖️',  45, 15, 'xp',    60),
    ('Gym Session',    'Gains. The pet comes back hungrier and happier.',                '🏋️',  30, 10, 'xp',    45),
    ('Night Market',   'Street food and people-watching.',                               '🏮',  60, 20, 'bones', 35),
    ('Road Trip',      'Out of the city for a few hours.',                               '🚗', 120, 40, 'bones', 90),
    ('Treasure Hunt',  'Long, expensive, and the only way to find a crown.',             '💎', 180, 60, 'bones', 200)
  ) as x(theme, description, emoji, duration_minutes, bone_cost, reward_type, reward_amount)
 where not exists (select 1 from public.pet_adventures a where a.theme = x.theme);

insert into public.tribes (name, description, icon)
select x.name, x.description, x.icon
  from (values
    ('Bear',        'Hairy, cuddly, proud of it.',                    '🐻'),
    ('Cub',         'Young bear energy.',                             '🐻'),
    ('Otter',       'Fit, furry, always up for a swim.',             '🦦'),
    ('Wolf',        'Independent and a little wild.',                 '🐺'),
    ('Daddy',       'Older, generous, decisive.',                     '🎩'),
    ('Jock',        'Sport came first and still does.',               '🏈'),
    ('Twink',       'Slim, youthful, loud.',                          '✨'),
    ('Chub',        'Soft, solid, warm.',                             '🫂'),
    ('Muscle',       'The gym is a personality.',                     '💪'),
    ('Silver',      'Grey at the temples, sharp everywhere else.',    '🩶'),
    ('Geek',        'Opinions about keyboards and canon.',            '🤓'),
    ('Leather',     'The vest is a lifestyle.',                       '🖤'),
    ('Rugged',      'Plaid, boots, fixed things.',                    '🪓'),
    ('Discreet',    'Private on purpose, and clear about it.',        '🤫'),
    ('Polar',       'Big, pale, gentle.',                             '🐻‍❄️'),
    ('Trans',       'Trans men, here and proud.',                     '🏳️‍⚧️'),
    ('Non-binary',  'Outside the binary, unbothered.',                '⚧️'),
    ('Poz & proud', 'Positive, open, no shame attached.',             '🎗️'),
    ('Sober',       'No alcohol involved, by choice.',                '🥤')
  ) as x(name, description, icon)
 where not exists (select 1 from public.tribes t where t.name = x.name);

-- ---------------------------------------------------------------------------
-- 10a. the `media` bucket the app uploads to and nobody created
-- ---------------------------------------------------------------------------
-- `profile-client.tsx` and `/settings/profile` both `storage.from('media').upload
-- ('avatars/<uid>/….jpg')`, and `resolveMediaUrl()` builds public URLs against the
-- same bucket. `003_storage.sql` created five buckets — avatars-public,
-- photos-public, albums-private, chat-media-private, event-media-public — and
-- `media` is not one of them, so every profile-photo upload failed with
-- "Bucket not found" (`throw uploadError`, a toast) while the *reader* happily
-- produced a URL to a bucket that did not exist: a broken image, forever.
--
-- The bucket is created rather than the call sites repointed, because three
-- places already speak `media` and the stored values are paths in it. Its path
-- convention is `<kind>/<owner_uuid>/<filename>` — one level deeper than 003's
-- `<owner_uuid>/<filename>` — which is what the uploaders write, so the ownership
-- check reads segment 2.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 15 * 1024 * 1024,
        array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fyk_media_read" on storage.objects;
create policy fyk_media_read on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "fyk_media_write" on storage.objects;
create policy fyk_media_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in ('avatars','photos')
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "fyk_media_replace" on storage.objects;
create policy fyk_media_replace on storage.objects
  for update to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[2] = auth.uid()::text
  )
  with check (bucket_id = 'media' and (storage.foldername(name))[2] = auth.uid()::text);

drop policy if exists "fyk_media_delete_own" on storage.objects;
create policy fyk_media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

comment on column public.users.photos is
  'Paths inside the `media` bucket (`avatars/<uid>/…` or `photos/<uid>/…`), or absolute URLs written before 0019. `resolveMediaUrl()` in #/integrations/supabase/media.ts is the only reader.';

-- ---------------------------------------------------------------------------
-- 10. indexes + stats for the shapes these policies query
-- ---------------------------------------------------------------------------
create index if not exists shouts_user_idx on public.shouts (user_id, created_at desc);
create index if not exists shout_like_shout_idx on public.shout_likes (shout_id, user_id);
create index if not exists group_message_group_idx on public.group_messages (group_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id, created_at desc);
create index if not exists wallet_tx_wallet_idx on public.wallet_transactions (wallet_id, created_at desc);
create index if not exists consumables_user_idx on public.consumables_inventory (user_id, type);
create index if not exists story_views_story_idx on public.story_views (story_id, viewed_at desc);
create index if not exists favorites_user_idx on public.favorites (user_id, created_at desc);
create index if not exists footprints_visited_idx on public.footprints (visited_id, created_at desc);

analyze public.wallet, public.wallet_transactions, public.notifications, public.user_notes,
         public.shouts, public.shout_likes, public.groups, public.group_members, public.group_messages,
         public.fansites, public.fansite_subscribers, public.tribes, public.king_pet,
         public.premium_entitlements, public.subscriptions, public.consumables_inventory,
         public.favorites, public.footprints, public.hides, public.taps, public.stories, public.story_views;

comment on table public.wallet is
  'One row per account. `balance` is derived from public.wallet_transactions by trigger (0019); a direct write raises. POST /api/wallet, /api/king-pet and /api/boost are the only writers.';
comment on table public.wallet_transactions is
  'Append-only ledger, and the only way a balance moves. Compensating rows, never UPDATE (0019 trigger). `source` names the product that minted it; `idempotency_key` makes a retry a no-op.';
comment on table public.king_pet is
  'Pet state. Progression (stage/xp/level/streak/mood/adventures) is server-owned; the client may update only wardrobe and equipped (0019). The old `bones` column was a second balance and is gone.';
comment on table public.shouts is
  'likes_count is derived from public.shout_likes by trigger (0019).';
comment on table public.groups is
  'member_count is derived from public.group_members by trigger (0019).';
comment on table public.fansites is
  'subscriber_count is derived from public.fansite_subscribers by trigger (0019).';
