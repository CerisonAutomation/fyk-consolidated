import { describe, it, expect, beforeEach } from "vitest";
import {
	getPreferences,
	setPreferences,
	clearAccountPreferences,
	getPreferencesSnapshot,
	preferencesLoaded,
} from "#/domains/settings/preferences";

// Mock localStorage for Node.js test environment
const storage = new Map<string, string>();
const mockLocalStorage = {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => {
		storage.set(key, value);
	},
	removeItem: (key: string) => {
		storage.delete(key);
	},
	clear: () => {
		storage.clear();
	},
};

Object.defineProperty(globalThis, "localStorage", {
	value: mockLocalStorage,
	writable: true,
});

describe("preferences persistence", () => {
	beforeEach(() => {
		storage.clear();
	});

	it("returns default preferences when localStorage is empty", async () => {
		const prefs = await getPreferences();
		expect(prefs.units).toBe("metric");
		expect(prefs.autoUpdateLocation).toBe(false);
		expect(prefs.geohash).toBeNull();
		expect(prefs.onboardingComplete).toBe(false);
		expect(prefs.showDistance).toBe(true);
		expect(prefs.showOnlineStatus).toBe(true);
		expect(prefs.stayOnline).toBe(true);
	});

	it("persists and retrieves preferences", async () => {
		await setPreferences({ units: "imperial" });
		const prefs = await getPreferences();
		expect(prefs.units).toBe("imperial");
	});

	it("merges partial preference updates", async () => {
		await setPreferences({ units: "imperial" });
		await setPreferences({ autoUpdateLocation: true });

		const prefs = await getPreferences();
		expect(prefs.units).toBe("imperial");
		expect(prefs.autoUpdateLocation).toBe(true);
	});

	it("clearAccountPreferences resets account-scoped fields", async () => {
		// Use a valid 12-character geohash for the geohash field
		const validGeohash = "dr5ru10y0s1y";

		await setPreferences({
			units: "imperial",
			autoUpdateLocation: true,
			geohash: validGeohash,
		});

		await clearAccountPreferences();

		const prefs = await getPreferences();
		// Account-scoped fields should be cleared
		expect(prefs.autoUpdateLocation).toBe(false);
		expect(prefs.geohash).toBeNull();
		// Non-account-scoped fields should be preserved
		expect(prefs.units).toBe("imperial");
	});

	it("getPreferencesSnapshot returns current state", () => {
		const snapshot = getPreferencesSnapshot();
		expect(snapshot).toBeDefined();
		expect(typeof snapshot.units).toBe("string");
	});

	it("preferencesLoaded returns a boolean", () => {
		const loaded = preferencesLoaded();
		expect(typeof loaded).toBe("boolean");
	});

	it("setPreferences validates and rejects invalid values", async () => {
		await expect(
			setPreferences({ units: "invalid-system" as "metric" | "imperial" }),
		).rejects.toThrow();
	});

	it("setPreferences accepts valid units values", async () => {
		await setPreferences({ units: "metric" });
		let prefs = await getPreferences();
		expect(prefs.units).toBe("metric");

		await setPreferences({ units: "imperial" });
		prefs = await getPreferences();
		expect(prefs.units).toBe("imperial");
	});
});
