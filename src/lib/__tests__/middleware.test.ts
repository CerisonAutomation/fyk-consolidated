import { describe, expect, it } from "vitest";
import {
	ApiError,
	assertSameOrigin,
	DEFAULT_MAX_BODY_BYTES,
	parseJsonBody,
	readBodyCapped,
	safeDeepLink,
	toSafeError,
	validateUuid,
} from "@/middleware";

const URL_HERE = "https://fyk.test/api/events";

function requestFor(init: RequestInit = {}): Request {
	return new Request(URL_HERE, init);
}

/**
 * `assertSameOrigin` is the CSRF control the old code did not have: every
 * mutating endpoint used to trust a cookie-less, origin-less request, and the
 * session itself was never verified. These cases pin both the rejections and
 * the deliberate exemptions.
 */
describe("assertSameOrigin", () => {
	it("lets safe methods through untouched", () => {
		expect(() => assertSameOrigin(requestFor({ method: "GET" }))).not.toThrow();
		expect(() =>
			assertSameOrigin(requestFor({ method: "HEAD" })),
		).not.toThrow();
	});

	it("exempts bearer-authenticated mutations (a cross-site page cannot read the token)", () => {
		const request = requestFor({
			method: "POST",
			headers: {
				authorization: "Bearer eyJhbGciOi.test.token",
				origin: "https://evil.test",
			},
		});
		expect(() => assertSameOrigin(request)).not.toThrow();
	});

	it("honours Sec-Fetch-Site before any header guessing", () => {
		expect(() =>
			assertSameOrigin(
				requestFor({
					method: "POST",
					headers: { "sec-fetch-site": "cross-site" },
				}),
			),
		).toThrowError(/Cross-site/i);

		expect(() =>
			assertSameOrigin(
				requestFor({
					method: "POST",
					headers: { "sec-fetch-site": "same-origin" },
				}),
			),
		).not.toThrow();
	});

	it("accepts a matching origin and rejects a foreign one", () => {
		expect(() =>
			assertSameOrigin(
				requestFor({ method: "POST", headers: { origin: "https://fyk.test" } }),
			),
		).not.toThrow();

		expect(() =>
			assertSameOrigin(
				requestFor({
					method: "POST",
					headers: { origin: "https://attacker.test" },
				}),
			),
		).toThrowError(/Origin not allowed/i);
	});

	it("falls back to Referer when Origin is absent", () => {
		expect(() =>
			assertSameOrigin(
				requestFor({
					method: "POST",
					headers: { referer: "https://fyk.test/discover" },
				}),
			),
		).not.toThrow();
		expect(() => assertSameOrigin(requestFor({ method: "POST" }))).toThrowError(
			/Missing origin/i,
		);
	});
});

describe("readBodyCapped", () => {
	it("returns the body when it fits", async () => {
		const body = await readBodyCapped(
			requestFor({ method: "POST", body: '{"a":1}' }),
			1024,
		);
		expect(new TextDecoder().decode(body)).toBe('{"a":1}');
	});

	it("rejects on a lying Content-Length before reading a byte", async () => {
		await expect(
			readBodyCapped(
				requestFor({
					method: "POST",
					headers: { "content-length": "999999999" },
					body: "tiny",
				}),
				1024,
			),
		).rejects.toThrowError(/exceeds/i);
	});

	it("rejects an oversized chunked body by counting streamed bytes", async () => {
		const chunk = new Uint8Array(4096);
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				for (let i = 0; i < 8; i += 1) controller.enqueue(chunk);
				controller.close();
			},
		});
		const request = new Request(URL_HERE, {
			method: "POST",
			body: stream,
			duplex: "half",
		} as RequestInit);
		await expect(readBodyCapped(request, 8 * 1024)).rejects.toThrowError(
			ApiError,
		);
	});
});

describe("parseJsonBody", () => {
	it("requires application/json", async () => {
		const result = await parseJsonBody(
			requestFor({
				method: "POST",
				headers: { "content-type": "text/plain" },
				body: "{}",
			}),
			DEFAULT_MAX_BODY_BYTES,
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.response.status).toBe(415);
	});

	it("rejects an empty or malformed body with 400", async () => {
		const empty = await parseJsonBody(
			requestFor({
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "",
			}),
			1024,
		);
		expect(empty.ok).toBe(false);

		const malformed = await parseJsonBody(
			requestFor({
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{oops",
			}),
			1024,
		);
		expect(malformed.ok).toBe(false);
		if (!malformed.ok)
			expect(await malformed.response.json()).toHaveProperty("error");
	});

	it("parses a valid body", async () => {
		const result = await parseJsonBody<{ action: string }>(
			requestFor({
				method: "POST",
				headers: { "content-type": "application/json" },
				body: '{"action":"join"}',
			}),
			1024,
		);
		expect(result.ok && result.data.action).toBe("join");
	});
});

describe("validation helpers", () => {
	it("validateUuid accepts only UUIDs", () => {
		expect(validateUuid("215b2a4e-4c28-4f52-9c1a-9e1a0f0a1f2e", "id").ok).toBe(
			true,
		);
		expect(validateUuid("../etc/passwd", "id").ok).toBe(false);
		expect(validateUuid(undefined, "id").ok).toBe(false);
	});

	it("safeDeepLink only accepts same-origin app paths", () => {
		expect(safeDeepLink("/notifications")).toBe("/notifications");
		expect(safeDeepLink("https://evil.test/x")).toBeNull();
		expect(safeDeepLink("javascript:alert(1)")).toBeNull();
		expect(safeDeepLink("//evil.test")).toBeNull();
		expect(safeDeepLink(42)).toBeNull();
	});

	it("toSafeError never forwards an unknown message", () => {
		expect(toSafeError(new ApiError(409, "Event is full"))).toEqual({
			status: 409,
			message: "Event is full",
		});
		const leaked = toSafeError(new Error("connect ECONNREFUSED 10.0.0.5:5432"));
		expect(leaked.status).toBe(500);
		expect(leaked.message).not.toContain("ECONNREFUSED");
		expect(leaked.message).not.toContain("10.0.0.5");
	});
});
