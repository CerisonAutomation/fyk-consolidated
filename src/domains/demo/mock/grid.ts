import {
	DEMO_ID_START,
	DEMO_PROFILE_COUNT,
	GRID_PAGE_SIZE,
} from '../config';
import {
	type DemoSeed,
	distanceForId,
	lastOnlineOf,
	onlineUntilOf,
	photosOf,
	profileSeed,
} from './profiles';

const demoFavoriteSet = new Set<number>([100001, 100013]);

export function demoFavoriteOf({ profileId }: { profileId: number; seed?: boolean }): boolean {
	return demoFavoriteSet.has(profileId);
}

function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash + char) | 0;
	}
	return hash;
}

function mulberry32(seed: number): () => number {
	return () => {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function num(value: string | null): number | undefined {
	if (value === null) return undefined;
	const n = Number(value);
	return Number.isFinite(n) ? n : undefined;
}

export { num };

function cascadeProfileData(seed: DemoSeed) {
	const photos = photosOf(seed.id);
	return {
		profileId: seed.id,
		onlineUntil: onlineUntilOf(seed),
		displayName: seed.name,
		distanceMeters: seed.distanceM ?? undefined,
		lastOnline: lastOnlineOf(seed),
		rightNow: 'NOT_ACTIVE',
		unreadCount: seed.unread,
		isVisiting: false,
		isPopular: seed.favorite || seed.unread > 0,
		primaryImageUrl: photos[0]
			? `https://cdns.grindr.com/images/profile/480x480/${photos[0]}`
			: undefined,
		favorite: demoFavoriteOf({ profileId: seed.id }),
		viewed: false,
		chatted: seed.unread > 0,
		roaming: false,
		age: seed.age ?? undefined,
		heightCm: seed.heightCm ?? undefined,
		weightGrams: seed.weightG ?? undefined,
		bodyType: seed.body ?? undefined,
	};
}

function cascadeFullItem(seed: DemoSeed) {
	return { type: 'full_profile_v1', data: cascadeProfileData(seed) };
}

function cascadePartialItem(seed: DemoSeed) {
	return {
		type: 'partial_profile_v1',
		data: {
			...cascadeProfileData(seed),
			upsellItemType: 'FREE_PROFILE_LIMIT',
		},
	};
}

const demoGridOrder: number[] = (() => {
	const ids = Array.from(
		{ length: DEMO_PROFILE_COUNT },
		(_, i) => DEMO_ID_START + i,
	);
	const distances = new Map(ids.map((id) => [id, distanceForId(id)]));
	return ids.sort((a, b) => distances.get(a)! - distances.get(b)! || a - b);
})();

function isPartialId(id: number): boolean {
	return id % 9 === 0;
}

function filteredGridIds(params: URLSearchParams): number[] {
	const favorites = params.get('favorites') === 'true';
	const onlineOnly = params.get('onlineOnly') === 'true';
	const ageMin = num(params.get('ageMin'));
	const ageMax = num(params.get('ageMax'));
	if (!favorites && !onlineOnly && ageMin === undefined && ageMax === undefined) {
		return demoGridOrder;
	}
	return demoGridOrder.filter((id) => {
		const seed = profileSeed(id);
		if (favorites && !demoFavoriteOf({ profileId: id })) return false;
		if (onlineOnly && !seed.online) return false;
		if (ageMin !== undefined && (seed.age === null || seed.age < ageMin)) return false;
		if (ageMax !== undefined && (seed.age === null || seed.age > ageMax)) return false;
		return true;
	});
}

export function demoCascadeV4(params: URLSearchParams) {
	const page = num(params.get('pageNumber')) ?? 0;
	const ids = filteredGridIds(params);
	const start = page * GRID_PAGE_SIZE;
	const slice = ids.slice(start, start + GRID_PAGE_SIZE);
	const items = slice.map((id) => {
		const seed = profileSeed(id);
		return isPartialId(id)
			? cascadePartialItem(seed)
			: cascadeFullItem(seed);
	});
	return {
		items,
		nextPage: start + GRID_PAGE_SIZE < ids.length ? page + 1 : null,
		shuffled: false,
		hiddenProfiles: null,
		hiddenProfileInfo: null,
	};
}

export function demoGetProfiles(profileIds: number[]) {
	return profileIds
		.map((id) => {
			const seed = profileSeed(id);
			const photos = photosOf(id);
			return {
				profileId: id,
				displayName: seed.name,
				age: seed.age,
				distance: seed.distanceM ?? null,
				medias: photos.length > 0 ? photos.map((mediaHash) => ({ mediaHash })) : null,
			};
		});
}

export function demoSearchProfiles(params: URLSearchParams) {
	const ids = filteredGridIds(params).slice(0, GRID_PAGE_SIZE);
	return ids.map((id) => {
		const photos = photosOf(id);
		const seed = profileSeed(id);
		return {
			profileId: id,
			displayName: seed.name,
			age: seed.age,
			distance: seed.distanceM ?? null,
			medias: photos.length > 0 ? photos.map((mediaHash) => ({ mediaHash })) : null,
		};
	});
}

export function demoMyUploadedPhotos() {
	return {
		medias: photosOf(123456000).map((mediaHash) => ({
			mediaHash,
			type: 1,
			state: 2,
		})),
	};
}
