import { TtlCache } from "#/core/lib/ttl-cache";
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
	compatibilityScore: number;
	isNew: boolean;
	distance: number | null;
	profilePhotosHashes: string[] | null;
	unread: number | null;
	onlineUntil: number | null;
	isFavorite: boolean;
	isVisiting: boolean;
	hasChattedInLast24Hrs: boolean;
};

export type LazyGridProfile = {
	type: "lazy";
	id: string;
	unread: number | null;
	isVisiting: boolean;
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

/** Columns selected from the `users` table for the grid query. */
const GRID_COLUMNS =
	"id, pseudo, nick, age, body_type, position, headline, photos, city, area, lat_coarse, lng_coarse, online, visible, hidden, incognito, status, last_active_at, created_at, height, weight, relationship_status, tag_codes, tribes, looking_for";

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

	// ── Build Supabase query against the `users` table ──
	let qb = client
		.from("users")
		.select(GRID_COLUMNS, { count: "exact" })
		.eq("visible", true)
		.eq("hidden", false)
		.eq("incognito", false)
		.neq("status", "suspended");

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

	// ── 6. Height filters (users table column is `height`, in cm) ──
	if (query.heightCmMin !== undefined) {
		qb = qb.gte("height", query.heightCmMin);
	}
	if (query.heightCmMax !== undefined) {
		qb = qb.lte("height", query.heightCmMax);
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
			displayName: p.nick ?? p.pseudo,
			age: p.age ?? null,
			position: Array.isArray(p.position)
				? (p.position as string[])[0]
				: (p.position as string | null),
			headline: p.headline ?? null,
			compatibilityScore: 50,
			isNew,
			distance,
			profilePhotosHashes: primaryImageHashes(primaryPhoto),
			unread: null,
			onlineUntil:
				p.online
					? Date.now() + 15 * 60 * 1000
					: null,
			isFavorite: favoriteIds?.has(p.id) ?? false,
			isVisiting: false,
			hasChattedInLast24Hrs: false,
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
			.from("users")
			.select(
				"id, pseudo, nick, age, position, headline, photos, lat_coarse, lng_coarse, online, incognito, last_active_at, created_at",
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
				.from("users")
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
			displayName: user.nick ?? user.pseudo,
			age: user.age ?? null,
			position: Array.isArray(user.position)
				? (user.position as string[])[0]
				: (user.position as string | null),
			headline: user.headline ?? null,
			compatibilityScore: 50,
			isNew,
			distance,
			profilePhotosHashes: primaryImageHashes(primaryPhoto),
			unread: profile.unread,
			onlineUntil: user.online
				? Date.now() + 15 * 60 * 1000
				: null,
			isFavorite,
			isVisiting: profile.isVisiting,
			hasChattedInLast24Hrs: false,
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
		isVisiting: profile.isVisiting,
		hasChattedInLast24Hrs: seed.unread > 0,
	};
}
