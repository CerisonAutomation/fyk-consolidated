import { TtlCache } from "#/core/lib/ttl-cache";
import { compatibilityScore, onlineUntil } from "#/lib/compatibility";
import { api } from "#/lib/client";
import { getSupabase } from "#/integrations/supabase/client";
import { decodeGeohash } from "#/core/model/geohash";
import { haversineKm } from "#/lib/geo";

export type RenderedGridProfile = {
	type: "rendered";
	id: string;
	displayName: string | null;
	age: number | null;
	position: string | null;
	headline: string | null;
	/**
	 * Six-dimension compatibility against the signed-in viewer (0-100), or
	 * `null` when there is no viewer row to compare against — the card draws
	 * no ring instead of drawing a made-up one.
	 */
	compatibilityScore: number | null;
	isNew: boolean;
	distance: number | null;
	profilePhotosHashes: string[] | null;
	unread: number | null;
	onlineUntil: number | null;
	isFavorite: boolean;
	hasChattedInLast24Hrs: boolean;
};

export type LazyGridProfile = {
	type: "lazy";
	id: string;
	unread: number | null;
};

export type GridProfile = RenderedGridProfile | LazyGridProfile;

export interface GridResponse {
	items: GridProfile[];
	nextPage: number | null;
	shuffled: boolean;
}

function primaryImageHashes(url: string | null | undefined): string[] | null {
	const hash = url?.split("/").pop();
	return hash ? [hash] : null;
}

/** Convert a geohash to a lat/lng bounding box expanded to cover a search radius (default ~50 km). */
function geohashBounds(
	hash: string,
	radiusKm = 50,
): {
	latMin: number;
	latMax: number;
	lngMin: number;
	lngMax: number;
	center: { lat: number; lng: number };
} {
	const decoded = decodeGeohash(hash);
	const center = { lat: decoded.lat, lng: decoded.lon };
	const latDelta = radiusKm / 111.32;
	const lngDelta =
		radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180));
	return {
		latMin: center.lat - latDelta,
		latMax: center.lat + latDelta,
		lngMin: center.lng - lngDelta,
		lngMax: center.lng + lngDelta,
		center,
	};
}

/**
 * The projection comes from `public.profiles` — the discoverable view over the
 * canonical `public.users` row — so the names are the canonical ones:
 * `display_name`/`handle` instead of `nick`/`pseudo`, `height_cm` instead of
 * `height`, and a single `discoverable` flag in place of the old
 * `visible`/`hidden`/`incognito`/`status` quartet, because the mirror trigger
 * already folds visibility, suspension, incognito mode and blocks into it.
 * `interests` and `verification` are here for the same reason the score is:
 * the card renders a badge and a percentage, both of which need real input.
 */
const GRID_COLUMNS =
	"id, display_name, handle, age, body_type, position, headline, photos, city, area, lat_coarse, lng_coarse, online, last_active_at, created_at, height_cm, weight, relationship_status, tag_codes, tribes, looking_for, interests, verification";

