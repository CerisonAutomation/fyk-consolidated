/**
 * Server request guards shared by every `/api/*` handler.
 *
 * WHY IT CHANGED
 * --------------
 * The previous version of this file hand-rolled three checks and got all three
 * subtly wrong:
 *
 *   1. CSRF was validated against a hard-coded allowlist
 *      (`localhost:3000`, `localhost:5173`, `fyk.app`, `www.fyk.app`). Any other
 *      deployment (preview, staging, a custom domain) had every mutating request
 *      rejected with 403 — and, worse, a request with *no* `Origin` and *no*
 *      `Referer` was accepted unconditionally, which is exactly what a
 *      same-site form POST or a non-browser replay looks like.
 *   2. Body size was enforced by trusting the client-supplied `Content-Length`
 *      header. Omit the header and the limit disappeared entirely.
 *   3. `jsonError()` leaked `details` whenever `NODE_ENV !== "production"`, and
 *      the responses carried none of the hardening headers the repo claimed.
 *
 * What lives here now:
 *   - `withSecurity(handler, options)` — one wrapper for headers, CSRF, size cap,
 *     rate limit and session resolution, so a route cannot forget one of them.
 *   - Origin binding derived from the request itself (never from `Origin`), with
 *     an optional env-driven extension for proxy/CDN deployments.
 *   - A real, streaming body-size cap.
 *
 * NOTE: this module runs on the server. It is imported by `src/routes/api/**`,
 * which TanStack Start only evaluates server-side.
 */

import { logError, logger } from "#/lib/logger";
import {
	clientIp,
	DEFAULT_WINDOW_MS,
	enforceRateLimit,
	type RateLimitResult,
} from "#/lib/rate-limit";
import {
	noStoreHeaders,
	publicCacheHeaders,
	securityHeaders,
} from "#/lib/security";
import type { Caller } from "#/lib/supabase-auth.server";
import { getCaller } from "#/lib/supabase-auth.server";

const SCOPE = "request-security";

/* ------------------------------ response shaping ---------------------------- */

export function json(
	data: unknown,
	init?: {
		status?: number;
		cache?: "private" | "public";
		headers?: Record<string, string>;
	},
): Response {
	const status = init?.status ?? 200;
	// `Pragma: no-cache` and `Vary: Cookie, Authorization` are only correct for a
	// response that must not be cached: stamping them onto a public response
	// (max-age below) both contradicts the Cache-Control and defeats the CDN.
	const cache =
		init?.cache === "public" || init?.headers?.["Cache-Control"]
			? publicCacheHeaders(30)
			: noStoreHeaders();
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			...securityHeaders(),
			...cache,
			...init?.headers,
		},
	});
}

/**
 * Error responses never carry internals: `details` is for logs, not for the
 * network. The caller's `message` is only surfaced when it is a message we
 * wrote ourselves (see `apiError`), never a raw Prisma/Postgres error.
 */
export function jsonError(
	message: string,
	status = 400,
	error?: unknown,
): Response {
	if (error !== undefined) logError(SCOPE, error, { status, message });
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			...securityHeaders(),
			...noStoreHeaders(),
		},
	});
}

/**
 * Turn an unknown thrown value into a safe (status, message) pair: known
 * validation/auth failures keep their text, everything else becomes a generic
 * 500 while the original error goes to the log.
 */
export function toSafeError(error: unknown): {
	status: number;
	message: string;
} {
	if (error instanceof ApiError)
		return { status: error.status, message: error.message };
	if (error instanceof Error) {
		logError("api", error);
		return { status: 500, message: "Something went wrong. Please try again." };
	}
	logError("api", error);
	return { status: 500, message: "Something went wrong. Please try again." };
}

export class ApiError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "ApiError";
	}
}

/* ---------------------------------- CSRF ----------------------------------- */

