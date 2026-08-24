import { create } from 'zustand';

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
	load: () => Promise<void>;
	markViewed: () => void;
	setFavorite: (args: { profileId: number; isFavorite: boolean }) => void;
	loadMore: () => void;
	setLoading: (loading: boolean) => void;
	setRefreshing: (refreshing: boolean) => void;
	setError: (error: Error | null) => void;
}

function getNewestTapAt(all: TapProfile[]): number {
	let newest = 0;
	for (const tap of all) {
		if (tap.timestamp > newest) newest = tap.timestamp;
	}
	return newest;
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
		const newestTapAt = getNewestTapAt(all);
		return tappedSinceViewed || newestTapAt > lastViewedAt;
	},

	get hasMore(): boolean {
		return get().visibleCount < get().all.length;
	},

	setAll: (all) => set({ all }),

	async load() {
		set({ loading: true, error: null });
		try {
			const { getReceivedTaps } = await import("#/core/api/supabase/index");
			const { demoRoute } = await import("#/domains/demo/router");

			// Try Supabase first
			const taps = await getReceivedTaps();

			if (taps.length > 0) {
				const converted: TapProfile[] = taps.map((t) => ({
					distance: t.distance,
					profileImageMediaHash: t.profileImageMediaHash,
					isFavorite: t.isFavorite,
					profileId: t.profileId,
					displayName: t.displayName,
					onlineUntil: t.onlineUntil
						? new Date(t.onlineUntil).getTime()
						: null,
					timestamp: new Date(t.timestamp).getTime(),
					tapType: t.tapType,
					lastOnline: new Date(t.lastOnline).getTime(),
					isBoosting: t.isBoosting,
					isMutual: t.isMutual,
					rightNowType: t.rightNowType,
					isViewable: t.isViewable,
				}));
				set({ all: converted, loading: false });
				return;
			}

			// Fallback to demo data
			const resp = demoRoute({
				path: "/v2/taps/received",
				method: "GET",
				body: null,
			});
			const data = resp.body as { profiles: Array<Record<string, unknown>> };
			const demoTaps: TapProfile[] = data.profiles.map((p) => ({
				distance: (p.distance as number) ?? null,
				profileImageMediaHash: (p.profileImageMediaHash as string) ?? null,
				isFavorite: (p.isFavorite as boolean) ?? false,
				profileId: p.profileId as number,
				displayName: (p.displayName as string) ?? null,
				onlineUntil: typeof p.onlineUntil === "number" ? p.onlineUntil : null,
				timestamp: p.timestamp as number,
				tapType: (p.tapType as number) ?? 0,
				lastOnline: p.lastOnline as number,
				isBoosting: (p.isBoosting as boolean) ?? false,
				isMutual: (p.isMutual as boolean) ?? false,
				rightNowType: (p.rightNowType as string) ?? "",
				isViewable: (p.isViewable as boolean) ?? true,
			}));
			set({ all: demoTaps, loading: false });
		} catch (err) {
			set({
				error:
					err instanceof Error
						? err
						: new Error("Failed to load taps"),
				loading: false,
			});
		}
	},

	markViewed() {
		const { all, lastViewedAt } = get();
		const newestTapAt = getNewestTapAt(all);
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
		const newAll = [...all.slice(0, index), { ...tap, isFavorite }, ...all.slice(index + 1)];
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