export async function getGrid(query: {
	nearbyGeoHash?: string;
	pageNumber?: number;
	favorites?: boolean;
	onlineOnly?: boolean;
	rightNow?: boolean;
	ageMin?: number;
	ageMax?: number;
	genders?: number[];
	sexualPositions?: string[];
	photoOnly?: boolean;
	hasAlbum?: boolean;
	faceOnly?: boolean;
	tribes?: string[];
	bodyTypes?: string[];
	heightCmMin?: number;
	heightCmMax?: number;
	weightGramsMin?: number;
	weightGramsMax?: number;
	relationshipStatuses?: string[];
	nsfwPics?: boolean;
	lookingFor?: string[];
	meetAt?: string[];
	notRecentlyChatted?: boolean;
	sexualHealth?: string[];
	tags?: string[];
	fresh?: boolean;
}): Promise<GridResponse> {
	const client = getSupabase();
	if (!client) {
		return { items: [], nextPage: null, shuffled: false };
	}

	const page = query.pageNumber ?? 0;
	const pageSize = 30;
	const from = page * pageSize;
	const to = from + pageSize - 1;

	// ── Resolve current user for favorites cross-reference ──
	const {
		data: { user: authUser },
	} = await client.auth.getUser();
	const userId = authUser?.id;

	// ── Fetch user's favorites (used for both filtering and cross-reference) ──
	let favoriteIds: Set<string> | null = null;
	if (userId) {
		const { data: favs } = await client
			.from("favorites")
			.select("target_id")
			.eq("user_id", userId);
		favoriteIds = new Set(favs?.map((f) => f.target_id) ?? []);
	}

	// ── Viewer row + own threads: the input for the compatibility ring, the
	// unread badge and the "chatted recently" flag, none of which used to be
	// derived from anything at all.
	const viewer = userId ? await getViewerContext(client, userId) : null;

	// ── If favorites filter active but user has none, short-circuit ──
	if (query.favorites && favoriteIds && favoriteIds.size === 0) {
		return { items: [], nextPage: null, shuffled: false };
	}

	// ── Decode nearbyGeoHash to get user location and search bounds ──
	let userLat: number | null = null;
	let userLng: number | null = null;
	let latMin: number | undefined;
	let latMax: number | undefined;
	let lngMin: number | undefined;
	let lngMax: number | undefined;

	if (query.nearbyGeoHash) {
		const bounds = geohashBounds(query.nearbyGeoHash);
		userLat = bounds.center.lat;
		userLng = bounds.center.lng;
		latMin = bounds.latMin;
		latMax = bounds.latMax;
		lngMin = bounds.lngMin;
		lngMax = bounds.lngMax;
	}

	// ── Build Supabase query against the `profiles` projection ──
	let qb = client
		.from("profiles")
		.select(GRID_COLUMNS, { count: "exact" })
		.eq("discoverable", true)
		// `discoverable` already excludes suspended and hidden accounts; the
		// explicit predicate stays so a partial backfill can never leak a
		// suspended profile into the grid.
		.eq("is_suspended", false);

	// ── 1. Geographic filtering using lat_coarse / lng_coarse ──
	if (
		latMin !== undefined &&
		latMax !== undefined &&
		lngMin !== undefined &&
		lngMax !== undefined
	) {
		qb = qb
			.gte("lat_coarse", latMin)
			.lte("lat_coarse", latMax)
			.gte("lng_coarse", lngMin)
			.lte("lng_coarse", lngMax);
	}

	// ── 2. Favorites filter (restrict to favorited profiles only) ──
	if (query.favorites && favoriteIds) {
		qb = qb.in("id", Array.from(favoriteIds));
	}

	// ── 3. Online / age filters ──
	if (query.onlineOnly) {
		qb = qb.eq("online", true);
	}
	if (query.ageMin !== undefined) {
		qb = qb.gte("age", query.ageMin);
	}
	if (query.ageMax !== undefined) {
		qb = qb.lte("age", query.ageMax);
	}

	// ── 4. Gender filter ──
	// NOTE: The `gender` column does not exist on the `users` table in the
	// current schema. Uncomment once the column has been added:
	// if (query.genders && query.genders.length > 0) {
	// 	qb = qb.in("gender", query.genders);
	// }

	// ── 5. Photo-only filter ──
	if (query.photoOnly) {
		qb = qb.not("photos", "is", null);
	}

	// ── 6. Height filters (centimetres, both bounds on `height_cm`) ──
	if (query.heightCmMin !== undefined) {
		qb = qb.gte("height_cm", query.heightCmMin);
	}
	if (query.heightCmMax !== undefined) {
		qb = qb.lte("height_cm", query.heightCmMax);
	}

	// ── 7. Weight, in grams (the filter panel sends kilograms × 1000). This
	// predicate used to be missing entirely, so moving the weight slider
	// changed the label and nothing else.
	if (query.weightGramsMin !== undefined) {
		qb = qb.gte("weight", query.weightGramsMin);
	}
	if (query.weightGramsMax !== undefined) {
		qb = qb.lte("weight", query.weightGramsMax);
	}

	// ── 7. Relationship-status filter ──
	if (query.relationshipStatuses && query.relationshipStatuses.length > 0) {
		qb = qb.in("relationship_status", query.relationshipStatuses);
	}

	// ── 8. Tags filter (tag_codes is a jsonb array) ──
	if (query.tags && query.tags.length > 0) {
		qb = qb.overlaps("tag_codes", query.tags);
	}

	// ── 9. Sexual-position filter (position is a jsonb array) ──
	if (query.sexualPositions && query.sexualPositions.length > 0) {
		qb = qb.overlaps("position", query.sexualPositions);
	}

	// ── 10. Looking-for filter (looking_for is a jsonb array) ──
	if (query.lookingFor && query.lookingFor.length > 0) {
		qb = qb.overlaps("looking_for", query.lookingFor);
	}

	// ── 11. Tribes filter (tribes is a jsonb array) ──
	if (query.tribes && query.tribes.length > 0) {
		qb = qb.overlaps("tribes", query.tribes);
	}

	// ── 12. Body-type filter ──
	if (query.bodyTypes && query.bodyTypes.length > 0) {
		qb = qb.in("body_type", query.bodyTypes);
	}

	// ── 13. Fresh profiles (created within the last 7 days) ──
	if (query.fresh) {
		const sevenDaysAgo = new Date(
			Date.now() - 7 * 24 * 60 * 60 * 1000,
		).toISOString();
		qb = qb.gte("created_at", sevenDaysAgo);
	}

	// ── 14. Not-recently-chatted filter ──
	// Requires a join against conversations / conversation_members.
	// Deferred: implement via a Supabase RPC or a separate query once the
	// conversations schema is stable.

	// ── 15. rightNow, hasAlbum, faceOnly, nsfwPics, meetAt, sexualHealth ──
	// These parameters require additional columns or cross-table joins that
	// are not yet available. Add them as the schema evolves.

	// ── Ordering & pagination (must be last before execute) ──
	qb = qb
		.order("last_active_at", { ascending: false })
		.range(from, to);

	const { data: profiles, count } = await qb;

	if (!profiles) {
		return { items: [], nextPage: null, shuffled: false };
	}

	// ── Map rows -> GridProfile with distance calculation & favorites ──
	const items: GridProfile[] = profiles.map((p) => {
		const photos = (p.photos as string[] | null) ?? [];
		const primaryPhoto = photos[0] ?? null;
		const createdAt = new Date(p.created_at);
		const isNew =
			Date.now() - createdAt.getTime() < 7 * 24 * 60 * 60 * 1000;

		// ── Haversine distance ──
		let distance: number | null = null;
		if (
			userLat !== null &&
			userLng !== null &&
			p.lat_coarse != null &&
			p.lng_coarse != null
		) {
			distance = haversineKm(
				{ lat: userLat, lng: userLng },
				{ lat: p.lat_coarse, lng: p.lng_coarse },
			);
		}

		return {
			type: "rendered" as const,
			id: p.id,
			displayName: p.handle ?? p.display_name,
			age: p.age ?? null,
			position: Array.isArray(p.position)
				? (p.position as string[])[0]
				: (p.position as string | null),
			headline: p.headline ?? null,
			compatibilityScore: viewer
				? compatibilityScore(viewer.me, {
						tribes: asStrings(p.tribes),
						interests: asStrings(p.interests),
						intents: asStrings(p.looking_for),
						age: p.age,
						distanceKm: distance,
						lastActiveAt: p.last_active_at
							? new Date(p.last_active_at)
							: null,
					})
				: null,
			isNew,
			distance,
			profilePhotosHashes: primaryImageHashes(primaryPhoto),
			unread: viewer?.unread.get(String(p.id)) ?? 0,
			onlineUntil: onlineUntil(p.last_active_at, p.online),
			isFavorite: favoriteIds?.has(p.id) ?? false,
			hasChattedInLast24Hrs:
				viewer?.chattedRecently.has(String(p.id)) ?? false,
		};
	});

	const hasMore =
		count !== null
			? from + pageSize < count
			: profiles.length === pageSize;

	return {
		items,
		nextPage: hasMore ? page + 1 : null,
		shuffled: false,
	};
}

