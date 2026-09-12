// ═══════════════════════════════════════════════════════════════════════════════
// Social — Tribes
// ═══════════════════════════════════════════════════════════════════════════════
//
// Tribes are interest-based labels stored on the `users.tribes` JSONB array.
// The `tribes` table holds the canonical list + member counts.
// Joining/leaving a tribe means adding/removing from the user's tribes array
// and incrementing/decrementing the tribe's member_count.

import { getSupabase, ok, toFailure, type Result } from "./client";
import type { Tribe } from "./types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TribeView = Tribe & {
  joined: boolean;
};

export const MAX_TRIBES = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TRIBE_COLUMNS = "id,name,description,icon,member_count,created_at";

/**
 * Tribe membership lives in `users.tribes`, which only the API may write.
 * `PUT /api/profile` replaces the bag, so the whole list is sent, and it
 * resolves whose row to write from the session cookie — which is exactly why
 * this helper no longer takes a user id it cannot be trusted with.
 */
async function saveTribes(tribes: string[]): Promise<{ ok: true } | { ok: false; code: "server"; message: string }> {
  try {
    const response = await fetch("/api/profile", {
      method: "PUT",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tribes }),
    });
    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      return {
        ok: false,
        code: "server",
        message:
          detail?.error ??
          detail?.message ??
          `Could not save your tribes (HTTP ${response.status}).`,
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      code: "server",
      message: "Could not reach the server; your tribes were not changed.",
    };
  }
}

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Lists all tribes, annotated with whether the current user has joined.
 */
export async function listTribes(userId: string | undefined): Promise<Result<TribeView[]>> {
  if (!userId) return { ok: false, code: "auth", message: "You must be signed in." };
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const [tribesResult, userResult] = await Promise.all([
    client
      .from("tribes")
      .select(TRIBE_COLUMNS)
      .order("member_count", { ascending: false }),
    client
      .from("profiles")
      .select("tribes")
      .eq("id", userId)
      .single(),
  ]);

  if (tribesResult.error) return toFailure(tribesResult.error);
  if (userResult.error) return toFailure(userResult.error);

  const tribes = tribesResult.data ?? [];
  const userTribes = (userResult.data?.tribes as string[]) ?? [];

  return ok(
    tribes.map((t) => ({
      ...t,
      joined: userTribes.includes(t.name),
    })),
  );
}

/**
 * Joins or leaves a tribe. Updates the user's tribes array and the tribe's member_count.
 * Enforces a maximum of MAX_TRIBES joined tribes.
 */
export async function toggleTribe(
  tribeName: string,
  userId: string | undefined,
  join: boolean,
): Promise<Result<{ joined: boolean; member_count: number }>> {
  if (!userId) return { ok: false, code: "auth", message: "You must be signed in." };
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  // Get current user tribes
  const { data: user, error: userErr } = await client
    // The projection carries `tribes` (0018) and is the only table a
    // browser token may select from.
    .from("profiles")
    .select("tribes")
    .eq("id", userId)
    .single();

  if (userErr) return toFailure(userErr);

  const currentTribes = (user?.tribes as string[]) ?? [];

  if (join) {
    if (currentTribes.includes(tribeName)) {
      return ok({ joined: true, member_count: 0 });
    }
    if (currentTribes.length >= MAX_TRIBES) {
      return {
        ok: false,
        code: "limit",
        message: `You can only join ${MAX_TRIBES} tribes. Leave one first.`,
      };
    }

    const newTribes = [...currentTribes, tribeName];
    // `public.users` is server-owned: 0018 revoked browser writes and mirrors
    // `profiles` from it, so membership is saved through the profile API, and
    // `users_apply_projection()` republishes it to the projection.
    const saved = await saveTribes(newTribes);
    if (!saved.ok) return saved;

    // Increment tribe member_count
    const { data: tribe, error: tribeErr } = await client
      .from("tribes")
      .select("member_count")
      .eq("name", tribeName)
      .single();

    if (tribeErr) return toFailure(tribeErr);

    const newCount = (tribe?.member_count ?? 0) + 1;
    const counted = await client
      .from("tribes")
      .update({ member_count: newCount })
      .eq("name", tribeName);
    // A count that failed to move while the membership saved is a real
    // inconsistency; it used to be discarded with the promise of a number.
    if (counted.error) return toFailure(counted.error);

    return ok({ joined: true, member_count: newCount });
  } else {
    if (!currentTribes.includes(tribeName)) {
      return ok({ joined: false, member_count: 0 });
    }

    const newTribes = currentTribes.filter((t) => t !== tribeName);
    const saved = await saveTribes(newTribes);
    if (!saved.ok) return saved;

    // Decrement tribe member_count
    const { data: tribe, error: tribeErr } = await client
      .from("tribes")
      .select("member_count")
      .eq("name", tribeName)
      .single();

    if (tribeErr) return toFailure(tribeErr);

    const newCount = Math.max(0, (tribe?.member_count ?? 1) - 1);
    const counted = await client
      .from("tribes")
      .update({ member_count: newCount })
      .eq("name", tribeName);
    if (counted.error) return toFailure(counted.error);

    return ok({ joined: false, member_count: newCount });
  }
}
