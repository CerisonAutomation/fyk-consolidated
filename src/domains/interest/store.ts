import { create } from "zustand";

export interface TapProfile {
	distance: number | null;
	profileImageMediaHash: string | null;
	isFavorite: boolean;
	profileId: number;
	displayName: string | null;
	onlineUntil: number | null;
	timestamp: number;
	tapType: number | null;
	lastOnline: number;
	isBoosting: boolean;
	isMutual: boolean;
	rightNowType: string;
	isViewable: boolean;
}

interface TapsState {
	all: TapProfile[];
	lastViewedAt: number;
	tappedSinceViewed: boolean;
	visibleCount: number;
	loading: boolean;
	refreshing: boolean;
	error: Error | null;

	taps: TapProfile[];
	hasUnseen: boolean;
	hasMore: boolean;

	setAll: (taps: TapProfile[]) => void;
	markViewed: () => void;
	setFavorite: (args: { profileId: number; isFavorite: boolean }) => void;
	loadMore: () => void;
	setLoading: (loading: boolean) => void;
	setRefreshing: (refreshing: boolean) => void;
	setError: (error: Error | null) => void;
}

export const useTapsStore = create<TapsState>((set, get) => ({
	all: [],
	lastViewedAt: 0,
	tappedSinceViewed: false,
	visibleCount: 20,
	loading: true,
	refreshing: false,
	error: null,

	get taps(): TapProfile[] {
		return get().all.slice(0, get().visibleCount);
	},

	get hasUnseen(): boolean {
		const { tappedSinceViewed, all, lastViewedAt } = get();
		const newestTapAt = all.reduce(
			(newest, tap) => Math.max(newest, tap.timestamp),
			0,
		);
		return tappedSinceViewed || newestTapAt > lastViewedAt;
	},

	get hasMore(): boolean {
		return get().visibleCount < get().all.length;
	},

	setAll: (all) => set({ all }),

	markViewed() {
		const { all, lastViewedAt } = get();
		const newestTapAt = all.reduce(
			(newest, tap) => Math.max(newest, tap.timestamp),
			0,
		);
		set({
			tappedSinceViewed: false,
			lastViewedAt: Math.max(lastViewedAt, newestTapAt),
		});
	},

	setFavorite({ profileId, isFavorite }) {
		const { all } = get();
		const index = all.findIndex((tap) => tap.profileId === profileId);
		const tap = all[index];
		if (!tap) return;
		const newAll = [...all];
		newAll[index] = { ...tap, isFavorite };
		set({ all: newAll });
	},

	loadMore() {
		const { visibleCount } = get();
		set({ visibleCount: visibleCount + 20 });
	},

	setLoading: (loading) => set({ loading }),
	setRefreshing: (refreshing) => set({ refreshing }),
	setError: (error) => set({ error }),
}));