/**
 * The viewer's own row and threads: the input for the three card fields that
 * used to be invented (`compatibilityScore`, `unread`, `hasChattedInLast24Hrs`).
 * Unread counts come from `/api/conversations`, which owns the "only my own
 * member row counts" rule, instead of being re-derived from a second table here.
 */
type ViewerContext = {
	me: {
		tribes: string[];
		interests: string[];
		intents: string[];
		age: number | null;
	};
	unread: Map<string, number>;
	chattedRecently: Set<string>;
};

/**
 * jsonb tag arrays arrive untyped and in two vocabularies — tribe names from
 * `/tribes`, numeric ids from the profile editor — so numbers are textified
 * rather than dropped (the same rule `asStringArray` follows server-side).
 */
function asStrings(value: unknown): string[] {
	return Array.isArray(value)
		? value
				.map((item) =>
					typeof item === "string"
						? item.trim()
						: typeof item === "number" && Number.isFinite(item)
							? String(item)
							: "",
				)
				.filter((item) => item !== "")
		: [];
}

/** One page of the grid costs one viewer lookup, not one per card. */
const viewerCache = new TtlCache<string, ViewerContext | null>({
	ttlMs: 60_000,
});

async function getViewerContext(
	client: NonNullable<ReturnType<typeof getSupabase>>,
	userId: string,
): Promise<ViewerContext | null> {
	const cached = viewerCache.get(userId);
	if (cached !== null) return cached;
	const loaded = await loadViewerContext(client, userId);
	viewerCache.set(userId, loaded);
	return loaded;
}

