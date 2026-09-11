import { beforeEach, describe, expect, it } from "vitest";
import {
	checkRateLimit,
	enforceRateLimit,
	rateLimitHeaders,
} from "#/lib/rate-limit";

/**
 * The previous limiter kept a counter per *route* with the key
 * `` `api:${pathname}` `` — i.e. one global bucket for the whole app. One
 * script hammering `POST /api/events` therefore locked every real user out of
 * the endpoint, and the fallback path had no `Retry-After` at all.
 *
 * These tests run against the in-process fallback (no Upstash credentials in
 * CI), which is also the code path a single container uses.
 */
describe("checkRateLimit (in-process fallback)", () => {
	const windowMs = 60_000;

	beforeEach(() => {
		// Keys are namespaced per test so ordering cannot matter.
	});

	it("allows the configured burst, then blocks", async () => {
		const key = `test:burst:${Date.now()}`;
		for (let i = 0; i < 3; i += 1) {
			expect((await checkRateLimit(key, 3, windowMs)).allowed).toBe(true);
		}
		const blocked = await checkRateLimit(key, 3, windowMs);
		expect(blocked.allowed).toBe(false);
		expect(blocked.remaining).toBe(0);
		expect(blocked.retryAfter).toBeGreaterThanOrEqual(1);
	});

	it("keeps buckets independent per key", async () => {
		const salt = Date.now();
		const a = `test:a:${salt}`;
		const b = `test:b:${salt}`;
		await checkRateLimit(a, 1, windowMs);
		expect((await checkRateLimit(a, 1, windowMs)).allowed).toBe(false);
		expect((await checkRateLimit(b, 1, windowMs)).allowed).toBe(true);
	});

	it("expires the window", async () => {
		const key = `test:ttl:${Date.now()}`;
		expect((await checkRateLimit(key, 1, 20)).allowed).toBe(true);
		expect((await checkRateLimit(key, 1, 20)).allowed).toBe(false);
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect((await checkRateLimit(key, 1, 20)).allowed).toBe(true);
	});
});

describe("enforceRateLimit", () => {
	it("returns a ready 429 with a Retry-After once the budget is gone", async () => {
		const key = `test:enforce:${Date.now()}`;
		let last: Awaited<ReturnType<typeof enforceRateLimit>> = {
			blocked: false,
			result: { allowed: true, remaining: 1, retryAfter: 0 },
			headers: {},
		};
		for (let i = 0; i < 4; i += 1) {
			last = await enforceRateLimit(key, 2, 60_000);
			if (last.blocked) break;
		}
		expect(last.blocked).toBe(true);
		if (!last.blocked) return;
		expect(last.response.status).toBe(429);
		expect(last.response.headers.get("retry-after")).toBeTruthy();
		expect(await last.response.json()).toHaveProperty("error");
	});

	it("hands the caller headers to attach on the success path", async () => {
		const key = `test:pass:${Date.now()}`;
		const outcome = await enforceRateLimit(key, 5, 60_000);
		expect(outcome.blocked).toBe(false);
		if (outcome.blocked) return;
		// IETF draft field names (no `X-` prefix), which is what browsers and
		// proxies already understand and what `RateLimitPolicy` will standardise.
		expect(outcome.headers["RateLimit-Limit"]).toBe("5");
		expect(outcome.headers["RateLimit-Remaining"]).toBe("4");
		expect(rateLimitHeaders(outcome.result)).toHaveProperty("RateLimit-Reset");
	});
});
