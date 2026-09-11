-- =============================================================================
-- FYK Consolidated — 0007_realtime.sql
-- Live updates for surfaces that genuinely benefit from them.
--
-- Honest scope: the FYK web client polls the API (React Query refetch
-- intervals) and, where the tables below are in the publication, also
-- subscribes to Postgres changes for new messages. There is no WebTransport,
-- no CRDT sync, and no "end-to-end encrypted realtime" — the app must not
-- claim any of those.
-- =============================================================================

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.conversation_members;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.board_posts;
exception when duplicate_object then null; end $$;

-- Expiry sweep: Board posts and timed media disappear server-side, so a stale
-- row can never be rendered as live by a client that missed an update.
create or replace function public.expire_stale_rows()
returns integer
language sql
security definer
set search_path = public
as $$
  with expired as (
    delete from public.board_posts where expires_at < now() returning id
  )
  select count(*) from expired;
$$;

grant execute on function public.expire_stale_rows() to authenticated;
