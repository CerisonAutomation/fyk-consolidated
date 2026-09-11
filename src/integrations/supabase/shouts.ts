/**
 * Shouts — Supabase integration.
 *
 * Reads/writes the `shouts` and `shout_likes` tables directly from the
 * browser client.  RLS policies on those tables gate access.
 */

import { getSupabase, ok, toFailure, type Result } from "./client";
import type { Profile } from "./types";

// ─── Projection types ──────────────────────────────────────────────────────

export type ShoutAuthor = Pick<
  Profile,
  "id" | "display_name" | "avatar_url" | "city" | "area" | "hide_online" | "last_active_at"
> & { verified: boolean };

export type ShoutRow = {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  likes_count: number;
  created_at: string;
};

export type ShoutItem = ShoutRow & {
  author: ShoutAuthor | null;
  has_liked: boolean;
};

const SHOUT_COLUMNS = "id, user_id, content, media_url, likes_count, created_at";
const PROFILE_COLUMNS =
  "id, display_name, avatar_url, city, area, hide_online, last_active_at, age_verified_at";

function toAuthor(p: Record<string, unknown>): ShoutAuthor {
  return {
    id: p.id as string,
    display_name: p.display_name as string | null,
    avatar_url: p.avatar_url as string | null,
    city: p.city as string | null,
    area: p.area as string | null,
    hide_online: p.hide_online as boolean,
    last_active_at: p.last_active_at as string,
    verified: !!p.age_verified_at,
  };
}

// ─── List shouts ───────────────────────────────────────────────────────────

export async function listShouts(userId: string): Promise<Result<ShoutItem[]>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  // 1. Fetch shouts
  const { data: shouts, error: shoutErr } = await client
    .from("shouts")
    .select(SHOUT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(50);

  if (shoutErr) return toFailure(shoutErr);
  if (!shouts?.length) return ok([]);

  // 2. Fetch all author profiles in one batch
  const authorIds = [...new Set(shouts.map((s) => s.user_id))];
  const { data: profiles, error: profErr } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .in("id", authorIds);

  if (profErr) return toFailure(profErr);

  const profileMap = new Map<string, ShoutAuthor>(
    (profiles ?? []).map((p) => [p.id, toAuthor(p)]),
  );

  // 3. Fetch the current user's likes on these shouts
  const shoutIds = shouts.map((s) => s.id);
  const { data: myLikes } = await client
    .from("shout_likes")
    .select("shout_id")
    .eq("user_id", userId)
    .in("shout_id", shoutIds);

  const likedSet = new Set((myLikes ?? []).map((l) => l.shout_id));

  return ok(
    shouts.map((s) => ({
      ...s,
      author: profileMap.get(s.user_id) ?? null,
      has_liked: likedSet.has(s.id),
    })),
  );
}

// ─── Create shout ──────────────────────────────────────────────────────────

export async function createShout(
  userId: string,
  content: string,
): Promise<Result<ShoutItem>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const trimmed = content.trim();
  if (!trimmed)
    return { ok: false, code: "validation", message: "Content cannot be empty." };
  if (trimmed.length > 280)
    return { ok: false, code: "validation", message: "Content exceeds 280 characters." };

  const { data: shout, error: insertErr } = await client
    .from("shouts")
    .insert({ user_id: userId, content: trimmed })
    .select(SHOUT_COLUMNS)
    .single();

  if (insertErr) return toFailure(insertErr);

  // Fetch author profile
  const { data: profile } = await client
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .single();

  return ok({
    ...shout,
    author: profile ? toAuthor(profile) : null,
    has_liked: false,
  });
}

// ─── Toggle like ───────────────────────────────────────────────────────────

export async function toggleShoutLike(
  userId: string,
  shoutId: string,
): Promise<Result<{ liked: boolean; likes_count: number }>> {
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  // Check for existing like
  const { data: existing, error: checkErr } = await client
    .from("shout_likes")
    .select("id")
    .eq("user_id", userId)
    .eq("shout_id", shoutId)
    .maybeSingle();

  if (checkErr) return toFailure(checkErr);

  // Fetch current shout to get the count
  const { data: shout, error: shoutErr } = await client
    .from("shouts")
    .select("likes_count")
    .eq("id", shoutId)
    .single();
  if (shoutErr) return toFailure(shoutErr);

  const currentCount = shout.likes_count ?? 0;

  if (existing) {
    // Unlike: delete the like row and decrement the counter
    const { error: delErr } = await client
      .from("shout_likes")
      .delete()
      .eq("id", existing.id);
    if (delErr) return toFailure(delErr);

    const newCount = Math.max(0, currentCount - 1);
    const { error: updErr } = await client
      .from("shouts")
      .update({ likes_count: newCount })
      .eq("id", shoutId);
    if (updErr) return toFailure(updErr);

    return ok({ liked: false, likes_count: newCount });
  }

  // Like: insert the like row and increment the counter
  const { error: insErr } = await client
    .from("shout_likes")
    .insert({ shout_id: shoutId, user_id: userId });
  if (insErr) return toFailure(insErr);

  const newCount = currentCount + 1;
  const { error: updErr } = await client
    .from("shouts")
    .update({ likes_count: newCount })
    .eq("id", shoutId);
  if (updErr) return toFailure(updErr);

  return ok({ liked: true, likes_count: newCount });
}
