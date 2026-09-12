// ═══════════════════════════════════════════════════════════════════════════════
// Social — Fansites
// ═══════════════════════════════════════════════════════════════════════════════

import { api } from "#/lib/client";
import { getSupabase, ok, type Result, toFailure } from "./client";
import type { Fansite } from "./types";

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * A fansite's owner as the screen needs it. The row is read from
 * `public.profiles` — the projection a browser token is allowed to select
 * (0018) — so the source columns are `display_name`/`handle`; the outgoing
 * keys stay `pseudo`/`nick` because that is the contract every fansite card
 * was written against.
 */
export type FansiteOwner = {
	id: string;
	pseudo: string | null;
	nick: string | null;
	photos: unknown;
	tier?: string;
};

export type FansiteView = Fansite & {
	owner: FansiteOwner | null;
	is_subscribed: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FANSITE_COLUMNS =
	"id,user_id,name,description,cover_url,subscriber_count,created_at";

// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Lists all fansites, annotated with subscriber status for the current user.
 */
export async function listFansites(
	userId: string | undefined,
): Promise<Result<FansiteView[]>> {
	if (!userId)
		return { ok: false, code: "auth", message: "You must be signed in." };
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
		.from("profiles")
		.select("id,display_name,handle,photos,tier")
		.in("id", ownerIds);

	if (ownersResult.error) return toFailure(ownersResult.error);

	const ownerMap = new Map((ownersResult.data ?? []).map((o) => [o.id, o]));

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
							pseudo: owner.display_name,
							nick: owner.handle,
							photos,
							tier: owner.tier ?? "free",
						}
					: null,
				is_subscribed: subscribedFansiteIds.has(f.id),
			};
		}),
	);
}

/** Postgres would reject a malformed uuid with a 400 of its own; checking here
 * keeps the message one the screen can show without a round trip. */
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Toggles subscription to a fansite.
 *
 * It used to represent a subscription as a notification sent to the creator
 * (`type: 'fansite_subscribe'`) and answer "am I subscribed?" by finding that
 * notification again — while `notifications_type_check` (0013) had never allowed
 * that type, so the insert was rejected and the UI flipped to "Subscribed" over
 * nothing. `0019` added `public.fansite_subscribers` as the real edge, moved
 * `subscriber_count` onto a trigger over it, and this now calls
 * `POST /api/fansites/subscribe`, because the creator's notification is a row in
 * *someone else's* inbox and no browser token may write that.
 */
export async function toggleFansiteSubscription(
	fansiteId: string,
	userId: string | undefined,
): Promise<Result<{ subscribed: boolean; subscriber_count: number }>> {
	if (!userId)
		return { ok: false, code: "auth", message: "You must be signed in." };
	if (!UUID_PATTERN.test(fansiteId))
		return { ok: false, code: "validation", message: "Unknown fansite." };

	try {
		const data = await api<{ subscribed: boolean; subscriber_count: number }>(
			"/api/fansites/subscribe",
			{ method: "POST", body: { fansiteId } },
		);
		return ok({
			subscribed: data.subscribed,
			subscriber_count: data.subscriber_count,
		});
	} catch (error) {
		return toFailure(
			error instanceof Error
				? new Error(error.message)
				: new Error("Subscription failed"),
		);
	}
}

/**
 * Creates a new fansite for the authenticated user.
 */
export async function createFansite(
	userId: string | undefined,
	input: { name: string; description?: string },
): Promise<Result<Fansite>> {
	if (!userId)
		return { ok: false, code: "auth", message: "You must be signed in." };
	const client = getSupabase();
	if (!client) return toFailure(new Error("Supabase is not configured."));

	const name = input.name.trim();
	// 2 characters is not a taste level: `fansites_create_own` (0019) requires
	// `char_length(btrim(name)) between 2 and 80`, and a client that lets a 1-char
	// name through gets a PostgREST policy error the screen cannot explain.
	if (name.length < 2 || name.length > 60) {
		return {
			ok: false,
			code: "validation",
			message: "Fansite name must be 2-60 characters.",
		};
	}

	// Check if user already has a fansite
	const existing = await client
		.from("fansites")
		.select("id")
		.eq("user_id", userId)
		.maybeSingle();

	if (existing.error) return toFailure(existing.error);
	if (existing.data) {
		return {
			ok: false,
			code: "conflict",
			message: "You already have a fansite.",
		};
	}

	const result = await client
		.from("fansites")
		.insert({
			user_id: userId,
			name,
			description: input.description?.trim() || null,
			// No `subscriber_count`: it is derived from `fansite_subscribers` by a
			// trigger (0019), and a hand-written 0 here would be refused anyway.
		})
		.select(FANSITE_COLUMNS)
		.single();

	return result.error ? toFailure(result.error) : ok(result.data);
}
