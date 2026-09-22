import { create } from "zustand";
import {
	type GridProfile,
	getGrid as fetchGrid,
	getCachedProfile,
	setCachedProfile,
	patchCachedProfile,
	resolveLazyProfile as resolveLazy,
} from "./service";
import { useGridSearchFiltersStore } from "./filters-store";
import {
	getPreferencesSnapshot,
	setPreferences,
} from "@/domains/settings/preferences";
import { autoLocation } from "@/domains/location/auto-location";
import { registerAccountCache } from "@/core/api/account-caches";
import { WEIGHT_KG_MAX, WEIGHT_KG_MIN } from "@/core/model/browse/grid/filters";

interface GridState {
	items: GridProfile[];
	nextPage: number | null;
	loadingMore: boolean;
	loading: boolean;
	refreshing: boolean;
	error: Error | null;
	currentQuery: Record<string, unknown> | null;
	scrollY: number;
	viewActive: boolean;

	errorMessage: string | null;
	load: (geohash: string) => Promise<void>;
	loadMore: () => Promise<void>;
	refresh: (opts?: { background?: boolean }) => Promise<void>;
	retry: () => void;
	reset: () => void;
	setFavorite: (args: { profileId: string; isFavorite: boolean }) => void;
	removeProfile: (profileId: string) => void;
	resolveProfile: (id: string) => Promise<void>;
	_withLiveLocation: (
		currentGeohash: string,
		token: number,
		background: boolean,
	) => Promise<string>;
	_fetchProfiles: (
		currentGeohash: string,
		opts?: { silent?: boolean; background?: boolean; sampleLocation?: boolean },
	) => Promise<void>;
	_reset: () => void;
}

let fetchToken = 0;
let geohash: string | null = null;
let retargeted: string | null = null;
const resolvingIds = new Set<string>();

