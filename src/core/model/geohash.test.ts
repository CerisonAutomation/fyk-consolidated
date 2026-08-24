import { describe, it, expect } from "vitest";
import {
	encodeGeohash,
	decodeGeohash,
	coarsenGeohash,
	geohashSchema,
} from "#/core/model/geohash";

describe("geohash encode/decode", () => {
	it("encodes known coordinates to expected hash", () => {
		// New York City: 40.7128, -74.0060
		const hash = encodeGeohash({ lat: 40.7128, lon: -74.0060 });
		expect(hash).toHaveLength(12);
		expect(hash).toMatch(/^[0-9b-hjkmnp-z]+$/);
	});

	it("roundtrips encode -> decode within precision bounds", () => {
		const coords = { lat: 40.7128, lon: -74.006 };
		const hash = encodeGeohash(coords);
		const decoded = decodeGeohash(hash);

		// Should be within ~1cm precision for 12-character geohash
		expect(decoded.lat).toBeCloseTo(coords.lat, 5);
		expect(decoded.lon).toBeCloseTo(coords.lon, 5);
	});

	it("roundtrips multiple known locations", () => {
		const locations = [
			{ lat: 0, lon: 0 }, // Null Island
			{ lat: 51.5074, lon: -0.1278 }, // London
			{ lat: -33.8688, lon: 151.2093 }, // Sydney
			{ lat: 35.6762, lon: 139.6503 }, // Tokyo
			{ lat: -90, lon: -180 }, // South Pole corner
			{ lat: 90, lon: 180 }, // North Pole corner
		];

		for (const coords of locations) {
			const hash = encodeGeohash(coords);
			const decoded = decodeGeohash(hash);
			expect(decoded.lat).toBeCloseTo(coords.lat, 4);
			expect(decoded.lon).toBeCloseTo(coords.lon, 4);
		}
	});

	it("returns errors for decoded geohash", () => {
		const hash = encodeGeohash({ lat: 40.7128, lon: -74.006 });
		const decoded = decodeGeohash(hash);
		expect(decoded.latErr).toBeGreaterThan(0);
		expect(decoded.lonErr).toBeGreaterThan(0);
		expect(decoded.latErr).toBeLessThan(0.00001);
		expect(decoded.lonErr).toBeLessThan(0.00001);
	});

	it("throws on invalid geohash characters", () => {
		expect(() => decodeGeohash("invalid!!!")).toThrow("Invalid geohash char");
	});

	it("geohash schema validates correct hashes", () => {
		const hash = encodeGeohash({ lat: 40.7128, lon: -74.006 });
		expect(() => geohashSchema.parse(hash)).not.toThrow();
	});

	it("geohash schema rejects wrong-length hashes", () => {
		expect(() => geohashSchema.parse("abc")).toThrow();
		expect(() => geohashSchema.parse("a".repeat(13))).toThrow();
	});

	it("geohash schema rejects invalid characters", () => {
		expect(() => geohashSchema.parse("i".repeat(12))).toThrow();
		expect(() => geohashSchema.parse("l".repeat(12))).toThrow();
		expect(() => geohashSchema.parse("o".repeat(12))).toThrow();
	});

	it("coarsenGeohash produces a valid geohash", () => {
		const hash = encodeGeohash({ lat: 40.7128, lon: -74.006 });
		const coarse = coarsenGeohash(hash);
		expect(coarse).toHaveLength(12);
		expect(coarse).toMatch(/^[0-9b-hjkmnp-z]+$/);
	});

	it("coarsenGeohash rounds coordinates to a coarse grid", () => {
		const hash1 = encodeGeohash({ lat: 40.7128, lon: -74.006 });
		const hash2 = encodeGeohash({ lat: 40.7129, lon: -74.0061 });
		// Coarsening should produce the same hash for nearby points
		expect(coarsenGeohash(hash1)).toBe(coarsenGeohash(hash2));
	});
});
