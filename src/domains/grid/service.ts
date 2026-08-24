import { TtlCache } from '#/core/lib/ttl-cache';

export type RenderedGridProfile = {
	type: 'rendered';
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
	type: 'lazy';
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
	const hash = url?.split('/').pop();
	return hash ? [hash] : null;
}

export function gridProfile(profile: {
	profileId: number;
	displayName?: string | null;
	distanceMeters?: number | null;
	primaryImageUrl?: string | null;
	unreadCount?: number;
	onlineUntil?: number | null;
	favorite?: boolean;
	isVisiting?: boolean;
	chatted?: boolean;
}): GridProfile {
	const { favorite, chatted } = profile;
	if (favorite === undefined || chatted === undefined) {
		return {
			type: 'lazy',
			id: profile.profileId,
			unread: profile.unreadCount ?? 0,
			isVisiting: profile.isVisiting ?? false,
		};
	}
	return {
		type: 'rendered',
		id: profile.profileId,
		displayName: profile.displayName ?? null,
		distance: profile.distanceMeters ?? null,
		profilePhotosHashes: primaryImageHashes(profile.primaryImageUrl),
		unread: profile.unreadCount ?? null,
		onlineUntil: profile.onlineUntil ?? null,
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
	// This will be wired to the actual API transport layer
	// For now, return empty results
	return { items: [], nextPage: null, shuffled: false };
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
	// This will be wired to the actual API transport layer
	return null;
}
