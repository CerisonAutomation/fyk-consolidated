import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MAX_MESSAGE_LENGTH, buildContext, clientIp, newRequestId, readJson, readQuery, success } from "./context";
import { badRequest } from "./errors";

const request = (body: unknown, headers: Record<string, string> = {}) =>
	new Request("http://localhost/api/test", {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: typeof body === "string" ? body : JSON.stringify(body),
	});

describe("newRequestId", () => {
	it("trusts a well-formed inbound id so a trace survives the proxy chain", () => {
		expect(newRequestId(new Headers({ "x-request-id": "trace-abc_123" }))).toBe("trace-abc_123");
	});

	it("replaces a hostile or malformed id instead of reflecting it", () => {
		expect(newRequestId(new Headers({ "x-request-id": "<script>x</script>" }))).toMatch(/^fyk_[a-f0-9]{20}$/);
		expect(newRequestId(new Headers({ "x-request-id": "ab" }))).toMatch(/^fyk_/);
		expect(newRequestId(new Headers())).toMatch(/^fyk_/);
	});
});

describe("clientIp", () => {
	it("takes only the first XFF hop, since later ones are attacker-controlled", () => {
		expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1, 10.0.0.2" }))).toBe("203.0.113.7");
		expect(clientIp(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
		expect(clientIp(new Headers())).toBe("unknown");
	});
});

describe("readJson", () => {
	const schema = z.object({ name: z.string().min(2), age: z.number().int().min(18) });

	it("returns parsed data for a valid body", async () => {
		await expect(readJson(request({ name: "Nik", age: 31 }), schema)).resolves.toEqual({ name: "Nik", age: 31 });
	});

	it("surfaces a single field error as the authored message", async () => {
		const error = await readJson(request({ name: "N", age: 31 }), schema).catch((caught) => caught);
		expect(error).toBeInstanceOf(badRequest().constructor);
		// Zod's own wording is library text; it is rewritten into product copy.
		expect(error.message).not.toMatch(/Too small|expected string/i);
		expect(error.message.toLowerCase()).toContain("name");
	});

	it("keeps a message the schema author wrote", async () => {
		const authored = z.object({ handle: z.string().regex(/^[a-z]+$/, "Lowercase letters only.") });
		const error = await readJson(request({ handle: "NO" }), authored).catch((caught) => caught);
		expect(error.message).toBe("Lowercase letters only.");
	});

	it("lists every offending field when there is more than one", async () => {
		const error = await readJson(request({ name: "N", age: 5 }), schema).catch((caught) => caught);
		expect(error.message).toBe("Some of those answers are not valid.");
		expect((error.details?.fields as unknown[]).length).toBe(2);
	});

	it("refuses junk, wrong content types and oversized bodies", async () => {
		await expect(readJson(request("{not json"), schema)).rejects.toThrow(/not valid JSON/);
		await expect(readJson(new Request("http://x/api/y", { method: "POST", body: "hi" }), schema)).rejects.toThrow(/Content-Type/);
		await expect(readJson(request({ blob: "x".repeat(70 * 1024) }), z.object({ blob: z.string() }))).rejects.toMatchObject({ code: "payload_too_large" });
	});

	it("applies schema defaults instead of trusting the client to send them", async () => {
		const withDefault = z.object({ page: z.number().int().default(0), body: z.string().max(MAX_MESSAGE_LENGTH) });
		await expect(readJson(request({ body: "hi" }), withDefault)).resolves.toMatchObject({ page: 0 });
	});
});

describe("readQuery", () => {
	it("coerces and validates query strings", () => {
		const schema = z.object({ page: z.coerce.number().int().min(0).default(0), when: z.enum(["upcoming", "past"]).default("upcoming") });
		expect(readQuery(new URLSearchParams("page=2&when=past"), schema)).toEqual({ page: 2, when: "past" });
		expect(readQuery(new URLSearchParams(), schema)).toEqual({ page: 0, when: "upcoming" });
		expect(() => readQuery(new URLSearchParams("when=whenever"), schema)).toThrow(/filters are not valid/);
	});
});

describe("success envelope", () => {
	it("wraps data with the request id and refuses caching", () => {
		const response = success({ ok: 1 }, "req_7", { "X-RateLimit-Limit": "3" });
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("x-request-id")).toBe("req_7");
		expect(response.headers.get("content-type")).toContain("application/json");
		return expect(response.json()).resolves.toEqual({ ok: true, data: { ok: 1 }, requestId: "req_7" });
	});
});

describe("buildContext", () => {
	it("exposes method, path and query without re-parsing per handler", () => {
		const url = new URL("http://localhost/api/discover?page=2");
		const req = new Request(url, { method: "GET" });
		const ctx = buildContext({ request: req, headers: req.headers, url, requestId: "r1", getClient: () => undefined as never });
		expect(ctx.method).toBe("GET");
		expect(ctx.path).toBe("/api/discover");
		expect(ctx.query.get("page")).toBe("2");
		expect(ctx.requestId).toBe("r1");
	});

	it("memoizes the database client so one request never opens two", () => {
		let created = 0;
		const url = new URL("http://localhost/api/session");
		const req = new Request(url);
		const ctx = buildContext({
			request: req,
			headers: req.headers,
			url,
			requestId: "r2",
			getClient: () => {
				created += 1;
				return {} as never;
			},
		});
		ctx.db();
		ctx.db();
		expect(created).toBe(1);
	});
});
