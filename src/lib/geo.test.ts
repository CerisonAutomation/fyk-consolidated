import { describe, expect, it } from "vitest";
import { compatibility, displayDistance, fuzzPin, haversineKm, jitterKm, nearestCity, pairHash, resolveDistanceKm, snap } from "./geo";

/**
 * Location math is the privacy surface of this app: the claim is "we only ever
 * store and show a coarse position". These tests are what make that claim
 * checkable instead of aspirational.
 */

describe("haversineKm", () => {
	it("measures a known city pair within tolerance", () => {
		// Valletta -> Palermo, ~295 km great-circle.
		const km = haversineKm({ lat: 35.8997, lng: 14.5147 }, { lat: 38.1157, lng: 13.3615 });
		// Great-circle Valletta -> Palermo is ~267 km.
		expect(km).toBeGreaterThan(260);
		expect(km).toBeLessThan(275);
	});

	it("is zero for the same point and symmetric", () => {
		const a = { lat: 35.9, lng: 14.5 };
		const b = { lat: 36.5, lng: 14.9 };
		expect(haversineKm(a, a)).toBeCloseTo(0, 6);
		expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 6);
	});
});

describe("snap — the grid that stands in for a precise fix", () => {
	it("is idempotent, which is what coarsened storage depends on", () => {
		const once = snap({ lat: 35.8997, lng: 14.5147 }, 250);
		expect(snap(once, 250)).toEqual(once);
	});

	it("never moves a member more than half a cell", () => {
		for (const point of [{ lat: 35.8997, lng: 14.5147 }, { lat: 51.5072, lng: -0.1276 }, { lat: -33.86, lng: 151.21 }]) {
			expect(haversineKm(point, snap(point, 250))).toBeLessThan(0.25);
		}
	});

	it("separates points that are kilometres apart", () => {
		expect(snap({ lat: 35.8997, lng: 14.5147 }, 250)).not.toEqual(snap({ lat: 35.9397, lng: 14.5147 }, 250));
	});

	it("produces a cell edge of about the requested size", () => {
		const point = { lat: 35.8997, lng: 14.5147 };
		const step = 250 / 111_320; // one grid cell in degrees of latitude
		const distance = haversineKm(snap(point, 250), snap({ ...point, lat: point.lat + step }, 250));
		expect(distance).toBeGreaterThan(0.15);
		expect(distance).toBeLessThan(0.4);
	});
});

describe("distance shown to a viewer", () => {
	it("never resolves finer than half a kilometre", () => {
		expect(displayDistance(0.02)).toBe("0.5 km");
		expect(displayDistance(1.2)).toBe("1 km");
		expect(displayDistance(12.7)).toBe("13 km");
	});

	it("says 'Distance hidden' instead of leaking anything when the member opted out", () => {
		expect(displayDistance(3.4, { hideDistance: true })).toBe("Distance hidden");
	});

	it("jitters within the documented radius but keeps the same value for the same pair", () => {
		for (let index = 0; index < 25; index += 1) {
			expect(Math.abs(jitterKm(`u${index}`, "target", 0.3))).toBeLessThanOrEqual(0.3);
		}
		expect(jitterKm("a", "b")).toBe(jitterKm("a", "b"));
		expect(pairHash("a", "b")).toBe(pairHash("b", "a"));
	});

	it("never rounds a distance to zero", () => {
		expect(resolveDistanceKm("viewer", "target", 0.001)).toBeGreaterThanOrEqual(0.1);
	});
});

describe("fuzzPin", () => {
	it("moves a marker by roughly the requested radius and no more", () => {
		const origin = { lat: 35.8997, lng: 14.5147 };
		for (let index = 0; index < 20; index += 1) {
			expect(haversineKm(origin, fuzzPin(origin, "seed-a", `seed-b-${index}`, 420))).toBeLessThanOrEqual(0.5);
		}
	});
});

describe("nearestCity", () => {
	it("resolves to the centroid a member is actually standing near", () => {
		expect(nearestCity({ lat: 35.9, lng: 14.5 }).id).toBe("valletta");
		expect(nearestCity({ lat: 52.52, lng: 13.4 }).id).toBe("berlin");
	});
});

describe("compatibility", () => {
	it("is bounded 0-100 and refuses when the age filter fails", () => {
		expect(compatibility({ tagScore: 100, reciprocal: true, distanceKm: 0, radiusKm: 50, ageOk: false })).toBe(0);
		const high = compatibility({ tagScore: 100, reciprocal: true, distanceKm: 1, radiusKm: 50, ageOk: true });
		expect(high).toBeLessThanOrEqual(100);
		expect(high).toBeGreaterThan(50);
	});

	it("rewards proximity and shared intent, and nothing else", () => {
		const near = compatibility({ tagScore: 60, reciprocal: true, distanceKm: 1, radiusKm: 50, ageOk: true });
		const far = compatibility({ tagScore: 60, reciprocal: true, distanceKm: 180, radiusKm: 50, ageOk: true });
		const notMutual = compatibility({ tagScore: 60, reciprocal: false, distanceKm: 1, radiusKm: 50, ageOk: true });
		expect(near).toBeGreaterThan(far);
		expect(notMutual).toBeLessThan(near);
	});
});
