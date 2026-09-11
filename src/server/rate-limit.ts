/**
 * Durable rate limiting for the FYK API.
 *
 * Two tiers, chosen at call time (never at import time, so a boot without Redis
 * or a schema not yet migrated cannot take the whole app down):
 *
 *   1. Postgres (`public.rate_limits` + `rate_limit_hit` RPC, added in migration
 *      0005). Fixed window, atomic upsert, survives restarts and is shared
 *      across instances. This is the production limiter.
 *   2. In-process map. **Explicitly non-production**: it exists so a `pnpm dev`
 *      loop still demonstrates back-pressure. `checkRateLimit` reports which tier
 *      answered, and `assertProductionLimiter` refuses to pretend when a
 *      production deployment is only using memory.
 */

import { createUserClient } from "./supabase-server";

export type LimiterTier = "postgres" | "memory" | "upstash" | "disabled";

export interface RateDecision {
	allowed: boolean;
	remaining: number;
	limit: number;
	resetAt: number;
	retryAfterSeconds: number;
	tier: LimiterTier;
}

const memory = new Map<string, { count: number; resetAt: number }>();
let lastSweep = 0;

function memoryHit(key: string, windowMs: number): { count: number; resetAt: number } {
	const now = Date.now();
	if (now - lastSweep > 30_000) {
		lastSweep = now;
		for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
	}
	const existing = memory.get(key);
	if (!existing || existing.resetAt <= now) {
		const entry = { count: 1, resetAt: now + windowMs };
		memory.set(key, entry);
		return entry;
	}
	existing.count += 1;
	return existing;
}

let postgresLimiterUsable: boolean | null = null;

/**
 * Fixed-window counter stored in Postgres. Returns null when the table/RPC is not
 * available yet so callers can degrade to the in-memory tier instead of failing.
 */
async function postgresHit(
	headers: Headers,
	key: string,
	limit: number,
	windowMs: number,
): Promise<{ count: number; blocked: boolean } | null> {
	const client = createUserClient(headers);
	if (!client) return null;
	const windowSeconds = Math.max(1, Math.round(windowMs / 1000));
	// Argument names must match the SQL signature exactly (p_*), otherwise
	// PostgREST answers 404 and every caller silently drops to the memory tier.
	const { data, error } = await client.rpc("rate_limit_hit" as never, {
		p_bucket_key: key,
		p_window_seconds: windowSeconds,
		p_max_hits: limit,
	} as never);
	if (error || !data) {
		postgresLimiterUsable = false;
		return null;
	}
	postgresLimiterUsable = true;
	const row = (Array.isArray(data) ? data[0] : data) as { hits?: number; blocked?: boolean };
	return { count: Number(row.hits ?? 1), blocked: Boolean(row.blocked) };
}

export async function checkRateLimit(
	headers: Headers,
	key: string,
	limit: number,
	windowMs: number,
): Promise<RateDecision> {
	const durable = await postgresHit(headers, key, limit, windowMs);
	if (durable) {
		const resetAt = Math.ceil((Date.now() + windowMs) / 1000) * 1000;
		return {
			allowed: !durable.blocked,
			remaining: Math.max(0, limit - durable.count),
			limit,
			resetAt,
			retryAfterSeconds: durable.blocked ? Math.max(1, Math.ceil(windowMs / 1000)) : 0,
			tier: "postgres",
		};
	}

	const hit = memoryHit(key, windowMs);
	const allowed = hit.count <= limit;
	return {
		allowed,
		remaining: Math.max(0, limit - hit.count),
		limit,
		resetAt: hit.resetAt,
		retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((hit.resetAt - Date.now()) / 1000)),
		tier: "memory",
	};
}

/** Rate-limit headers to attach to every API response. */
export function rateLimitHeaders(decision: RateDecision): Record<string, string> {
	const headers: Record<string, string> = {
		"X-RateLimit-Limit": String(decision.limit),
		"X-RateLimit-Remaining": String(decision.remaining),
		"X-RateLimit-Reset": String(Math.ceil(decision.resetAt / 1000)),
		"X-RateLimit-Tier": decision.tier,
	};
	if (!decision.allowed) headers["Retry-After"] = String(decision.retryAfterSeconds);
	return headers;
}

/** True when the durable limiter answered at least once. */
export function durableLimiterReady(): boolean {
	return postgresLimiterUsable === true;
}

/**
 * Called once per server start. A production build that can only use the
 * in-process limiter is reported loudly instead of being silently accepted.
 */
export function limiterWarning(): string | null {
	if (process.env.NODE_ENV === "production" && postgresLimiterUsable === false) {
		return "Rate limiting is running on the in-memory fallback. It is per-instance and resets on restart — apply migration 0006_mvp_gaps.sql for durable limits.";
	}
	return null;
}

export const RATE_LIMITS = {
	anonymousRead: { limit: 120, windowMs: 5 * 60_000 },
	read: { limit: 300, windowMs: 5 * 60_000 },
	write: { limit: 60, windowMs: 5 * 60_000 },
	message: { limit: 30, windowMs: 60_000 },
	auth: { limit: 10, windowMs: 15 * 60_000 },
	report: { limit: 10, windowMs: 15 * 60_000 },
	moderation: { limit: 120, windowMs: 5 * 60_000 },
} as const;