export const useGridStore = create<GridState>((set, get) => ({
	items: [],
	nextPage: 0,
	loadingMore: false,
	loading: false,
	refreshing: false,
	error: null,
	currentQuery: null,
	scrollY: 0,
	viewActive: false,

	get errorMessage(): string | null {
		return get().error?.message ?? null;
	},

	setFavorite({ profileId, isFavorite }) {
		patchCachedProfile({ id: profileId, patch: { isFavorite } });
		const { items } = get();
		const index = items.findIndex((item) => item.id === profileId);
		const item = items[index];
		if (!item || item.type !== "rendered") return;
		const newItems = [...items];
		newItems[index] = { ...item, isFavorite };
		set({ items: newItems });
	},

	removeProfile(profileId) {
		const { items } = get();
		const index = items.findIndex((item) => item.id === profileId);
		if (index === -1) return;
		const newItems = [...items];
		newItems.splice(index, 1);
		set({ items: newItems });
	},

	async load(newGeohash: string) {
		if (retargeted === newGeohash) return;
		if (geohash === newGeohash && get().items.length > 0) return;
		geohash = newGeohash;
		get()._reset();
		set({ scrollY: 0 });
		await get()._fetchProfiles(newGeohash);
	},

	retry() {
		if (!geohash) return;
		get()._reset();
		set({ scrollY: 0 });
		void get()._fetchProfiles(geohash);
	},

	async refresh({ background = false } = {}) {
		const currentGeohash = geohash ?? getPreferencesSnapshot().geohash;
		if (!currentGeohash || get().refreshing) return;
		geohash = currentGeohash;
		set({ refreshing: true });
		try {
			await get()._fetchProfiles(currentGeohash, {
				silent: true,
				background,
				sampleLocation: !background || get().viewActive,
			});
		} finally {
			set({ refreshing: false });
		}
	},

	async loadMore() {
		const { loadingMore, nextPage, currentQuery } = get();
		if (loadingMore || !nextPage || !currentQuery) return;
		set({ loadingMore: true });
		const token = fetchToken;
		const query = currentQuery;
		try {
			const result = await fetchGrid({
				...query,
				pageNumber: nextPage,
			} as Parameters<typeof fetchGrid>[0]);
			if (token !== fetchToken) return;
			set((state) => ({
				items: [...state.items, ...result.items],
				nextPage: result.nextPage,
			}));
		} catch (error) {
			console.error(error);
		} finally {
			set({ loadingMore: false });
		}
	},

	async resolveProfile(id: string) {
		if (resolvingIds.has(id)) return;
		resolvingIds.add(id);
		const token = fetchToken;
		try {
			const { items } = get();
			const item = items.find((i) => i.id === id);
			if (!item || item.type !== "lazy") return;

			const cached = getCachedProfile(id);
			if (cached) {
				const idx = items.findIndex((i) => i.id === id);
				if (idx !== -1) {
					const newItems = [...items];
					newItems[idx] = cached;
					set({ items: newItems });
				}
				return;
			}

			const resolved = await resolveLazy(item);
			if (token !== fetchToken) return;
			const currentItems = get().items;
			const idx = currentItems.findIndex((i) => i.id === id);
			if (idx === -1) return;
			const newItems = [...currentItems];
			if (resolved) {
				setCachedProfile(resolved);
				newItems[idx] = resolved;
				set({ items: newItems });
			} else {
				newItems.splice(idx, 1);
				set({ items: newItems });
			}
		} catch (error) {
			console.error(id, error);
		} finally {
			resolvingIds.delete(id);
		}
	},

	async _withLiveLocation(
		currentGeohash: string,
		token: number,
		background: boolean,
	): Promise<string> {
		const resolved = await autoLocation.resolveGeohash(currentGeohash, {
			background,
		});
		if (token !== fetchToken || resolved === currentGeohash)
			return currentGeohash;
		geohash = resolved;
		retargeted = resolved;
		setPreferences({ geohash: resolved }).catch((error: unknown) =>
			console.error(error),
		);
		return resolved;
	},

	async _fetchProfiles(
		currentGeohash: string,
		opts?: {
			silent?: boolean;
			background?: boolean;
			sampleLocation?: boolean;
		},
	): Promise<void> {
		const token = ++fetchToken;
		retargeted = null;
		try {
			if (opts?.sampleLocation ?? true) {
				currentGeohash = await get()._withLiveLocation(
					currentGeohash,
					token,
					opts?.background ?? false,
				);
				if (token !== fetchToken) return;
			}
			const filters = useGridSearchFiltersStore.getState().value;
			const query = {
				nearbyGeoHash: currentGeohash,
				favorites: filters?.isFavorite || undefined,
				onlineOnly: filters?.isOnline || undefined,
				rightNow: filters?.isRightNow || undefined,
				...(filters?.ageEnabled && {
					ageMin: filters?.age[0],
					ageMax: filters?.age[1],
				}),
				...(filters?.genderEnabled && { genders: filters?.genders }),
				...(filters?.positionEnabled && {
					sexualPositions: filters?.positions,
				}),
				...(filters?.photosEnabled &&
					filters?.photos.includes("has-photos") && {
						photoOnly: true,
					}),
				...(filters?.photosEnabled &&
					filters?.photos.includes("has-albums") && {
						hasAlbum: true,
					}),
				...(filters?.photosEnabled &&
					filters?.photos.includes("has-face-pics") && {
						faceOnly: true,
					}),
				...(filters?.tribesEnabled && { tribes: filters?.tribes }),
				...(filters?.bodyTypesEnabled && {
					bodyTypes: filters?.bodyTypes,
				}),
				...(filters?.heightEnabled && {
					heightCmMin: filters?.height[0],
					heightCmMax: filters?.height[1],
				}),
				...(filters?.weightEnabled && {
					weightGramsMin: (filters?.weight[0] ?? WEIGHT_KG_MIN) * 1000,
					weightGramsMax: (filters?.weight[1] ?? WEIGHT_KG_MAX) * 1000,
				}),
				...(filters?.relationshipStatusesEnabled && {
					relationshipStatuses: filters?.relationshipStatuses,
				}),
				...(filters?.acceptNSFWPicsEnabled &&
					filters?.acceptNSFWPics !== undefined && {
						nsfwPics: filters?.acceptNSFWPics,
					}),
				...(filters?.lookingForEnabled && {
					lookingFor: filters?.lookingFor,
				}),
				...(filters?.meetAtEnabled && { meetAt: filters?.meetAt }),
				notRecentlyChatted: filters?.haventChattedTodayEnabled || undefined,
				...(filters?.healthPracticesEnabled && {
					sexualHealth: filters?.healthPractices,
				}),
				...(filters?.tagsEnabled && filters?.tags && { tags: filters?.tags }),
				fresh: filters?.isFresh || undefined,
			};
			const result = await fetchGrid(query as Parameters<typeof fetchGrid>[0]);
			if (token !== fetchToken) return;
			resolvingIds.clear();
			set({
				currentQuery: query,
				items: result.items,
				nextPage: result.nextPage,
				error: null,
				loading: false,
			});
		} catch (err) {
			if (token !== fetchToken) return;
			console.error(err);
			set({ loading: false });
			if (opts?.background) return;
			if (opts?.silent) {
				return;
			}
			set({
				error:
					err instanceof Error
						? err
						: new Error("Failed to fetch profiles", { cause: err }),
			});
		}
	},

	_reset() {
		set({
			items: [],
			nextPage: 0,
			loadingMore: false,
			loading: true,
			refreshing: false,
			error: null,
			currentQuery: null,
			scrollY: 0,
			viewActive: false,
		});
		resolvingIds.clear();
	},
	reset() {
		get()._reset();
	},
}));

registerAccountCache({ reset: () => useGridStore.getState().reset() });
