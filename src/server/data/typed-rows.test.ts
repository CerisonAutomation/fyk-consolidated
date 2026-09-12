import { describe, expect, it } from "vitest";
import { asRow, asRows } from "./typed-rows";

/**
 * The one helper standing between a driver response and 30 `.map()` calls. It has
 * to be boring and it has to survive the shapes Supabase actually returns when
 * something is wrong — including the two that used to crash a request.
 */
describe("asRows", () => {
	it("passes a real result set through untouched", () => {
		const data = [{ id: 1 }, { id: 2 }];
		expect(asRows<{ id: number }>(data)).toBe(data);
	});

	it("treats null, undefined and a non-array answer as no rows", () => {
		expect(asRows<unknown>(null)).toEqual([]);
		expect(asRows<unknown>(undefined)).toEqual([]);
		// A PostgREST error body is an object, and an object is iterable-looking
		// enough to reach a `.map()` and throw: the response is not a result set.
		expect(
			asRows<unknown>({ code: "42P01", message: "relation not found" }),
		).toEqual([]);
		expect(asRows<unknown>("rows")).toEqual([]);
	});

	it("keeps array-shaped junk as array-shaped junk", () => {
		// Nothing in the handlers indexes a row positionally, so a bare array passes;
		// guarding this further would be inventing a validation the schema owns.
		expect(asRows<unknown>([])).toEqual([]);
	});
});

describe("asRow", () => {
	it("returns the object, and null for everything else", () => {
		const one = { id: 1 };
		expect(asRow<{ id: number }>(one)).toBe(one);
		expect(asRow<unknown>(null)).toBeNull();
		expect(asRow<unknown>([one])).toBeNull();
		expect(asRow<unknown>("nope")).toBeNull();
	});
});
