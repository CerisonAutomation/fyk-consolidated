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
      .from("users")
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
    .from("users")
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
    const { error: updateErr } = await client
      .from("users")
      .update({ tribes: newTribes })
      .eq("id", userId);

    if (updateErr) return toFailure(updateErr);

    // Increment tribe member_count
    const { data: tribe, error: tribeErr } = await client
      .from("tribes")
      .select("member_count")
      .eq("name", tribeName)
      .single();

    if (tribeErr) return toFailure(tribeErr);

    const newCount = (tribe?.member_count ?? 0) + 1;
    await client
      .from("tribes")
      .update({ member_count: newCount })
      .eq("name", tribeName);

    return ok({ joined: true, member_count: newCount });
  } else {
    if (!currentTribes.includes(tribeName)) {
      return ok({ joined: false, member_count: 0 });
    }

    const newTribes = currentTribes.filter((t) => t !== tribeName);
    const { error: updateErr } = await client
      .from("users")
      .update({ tribes: newTribes })
      .eq("id", userId);

    if (updateErr) return toFailure(updateErr);

    // Decrement tribe member_count
    const { data: tribe, error: tribeErr } = await client
      .from("tribes")
      .select("member_count")
      .eq("name", tribeName)
      .single();

    if (tribeErr) return toFailure(tribeErr);

    const newCount = Math.max(0, (tribe?.member_count ?? 1) - 1);
    await client
      .from("tribes")
      .update({ member_count: newCount })
      .eq("name", tribeName);

    return ok({ joined: false, member_count: newCount });
  }
}
