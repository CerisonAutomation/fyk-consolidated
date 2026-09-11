/**
 * Nearby discovery, taps/favorites, and profile views.
 *
 * Query shape deliberately mirrors what the Board/discovery UI needs and nothing
 * more: filter on the coarse geohash prefix (indexed), then order by recency.
 * No embedding search, no "AI recommendations": those tables and models do not
 * exist in this deployment, and a ranked list we cannot compute is worse than an
 * honest nearby list.
 */

import { z } from "zod";
import { encodeGeohash, PROFILE_LIST_COLUMNS, toPublicProfile, photosByOwner, type ProfileRow } from "../data/profiles";
import { badRequest, conflict, forbidden, notFound, dbFailure } from "../errors";
import type { RequestCtx } from "../context";
import { readJson, type ApiClient } from "../context";
import { haversineKm } from "#/lib/geo";

const PAGE_SIZE = 30;
const MAX_PAGE = 20;

export const discoverQuerySchema = z.object({
	geohash: z.string().regex(/^[0-9a-z]{4,9}$/, "Location precision is not valid.").optional(),
	ageMin: z.coerce.number().int().min(18).max(99).optional(),
	ageMax: z.coerce.number().int().min(18).max(99).optional(),
	maxKm: z.coerce.number().min(1).max(500).optional(),
	onlineOnly: z.coerce.boolean().default(false),
	openToMeet: z.coerce.boolean().default(false),
	hasPhotos: z.coerce.boolean().default(false),
	bodyTypes: z.string().max(200).optional(),
	positions: z.string().max(200).optional(),
	lookingFor: z.string().max(200).optional(),
	interests: z.string().max(400).optional(),
	exposure: z.enum(["clean", "mature", "explicit"]).default("clean"),
	page: z.coerce.number().int().min(0).max(MAX_PAGE).default(0),
});

export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;

const list = (value: string | undefined) =>
	value
		? value
				.split(",")
				.map((entry) => entry.trim())
				.filter(Boolean)
				.slice(0, 12)
		: undefined;

export async function getViewerRow(ctx: RequestCtx): Promise<ProfileRow | null> {
	const caller = await ctx.callerPromise;
	if (!caller) return null;
	const { data } = await ctx
		.db()
		.from("profiles")
		.select(PROFILE_LIST_COLUMNS)
		.eq("id", caller.userId)
		.maybeSingle();
	return (data ?? null) as ProfileRow | null;
}

export async function listNearby(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const query = parseQuery(ctx);
	const client = ctx.db();

	const viewer = await getViewerRow(ctx);
	if (!viewer) throw notFound("Complete your profile before browsing.");

	const prefix = query.geohash ?? (viewer.lat_coarse != null ? encodeGeohash(viewer.lat_coarse, viewer.lng_coarse ?? 0, Math.min(6, 5)) : undefined);

	let builder = client
		.from("profiles")
		.select(PROFILE_LIST_COLUMNS)
		.neq("id", caller.userId)
		.not("onboarding_completed_at", "is", null)
		.eq("exposure_level", query.exposure === "clean" ? "clean" : query.exposure)
		.order("last_active_at", { ascending: false })
		.range(query.page * PAGE_SIZE, query.page * PAGE_SIZE + PAGE_SIZE - 1);

	// Prefix filter on the indexed coarse cell. A missing geohash falls back to
	// "recently active", which is honest: the app never claims radius precision it
	// did not compute.
	if (prefix) builder = builder.like("geohash6", `${prefix}%`);
	if (query.ageMin) builder = builder.gte("age", query.ageMin);
	if (query.ageMax) builder = builder.lte("age", query.ageMax);
	if (query.onlineOnly) builder = builder.gte("last_active_at", new Date(Date.now() - 5 * 60_000).toISOString());
	if (query.openToMeet) builder = builder.eq("open_to_meet", true).gte("available_until", new Date().toISOString());
	const bodyTypes = list(query.bodyTypes);
	if (bodyTypes?.length) builder = builder.in("body_type", bodyTypes);
	const positions = list(query.positions);
	if (positions?.length) builder = builder.in("position_role", positions);
	const lookingFor = list(query.lookingFor);
	if (lookingFor?.length) builder = builder.overlaps("looking_for", lookingFor);
	const interests = list(query.interests);
	if (interests?.length) builder = builder.overlaps("interests", interests);

	const { data, error } = await builder;
	if (error) throw dbFailure(error, "That did not save. Please try again.");

	let rows = (data ?? []) as unknown as ProfileRow[];

	// Radius filtering needs the haversine on coarsened points, done after the
	// index-narrowed fetch so we never compute distances for the whole table.
	if (query.maxKm && viewer.lat_coarse != null && viewer.lng_coarse != null) {
		rows = rows.filter((row) => {
			if (row.hide_distance || row.lat_coarse == null || row.lng_coarse == null) return true;
			return haversineKm({ lat: viewer.lat_coarse!, lng: viewer.lng_coarse ?? 0 }, { lat: row.lat_coarse, lng: row.lng_coarse }) <= query.maxKm!;
		});
	}

	const photos = await photosByOwner(client, rows.map((row) => row.id));
	const viewerInterests = viewer.interests ?? [];

	const candidates = rows
		.map((row) =>
			toPublicProfile(row, {
				viewer: {
					id: caller.userId,
					lat: viewer.lat_coarse,
					lng: viewer.lng_coarse,
					interests: viewerInterests,
				},
				photos: photos.get(row.id) ?? [],
				client,
			}),
		)
		.filter((candidate) => (query.hasPhotos ? candidate.photos.length > 0 : true))
		.filter((candidate) => (query.maxKm && candidate.distanceKm != null ? candidate.distanceKm <= query.maxKm : true));

	return {
		candidates,
		page: query.page,
		hasMore: rows.length === PAGE_SIZE,
		/** Explains a thin result set instead of leaving a blank grid. */
		note:
			candidates.length === 0
				? prefix
					? "Nobody nearby matches those filters yet. Widen the distance or clear a filter."
					: "No nearby profiles yet. Add your city so FYK can search your area."
				: null,
	};
}

