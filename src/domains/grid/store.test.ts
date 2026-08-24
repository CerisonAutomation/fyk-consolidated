import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies before importing the store
vi.mock("./service", () => ({
	getGrid: vi.fn(),
	getCachedProfile: vi.fn(),
	setCachedProfile: vi.fn(),
	patchCachedProfile: vi.fn(),
	resolveLazyProfile: vi.fn(),
}));

vi.mock("./filters-store", () => ({
	useGridSearchFiltersStore: {
		getState: vi.fn(() => ({
			value: null,
			reset: vi.fn(),
		})),
	},
}));

vi.mock("#/domains/settings/preferences", () => ({
	getPreferencesSnapshot: vi.fn(() => ({ geohash: "abc123" })),
	setPreferences: vi.fn(),
}));

vi.mock("#/domains/location/auto-location", () => ({
	autoLocation: {
		resolveGeohash: vi.fn(async (gh: string) => gh),
	},
}));

vi.mock("#/core/api/account-caches", () => ({
	registerAccountCache: vi.fn(),
}));

vi.mock("#/core/model/browse/grid/filters", () => ({
	WEIGHT_KG_MIN: 30,
	WEIGHT_KG_MAX: 273,
}));

import { useGridStore } from "./store";
import { getGrid } from "./service";
import { autoLocation } from "#/domains/location/auto-location";
import { getPreferencesSnapshot } from "#/domains/settings/preferences";

const mockGetGrid = vi.mocked(getGrid);
const mockAutoLocation = vi.mocked(autoLocation);
const mockGetPreferencesSnapshot = vi.mocked(getPreferencesSnapshot);

describe("grid store", () => {
	beforeEach(() => {
		// Use store's reset() which clears the module-level geohash variable
		useGridStore.getState().reset();
		mockGetGrid.mockReset();
		mockGetPreferencesSnapshot.mockReturnValue({ geohash: "abc123" } as never);
		mockAutoLocation.resolveGeohash.mockImplementation(
			async (gh: string) => gh,
		);
	});

	describe("load", () => {
		it("sets loading state and fetches profiles", async () => {
			mockGetGrid.mockResolvedValue({
				items: [{ id: 1, type: "rendered" } as never],
				nextPage: 2,
			});

			useGridStore.getState().load("abc123");

			// Should immediately set loading state
			expect(useGridStore.getState().loading).toBe(true);

			// Wait for async fetch to complete
			await vi.waitFor(() => {
				expect(useGridStore.getState().loading).toBe(false);
			});

			expect(useGridStore.getState().items).toHaveLength(1);
			expect(useGridStore.getState().nextPage).toBe(2);
			expect(useGridStore.getState().error).toBeNull();
		});

		it("sets error on fetch failure", async () => {
			mockGetGrid.mockRejectedValue(new Error("Network error"));

			useGridStore.getState().load("abc123");

			await vi.waitFor(() => {
				expect(useGridStore.getState().loading).toBe(false);
			});

			expect(useGridStore.getState().error).toBeInstanceOf(Error);
			expect(useGridStore.getState().error?.message).toBe("Network error");
		});

		it("skips load if already loaded with items for same geohash", async () => {
			mockGetGrid.mockResolvedValue({
				items: [{ id: 1, type: "rendered" } as never],
				nextPage: null,
			});

			// First load
			useGridStore.getState().load("abc123");
			await vi.waitFor(() => {
				expect(useGridStore.getState().loading).toBe(false);
			});

			mockGetGrid.mockClear();

			// Second load with same geohash should be skipped
			useGridStore.getState().load("abc123");
			expect(mockGetGrid).not.toHaveBeenCalled();
		});
	});

	describe("refresh", () => {
		it("refreshes with background=false by default", async () => {
			mockGetGrid.mockResolvedValue({
				items: [{ id: 1, type: "rendered" } as never],
				nextPage: null,
			});

			await useGridStore.getState().refresh();

			await vi.waitFor(() => {
				expect(useGridStore.getState().refreshing).toBe(false);
			});
		});

		it("sets refreshing state during refresh", async () => {
			mockGetGrid.mockImplementation(
				() =>
					new Promise((resolve) =>
						setTimeout(
							() => resolve({ items: [] as never[], nextPage: null }),
							50,
						),
					),
			);

			const refreshPromise = useGridStore.getState().refresh();
			expect(useGridStore.getState().refreshing).toBe(true);

			await refreshPromise;
			expect(useGridStore.getState().refreshing).toBe(false);
		});

		it("does nothing if no geohash is available", async () => {
			// Reset to clear module-level geohash
			useGridStore.getState().reset();

			// Mock preferences to return no geohash
			mockGetPreferencesSnapshot.mockReturnValue({} as never);

			await useGridStore.getState().refresh();
			expect(useGridStore.getState().refreshing).toBe(false);
			expect(mockGetGrid).not.toHaveBeenCalled();
		});
	});

	describe("retry", () => {
		it("resets state and fetches again", async () => {
			// First load to set geohash
			mockGetGrid.mockRejectedValueOnce(new Error("fail"));
			useGridStore.getState().load("abc123");
			await vi.waitFor(() => {
				expect(useGridStore.getState().error).not.toBeNull();
			});

			// Retry
			mockGetGrid.mockResolvedValueOnce({
				items: [{ id: 2, type: "rendered" } as never],
				nextPage: null,
			});
			useGridStore.getState().retry();

			await vi.waitFor(() => {
				expect(useGridStore.getState().loading).toBe(false);
			});

			expect(useGridStore.getState().items).toHaveLength(1);
			expect(useGridStore.getState().error).toBeNull();
		});
	});

	describe("setFavorite", () => {
		it("updates favorite on an item", () => {
			useGridStore.setState({
				items: [
					{ id: 1, type: "rendered", isFavorite: false } as never,
				],
			});

			useGridStore.getState().setFavorite({
				profileId: 1,
				isFavorite: true,
			});

			const item = useGridStore.getState().items[0] as Record<string, unknown>;
			expect(item.isFavorite).toBe(true);
		});
	});

	describe("removeProfile", () => {
		it("removes a profile by id", () => {
			useGridStore.setState({
				items: [
					{ id: 1, type: "rendered" } as never,
					{ id: 2, type: "rendered" } as never,
				],
			});

			useGridStore.getState().removeProfile(1);
			expect(useGridStore.getState().items).toHaveLength(1);
			expect(useGridStore.getState().items[0].id).toBe(2);
		});

		it("does nothing if profile not found", () => {
			useGridStore.setState({
				items: [{ id: 1, type: "rendered" } as never],
			});

			useGridStore.getState().removeProfile(999);
			expect(useGridStore.getState().items).toHaveLength(1);
		});
	});

	describe("reset", () => {
		it("clears all state", () => {
			useGridStore.setState({
				items: [{ id: 1, type: "rendered" } as never],
				loading: false,
				error: new Error("test"),
				scrollY: 100,
			});

			useGridStore.getState().reset();

			const state = useGridStore.getState();
			expect(state.items).toEqual([]);
			expect(state.loading).toBe(false);
			expect(state.error).toBeNull();
			expect(state.scrollY).toBe(0);
		});
	});
});
