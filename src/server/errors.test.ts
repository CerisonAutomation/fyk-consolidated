import { describe, expect, it } from "vitest";
import { ApiFailure, badRequest, dbFailure, failureResponse, forbidden, mapUnknownError, redact, unsupported } from "./errors";

/**
 * These tests are the contract that a browser never sees internals. They are kept
 * deliberately paranoid: every pattern here is a real leak shape that Supabase
 * PostgREST errors, Postgres detail lines, or a bearer token can take.
 */

describe("redact", () => {
	it("removes JWT-shaped tokens", () => {
		const leaked = `auth failed for eyJhbGciOiJIUzI1NiJ9.${"A".repeat(30)}.${"B".repeat(30)} now`;
		const out = redact(leaked);
		expect(out).not.toContain("eyJhbGciOiJIUzI1NiJ9");
		expect(out).toContain("[redacted]");
	});

	it("removes Supabase keys and connection strings", () => {
		expect(redact("key sb_secret_AbCdEfGhIjKlMnOpQrStUvWx")).not.toContain("sb_secret_");
		expect(redact("postgres://user:[email protected]:5432/db")).not.toContain("password");
		expect(redact("postgresql://u:[email protected]/x")).not.toContain("innerpass");
	});

	it("removes storage paths and uuids", () => {
		expect(redact("failed for chat-media-private/9c8a1e0a-1f2e-4a6b-9c0d-1e2f3a4b5c6d/photo.jpg")).not.toContain("chat-media-private");
		expect(redact("row 9c8a1e0a-1f2e-4a6b-9c0d-1e2f3a4b5c6d missing")).not.toContain("9c8a1e0a");
	});

	it("drops Postgres detail/hint/context tails", () => {
		const message = redact('duplicate key value violates unique constraint "blocks_pkey" DETAIL: Key (id)=(7) already exists.');
		expect(message).not.toContain("DETAIL");
		expect(message).not.toContain("blocks_pkey");
	});

	it("caps length so a stack-trace-shaped message cannot be forwarded whole", () => {
		expect(redact("x".repeat(5000)).length).toBeLessThanOrEqual(300);
	});
});

describe("ApiFailure", () => {
	it("maps codes to statuses", () => {
		expect(badRequest("nope").status).toBe(400);
		expect(forbidden("nope").status).toBe(403);
		expect(unsupported("nope").status).toBe(503);
	});

	it("keeps details for the client when they are authored", () => {
		const failure = new ApiFailure("bad_request", "Two fields are wrong.", { fields: [{ path: "email", message: "Required" }] });
		expect(failure.details?.fields).toBeTruthy();
	});
});

describe("dbFailure", () => {
	it("never forwards the Postgres message for internal errors", () => {
		const failure = dbFailure({ message: 'relation "profiles" does not exist', code: "42P01" }, "fallback");
		expect(failure.message).toBe("fallback");
		expect(failure.status).toBe(500);
		expect(failure.details?.sqlstate).toBe("42P01");
	});

	it("turns a unique violation into a conflict", () => {
		expect(dbFailure({ message: "duplicate key", code: "23505" }, "x").status).toBe(409);
	});

	it("turns an RLS refusal into a 403", () => {
		expect(dbFailure({ message: "new row violates row-level security policy", code: "42501" }, "x").status).toBe(403);
	});

	it("treats a raised function exception as authored copy", () => {
		// Our own triggers raise P0001 with human messages such as 'too_young'.
		const failure = dbFailure({ message: "you must be 18 or older", code: "P0001" }, "x");
		expect(failure.status).toBe(400);
		expect(failure.message).toContain("18");
	});

	it("handles a null error without throwing", () => {
		expect(dbFailure(null, "nothing happened").message).toBe("nothing happened");
	});
});

describe("mapUnknownError", () => {
	it("converts arbitrary throwables into a safe envelope", () => {
		const mapped = mapUnknownError({ weird: "object with a password=hunter2 inside" }, "request");
		expect(mapped.code).toBe("internal_error");
		expect(JSON.stringify(mapped)).not.toContain("hunter2");
	});

	it("passes ApiFailure through unchanged", () => {
		const failure = badRequest("Write something first.");
		expect(mapUnknownError(failure, "request").message).toBe("Write something first.");
	});
});

describe("failureResponse", () => {
	it("returns the requestId so a user report can be matched to a log line", async () => {
		const response = failureResponse({ code: "rate_limited", message: "Slow down.", retryAfterSeconds: 12 }, "req_123", { "X-Limit": "1" });
		expect(response.status).toBe(429);
		expect(response.headers.get("x-request-id")).toBe("req_123");
		expect(response.headers.get("retry-after")).toBe("12");
		// A 429 is retryable by definition; a 409/400 is not, and auto-retrying one of
		// those is how a message gets stored twice.
		expect(response.headers.get("x-should-retry")).toBe("true");
		const body = await response.json();
		expect(body).toMatchObject({ ok: false, error: { code: "rate_limited" }, requestId: "req_123" });
	});

	it("never includes a stack or data field on errors", async () => {
		const body = await failureResponse(mapUnknownError(new Error("at Object.<anonymous> /app/x.ts:1:1")), "req_9").json();
		expect(JSON.stringify(body)).not.toContain("at Object");
		expect(JSON.stringify(body)).not.toContain("/app/");
		expect(body.data).toBeUndefined();
	});
});