function parseQuery(ctx: RequestCtx): DiscoverQuery {
	const obj: Record<string, string> = {};
	ctx.query.forEach((value, key) => {
		obj[key] = value;
	});
	const parsed = discoverQuerySchema.safeParse(obj);
	if (!parsed.success) {
		throw badRequest("Those filters are not valid.", { fields: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) });
	}
	return parsed.data;
}

export async function getProfile(ctx: RequestCtx, profileId: string) {
	const caller = await ctx.auth();
	z.string().uuid().parse(profileId);
	const client = ctx.db();

	const viewer = await getViewerRow(ctx);
	const { data, error } = await client.from("profiles").select(PROFILE_LIST_COLUMNS + ",bio,age_verified_at,incognito,is_suspended").eq("id", profileId).maybeSingle();
	if (error) throw dbFailure(error, "That did not save. Please try again.");
	if (!data) throw notFound("That profile is not visible to you.");
	const row = data as unknown as ProfileRow;

	const photos = await photosByOwner(client, [row.id]);
	const profile = toPublicProfile(row, {
		viewer: { id: caller.userId, lat: viewer?.lat_coarse ?? null, lng: viewer?.lng_coarse ?? null, interests: viewer?.interests ?? [] },
		photos: photos.get(row.id) ?? [],
		client,
		includeBio: true,
	});

	// View logging is best-effort and never blocks the page. The database also
	// refuses to record it for incognito viewers (see record_view in 0006).
	void client.rpc("record_view" as never, { target: row.id } as never);

	const relationship = await readRelationship(client, caller.userId, row.id);
	return { profile, relationship };
}

async function readRelationship(client: ApiClient, meId: string, otherId: string) {
	const [likes, blocks] = await Promise.all([
		client.from("likes").select("from_id,to_id,kind").or(`and(from_id.eq.${meId},to_id.eq.${otherId}),and(from_id.eq.${otherId},to_id.eq.${meId})`),
		client.from("blocks").select("blocker_id,blocked_id").or(`and(blocker_id.eq.${meId},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${meId})`),
	]);
	const mine = (likes.data ?? []).find((row: { from_id: string }) => row.from_id === meId);
	const theirs = (likes.data ?? []).find((row: { from_id: string }) => row.from_id === otherId);
	const blocked = (blocks.data ?? []).length > 0;
	return {
		blocked,
		iTapped: mine?.kind === "tap",
		tappedMe: theirs?.kind === "tap",
		isMatch: Boolean(mine && theirs),
		iFavorited: mine?.kind === "like",
	};
}

export const tapSchema = z.object({
	targetId: z.string().uuid(),
	action: z.enum(["tap", "favorite", "unfavorite", "pass"]).default("tap"),
});

/**
 * Tapping is the whole matching mechanic, so the rules live here and in the
 * database — not in a component:
 *   - one row per ordered pair (unique constraint on likes)
 *   - a match row and conversation appear only when the tap is mutual, via the
 *     `handle_mutual_tap` trigger
 *   - blocked either way is refused before a query is even attempted
 */
export async function tap(ctx: RequestCtx) {
	const caller = await ctx.auth();
	const body = await readJson(ctx.request, tapSchema);
	const client = ctx.db();

	if (body.targetId === caller.userId) throw badRequest("You cannot tap yourself.");

	const blocked = await client.from("blocks").select("id").or(`and(blocker_id.eq.${caller.userId},blocked_id.eq.${body.targetId}),and(blocker_id.eq.${body.targetId},blocked_id.eq.${caller.userId})`).limit(1);
	if ((blocked.data ?? []).length) throw forbidden("You cannot interact with this person.");

	if (body.action === "pass" || body.action === "unfavorite") {
		await client.from("likes").delete().eq("from_id", caller.userId).eq("to_id", body.targetId);
		return { ok: true, matched: false };
	}

	const kind = body.action === "tap" ? "tap" : "like";
	const existing = await client.from("likes").select("id,kind").eq("from_id", caller.userId).eq("to_id", body.targetId).maybeSingle();
	if (existing.error) throw dbFailure(existing.error, "That did not save. Please try again.");

	if (existing.data) {
		if (existing.data.kind === kind) throw conflict("You already did that.");
		await client.from("likes").update({ kind }).eq("id", existing.data.id);
	} else {
		const insert = await client.from("likes").insert({ from_id: caller.userId, to_id: body.targetId, kind });
		if (insert.error) throw dbFailure(insert.error, "That did not save. Please try again.");
	}

	// The trigger creates the match + conversation. Reading it back tells the UI
	// whether to show a "matched" celebration; it can never be forged client-side.
	const match = await client
		.from("matches")
		.select("id")
		.or(`and(user_a.eq.${caller.userId},user_b.eq.${body.targetId}),and(user_a.eq.${body.targetId},user_b.eq.${caller.userId})`)
		.maybeSingle();

	let conversationId: string | null = null;
	if (match.data?.id) {
		const conversation = await client.from("conversations").select("id").eq("match_id", match.data.id).maybeSingle();
		conversationId = conversation.data?.id ?? null;
	}

	return { ok: true, matched: Boolean(match.data?.id), conversationId, kind };
}