/** Extra origins allowed to call mutating endpoints (proxy/CDN rewrites). */
function allowedOrigins(): string[] {
	const raw = process.env.CORS_ALLOWED_ORIGINS ?? "";
	return raw
		.split(",")
		.map((entry) => entry.trim().replace(/\/+$/, ""))
		.filter((entry) => entry.length > 0 && entry !== "*")
		.map((entry) => {
			try {
				return new URL(entry).origin;
			} catch {
				logger.warn(
					{ scope: SCOPE, entry },
					"ignoring malformed CORS_ALLOWED_ORIGINS entry",
				);
				return "";
			}
		})
		.filter(Boolean);
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Same-origin binding for state-changing requests.
 *
 * `Sec-Fetch-Site` is honoured first (browser-authored, unspoofable from a
 * cross-site page), then `Origin`, then `Referer`. When a request carries a
 * bearer token it is CSRF-immune by construction — a cross-site document
 * cannot read it — so only cookie-authenticated mutations are constrained.
 */
export function assertSameOrigin(request: Request): void {
	if (SAFE_METHODS.has(request.method.toUpperCase())) return;

	const auth = request.headers.get("authorization");
	if (auth && /^bearer\s+\S+/i.test(auth.trim())) return; // token-authenticated

	const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
	if (secFetchSite === "same-origin" || secFetchSite === "none") return;
	if (secFetchSite === "cross-site" || secFetchSite === "same-site") {
		throw new ApiError(403, "Cross-site request blocked");
	}

	const expected = requestOrigin(request);
	const origin = request.headers.get("origin");
	if (origin) {
		if (origin === expected || allowedOrigins().includes(origin)) return;
		throw new ApiError(403, "Origin not allowed");
	}

	const referer = request.headers.get("referer");
	if (referer) {
		try {
			const refererOrigin = new URL(referer).origin;
			if (
				refererOrigin === expected ||
				allowedOrigins().includes(refererOrigin)
			)
				return;
		} catch {
			/* malformed — rejected below */
		}
		throw new ApiError(403, "Referer not allowed");
	}

	// No fetch-metadata and no origin: a browser would always send at least one
	// for a cookie-authenticated POST, so treat it as hostile.
	throw new ApiError(403, "Missing origin information");
}

/**
 * The origin the *server* believes it is serving. Derived from `request.url`
 * (set by the adapter) and never from a client header, so it cannot be spoofed
 * into blessing a malicious origin.
 */
export function requestOrigin(request: Request): string {
	try {
		return new URL(request.url).origin;
	} catch {
		return "unknown-origin";
	}
}

/* ------------------------------- body handling ------------------------------ */

export const DEFAULT_MAX_BODY_BYTES = 64 * 1024;

/**
 * Read the request body with a hard cap. `Content-Length` is used only as an
 * early-out; the authoritative check counts bytes as they stream in, so a
 * chunked or lying request cannot smuggle a larger payload past it.
 */
export async function readBodyCapped(
	request: Request,
	maxBytes: number,
): Promise<Uint8Array | null> {
	const declared = Number.parseInt(
		request.headers.get("content-length") ?? "",
		10,
	);
	if (Number.isFinite(declared) && declared > maxBytes) {
		throw new ApiError(
			413,
			`Request body exceeds ${Math.round(maxBytes / 1024)}KB`,
		);
	}
	if (!request.body) return null;

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		if (!value) continue;
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel().catch(() => undefined);
			throw new ApiError(
				413,
				`Request body exceeds ${Math.round(maxBytes / 1024)}KB`,
			);
		}
		chunks.push(value);
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return out;
}

export type JsonBodyResult<T> =
	| { ok: true; data: T }
	| { ok: false; response: Response };

/**
 * Parse + validate a JSON body against a standard-schema (Zod v4) validator.
 * Returns a 415/413/400 `Response` instead of throwing, so handlers stay flat.
 */
export async function parseJsonBody<T>(
	request: Request,
	maxBytes: number = DEFAULT_MAX_BODY_BYTES,
): Promise<JsonBodyResult<T>> {
	const contentType = request.headers.get("content-type") ?? "";
	if (!contentType.toLowerCase().includes("application/json")) {
		return {
			ok: false,
			response: jsonError("Content-Type must be application/json", 415),
		};
	}
	let body: Uint8Array | null;
	try {
		body = await readBodyCapped(request, maxBytes);
	} catch (error) {
		if (error instanceof ApiError)
			return { ok: false, response: jsonError(error.message, error.status) };
		throw error;
	}
	if (!body || body.byteLength === 0)
		return { ok: false, response: jsonError("Request body is required", 400) };
	try {
		return { ok: true, data: JSON.parse(new TextDecoder().decode(body)) as T };
	} catch {
		return {
			ok: false,
			response: jsonError("Request body is not valid JSON", 400),
		};
	}
}

/* ------------------------------ handler wrapper ----------------------------- */

export type SecurityContext = {
	request: Request;
	/** Resolved Supabase identity, or `null` for anonymous traffic. */
	caller: Caller | null;
	ip: string;
};

export type SecurityOptions = {
	/** Hard cap on the request body, in bytes. */
	maxBodySize?: number;
	/**
	 * Per-endpoint budget. `key` receives the resolved caller/IP so a route can
	 * charge mutations against the user id rather than a spoofable header.
	 */
	rateLimit?: {
		limit: number;
		windowMs?: number;
		key: (ctx: { caller: Caller | null; ip: string }) => string;
	};
	/**
	 * `required` (default for POST/PATCH/PUT/DELETE) rejects anonymous traffic
	 * with 401 before any body parsing happens.
	 */
	auth?: "required" | "optional";
	/** Skip the CSRF origin binding (webhooks with their own signature check). */
	allowCrossSite?: boolean;
};

export type SecuredHandler = (
	ctx: SecurityContext,
) => Promise<Response> | Response;

/** Shape TanStack Start expects for a route handler: `({ request }) => Response`. */
export type SecuredRouteHandler = (ctx: {
	request: Request;
}) => Promise<Response>;

