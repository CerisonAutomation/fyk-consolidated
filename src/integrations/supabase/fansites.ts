// ═══════════════════════════════════════════════════════════════════════════════
// Social — Fansites
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase, ok, toFailure, type Result } from "./client";
import type { Fansite, User } from "./types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type FansiteOwner = Pick<User, "id" | "pseudo" | "nick" | "photos"> & {
  tier?: string;
};

export type FansiteView = Fansite & {
  owner: FansiteOwner | null;
  is_subscribed: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FANSITE_COLUMNS = "id,user_id,name,description,cover_url,subscriber_count,created_at";

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Lists all fansites, annotated with subscriber status for the current user.
 */
export async function listFansites(userId: string | undefined): Promise<Result<FansiteView[]>> {
  if (!userId) return { ok: false, code: "auth", message: "You must be signed in." };
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const fansitesResult = await client
    .from("fansites")
    .select(FANSITE_COLUMNS)
    .order("subscriber_count", { ascending: false });

  if (fansitesResult.error) return toFailure(fansitesResult.error);

  const fansites = fansitesResult.data ?? [];
  if (fansites.length === 0) return ok([]);

  // Fetch owner profiles
  const ownerIds = [...new Set(fansites.map((f) => f.user_id))];
  const ownersResult = await client
    .from("users")
    .select("id,pseudo,nick,photos,tier")
    .in("id", ownerIds);

  if (ownersResult.error) return toFailure(ownersResult.error);

  const ownerMap = new Map(
    (ownersResult.data ?? []).map((o) => [o.id, o]),
  );

  // Find which fansites this user is subscribed to.
  // Subscriptions are tracked as notifications of type 'fansite_subscribe'
  // where actor_id = subscribing user and user_id = fansite owner.
  const fansiteOwnerMap = new Map(fansites.map((f) => [f.user_id, f.id]));
  const ownerUserIds = [...fansiteOwnerMap.keys()];

  const subsResult = await client
    .from("notifications")
    .select("user_id")
    .eq("type", "fansite_subscribe")
    .eq("actor_id", userId)
    .in("user_id", ownerUserIds);

  const subscribedFansiteIds = new Set<string>();
  if (!subsResult.error && subsResult.data) {
    for (const row of subsResult.data) {
      const fansiteId = fansiteOwnerMap.get(row.user_id);
      if (fansiteId) subscribedFansiteIds.add(fansiteId);
    }
  }

  return ok(
    fansites.map((f) => {
      const owner = ownerMap.get(f.user_id);
      const photos = (owner?.photos as string[]) ?? [];
      return {
        ...f,
        owner: owner
          ? {
              id: owner.id,
              pseudo: owner.pseudo,
              nick: owner.nick,
              photos,
              tier: owner.tier ?? "free",
            }
          : null,
        is_subscribed: subscribedFansiteIds.has(f.id),
      };
    }),
  );
}

/**
 * Toggles subscription to a fansite. Uses notifications as a lightweight
 * subscription tracking mechanism (matching the Prisma-based pattern).
 */
export async function toggleFansiteSubscription(
  fansiteId: string,
  userId: string | undefined,
): Promise<Result<{ subscribed: boolean; subscriber_count: number }>> {
  if (!userId) return { ok: false, code: "auth", message: "You must be signed in." };
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  // Get the fansite
  const fansiteResult = await client
    .from("fansites")
    .select("id,user_id,subscriber_count")
    .eq("id", fansiteId)
    .single();

  if (fansiteResult.error) return toFailure(fansiteResult.error);

  const fansite = fansiteResult.data;
  if (fansite.user_id === userId) {
    return { ok: false, code: "validation", message: "Cannot subscribe to your own fansite." };
  }

  // Check if already subscribed (notification from this user to fansite owner)
  const existingResult = await client
    .from("notifications")
    .select("id")
    .eq("user_id", fansite.user_id)
    .eq("type", "fansite_subscribe")
    .eq("actor_id", userId)
    .maybeSingle();

  if (existingResult.error) return toFailure(existingResult.error);

  if (existingResult.data) {
    // Unsubscribe: delete the notification
    await client
      .from("notifications")
      .delete()
      .eq("id", existingResult.data.id);

    const newCount = Math.max(0, (fansite.subscriber_count ?? 1) - 1);
    await client
      .from("fansites")
      .update({ subscriber_count: newCount })
      .eq("id", fansiteId);

    return ok({ subscribed: false, subscriber_count: newCount });
  }

  // Subscribe: create a notification
  await client.from("notifications").insert({
    user_id: fansite.user_id,
    type: "fansite_subscribe",
    title: "New Subscriber",
    body: "Someone subscribed to your fansite!",
    actor_id: userId,
    href: null,
  });

  const newCount = (fansite.subscriber_count ?? 0) + 1;
  await client
    .from("fansites")
    .update({ subscriber_count: newCount })
    .eq("id", fansiteId);

  return ok({ subscribed: true, subscriber_count: newCount });
}

/**
 * Creates a new fansite for the authenticated user.
 */
export async function createFansite(
  userId: string | undefined,
  input: { name: string; description?: string },
): Promise<Result<Fansite>> {
  if (!userId) return { ok: false, code: "auth", message: "You must be signed in." };
  const client = getSupabase();
  if (!client) return toFailure(new Error("Supabase is not configured."));

  const name = input.name.trim();
  if (!name || name.length > 60) {
    return { ok: false, code: "validation", message: "Fansite name must be 1-60 characters." };
  }

  // Check if user already has a fansite
  const existing = await client
    .from("fansites")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) return toFailure(existing.error);
  if (existing.data) {
    return { ok: false, code: "conflict", message: "You already have a fansite." };
  }

  const result = await client
    .from("fansites")
    .insert({
      user_id: userId,
      name,
      description: input.description?.trim() || null,
      subscriber_count: 0,
    })
    .select(FANSITE_COLUMNS)
    .single();

  return result.error ? toFailure(result.error) : ok(result.data);
}
