/**
 * Server-only Supabase identity resolution for the `/api/*` routes.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The browser authenticates against Supabase Auth (`EntryShell`, `auth-guard`,
 * every `#/integrations/supabase/*` module rely on that session), while the
 * JSON API routes used `auth.api.getSession()` from better-auth. better-auth was
 * configured with **no database adapter**, so it could never have issued or read
 * a session — every `POST /api/events`, `/api/meetnow`, `/api/notifications` and
 * `/api/push/subscribe` therefore answered `401 Unauthorized` for a signed-in
 * user, and every `GET` silently treated them as anonymous.
 *
 * Server handlers now verify the credential the client actually holds:
 *   1. `Authorization: Bearer <supabase access token>` (sent by `#/lib/client`), or
 *   2. the persisted session cookie, when the deployment uses one.
 *
 * Verification order:
 *   - `SUPABASE_JWT_SECRET` present  → verify HS256 locally (no network hop);
 *   - otherwise                      → introspect GoTrue `GET /auth/v1/user`.
 * Results are cached briefly so a burst of requests from one client does not
 * turn into a burst of GoTrue round-trips.
 *
 * SECURITY: this module is only importable from server code — `*.server.ts`
 * files are covered by TanStack Start's import protection, and it reads
 * `process.env`, which does not exist in the browser bundle.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { logError } from "#/lib/logger";

const SCOPE = "auth/supabase";

export type Caller = {
	/** Supabase `auth.users.id` — also the FK target of every app table. */
	id: string;
	email: string | null;
	/** Postgres role from the JWT (`authenticated` | `anon` | `service_role`). */
	role: string | null;
};

type Cfg = { url: string; anonKey: string; jwtSecret: string | null };

let cachedCfg: Cfg | null | undefined;

function config(): Cfg | null {
	if (cachedCfg !== undefined) return cachedCfg;
	const url = (
		process.env.SUPABASE_URL ??
		process.env.VITE_SUPABASE_URL ??
		""
	).trim();
	const anonKey = (
		process.env.SUPABASE_ANON_KEY ??
		process.env.VITE_SUPABASE_ANON_KEY ??
		""
	).trim();
	const jwtSecret = (process.env.SUPABASE_JWT_SECRET ?? "").trim() || null;
	if (!url || !anonKey) {
		cachedCfg = null;
		return null;
	}
	cachedCfg = { url: url.replace(/\/+$/, ""), anonKey, jwtSecret };
	return cachedCfg;
}

/** True when the server is configured to verify Supabase tokens at all. */
export function isAuthConfigured(): boolean {
	return config() !== null;
}

/* ------------------------------ token extraction -------------------------- */

export function bearerToken(request: Request): string | null {
	const header = request.headers.get("authorization");
	if (header) {
		const [scheme, value] = header.trim().split(/\s+/);
		if (scheme?.toLowerCase() === "bearer" && value) return value;
		if (scheme?.toLowerCase() === "token" && value) return value;
	}
	// supabase-js cookie format: base64url JSON `{ "access_token": "…" }`,
	// plus the plain `sb-<ref>-auth-token` variant.
	const cookie = request.headers.get("cookie");
	if (cookie) {
		for (const part of cookie.split(/;\s*/)) {
			const eq = part.indexOf("=");
			if (eq < 0) continue;
			const name = part.slice(0, eq);
			if (
				!/(^|[-.])sb[-=].*auth.*$|fyk\.auth/i.test(name) &&
				!name.includes("auth-token")
			) {
				continue;
			}
			const raw = decodeURIComponent(part.slice(eq + 1));
			const token = extractTokenFromCookieValue(raw);
			if (token) return token;
		}
	}
	return null;
}

function extractTokenFromCookieValue(raw: string): string | null {
	const candidates = [raw, safeBase64UrlDecode(raw)];
	for (const candidate of candidates) {
		if (!candidate) continue;
		if (candidate.startsWith("{")) {
			try {
				const parsed = JSON.parse(candidate) as { access_token?: string };
				if (parsed.access_token) return parsed.access_token;
			} catch {
				/* not JSON — fall through */
			}
		} else if (candidate.split(".").length === 3) {
			return candidate;
		}
	}
	return null;
}

function safeBase64UrlDecode(value: string): string | null {
	try {
		return Buffer.from(value, "base64url").toString("utf8");
	} catch {
		return null;
	}
}

/* ------------------------------ jwt (HS256) ------------------------------- */

