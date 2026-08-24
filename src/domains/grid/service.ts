import { TtlCache } from "#/core/lib/ttl-cache";
import { getGridProfiles } from "#/core/api/supabase/index";

export type RenderedGridProfile = {
	type: "rendered";
	id: number;
	displayName: string | null;
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
	id: number;
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
	if (!url) return null;
	const parts = url.split("/");
	const hash = parts[parts.length - 1];
	return hash ? [hash] : null;
}

export function gridProfile(profile: {
	profileId: number;
	displayName?: string | null;
	distanceMeters?: number | null;
	primaryImageUrl?: string | null;
	unreadCount?: number;
	onlineUntil?: number | string | null;
	favorite?: boolean;
	isVisiting?: boolean;
	chatted?: boolean;
}): GridProfile {
	const { favorite, chatted } = profile;
	if (favorite === undefined || chatted === undefined) {
		return {
			type: "lazy",
			id: profile.profileId,
			unread: profile.unreadCount ?? 0,
			isVisiting: profile.isVisiting ?? false,
		};
	}
	return {
		type: "rendered",
		id: profile.profileId,
		displayName: profile.displayName ?? null,
		distance: profile.distanceMeters ?? null,
		profilePhotosHashes: primaryImageHashes(profile.primaryImageUrl),
		unread: profile.unreadCount ?? null,
		onlineUntil:
			typeof profile.onlineUntil === "string"
				? new Date(profile.onlineUntil).getTime()
				: (profile.onlineUntil ?? null),
		isFavorite: favorite,
		isVisiting: profile.isVisiting ?? false,
		hasChattedInLast24Hrs: chatted,
	};
}

export async function getGrid(query: {
	nearbyGeoHash?: string;
	pageNumber?: number;
	favorites?: boolean;
	onlineOnly?: boolean;
	rightNow?: boolean;
	ageMin?: number;
	ageMax?: number;
}): Promise<GridResponse> {
	// Try Supabase first
	const result = await getGridProfiles({
		nearbyGeoHash: query.nearbyGeoHash,
		pageNumber: query.pageNumber,
		favorites: query.favorites,
		onlineOnly: query.onlineOnly,
		ageMin: query.ageMin,
		ageMax: query.ageMax,
	});

	// If Supabase has data, use it
	if (result.items.length > 0) {
		const items: GridProfile[] = result.items.map((item) => {
			const isPartial = item.type === "partial_profile_v1";
			if (isPartial) {
				return {
					type: "lazy" as const,
					id: item.data.profileId,
					unread: item.data.unreadCount,
					isVisiting: item.data.isVisiting,
				};
			}
			return gridProfile({
				profileId: item.data.profileId,
				displayName: item.data.displayName,
				distanceMeters: item.data.distanceMeters,
				primaryImageUrl: item.data.primaryImageUrl,
				unreadCount: item.data.unreadCount,
				onlineUntil: item.data.onlineUntil,
				favorite: item.data.favorite,
				isVisiting: item.data.isVisiting,
				chatted: item.data.chatted,
			});
		});

		return {
			items,
			nextPage: result.nextPage,
			shuffled: false,
		};
	}

	// Fallback to demo data
	const { demoRoute } = await import("#/domains/demo/router");
	const params = new URLSearchParams();
	if (query.pageNumber !== undefined)
		params.set("pageNumber", String(query.pageNumber));
	if (query.favorites) params.set("favorites", "true");
	if (query.onlineOnly) params.set("onlineOnly", "true");
	if (query.ageMin !== undefined)
		params.set("ageMin", String(query.ageMin));
	if (query.ageMax !== undefined)
		params.set("ageMax", String(query.ageMax));

	const resp = demoRoute({
		path: `/v4/cascade?${params.toString()}`,
		method: "GET",
		body: null,
	});
	const data = resp.body as {
		items: Array<{ type: string; data: Record<string, unknown> }>;
		nextPage: number | null;
		shuffled: boolean;
	};

	const demoItems: GridProfile[] = data.items.map((item) => {
		const d = item.data;
		if (item.type === "partial_profile_v1") {
			return {
				type: "lazy" as const,
				id: d.profileId as number,
				unread: (d.unreadCount as number) ?? 0,
				isVisiting: (d.isVisiting as boolean) ?? false,
			};
		}
		return gridProfile({
			profileId: d.profileId as number,
			displayName: d.displayName as string | null,
			distanceMeters: d.distanceMeters as number | null,
			primaryImageUrl: d.primaryImageUrl as string | null,
			unreadCount: d.unreadCount as number,
			onlineUntil: d.onlineUntil as number | null,
			favorite: d.favorite as boolean,
			isVisiting: d.isVisiting as boolean,
			chatted: d.chatted as boolean,
		});
	});

	return {
		items: demoItems,
		nextPage: data.nextPage,
		shuffled: data.shuffled,
	};
}

const profileCache = new TtlCache<number, RenderedGridProfile>({
	ttlMs: 60_000,
});

export function getCachedProfile(id: number): RenderedGridProfile | null {
	return profileCache.get(id);
}

export function setCachedProfile(profile: RenderedGridProfile): void {
	profileCache.set(profile.id, profile);
}

export function patchCachedProfile({
	id,
	patch,
}: {
	id: number;
	patch: Partial<RenderedGridProfile>;
}): void {
	profileCache.update(id, (profile) => ({ ...profile, ...patch }));
}

export async function resolveLazyProfile(
	profile: LazyGridProfile,
): Promise<RenderedGridProfile | null> {
	const { getProfileById } = await import("#/core/api/supabase/index");
	const dbProfile = await getProfileById(profile.id);
	if (!dbProfile) return null;

	const { getPhotosForProfile } = await import("#/core/api/supabase/index");
	const photos = await getPhotosForProfile(profile.id);
	const primaryHash = photos[0]?.hash;

	return {
		type: "rendered",
		id: dbProfile.id,
		displayName: dbProfile.displayName,
		distance: null,
		profilePhotosHashes: primaryHash ? [primaryHash] : null,
		unread: dbProfile.unreadCount,
		onlineUntil: dbProfile.onlineUntil
			? new Date(dbProfile.onlineUntil).getTime()
			: null,
		isFavorite: dbProfile.isFavorite,
		isVisiting: dbProfile.isVisiting,
		hasChattedInLast24Hrs: dbProfile.hasChatted24h,
	};
}
