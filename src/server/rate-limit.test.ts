import { describe, expect, it } from "vitest";
import {
	checkRateLimit,
	durableLimiterReady,
	limiterWarning,
	RATE_LIMITS,
	rateLimitHeaders,
} from "./rate-limit";

const headers = (ip: string) => new Headers({ "x-forwarded-for": ip });

describe("checkRateLimit (memory tier, no database in tests)", () => {
	it("allows requests up to the tier limit then blocks", async () => {
		const bucket = `test:${Math.random()}`;
		const limit = RATE_LIMITS.message.limit;
		let last = await checkRateLimit(headers("10.0.0.1"), bucket, limit, 60_000);
		for (let index = 1; index < limit; index += 1) {
			last = await checkRateLimit(headers("10.0.0.1"), bucket, limit, 60_000);
			expect(last.allowed).toBe(true);
		}
		const blocked = await checkRateLimit(
			headers("10.0.0.1"),
			bucket,
			limit,
			60_000,
		);
		expect(blocked.allowed).toBe(false);
		expect(blocked.remaining).toBe(0);
		expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
	});

	it("is separated by whatever key the caller supplies", async () => {
		const suffix = Math.random().toString(36).slice(2);
		const limit = 2;
		const a = `w:${suffix}:a`;
		const b = `w:${suffix}:b`;
		await checkRateLimit(headers("10.0.0.2"), a, limit, 60_000);
		await checkRateLimit(headers("10.0.0.2"), a, limit, 60_000);
		expect(
			(await checkRateLimit(headers("10.0.0.2"), a, limit, 60_000)).allowed,
		).toBe(false);
		expect(
			(await checkRateLimit(headers("10.0.0.3"), b, limit, 60_000)).allowed,
		).toBe(true);
	});

	it("lets the window pass and allows again", async () => {
		const bucket = `short:${Math.random()}`;
		await checkRateLimit(headers("10.0.0.4"), bucket, 1, 20);
		expect(
			(await checkRateLimit(headers("10.0.0.4"), bucket, 1, 20)).allowed,
		).toBe(false);
		await new Promise((resolve) => setTimeout(resolve, 40));
		expect(
			(await checkRateLimit(headers("10.0.0.4"), bucket, 1, 20)).allowed,
		).toBe(true);
	});

	it("does not throw when the limiter cannot be reached", async () => {
		// Fail-open is a decision: a limiter outage must not take messaging down.
		await expect(
			checkRateLimit(new Headers(), `x:${Math.random()}`, 1, 1000),
		).resolves.toMatchObject({ allowed: true });
	});
});

describe("rate limit headers", () => {
	it("reports which tier answered, so a non-durable limiter is visible", () => {
		const out = rateLimitHeaders({
			allowed: true,
			remaining: 3,
			limit: 5,
			resetAt: Date.now() + 1000,
			retryAfterSeconds: 0,
			tier: "memory",
		});
		expect(out["X-RateLimit-Limit"]).toBe("5");
		expect(out["X-RateLimit-Remaining"]).toBe("3");
		// The tier is in the headers on purpose: an in-process limiter is not a
		// production control, and an operator should be able to see that with curl.
		expect(out["X-RateLimit-Tier"]).toBe("memory");
		expect(out["Retry-After"]).toBeUndefined();
	});

	it("only sends Retry-After on a refusal", () => {
		const out = rateLimitHeaders({
			allowed: false,
			remaining: 0,
			limit: 5,
			resetAt: Date.now() + 5000,
			retryAfterSeconds: 4,
			tier: "postgres",
		});
		expect(out["Retry-After"]).toBe("4");
	});

	it("is honest about the durable limiter before any database call", () => {
		expect(durableLimiterReady()).toBe(false);
		// The warning is production-only, so a test run must not claim a problem.
		expect(limiterWarning()).toBeNull();
	});

	it("gives writes a tighter budget than reads", () => {
		expect(RATE_LIMITS.message.limit).toBeLessThan(RATE_LIMITS.read.limit);
		expect(RATE_LIMITS.report.limit).toBeLessThan(RATE_LIMITS.write.limit);
		expect(RATE_LIMITS.auth.windowMs).toBeGreaterThan(
			RATE_LIMITS.read.windowMs,
		);
	});
});
