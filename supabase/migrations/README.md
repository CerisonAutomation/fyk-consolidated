# FYK database migrations

Applied in filename order by `supabase db push`, and by copy-paste in the SQL
editor top-to-bottom. The order is load-bearing — files depend on each other:

| # | File | Provides |
|---|------|----------|
| 1 | `0001_core_schema.sql` | enums, profiles, photos, albums, likes/matches/blocks/reports, chat, board, events, offers, audit log. Every table: RLS **enabled**, no policies (deny-all). |
| 2 | `0002_grants.sql` | maximum reachable access for `authenticated`. |
| 3 | `0003_security_rls.sql` | the real authorization model: helper functions (`is_blocked`, `is_conversation_member`, `has_album_access`, `is_age_verified`), one policy per table per verb, and the triggers that enforce server-side invariants (mutual-tap match, board capacity, media/album immutability). Drops and recreates every policy, so it must run after the grants. |
| 4 | `0004_functions.sql` | `can_access_album`, `can_access_chat_media`, `register_media_open`, `register_album_open`. |
| 5 | `0005_storage.sql` | buckets + storage policies that call those functions. Must follow 0004. |
| 6 | `0006_mvp_gaps.sql` | moderation roles, notifications, profile views, message pins, edit/recall windows, report triage, the `resolve_report` RPC, and the durable `rate_limit_hit` counter. |
| 7 | `0007_realtime.sql` | publication membership for chat/board + the expiry sweep. |

## Rules for new migrations

1. **Never create a table without also creating its policies in the same PR.**
   A table with RLS enabled and no policies reads as empty, which shows up in the
   product as "no people nearby" rather than as an error.
2. Never grant anything to `anon`. FYK has no anonymous browsing; signed-out users
   see the auth screen.
3. No `ALTER SYSTEM` / server settings: Supabase manages those, and the statement
   aborts the run.
4. Anything that must be true regardless of what a client sends (edit windows,
   pin limits, who may moderate, that a match requires a mutual tap) belongs in a
   trigger or a `security definer` function — not in the React component.
5. There is one identity table: `profiles`, keyed to `auth.users.id`. A second
   `users` table with its own credentials was removed; do not reintroduce it.

## What is intentionally absent

Wallets, consumables, subscriptions beyond `premium_entitlements`, King Pet,
groups, fansites, shouts, stories, tribes, embeddings/pgvector, typing
indicators, and a `sessions` table. None of them had a working call site, and a
table nobody can use is a liability, not a head start.
