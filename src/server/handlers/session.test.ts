import { describe, expect, it } from "vitest";
import { PRESENCE_STAMP_INTERVAL_MS, shouldStampPresence } from "./session";

const at = (ms: number) => new Date(Date.now() + ms).toISOString();

describe("shouldStampPresence — how often an app open may move presence", () => {
	it("stamps for a member who has never been seen", () => {
		expect(shouldStampPresence(null)).toBe(true);
		expect(shouldStampPresence(undefined)).toBe(true);
	});

	it("leaves a recent stamp alone, however many tabs reload", () => {
		expect(shouldStampPresence(at(-1_000))).toBe(false);
		expect(shouldStampPresence(at(-PRESENCE_STAMP_INTERVAL_MS + 1_000))).toBe(
			false,
		);
	});

	it("stamps again once the interval has passed", () => {
		expect(shouldStampPresence(at(-PRESENCE_STAMP_INTERVAL_MS))).toBe(true);
		expect(shouldStampPresence(at(-3_600_000))).toBe(true);
	});

	it("replaces a value it cannot trust", () => {
		expect(shouldStampPresence(at(60_000))).toBe(true); // in the future
		expect(shouldStampPresence("not a date")).toBe(true);
	});
});