async function loadViewerContext(
	client: NonNullable<ReturnType<typeof getSupabase>>,
	userId: string,
): Promise<ViewerContext | null> {
	const { data: row } = await client
		.from("profiles")
		.select("age, tribes, interests, looking_for")
		.eq("id", userId)
		.maybeSingle();
	if (!row) return null;

	// The thread list needs the viewer's session, so it is only asked for in the
	// browser; during SSR the badges stay at zero rather than defaulting to
	// something optimistic.
	const unread = new Map<string, number>();
	const chattedRecently = new Set<string>();
	if (typeof window !== "undefined") {
		const threads = await api<{
			conversations: {
				unread_count?: number;
				last_message_at?: string | null;
				participant?: { id?: string } | null;
			}[];
		}>("/api/conversations").catch(() => null);
		const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
		for (const thread of threads?.conversations ?? []) {
			const peer = thread.participant?.id;
			if (!peer) continue;
			unread.set(peer, Number(thread.unread_count ?? 0));
			const at = thread.last_message_at ? Date.parse(thread.last_message_at) : 0;
			if (at >= dayAgo) chattedRecently.add(peer);
		}
	}

	return {
		me: {
			tribes: asStrings(row.tribes),
			interests: asStrings(row.interests),
			intents: asStrings(row.looking_for),
			age: row.age ?? null,
		},
		unread,
		chattedRecently,
	};
}

const profileCache = new TtlCache<string, RenderedGridProfile>({
	ttlMs: 60_000,
});

export function getCachedProfile(id: string): RenderedGridProfile | null {
	return profileCache.get(id);
}

export function setCachedProfile(profile: RenderedGridProfile): void {
	profileCache.set(profile.id, profile);
}

export function patchCachedProfile({
	id,
	patch,
}: {
	id: string;
	patch: Partial<RenderedGridProfile>;
}): void {
	profileCache.update(id, (profile) => ({ ...profile, ...patch }));
}

/**
 * Resolve a lazy profile placeholder into a fully-rendered profile.
 *
 * Fetches the profile row and, when running in production, calculates
 * the Haversine distance from the current user's stored geohash and
 * cross-references the favorites table to populate `isFavorite`.
 */
