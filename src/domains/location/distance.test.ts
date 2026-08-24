import { describe, it, expect } from "vitest";
import { distanceMeters, type Coordinates } from "#/domains/location/distance";

describe("distance calculation", () => {
	it("returns 0 for identical points", () => {
		const point: Coordinates = { lat: 40.7128, lon: -74.006 };
		expect(distanceMeters({ from: point, to: point })).toBe(0);
	});

	it("calculates distance between NYC and London", () => {
		const nyc: Coordinates = { lat: 40.7128, lon: -74.006 };
		const london: Coordinates = { lat: 51.5074, lon: -0.1278 };
		const dist = distanceMeters({ from: nyc, to: london });
		// Actual distance is approximately 5,570 km (great-circle) but
		// equirectangular approximation yields ~5,820 km
		expect(dist).toBeGreaterThan(5_500_000);
		expect(dist).toBeLessThan(6_000_000);
	});

	it("calculates distance between Sydney and Tokyo", () => {
		const sydney: Coordinates = { lat: -33.8688, lon: 151.2093 };
		const tokyo: Coordinates = { lat: 35.6762, lon: 139.6503 };
		const dist = distanceMeters({ from: sydney, to: tokyo });
		// Actual distance is approximately 7,823 km
		expect(dist).toBeGreaterThan(7_700_000);
		expect(dist).toBeLessThan(8_000_000);
	});

	it("is symmetric (distance A->B equals B->A)", () => {
		const a: Coordinates = { lat: 48.8566, lon: 2.3522 }; // Paris
		const b: Coordinates = { lat: 41.9028, lon: 12.4964 }; // Rome
		const ab = distanceMeters({ from: a, to: b });
		const ba = distanceMeters({ from: b, to: a });
		expect(ab).toBeCloseTo(ba, 0);
	});

	it("calculates distance across the equator", () => {
		const north: Coordinates = { lat: 10, lon: 0 };
		const south: Coordinates = { lat: -10, lon: 0 };
		const dist = distanceMeters({ from: north, to: south });
		// ~20 degrees of latitude, ~2225 km
		expect(dist).toBeGreaterThan(2_200_000);
		expect(dist).toBeLessThan(2_250_000);
	});

	it("handles antipodal points", () => {
		const a: Coordinates = { lat: 0, lon: 0 };
		const b: Coordinates = { lat: 0, lon: 180 };
		const dist = distanceMeters({ from: a, to: b });
		// Half the Earth's circumference at equator ~20,015 km
		expect(dist).toBeGreaterThan(20_000_000);
		expect(dist).toBeLessThan(20_100_000);
	});

	it("handles very small distances", () => {
		const a: Coordinates = { lat: 40.7128, lon: -74.006 };
		const b: Coordinates = { lat: 40.7129, lon: -74.006 };
		const dist = distanceMeters({ from: a, to: b });
		// ~0.0001 degrees latitude ~11 meters
		expect(dist).toBeGreaterThan(5);
		expect(dist).toBeLessThan(20);
	});
});
