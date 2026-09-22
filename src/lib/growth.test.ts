import { describe, expect, it } from "vitest";
import { calculateStreak, distinctUtcDays } from "./growth";

/**
 * Streaks are shown to users as a number they are asked to protect, so the counting
 * rules are the feature. These tests pin the cases the previous implementation got
 * wrong: it rounded hour differences to days, so a login at 23:00 followed by one at
 * 01:00 counted as the same day, and a streak that ended weeks ago still reported its
 * old length as though it were current.
 */
const NOW = new Date("2026-03-10T12:00:00Z");
const day = (offset: number, time = "12:00:00") =>
	new Date(Date.parse(`2026-03-10T${time}Z`) - offset * 86_400_000).toISOString();

describe("distinctUtcDays", () => {
	it("collapses many timestamps on one day into one day", () => {
		expect(distinctUtcDays([day(0, "01:00:00"), day(0, "09:30:00"), day(0, "23:59:00")])).toEqual([
			"2026-03-10",
		]);
	});

	it("returns days newest first and ignores junk", () => {
		expect(distinctUtcDays([day(2), null, undefined, "not a date", day(0), day(1)])).toEqual([
			"2026-03-10",
			"2026-03-09",
			"2026-03-08",
		]);
	});

	it("accepts Date objects as well as strings", () => {
		expect(distinctUtcDays([new Date("2026-03-09T22:00:00Z")])).toEqual(["2026-03-09"]);
	});
});

describe("calculateStreak", () => {
	it("reports nothing for an account with no activity", () => {
		expect(calculateStreak([], NOW)).toMatchObject({ count: 0, longestStreak: 0, atRisk: false });
	});

	it("counts consecutive days ending today", () => {
		const streak = calculateStreak([day(0), day(1), day(2), day(3)], NOW);
		expect(streak.count).toBe(4);
		expect(streak.longestStreak).toBe(4);
		expect(streak.atRisk).toBe(false);
	});

	it("counts a run whose last day was yesterday, and flags it at risk", () => {
		const streak = calculateStreak([day(1), day(2), day(3)], NOW);
		expect(streak.count).toBe(3);
		expect(streak.atRisk).toBe(true);
	});

	it("stops counting at the first gap", () => {
		const streak = calculateStreak([day(0), day(1), day(3), day(4)], NOW);
		expect(streak.count).toBe(2);
		expect(streak.longestStreak).toBe(2);
	});

	it("reports a dead streak as zero but keeps the longest run", () => {
		// Last activity ten days ago: there is nothing left to keep, and the honest
		// number is 0 with a history of 3.
		const streak = calculateStreak([day(10), day(11), day(12)], NOW);
		expect(streak.count).toBe(0);
		expect(streak.longestStreak).toBe(3);
		expect(streak.atRisk).toBe(false);
	});

	it("treats 23:00 and 01:00 the next morning as two days", () => {
		const streak = calculateStreak(
			[new Date("2026-03-10T01:00:00Z"), new Date("2026-03-09T23:00:00Z")],
			NOW,
		);
		expect(streak.count).toBe(2);
	});

	it("does not count one day twice when the app is opened repeatedly", () => {
		const streak = calculateStreak(
			[day(0, "08:00:00"), day(0, "20:00:00"), day(1, "07:00:00")],
			NOW,
		);
		expect(streak.count).toBe(2);
	});

	it("keeps the most recent instant as lastActiveAt", () => {
		const streak = calculateStreak([day(2), day(0, "06:15:00")], NOW);
		expect(streak.lastActiveAt).toBe("2026-03-10T06:15:00.000Z");
	});
});