export async function resolveLazyProfile(
	profile: LazyGridProfile,
): Promise<RenderedGridProfile | null> {
	const { demoEnabled } = await import("#/domains/demo/config");

	// ── Production path: fetch real data from Supabase ──
	if (!demoEnabled) {
		const client = getSupabase();
		if (!client) return null;

		// Fetch the target profile
		const { data: user } = await client
			.from("profiles")
			.select(
				"id, display_name, handle, age, position, headline, photos, lat_coarse, lng_coarse, online, last_active_at, created_at, tribes, interests, looking_for, verification",
			)
			.eq("id", profile.id)
			.single();

		if (!user) return null;

		const photos = (user.photos as string[] | null) ?? [];
		const primaryPhoto = photos[0] ?? null;
		const createdAt = new Date(user.created_at);
		const isNew =
			Date.now() - createdAt.getTime() < 7 * 24 * 60 * 60 * 1000;

		// ── Distance from current user ──
		let distance: number | null = null;
		const {
			data: { user: authUser },
		} = await client.auth.getUser();
		if (authUser) {
			const { data: me } = await client
				.from("profiles")
				.select("lat_coarse, lng_coarse")
				.eq("id", authUser.id)
				.single();
			if (
				me &&
				me.lat_coarse != null &&
				me.lng_coarse != null &&
				user.lat_coarse != null &&
				user.lng_coarse != null
			) {
				distance = haversineKm(
					{ lat: me.lat_coarse, lng: me.lng_coarse },
					{ lat: user.lat_coarse, lng: user.lng_coarse },
				);
			}
		}

		const viewer = authUser
			? await getViewerContext(client, authUser.id)
			: null;

		// ── Favorites cross-reference ──
		let isFavorite = false;
		if (authUser) {
			const { data: fav } = await client
				.from("favorites")
				.select("id")
				.eq("user_id", authUser.id)
				.eq("target_id", profile.id)
				.maybeSingle();
			isFavorite = fav !== null;
		}

		return {
			type: "rendered",
			id: profile.id,
			displayName: user.handle ?? user.display_name,
			age: user.age ?? null,
			position: Array.isArray(user.position)
				? (user.position as string[])[0]
				: (user.position as string | null),
			headline: user.headline ?? null,
			compatibilityScore: viewer
				? compatibilityScore(viewer.me, {
						
							tribes: asStrings(user.tribes),
							interests: asStrings(user.interests),
							intents: asStrings(user.looking_for),
							age: user.age,
							distanceKm: distance,
							lastActiveAt: user.last_active_at
								? new Date(user.last_active_at)
								: null,
						},
					)
				: null,
			isNew,
			distance,
			profilePhotosHashes: primaryImageHashes(primaryPhoto),
			unread: viewer?.unread.get(String(profile.id)) ?? 0,
			onlineUntil: onlineUntil(user.last_active_at, user.online),
			isFavorite,
			hasChattedInLast24Hrs:
				viewer?.chattedRecently.has(String(profile.id)) ?? false,
		};
	}

	// ── Demo path: use mock data ──
	const [{ demoFavoriteOf }, { onlineUntilOf, photosOf, profileSeed }] =
		await Promise.all([
			import("#/domains/demo/mock/grid"),
			import("#/domains/demo/mock/profiles"),
		]);
	const seed = profileSeed(Number(profile.id));
	const photos = photosOf(Number(profile.id));
	return {
		type: "rendered",
		id: profile.id,
		displayName: seed.name,
		age: seed.showAge ? seed.age : null,
		position: seed.position,
		headline: seed.bio || seed.lookingFor.join(" · "),
		compatibilityScore: 58 + Number(profile.id) % 39,
		isNew: Number(profile.id) % 11 === 0,
		distance: seed.distanceM,
		profilePhotosHashes: photos.length > 0 ? photos : null,
		unread: profile.unread,
		onlineUntil: onlineUntilOf(seed),
		isFavorite: demoFavoriteOf({ profileId: Number(profile.id) }),
		hasChattedInLast24Hrs: seed.unread > 0,
	};
}
