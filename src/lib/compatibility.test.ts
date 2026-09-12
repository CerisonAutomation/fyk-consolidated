import { describe, expect, it } from "vitest";
import {
	COMPATIBILITY_WEIGHTS,
	compatibilityScore,
	onlineUntil,
	tagOverlap,
} from "#/lib/compatibility";

const minutes = (count: number) => new Date(Date.now() - count * 60_000);
const days = (count: number) => new Date(Date.now() - count * 86_400_000);

describe("tagOverlap", () => {
	it("is zero when either side has no tags, instead of a free point", () => {
		expect(tagOverlap([], ["vinyl"])).toBe(0);
		expect(tagOverlap(["vinyl"], [])).toBe(0);
		expect(tagOverlap(["  "], ["vinyl"])).toBe(0);
	});

	it("is Jaccard, case- and space-insensitive", () => {
		expect(
			tagOverlap(["Vinyl", " Sea Swimming "], ["sea swimming", "vinyl"]),
		).toBe(1);
		// Two shared of three distinct values.
		expect(tagOverlap(["a", "b"], ["a", "b", "c"])).toBeCloseTo(2 / 3);
	});
});

describe("compatibilityScore", () => {
	const viewer = {
		tribes: ["1", "2"],
		interests: ["vinyl", "late nights", "sea swimming"],
		intents: ["casual", "friends"],
		age: 30,
	};

	it("ranks an aligned profile above an unrelated one", () => {
		const aligned = compatibilityScore(viewer, {
			tribes: ["1", "2"],
			interests: ["vinyl", "late nights", "sea swimming"],
			intents: ["casual", "friends"],
			age: 31,
			distanceKm: 1,
			lastActiveAt: minutes(2),
		});
		const stranger = compatibilityScore(viewer, {
			tribes: [],
			interests: ["knitting"],
			intents: ["marriage"],
			age: 58,
			distanceKm: 24,
			lastActiveAt: days(60),
		});
		expect(aligned).toBeGreaterThan(stranger);
	});

	it("stays inside 0..100 and gives a full match 100", () => {
		const perfect = compatibilityScore(
			{ ...viewer, age: 30 },
			{
				tribes: viewer.tribes,
				interests: viewer.interests,
				intents: viewer.intents,
				age: 30,
				distanceKm: 0,
				lastActiveAt: new Date(),
			},
		);
		expect(perfect).toBe(100);
	});

	it("treats an unknown distance as no distance, not as zero distance", () => {
		const withDistance = compatibilityScore(viewer, {
			tribes: [],
			interests: [],
			intents: [],
			age: null,
			distanceKm: 0,
			lastActiveAt: minutes(1),
		});
		const without = compatibilityScore(viewer, {
			tribes: [],
			interests: [],
			intents: [],
			age: null,
			distanceKm: null,
			lastActiveAt: minutes(1),
		});
		expect(withDistance).toBeGreaterThan(without);
	});

	it("scores the weights it documents", () => {
		const total = Object.values(COMPATIBILITY_WEIGHTS).reduce(
			(a, b) => a + b,
			0,
		);
		expect(total).toBeGreaterThan(1);
		expect(total).toBeLessThan(1.1);
	});
});

describe("onlineUntil", () => {
	it("is null unless the online flag is set", () => {
		expect(onlineUntil(new Date(), false)).toBeNull();
		expect(onlineUntil(new Date(), null)).toBeNull();
		expect(onlineUntil(null, true)).toBeNull();
	});

	it("expires with the activity window rather than living forever", () => {
		expect(onlineUntil(minutes(1), true)).toBeGreaterThan(Date.now());
		expect(onlineUntil(minutes(40), true)).toBeNull();
	});

	it("accepts the ISO text PostgREST returns, and ignores junk", () => {
		expect(onlineUntil(new Date().toISOString(), true)).not.toBeNull();
		expect(onlineUntil("not a date", true)).toBeNull();
	});
});