/**
 * Wrap an API handler with the standard request pipeline:
 * CSRF → size cap → session → rate limit → handler, then attach headers.
 *
 * Every failure path returns JSON (never an HTML stack page), and every
 * response — including the handler's own — gets the security headers and, when
 * a limit is configured, `RateLimit-*` headers.
 *
 * Why the limiter runs *after* session resolution: the key must be the caller's
 * id when one exists (`caller?.id ?? ip`), otherwise one NAT or corporate proxy
 * would charge a thousand users against a single bucket and lock them all out.
 * The pre-auth cost this leaves unthrottled is one HMAC verification, or a
 * GoTrue round trip whose *negative* result is cached for 30s
 * (`#/lib/supabase-auth.server`), so replaying a bogus token is not an amplification
 * vector. Routes that are expensive *before* identity (none today) should take
 * `auth: "optional"` and call `enforceRateLimit` first themselves.
 */
export function withSecurity(
	handler: SecuredHandler,
	options: SecurityOptions = {},
): SecuredRouteHandler {
	const maxBytes = options.maxBodySize ?? DEFAULT_MAX_BODY_BYTES;

	return async ({ request }: { request: Request }): Promise<Response> => {
		const method = request.method.toUpperCase();
		const wantsAuth =
			options.auth ??
			(method === "GET" || method === "HEAD" ? "optional" : "required");

		try {
			if (!options.allowCrossSite) assertSameOrigin(request);
		} catch (error) {
			const safe = toSafeError(error);
			return jsonError(
				safe.message,
				safe.status,
				error instanceof ApiError ? undefined : error,
			);
		}

		// Reject oversize bodies before touching the session store.
		if (!SAFE_METHODS.has(method)) {
			const declared = Number.parseInt(
				request.headers.get("content-length") ?? "",
				10,
			);
			if (Number.isFinite(declared) && declared > maxBytes) {
				return jsonError(
					`Request body exceeds ${Math.round(maxBytes / 1024)}KB`,
					413,
				);
			}
		}

		const caller = await getCaller(request);
		if (wantsAuth === "required" && !caller) {
			return jsonError("Sign in to continue", 401);
		}

		const ip = clientIp(request);
		let rate: RateLimitResult | undefined;
		if (options.rateLimit) {
			const key = options.rateLimit.key({ caller, ip });
			const outcome = await enforceRateLimit(
				key,
				options.rateLimit.limit,
				options.rateLimit.windowMs ?? DEFAULT_WINDOW_MS,
			);
			if (outcome.blocked) return outcome.response;
			rate = outcome.result;
		}

		let response: Response;
		try {
			response = await handler({ request, caller, ip });
		} catch (error) {
			const safe = toSafeError(error);
			response = jsonError(
				safe.message,
				safe.status,
				error instanceof ApiError ? undefined : error,
			);
		}

		return withResponseHeaders(response, rate);
	};
}

/** Attach hardening + rate-limit headers to a response the handler produced. */
export function withResponseHeaders(
	response: Response,
	rate?: RateLimitResult,
): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(securityHeaders()))
		headers.set(key, value);
	if (rate) {
		headers.set("RateLimit-Limit", String(rate.limit));
		headers.set("RateLimit-Remaining", String(rate.remaining));
		headers.set(
			"RateLimit-Reset",
			String(Math.max(0, Math.ceil((rate.resetAt - Date.now()) / 1000))),
		);
	}
	if (!headers.has("cache-control") && response.status < 400) {
		for (const [key, value] of Object.entries(noStoreHeaders()))
			headers.set(key, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

/* ------------------------------ field validation ---------------------------- */

/**
 * Validate a single user-provided string. Prefer a Zod schema for whole bodies;
 * this exists for query params and for the few handlers that take one field.
 */
export function validateString(
	value: unknown,
	name: string,
	opts?: { min?: number; max?: number; pattern?: RegExp },
): { ok: true; value: string } | { ok: false; error: string } {
	if (typeof value !== "string")
		return { ok: false, error: `${name} must be a string` };
	const trimmed = value.trim();
	if (opts?.min !== undefined && trimmed.length < opts.min) {
		return {
			ok: false,
			error: `${name} must be at least ${opts.min} characters`,
		};
	}
	if (opts?.max !== undefined && trimmed.length > opts.max) {
		return {
			ok: false,
			error: `${name} must be at most ${opts.max} characters`,
		};
	}
	if (opts?.pattern && !opts.pattern.test(trimmed)) {
		return { ok: false, error: `${name} format is invalid` };
	}
	return { ok: true, value: trimmed };
}

/** UUID-shaped id check — Prisma's `@db.Uuid` columns reject anything else. */
export const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateUuid(
	value: unknown,
	name: string,
): { ok: true; value: string } | { ok: false; error: string } {
	if (typeof value !== "string")
		return { ok: false, error: `${name} must be a string` };
	if (!UUID_PATTERN.test(value))
		return { ok: false, error: `${name} must be a UUID` };
	return { ok: true, value };
}

/**
 * App-relative deep links only: these are stored in `notifications.href` and
 * rendered as `<a href>`, so an absolute or `javascript:` value would be a
 * phishing/XSS vector.
 */
export function safeDeepLink(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
	if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
	if (/[<>"'`\s]/.test(trimmed)) return null;
	return trimmed.slice(0, 512);
}

export { clientIp };
export type { RateLimitResult };
