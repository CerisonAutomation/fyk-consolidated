import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, api } from "./client";

/**
 * The transport is where "the server said no" becomes something a screen can show.
 * These tests pin the four behaviours that are invisible when they work and awful
 * when they break: cookie credentials, no blind retry of writes, envelope
 * unwrapping, and never forwarding an HTML error page as if it were data.
 */

const json = (body: unknown, init: ResponseInit = {}) =>
	new Response(JSON.stringify(body), {
		status: 200,
		headers: { "content-type": "application/json" },
		...init,
	});

const envelope = <T>(data: T) => ({
	ok: true as const,
	data,
	requestId: "srv_1",
});

let lastRequest: { url: string; init: RequestInit } | null = null;

function stubFetch(handler: (call: number) => Response | Promise<Response>) {
	let calls = 0;
	lastRequest = null;
	vi.stubGlobal(
		"fetch",
		async (input: RequestInfo | URL, init: RequestInit) => {
			calls += 1;
			lastRequest = { url: String(input), init };
			return handler(calls);
		},
	);
	return () => calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
	it("sends cookies and a request id, and unwraps the envelope", async () => {
		const calls = stubFetch(() => json(envelope({ hello: "world" })));
		await expect(api.get<{ hello: string }>("discover")).resolves.toEqual({
			hello: "world",
		});
		expect(calls()).toBe(1);
		expect(lastRequest?.url).toBe("/api/discover");
		expect(lastRequest?.init.credentials).toBe("include");
		expect(
			new Headers(lastRequest?.init.headers as HeadersInit).get("x-request-id"),
		).toMatch(/^[a-z0-9_]{8,}$/i);
	});

	it("normalizes paths so callers cannot build //api or escape the prefix", async () => {
		stubFetch(() => json(envelope(1)));
		await api.get("///discover///");
		expect(lastRequest?.url).toBe("/api/discover");
		await api.get("/conversations/abc/messages");
		expect(lastRequest?.url).toBe("/api/conversations/abc/messages");
	});

	it("throws a readable error built from the server envelope", async () => {
		stubFetch(() =>
			json(
				{
					ok: false,
					error: {
						code: "rate_limited",
						message: "Slow down — try again in a minute.",
					},
					requestId: "srv_9",
				},
				{
					status: 429,
					headers: { "retry-after": "31", "x-should-retry": "true" },
				},
			),
		);
		const error = await api
			.get("board")
			.catch((caught) => caught as ApiClientError);
		expect(error).toBeInstanceOf(ApiClientError);
		expect(error.code).toBe("rate_limited");
		expect(error.status).toBe(429);
		expect(error.retryable).toBe(true);
		expect(error.requestId).toBe("srv_9");
	});

	it("treats a conflict as final, not retryable", async () => {
		stubFetch(() =>
			json(
				{
					ok: false,
					error: { code: "conflict", message: "You already have a live post." },
					requestId: "r",
				},
				{ status: 409 },
			),
		);
		const error = (await api
			.post("board", {})
			.catch((caught) => caught)) as ApiClientError;
		expect(error.retryable).toBe(false);
		expect(error.isBlocking).toBe(true);
	});

	it("flags an auth failure so the shell can re-check the session", async () => {
		stubFetch(() =>
			json(
				{
					ok: false,
					error: { code: "unauthorized", message: "Sign in again." },
				},
				{ status: 401 },
			),
		);
		const error = (await api
			.get("settings")
			.catch((caught) => caught)) as ApiClientError;
		expect(error.isAuth).toBe(true);
	});

	it("retries a GET once on a network failure but never a POST", async () => {
		const getCount = stubFetch((call) =>
			call === 1
				? Promise.reject(new TypeError("fetch failed"))
				: json(envelope({ ok: true })),
		);
		await expect(api.get("notifications")).resolves.toEqual({ ok: true });
		expect(getCount()).toBe(2);

		const postCalls = stubFetch((call) =>
			call === 1
				? Promise.reject(new TypeError("fetch failed"))
				: json(envelope({ ok: true })),
		);
		await expect(api.post("messages", { body: "hi" })).rejects.toBeInstanceOf(
			ApiClientError,
		);
		expect(postCalls()).toBe(1);
	});

	it("converts a non-JSON answer (a proxy error page) into a clean failure", async () => {
		stubFetch(
			() =>
				new Response("<html><body>502 Bad Gateway</body></html>", {
					status: 502,
					headers: { "content-type": "text/html" },
				}),
		);
		const error = (await api
			.get("board")
			.catch((caught) => caught)) as ApiClientError;
		expect(error.code).toBe("dependency_unavailable");
		expect(error.message).not.toContain("<html");
		expect(error.retryable).toBe(true);
	});

	it("reports an empty 204-style body as a server problem rather than undefined data", async () => {
		stubFetch(() => new Response("", { status: 200 }));
		const error = (await api
			.get("board")
			.catch((caught) => caught)) as ApiClientError;
		expect(error.code).toBe("internal_error");
	});

	it("sends a JSON body for writes and FormData untouched for uploads", async () => {
		stubFetch(() => json(envelope({ saved: true })));
		await api.post("settings/profile", { displayName: "Nik" });
		expect(lastRequest?.init.method).toBe("POST");
		expect(
			new Headers(lastRequest?.init.headers as HeadersInit).get("content-type"),
		).toContain("application/json");

		const form = new FormData();
		form.append("files", new Blob(["x"], { type: "image/png" }), "a.png");
		await api.postForm("media/photos", form);
		expect(lastRequest?.init.method).toBe("POST");
		// Setting Content-Type on a FormData body breaks the multipart boundary.
		expect(
			new Headers(lastRequest?.init.headers as HeadersInit).get("content-type"),
		).toBeNull();
		expect(lastRequest?.init.body).toBe(form);
	});

	it("uses DELETE for del()", async () => {
		stubFetch(() => json(envelope({ blocked: false })));
		await api.del("blocks/some-id");
		expect(lastRequest?.init.method).toBe("DELETE");
	});
});