type JwtPayload = {
	sub?: string;
	email?: string;
	role?: string;
	/** seconds since epoch */
	exp?: number;
	iat?: number;
	aal?: string;
};

function decodeSegment(segment: string): Buffer {
	return Buffer.from(segment, "base64url");
}

function parseJwt(token: string): {
	header: JwtPayload;
	payload: JwtPayload;
	signingInput: string;
	signature: Buffer;
} | null {
	const parts = token.split(".");
	if (parts.length !== 3) return null;
	const [h, p, s] = parts as [string, string, string];
	try {
		return {
			header: JSON.parse(decodeSegment(h).toString("utf8")) as JwtPayload,
			payload: JSON.parse(decodeSegment(p).toString("utf8")) as JwtPayload,
			signingInput: `${h}.${p}`,
			signature: decodeSegment(s),
		};
	} catch {
		return null;
	}
}

/**
 * Verify a Supabase access token locally. Supabase signs GoTrue tokens with
 * HS256 using the project JWT secret, which the deployment owns.
 */
function verifyLocally(token: string, secret: string): Caller | null {
	const jwt = parseJwt(token);
	if (!jwt) return null;
	const expected = createHmac("sha256", secret)
		.update(jwt.signingInput)
		.digest();
	if (expected.length !== jwt.signature.length) return null;
	if (!timingSafeEqual(expected, jwt.signature)) return null;

	const now = Math.floor(Date.now() / 1000);
	if (typeof jwt.payload.exp === "number" && jwt.payload.exp <= now)
		return null;
	if (jwt.payload.role === "anon") return null;
	if (!jwt.payload.sub) return null;

	return {
		id: jwt.payload.sub,
		email: jwt.payload.email ?? null,
		role: jwt.payload.role ?? null,
	};
}

/* ------------------------------ introspection ----------------------------- */

type CacheEntry = { caller: Caller | null; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_MS = 30_000;
const CACHE_MAX = 2_000;

function cacheKey(token: string): string {
	return createHash("sha256").update(token).digest("hex").slice(0, 32);
}

function cachePut(key: string, caller: Caller | null): void {
	if (cache.size >= CACHE_MAX) {
		// Drop everything older than the TTL instead of evicting LRU-style: the
		// cache is short-lived and this keeps the hot path allocation-free.
		const now = Date.now();
		for (const [k, v] of cache) if (v.expiresAt <= now) cache.delete(k);
		if (cache.size >= CACHE_MAX) cache.clear();
	}
	cache.set(key, { caller, expiresAt: Date.now() + CACHE_MS });
}

async function introspect(cfg: Cfg, token: string): Promise<Caller | null> {
	const response = await fetch(`${cfg.url}/auth/v1/user`, {
		headers: {
			authorization: `Bearer ${token}`,
			apikey: cfg.anonKey,
		},
		// A hung GoTrue must not pin a server request open forever.
		signal: AbortSignal.timeout(5_000),
	});
	if (!response.ok) return null;
	const user = (await response.json()) as {
		id?: string;
		email?: string;
		role?: string;
	};
	if (!user.id) return null;
	return { id: user.id, email: user.email ?? null, role: user.role ?? null };
}

/**
 * Resolve the caller of a request, or `null` when the request is anonymous or
 * the token is invalid/expired. Never throws for "not signed in"; only genuine
 * infrastructure failures are logged.
 */
export async function getCaller(request: Request): Promise<Caller | null> {
	const cfg = config();
	if (!cfg) {
		logError(SCOPE, new Error("SUPABASE_URL / SUPABASE_ANON_KEY are not set"));
		return null;
	}
	const token = bearerToken(request);
	if (!token) return null;

	if (cfg.jwtSecret) {
		const local = verifyLocally(token, cfg.jwtSecret);
		// A locally-verifiable token needs no cache; a *rejected* one is cached so
		// a replaying client cannot force a HMAC per request.
		if (local) return local;
	}

	const key = cacheKey(token);
	const hit = cache.get(key);
	if (hit && hit.expiresAt > Date.now()) return hit.caller;

	let caller: Caller | null = null;
	try {
		caller = await introspect(cfg, token);
	} catch (error) {
		logError(SCOPE, error, { stage: "introspect" });
		// Do not cache an infrastructure failure: the next request retries.
		return null;
	}
	cachePut(key, caller);
	return caller;
}

/** Drop every cached verification result (tests, token revocation drills). */
export function clearCallerCache(): void {
	cache.clear();
}
