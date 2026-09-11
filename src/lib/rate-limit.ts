/**
 * Rate limiting — Upstash Redis in production, an in-process window otherwise.
 *
 * THE BUG THIS REPLACES
 * ---------------------
 * `checkRateLimit(key, limit, windowMs)` accepted a per-endpoint budget but the
 * Upstash branch ignored both arguments and reused one process-wide limiter
 * configured with `slidingWindow(1000, "15 m")`. So in production "20 event
 * creations per 15 minutes" and "10 MeetNow posts per 15 minutes" were all
 * effectively 1000/15m — the counters every route checks. A burst of abuse
 * therefore looked normal to the limiter and only the per-user quota in the UI
 * slowed it down. Limiters are now keyed by `(limit, windowMs)` so the budget a
 * call site asks for is the budget it gets.
 *
 * Other fixes here: the in-memory fallback used to grow without bound (one Map
 * entry per key, never pruned) and any Redis hiccup escaped as a 500.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logError, logger } from "#/lib/logger";

const SCOPE = "rate-limit";

export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	limit: number;
	resetAt: number;
	/** seconds */
	retryAfter: number;
}

/** Default window when a call site does not care. */
export const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

/* ------------------------------- configuration ---------------------------- */

let redis: Redis | null | undefined;

function getRedis(): Redis | null {
	if (redis !== undefined) return redis;
	const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
	const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
	redis = url && token ? new Redis({ url, token }) : null;
	if (!redis) {
		logger.warn(
			{ scope: SCOPE },
			"UPSTASH_REDIS_REST_URL/TOKEN not set — using in-process rate limiting (single node only)",
		);
	}
	return redis;
}

/** One limiter per budget: `Ratelimit` bakes the window into the instance. */
const limiters = new Map<string, Ratelimit>();

function limiterFor(limit: number, windowMs: number): Ratelimit | null {
	const client = getRedis();
	if (!client) return null;
	const key = `${limit}/${windowMs}`;
	const existing = limiters.get(key);
	if (existing) return existing;
	const created = new Ratelimit({
		redis: client,
		limiter: Ratelimit.slidingWindow(limit, toUpstashWindow(windowMs)),
		prefix: `fyk:ratelimit:${key}`,
	});
	limiters.set(key, created);
	return created;
}

/** `@upstash/ratelimit` accepts `s|m|h|d` — snap to the nearest supported unit. */
export function toUpstashWindow(
	windowMs: number,
): `${number} s` | `${number} m` | `${number} h` | `${number} d` {
	const seconds = Math.max(1, Math.round(windowMs / 1000));
	if (seconds % 86_400 === 0) return `${seconds / 86_400} d`;
	if (seconds % 3600 === 0) return `${seconds / 3600} h`;
	if (seconds % 60 === 0) return `${seconds / 60} m`;
	return `${seconds} s`;
}

/* ------------------------------ memory fallback ---------------------------- */

type Bucket = { count: number; resetAt: number };

const hits = new Map<string, Bucket>();
const MEMORY_MAX_KEYS = 20_000;

/**
 * The fallback Map grows with every distinct key (per IP, per user, per
 * bucket). Entries are *checked* lazily, which is correct but never frees
 * memory, so a long-lived container accumulated one record per visitor per
 * window. Sweep at most once per interval to keep the hot path O(1).
 * (Ported from the `main` audit fix — same idea, adapted to this module.)
 */
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanupAt = 0;

function purgeExpired(now: number): void {
	if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
	lastCleanupAt = now;
	for (const [key, entry] of hits) {
		if (now > entry.resetAt) hits.delete(key);
	}
}

function memoryRateLimit(
	key: string,
	limit: number,
	windowMs: number,
): RateLimitResult {
	pruneExpired();
	const now = Date.now();
	const bucket = hits.get(key);
	if (!bucket || now > bucket.resetAt) {
		// Only insert a fresh bucket when there is room; under pressure we fail
		// open rather than evicting someone else's counter.
		if (hits.size >= MEMORY_MAX_KEYS) {
			return {
				allowed: true,
				remaining: limit,
				limit,
				resetAt: now + windowMs,
				retryAfter: 0,
			};
		}
		hits.set(key, { count: 1, resetAt: now + windowMs });
		return {
			allowed: true,
			remaining: Math.max(0, limit - 1),
			limit,
			resetAt: now + windowMs,
			retryAfter: 0,
		};
	}
	if (bucket.count >= limit) {
		return {
			allowed: false,
			remaining: 0,
			limit,
			resetAt: bucket.resetAt,
			retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
		};
	}
	bucket.count += 1;
	return {
		allowed: true,
		remaining: Math.max(0, limit - bucket.count),
		limit,
		resetAt: bucket.resetAt,
		retryAfter: 0,
	};
}

let lastPrune = 0;
function pruneExpired(): void {
	const now = Date.now();
	if (now - lastPrune < 60_000) return;
	lastPrune = now;
	for (const [key, bucket] of hits) if (bucket.resetAt <= now) hits.delete(key);
}

/* --------------------------------- public API ----------------------------- */

/**
 * Consume one unit of `key`'s budget.
 *
 * Fail-open policy: if Redis errors we fall back to the in-process window and
 * log loudly. Rate limiting is an abuse brake, not an authorization check — a
 * Redis outage must not turn every endpoint into a 500.
 */
export async function checkRateLimit(
	key: string,
	limit = 1000,
	windowMs = DEFAULT_WINDOW_MS,
): Promise<RateLimitResult> {
	const limiter = limiterFor(limit, windowMs);
	if (limiter) {
		try {
			const result = await limiter.limit(key);
			return {
				allowed: result.success,
				remaining: result.remaining,
				limit,
				resetAt: result.reset,
				retryAfter: result.success
					? 0
					: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
			};
		} catch (error) {
			logError(SCOPE, error, { key, stage: "upstash" });
		}
	}
	return memoryRateLimit(key, limit, windowMs);
}

/**
 * Rate limit *and* short-circuit: returns a ready `429` response when the
 * budget is gone, otherwise the headers to attach to the real response.
 */
export async function enforceRateLimit(
	key: string,
	limit: number,
	windowMs: number,
): Promise<
	| { blocked: true; response: Response }
	| { blocked: false; result: RateLimitResult; headers: Record<string, string> }
> {
	const result = await checkRateLimit(key, limit, windowMs);
	const headers = rateLimitHeaders(result);
	if (!result.allowed) {
		return {
			blocked: true,
			response: new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
				status: 429,
				headers: {
					"Content-Type": "application/json",
					"Retry-After": String(result.retryAfter),
					...headers,
				},
			}),
		};
	}
	return { blocked: false, result, headers };
}

export function rateLimitHeaders(
	result: RateLimitResult,
): Record<string, string> {
	return {
		"RateLimit-Limit": String(result.limit),
		"RateLimit-Remaining": String(result.remaining),
		"RateLimit-Reset": String(
			Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000)),
		),
		...(result.allowed ? {} : { "Retry-After": String(result.retryAfter) }),
	};
}

/** First hop of `X-Forwarded-For`, falling back to `X-Real-IP`. */
export function clientIp(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		const first = forwarded.split(",")[0]?.trim();
		if (first) return first;
	}
	return request.headers.get("x-real-ip")?.trim() || "anonymous";
}

/** Test seam: reset the in-process window. */
export function __resetMemoryRateLimit(): void {
	hits.clear();
	limiters.clear();
	redis = undefined;
}
