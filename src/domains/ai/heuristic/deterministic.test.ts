import { describe, expect, it } from "vitest";
import { heuristicDeepfakeScore } from "./catfish-detect";
import { hashString, jitter, jitterFloat, seededRandom } from "./deterministic";
import { scorePhoto, suggestPhotoOrder } from "./photo-enhance";

/**
 * The bug these tests exist for: two heuristics answered with `Math.random()`, so a
 * photo's "lighting" score and a deepfake risk score changed between two identical
 * requests. Screens printed those numbers as measurements. Everything here asserts
 * the property that was missing — same input, same output — plus the ranges, so a
 * future edit cannot reintroduce a draw and quietly pass.
 */

describe("hashString", () => {
	it("is stable for the same input", () => {
		expect(hashString("https://cdn.fyk/media/a.jpg")).toBe(
			hashString("https://cdn.fyk/media/a.jpg"),
		);
	});

	it("differs for different inputs", () => {
		expect(hashString("a.jpg")).not.toBe(hashString("b.jpg"));
	});

	it("is never negative", () => {
		// `| 0` can produce a negative int32; the helper takes the absolute value
		// because it is used as a PRNG seed.
		for (const value of ["", "x", "🙂", "a".repeat(200), "/api/ai"]) {
			expect(hashString(value)).toBeGreaterThanOrEqual(0);
		}
	});
});

describe("seededRandom", () => {
	it("produces the same sequence from the same seed", () => {
		const a = seededRandom(12345);
		const b = seededRandom(12345);
		expect([a(), a(), a()]).toEqual([b(), b(), b()]);
	});

	it("stays inside [0, 1)", () => {
		const random = seededRandom(7);
		for (let i = 0; i < 200; i += 1) {
			const value = random();
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThan(1);
		}
	});

	it("survives a seed that would stall a Lehmer generator", () => {
		// `state <= 0` is corrected inside the helper; a zero seed used to return a
		// constant 0 forever.
		const random = seededRandom(0);
		expect(random()).toBeGreaterThan(0);
	});
});

describe("jitter", () => {
	it("is reproducible for the same seed", () => {
		expect(jitter("photo:lighting", 75, 99)).toBe(jitter("photo:lighting", 75, 99));
	});

	it("stays inside the requested range, inclusive", () => {
		for (let i = 0; i < 100; i += 1) {
			const value = jitter(`seed-${i}`, 30, 59);
			expect(value).toBeGreaterThanOrEqual(30);
			expect(value).toBeLessThanOrEqual(59);
		}
	});

	it("returns the only value when min equals max", () => {
		expect(jitter("anything", 42, 42)).toBe(42);
	});

	it("spreads rather than collapsing onto one number", () => {
		const seen = new Set<number>();
		for (let i = 0; i < 60; i += 1) seen.add(jitter(`spread-${i}`, 0, 100));
		expect(seen.size).toBeGreaterThan(10);
	});
});

describe("jitterFloat", () => {
	it("is reproducible and inside [min, max)", () => {
		const first = jitterFloat("url:deepfake", 0, 0.3);
		expect(jitterFloat("url:deepfake", 0, 0.3)).toBe(first);
		expect(first).toBeGreaterThanOrEqual(0);
		expect(first).toBeLessThan(0.3);
	});
});

describe("scorePhoto", () => {
	it("scores the same photo the same way every time", () => {
		const url = "https://cdn.fyk/media/avatars/u1/1700000000.jpg";
		const first = scorePhoto(url);
		for (let i = 0; i < 5; i += 1) {
			expect(scorePhoto(url)).toEqual(first);
		}
	});

	it("keeps every component inside 0–100", () => {
		const score = scorePhoto("https://cdn.fyk/media/dark-blur.jpg");
		for (const value of [
			score.quality,
			score.lighting,
			score.blur,
			score.smile,
			score.background,
			score.appeal,
		]) {
			expect(value).toBeGreaterThanOrEqual(0);
			expect(value).toBeLessThanOrEqual(100);
		}
	});

	it("orders a set of photos the same way twice", () => {
		const urls = [
			"https://cdn.fyk/media/a.jpg",
			"https://cdn.fyk/media/dark-b.jpg",
			"https://cdn.fyk/media/sunny-c.jpg",
		];
		expect(suggestPhotoOrder(urls).ordered).toEqual(suggestPhotoOrder(urls).ordered);
	});
});

describe("heuristicDeepfakeScore", () => {
	it("flags AI-artifact filenames high", () => {
		expect(heuristicDeepfakeScore("https://cdn.fyk/midjourney/out.png")).toBe(0.85);
	});

	it("keeps an ordinary photo's baseline low and stable", () => {
		const url = "https://cdn.fyk/media/avatars/u2/1700000001.jpg";
		const first = heuristicDeepfakeScore(url);
		expect(heuristicDeepfakeScore(url)).toBe(first);
		expect(first).toBeLessThan(0.3);
	});
});
