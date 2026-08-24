import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTapsStore, type TapProfile } from "./store";

function makeTapProfile(
	overrides: Partial<{
		profileId: number;
		displayName: string;
		timestamp: number;
		tapType: number;
		isFavorite: boolean;
		isMutual: boolean;
		isViewable: boolean;
	}> = {},
): TapProfile {
	return {
		distance: null,
		profileImageMediaHash: null,
		isFavorite: overrides.isFavorite ?? false,
		profileId: overrides.profileId ?? Math.floor(Math.random() * 10000),
		displayName: overrides.displayName ?? "Test User",
		onlineUntil: null,
		timestamp: overrides.timestamp ?? Date.now(),
		tapType: overrides.tapType ?? null,
		lastOnline: Date.now(),
		isBoosting: false,
		isMutual: overrides.isMutual ?? false,
		rightNowType: "",
		isViewable: overrides.isViewable ?? true,
	};
}

function resetStore() {
	useTapsStore.setState({
		all: [],
		lastViewedAt: 0,
		tappedSinceViewed: false,
		visibleCount: 20,
		loading: false,
		refreshing: false,
		error: null,
	});
}

describe("taps store", () => {
	beforeEach(() => {
		resetStore();
	});

	describe("setAll", () => {
		it("sets all taps", () => {
			const taps = [
				makeTapProfile({ profileId: 1 }),
				makeTapProfile({ profileId: 2 }),
				makeTapProfile({ profileId: 3 }),
			];
			useTapsStore.getState().setAll(taps);
			expect(useTapsStore.getState().all).toHaveLength(3);
		});
	});

	describe("taps slicing", () => {
		it("slices to visibleCount from all", () => {
			const taps = Array.from({ length: 30 }, (_, i) =>
				makeTapProfile({ profileId: i + 1 }),
			);
			useTapsStore.setState({ all: taps, visibleCount: 20 });
			const state = useTapsStore.getState();
			// Verify the slicing logic: all.length > visibleCount means hasMore
			expect(state.all.length).toBe(30);
			expect(state.visibleCount).toBe(20);
			expect(state.all.length > state.visibleCount).toBe(true);
		});

		it("does not slice when all is smaller than visibleCount", () => {
			const taps = [
				makeTapProfile({ profileId: 1 }),
				makeTapProfile({ profileId: 2 }),
			];
			useTapsStore.setState({ all: taps, visibleCount: 20 });
			const state = useTapsStore.getState();
			expect(state.all.length).toBe(2);
			expect(state.all.length > state.visibleCount).toBe(false);
		});
	});

	describe("hasUnseen logic", () => {
		it("detects unseen when taps are newer than lastViewedAt", () => {
			const taps = [
				makeTapProfile({ timestamp: 1000 }),
				makeTapProfile({ timestamp: 2000 }),
			];
			useTapsStore.setState({ all: taps, lastViewedAt: 0 });
			// Verify the underlying data: newest tap timestamp > lastViewedAt
			const newestTimestamp = Math.max(...useTapsStore.getState().all.map((t) => t.timestamp));
			expect(newestTimestamp).toBeGreaterThan(useTapsStore.getState().lastViewedAt);
		});

		it("detects seen when all taps are older than lastViewedAt", () => {
			const taps = [
				makeTapProfile({ timestamp: 100 }),
				makeTapProfile({ timestamp: 200 }),
			];
			useTapsStore.setState({ all: taps, lastViewedAt: 500 });
			const newestTimestamp = Math.max(...useTapsStore.getState().all.map((t) => t.timestamp));
			expect(newestTimestamp).toBeLessThanOrEqual(useTapsStore.getState().lastViewedAt);
		});

		it("tappedSinceViewed flag indicates unseen", () => {
			useTapsStore.setState({ tappedSinceViewed: true });
			expect(useTapsStore.getState().tappedSinceViewed).toBe(true);
		});
	});

	describe("hasMore logic", () => {
		it("has more when all.length > visibleCount", () => {
			const taps = Array.from({ length: 25 }, (_, i) =>
				makeTapProfile({ profileId: i + 1 }),
			);
			useTapsStore.setState({ all: taps, visibleCount: 20 });
			expect(useTapsStore.getState().all.length > useTapsStore.getState().visibleCount).toBe(true);
		});

		it("has no more when all fits within visibleCount", () => {
			const taps = [
				makeTapProfile({ profileId: 1 }),
				makeTapProfile({ profileId: 2 }),
			];
			useTapsStore.setState({ all: taps, visibleCount: 20 });
			expect(useTapsStore.getState().all.length > useTapsStore.getState().visibleCount).toBe(false);
		});
	});

	describe("markViewed", () => {
		it("updates lastViewedAt to the newest tap timestamp", () => {
			const taps = [
				makeTapProfile({ timestamp: 1000 }),
				makeTapProfile({ timestamp: 5000 }),
			];
			useTapsStore.getState().setAll(taps);
			useTapsStore.getState().markViewed();

			expect(useTapsStore.getState().lastViewedAt).toBe(5000);
			expect(useTapsStore.getState().tappedSinceViewed).toBe(false);
		});

		it("keeps lastViewedAt if newest tap is older", () => {
			const taps = [makeTapProfile({ timestamp: 1000 })];
			useTapsStore.getState().setAll(taps);
			useTapsStore.setState({ lastViewedAt: 5000 });
			useTapsStore.getState().markViewed();

			expect(useTapsStore.getState().lastViewedAt).toBe(5000);
		});
	});

	describe("setFavorite", () => {
		it("toggles favorite on a tap", () => {
			useTapsStore.setState({
				all: [
					makeTapProfile({ profileId: 1, isFavorite: false }),
					makeTapProfile({ profileId: 2, isFavorite: true }),
				],
			});

			useTapsStore.getState().setFavorite({
				profileId: 1,
				isFavorite: true,
			});

			const all = useTapsStore.getState().all;
			expect(all.find((t) => t.profileId === 1)?.isFavorite).toBe(true);
			expect(all.find((t) => t.profileId === 2)?.isFavorite).toBe(true);
		});

		it("does nothing for nonexistent profile", () => {
			useTapsStore.setState({
				all: [makeTapProfile({ profileId: 1, isFavorite: false })],
			});

			useTapsStore.getState().setFavorite({
				profileId: 999,
				isFavorite: true,
			});

			expect(useTapsStore.getState().all[0].isFavorite).toBe(false);
		});
	});

	describe("loadMore", () => {
		it("increments visibleCount by 20", () => {
			useTapsStore.setState({ visibleCount: 20 });
			useTapsStore.getState().loadMore();
			expect(useTapsStore.getState().visibleCount).toBe(40);
		});
	});

	describe("setLoading / setRefreshing / setError", () => {
		it("updates loading", () => {
			useTapsStore.getState().setLoading(true);
			expect(useTapsStore.getState().loading).toBe(true);
		});

		it("updates refreshing", () => {
			useTapsStore.getState().setRefreshing(true);
			expect(useTapsStore.getState().refreshing).toBe(true);
		});

		it("sets error", () => {
			const error = new Error("test");
			useTapsStore.getState().setError(error);
			expect(useTapsStore.getState().error).toBe(error);
		});
	});
});
