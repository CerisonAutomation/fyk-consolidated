import { TtlCache } from "#/core/lib/ttl-cache";
import { getSupabase } from "#/integrations/supabase/client";

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

	let qb = client
		.from("users")
		.select("id, pseudo, nick, age, body_type, position, headline, photos, city, area, lat_coarse, lng_coarse, online, visible, hidden, incognito, last_active_at, created_at", { count: "exact" })
		.eq("visible", true)
		.eq("hidden", false)
		.eq("incognito", false)
		.neq("status", "suspended")
		.order("last_active_at", { ascending: false })
		.range(from, to);

	if (query.onlineOnly) {
		qb = qb.eq("online", true);
	}
	if (query.ageMin !== undefined) {
		qb = qb.gte("age", query.ageMin);
	}
	if (query.ageMax !== undefined) {
		qb = qb.lte("age", query.ageMax);
	}
	if (query.tribes && query.tribes.length > 0) {
		qb = qb.overlaps("tribes", query.tribes);
	}
	if (query.bodyTypes && query.bodyTypes.length > 0) {
		qb = qb.in("body_type", query.bodyTypes);
	}
	if (query.lookingFor && query.lookingFor.length > 0) {
		qb = qb.overlaps("looking_for", query.lookingFor);
	}

	const { data: profiles, count } = await qb;

	if (!profiles) {
		return { items: [], nextPage: null, shuffled: false };
	}

	const items: GridProfile[] = profiles.map((p) => {
		const photos = (p.photos as string[] | null) ?? [];
		const primaryPhoto = photos[0] ?? null;
		const createdAt = new Date(p.created_at);
		const isNew = Date.now() - createdAt.getTime() < 7 * 24 * 60 * 60 * 1000;

		return {
			type: "rendered" as const,
			id: p.id,
			displayName: p.nick ?? p.pseudo,
			age: p.age ?? null,
			position: Array.isArray(p.position) ? p.position[0] : p.position,
			headline: p.headline ?? null,
			compatibilityScore: 50,
			isNew,
			distance: null,
			profilePhotosHashes: primaryImageHashes(primaryPhoto),
			unread: null,
			onlineUntil: p.online ? Date.now() + 30 * 60 * 1000 : null,
			isFavorite: false,
			isVisiting: false,
			hasChattedInLast24Hrs: false,
		};
	});

	const hasMore = count !== null ? from + pageSize < count : profiles.length === pageSize;

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

export async function resolveLazyProfile(
	profile: LazyGridProfile,
): Promise<RenderedGridProfile | null> {
	const { demoEnabled } = await import("#/domains/demo/config");

	// ── Production path: fetch real data from Supabase ──
	if (!demoEnabled) {
		const client = getSupabase();
		if (!client) return null;

		const { data: user } = await client
			.from("users")
			.select("id, pseudo, nick, age, position, headline, photos, lat_coarse, lng_coarse, online, visible, hidden, incognito, last_active_at, created_at")
			.eq("id", profile.id)
			.single();

		if (!user) return null;

		const photos = (user.photos as string[] | null) ?? [];
		const primaryPhoto = photos[0] ?? null;
		const createdAt = new Date(user.created_at);
		const isNew = Date.now() - createdAt.getTime() < 7 * 24 * 60 * 60 * 1000;

		return {
			type: "rendered",
			id: profile.id,
			displayName: user.nick ?? user.pseudo,
			age: user.age ?? null,
			position: Array.isArray(user.position) ? user.position[0] : user.position,
			headline: user.headline ?? null,
			compatibilityScore: 50,
			isNew,
			distance: null,
			profilePhotosHashes: primaryImageHashes(primaryPhoto),
			unread: profile.unread,
			onlineUntil: user.online ? Date.now() + 30 * 60 * 1000 : null,
			isFavorite: false,
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
		compatibilityScore: 58 + ((Number(profile.id) % 39)),
		isNew: (Number(profile.id) % 11) === 0,
		distance: seed.distanceM,
		profilePhotosHashes: photos.length > 0 ? photos : null,
		unread: profile.unread,
		onlineUntil: onlineUntilOf(seed),
		isFavorite: demoFavoriteOf({ profileId: Number(profile.id) }),
		isVisiting: profile.isVisiting,
		hasChattedInLast24Hrs: seed.unread > 0,
	};
}
