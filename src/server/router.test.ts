import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateBucket } from "./router";

/**
 * The dispatch layer's promises: every response is an envelope, every response
 * carries the request id, and no route reaches the database before the request has
 * been identified and rate-limited. Those are tested here rather than per handler,
 * because per-handler tests are exactly where such a rule gets forgotten.
 */

const post = (path: string, init: RequestInit = {}) => new Request(`http://localhost${path}`, init);

describe("rateBucket", () => {
	it("separates callers, tiers, verbs and routes", () => {
		const a = rateBucket("message", "user-a", "10.0.0.1", "POST", "conversations/:id/messages");
		const b = rateBucket("message", "user-b", "10.0.0.1", "POST", "conversations/:id/messages");
		expect(a).not.toBe(b);
		expect(rateBucket("read", "user-a", "10.0.0.1", "GET", "conversations/:id/messages")).not.toBe(a);
	});

	it("falls back to the IP for anonymous traffic", () => {
		expect(rateBucket("read", null, "203.0.113.9", "GET", "discover")).toContain("ip:203.0.113.9");
	});
});

describe("handleApi without server configuration", () => {
	it("answers 503 with an envelope instead of rendering a broken app", async () => {
		const { handleApi } = await import("./router");
		const response = await handleApi(post("/api/session"));
		expect(response.status).toBe(503);
		const body = await response.json();
		expect(body.ok).toBe(false);
		expect(body.error.code).toBe("dependency_unavailable");
		expect(response.headers.get("x-request-id")).toMatch(/^fyk_/);
		expect(response.headers.get("cache-control")).toBe("no-store");
		// Stack frames, source paths, connection strings and JWT-shaped values are
		// the four things an error body must never carry.
		const serialized = JSON.stringify(body);
		expect(serialized).not.toMatch(/\n\s*at .*:\d+:\d+/);
		expect(serialized).not.toMatch(/\.tsx?:\d+/);
		expect(serialized).not.toMatch(/postgres(ql)?:\/\//);
		expect(serialized).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/);
	});
});

describe("handleApi dispatch rules", () => {
	const previous = { ...process.env };

	beforeEach(async () => {
		process.env.SUPABASE_URL = "https://fyk-test.supabase.co";
		process.env.SUPABASE_ANON_KEY = "eyJhbGciOi-test-anon-key-long-enough";
		vi.resetModules();
	});

	afterEach(() => {
		process.env = { ...previous };
		vi.resetModules();
	});

	it("returns 404 for an unknown route, without echoing the raw path", async () => {
		const { handleApi } = await import("./router");
		const response = await handleApi(post("/api/definitely-not-a-route/../secret"));
		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error.code).toBe("not_found");
		// The requested path is not reflected back: a mistyped /api/profile/<uuid>
		// must not be readable in an error body by whoever can trigger the call.
		expect(body.error.message).not.toContain("secret");
		expect(body.error.message).toBe("That endpoint does not exist.");
	});

	it("refuses a verb the route does not implement", async () => {
		const { handleApi } = await import("./router");
		const response = await handleApi(post("/api/discover", { method: "DELETE" }));
		expect(response.status).toBe(400);
		expect((await response.json()).error.message).toContain("not allowed");
	});

	it("requires a session on protected routes before touching the database", async () => {
		const { handleApi } = await import("./router");
		const response = await handleApi(post("/api/discover"));
		expect(response.status).toBe(401);
		expect((await response.json()).error.message).toMatch(/sign in/i);
	});

	it("propagates the caller's request id so a bug report maps to a log line", async () => {
		const { handleApi } = await import("./router");
		const response = await handleApi(post("/api/discover", { headers: { "x-request-id": "trace-me-001" } }));
		expect(response.headers.get("x-request-id")).toBe("trace-me-001");
		expect((await response.json()).requestId).toBe("trace-me-001");
	});

	it("attaches rate-limit headers even on a rejection", async () => {
		const { handleApi } = await import("./router");
		const response = await handleApi(post("/api/discover"));
		expect(response.headers.get("x-ratelimit-tier")).toBe("memory");
		expect(Number(response.headers.get("x-ratelimit-limit"))).toBeGreaterThan(0);
	});
});
