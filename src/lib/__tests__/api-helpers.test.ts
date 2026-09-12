import { describe, expect, it } from "vitest";
import {
	asStringArray,
	cleanText,
	isMissingProfileError,
	publicProfile,
	readPagination,
	requireCaller,
} from "#/lib/api-helpers";
import { ApiError } from "#/middleware";

/**
 * `users.interests`, `tribes`, `photos` and `meetnow_posts.tags` are all
 * `jsonb`, but the previous data layer typed some as `String` and others as
 * `String[]`, so rows exist in every shape. These mappers are the only place
 * allowed to paper over that — and they must never invent values.
 */
describe("asStringArray", () => {
	it("normalises the shapes this column has had", () => {
		expect(asStringArray(["hiking", ""])).toEqual(["hiking"]);
		expect(asStringArray('["hiking","cooking"]')).toEqual([
			"hiking",
			"cooking",
		]);
		expect(asStringArray("hiking, cooking ")).toEqual(["hiking", "cooking"]);
		expect(asStringArray(null)).toEqual([]);
		expect(asStringArray({ nope: true })).toEqual([]);
	});

	it("keeps numeric tags as text, and drops what has no text form", () => {
		// `users.tribes` carries two vocabularies: numeric ids from the profile
		// editor and names from `/tribes`. Dropping the numbers made a tagged user
		// look untagged to the compatibility scorer, so finite numbers are textified
		// while objects, nulls and nested arrays stay out.
		expect(asStringArray([1, "ok", 3.5, { a: 1 }, null, ["nested"]])).toEqual([
			"1",
			"ok",
			"3.5",
		]);
	});
});

describe("cleanText", () => {
	it("collapses whitespace and truncates", () => {
		expect(cleanText("  hi\n\tthere  ")).toBe("hi there");
		expect(cleanText("a".repeat(50), 10)).toHaveLength(10);
		expect(cleanText(undefined)).toBe("");
	});

	it("strips control characters that would corrupt logs", () => {
		expect(
			cleanText(String.fromCharCode(0) + "x" + String.fromCharCode(27) + "y"),
		).toBe("x y");
	});
});
describe("publicProfile", () => {
	const row = (
		over: Partial<import("#/lib/api-helpers").PublicProfileRow> = {},
	) =>
		({
			id: "u1",
			displayName: "King",
			handle: "king",
			avatar: null,
			online: false,
			lastActiveAt: null,
			city: null,
			area: null,
			...over,
		}) satisfies import("#/lib/api-helpers").PublicProfileRow;

	it("reports presence from the row instead of hardcoding online", () => {
		expect(publicProfile(row())?.status).toBe("offline");
		expect(publicProfile(row({ online: true }))?.status).toBe("online");
	});

	it("never fabricates coordinates (0,0 is a real place in the ocean)", () => {
		expect(publicProfile(row())?.geo).toBeUndefined();
		expect(publicProfile(row({ city: "Sliema" }))?.geo).toEqual({
			city: "Sliema",
			area: null,
		});
	});

	it("returns undefined for a missing actor rather than an empty shell", () => {
		expect(publicProfile(null)).toBeUndefined();
		expect(publicProfile(undefined)).toBeUndefined();
	});
});

describe("readPagination", () => {
	it("caps the page size and ignores an oversized request", () => {
		expect(
			readPagination(new URL("https://fyk.test/api/events?limit=1000")).limit,
		).toBe(50);
		expect(
			readPagination(new URL("https://fyk.test/api/events?limit=10")).limit,
		).toBe(10);
	});

	it("only accepts a UUID cursor", () => {
		expect(
			readPagination(new URL("https://fyk.test/api/events?cursor=%2e%2e"))
				.cursor,
		).toBeUndefined();
		expect(
			readPagination(
				new URL(
					"https://fyk.test/api/events?cursor=215b2a4e-4c28-4f52-9c1a-9e1a0f0a1f2e",
				),
			).cursor,
		).toBe("215b2a4e-4c28-4f52-9c1a-9e1a0f0a1f2e");
	});
});

describe("identity + error mapping", () => {
	it("requireCaller throws a 401 rather than letting handlers null-check", () => {
		expect(() => requireCaller(null)).toThrowError(ApiError);
		const user = { id: "u1", email: null, role: "authenticated" };
		expect(requireCaller(user)).toBe(user);
	});

	it("maps Postgres constraint violations to a 409-shaped signal", () => {
		expect(isMissingProfileError({ code: "23503" })).toBe(true);
		expect(isMissingProfileError({ code: "23505" })).toBe(true);
		// Prisma codes must not come back: they no longer surface at all.
		expect(isMissingProfileError({ code: "P2003" })).toBe(false);
		expect(isMissingProfileError(undefined)).toBe(false);
	});
});
