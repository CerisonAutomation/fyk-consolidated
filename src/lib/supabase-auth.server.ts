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
	return tokenFromCookieHeader(request.headers.get("cookie"));
}

/**
 * The session cookie, reassembled.
 *
 * `@supabase/ssr` writes a session too large for one cookie as
 * `<name>.0`, `<name>.1`, … (it chunks at 3180 bytes because that is what a
 * browser accepts per cookie, and it splits along `%XX` boundaries so each chunk
 * decodes on its own). Reading only the un-chunked name would work in a review
 * and fail for a real session — a JWT plus a refresh token plus the user object
 * clears 3180 bytes often enough that this is the normal case, not the edge
 * case — so the chunks are grouped, ordered and joined here.
 *
 * The name test is a pattern, not a constant: Supabase derives the cookie name
 * from the project ref (`sb-<ref>-auth-token`), and a deployment that sets
 * `cookieOptions.name` is allowed to. `*-auth-token` is what both share.
 * The PKCE code verifier (`sb-<ref>-auth-code-verifier`) matches the same shape
 * and is deliberately excluded: it is 43 characters of verifier, not a token.
 */
export function tokenFromCookieHeader(header: string | null): string | null {
	if (!header) return null;
	type Entry = { base: string; index: number; value: string };
	const entries: Entry[] = [];
	for (const part of header.split(/;\s*/)) {
		const eq = part.indexOf("=");
		if (eq < 0) continue;
		const name = part.slice(0, eq);
		if (/verifier|csrf|state/i.test(name)) continue;
		if (
			!/(^|[-.])sb[-=].*auth.*$|fyk\.auth/i.test(name) &&
			!name.includes("auth-token")
		) {
			continue;
		}
		let value = part.slice(eq + 1);
		try {
			value = decodeURIComponent(value);
		} catch {
			/* an undecodable cookie is not a credential */
			continue;
		}
		const chunked = /^(.*)\.(0|[1-9][0-9]*)$/.exec(name);
		entries.push({
			base: chunked ? chunked[1] : name,
			index: chunked ? Number(chunked[2]) : 0,
			value,
		});
	}
	if (entries.length === 0) return null;

	const groups = new Map<string, Entry[]>();
	for (const entry of entries) {
		const list = groups.get(entry.base);
		if (list) list.push(entry);
		else groups.set(entry.base, [entry]);
	}
	for (const list of groups.values()) {
		list.sort((a, b) => a.index - b.index);
		const joined = list.map((entry) => entry.value).join("");
		const token = extractTokenFromCookieValue(joined);
		if (token) return token;
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

type LocalVerdict =
	| { kind: "ok"; caller: Caller }
	| { kind: "expired"; sub: string | null }
	| { kind: "rejected" };

/**
 * Verify a Supabase access token locally. Supabase signs GoTrue tokens with
 * HS256 using the project JWT secret, which the deployment owns.
 *
 * "expired" is separated from "rejected" because the two need opposite answers
 * upstream: an expired token says *this browser is signed in and is about to
 * refresh*, and a document render must not bounce it; a forged signature says
 * nothing at all and is answered the same way as no credential.
 */
function verifyLocally(token: string, secret: string): LocalVerdict {
	const jwt = parseJwt(token);
	if (!jwt) return { kind: "rejected" };
	const expected = createHmac("sha256", secret)
		.update(jwt.signingInput)
		.digest();
	if (expected.length !== jwt.signature.length) return { kind: "rejected" };
	if (!timingSafeEqual(expected, jwt.signature)) return { kind: "rejected" };

	const now = Math.floor(Date.now() / 1000);
	if (typeof jwt.payload.exp === "number" && jwt.payload.exp <= now) {
		return { kind: "expired", sub: jwt.payload.sub ?? null };
	}
	if (jwt.payload.role === "anon") return { kind: "rejected" };
	if (!jwt.payload.sub) return { kind: "rejected" };

	return {
		kind: "ok",
		caller: {
			id: jwt.payload.sub,
			email: jwt.payload.email ?? null,
			role: jwt.payload.role ?? null,
		},
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
 * Why a request is not authenticated, when it is not. `expired` and
 * `unreachable` are the two that must not be treated as "signed out" by a
 * document render — see `#/lib/document-auth.server`.
 */
export type Verification =
	| { status: "authenticated"; caller: Caller }
	| { status: "expired"; sub: string | null }
	| { status: "anonymous" }
	| { status: "rejected" }
	| { status: "unreachable" }
	| { status: "unconfigured" };

/**
 * The one verification path, shared by `/api/*` (`getCaller`) and the SSR
 * document guard (`#/lib/document-auth.server`). Two implementations of "who is
 * this request" is how a project ends up with a JSON API that checks the
 * signature and an HTML render that trusts the cookie name.
 */
export async function verifyRequest(request: Request): Promise<Verification> {
	const cfg = config();
	if (!cfg) {
		logError(SCOPE, new Error("SUPABASE_URL / SUPABASE_ANON_KEY are not set"));
		return { status: "unconfigured" };
	}
	const token = bearerToken(request);
	if (!token) return { status: "anonymous" };

	if (cfg.jwtSecret) {
		const local = verifyLocally(token, cfg.jwtSecret);
		// Every verdict is final in this branch, including `rejected`, and that is
		// the point. Asking GoTrue about a token whose HMAC this server has just
		// disproved turns "not authenticated" into whatever the network reports:
		// probed against a dev server pointed at a non-existent project, a forged
		// cookie fell through to introspection, `ENOTFOUND` came back as
		// `unreachable`, and a document guard that fails open on `unreachable`
		// rendered `/settings`. A project secret this server holds is the stronger
		// authority, so when one is configured there is no network hop at all —
		// which also means a replayed bogus token costs one HMAC and nothing more.
		if (local.kind === "ok")
			return { status: "authenticated", caller: local.caller };
		if (local.kind === "expired") return { status: "expired", sub: local.sub };
		return { status: "rejected" };
	}

	const key = cacheKey(token);
	const hit = cache.get(key);
	if (hit && hit.expiresAt > Date.now()) {
		return hit.caller
			? { status: "authenticated", caller: hit.caller }
			: { status: "rejected" };
	}

	let caller: Caller | null = null;
	try {
		caller = await introspect(cfg, token);
	} catch (error) {
		logError(SCOPE, error, { stage: "introspect" });
		// Do not cache an infrastructure failure: the next request retries.
		return { status: "unreachable" };
	}
	cachePut(key, caller);
	return caller ? { status: "authenticated", caller } : { status: "rejected" };
}

/**
 * Resolve the caller of a request, or `null` when the request is anonymous,
 * expired, forged or unverifiable. Never throws for "not signed in": only
 * genuine infrastructure failures are logged.
 *
 * This is what every `/api/*` route calls (through `#/middleware#withSecurity`).
 * It is `verifyRequest` narrowed to a boolean-shaped answer, so that the ~30
 * handlers that say `if (!caller) return jsonError("Sign in first", 401)` did
 * not have to change when the statuses were introduced for the document guard.
 */
export async function getCaller(request: Request): Promise<Caller | null> {
	const verification = await verifyRequest(request);
	return verification.status === "authenticated" ? verification.caller : null;
}

/** Drop every cached verification result (tests, token revocation drills). */
export function clearCallerCache(): void {
	cache.clear();
}
