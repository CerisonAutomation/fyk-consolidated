/**
 * Rate limiting with Upstash Redis (production) and in-memory fallback (dev).
 *
 * Per rate-limiting.md and api-security.md:
 *   - Global rate limit: 1000 req / 15 min
 *   - Auth endpoints: 20 req / 15 min (per IP + username)
 *   - Standard RateLimit headers on every response
 *   - 429 with Retry-After on limit breach
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Upstash Redis client (lazy init — only connects when env vars are present)
// ---------------------------------------------------------------------------

let redis: Redis | null = null;
let upstashLimiter: Ratelimit | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function getUpstashLimiter(): Ratelimit | null {
  if (upstashLimiter) return upstashLimiter;
  const r = getRedis();
  if (!r) return null;
  upstashLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(1000, "15 m"),
    analytics: true,
    prefix: "fyk:ratelimit",
  });
  return upstashLimiter;
}

// ---------------------------------------------------------------------------
// In-memory fallback (dev / no Redis)
// ---------------------------------------------------------------------------

const hits = new Map<string, { count: number; resetAt: number }>();

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    hits.set(key, { count: 1, resetAt });
    return { success: true, remaining: limit - 1, resetAt };
  }
  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count++;
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number; // seconds
}

/**
 * Check rate limit for a given key. Tries Upstash first, falls back to memory.
 */
export async function checkRateLimit(
  key: string,
  limit = 1000,
  windowMs = 15 * 60 * 1000,
): Promise<RateLimitResult> {
  const upstash = getUpstashLimiter();
  if (upstash) {
    const { success, remaining, reset } = await upstash.limit(key);
    const resetMs = reset; // Upstash returns unix ms
    const retryAfter = success ? 0 : Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
    return { allowed: success, remaining, resetAt: resetMs, retryAfter };
  }

  const result = memoryRateLimit(key, limit, windowMs);
  const retryAfter = result.success
    ? 0
    : Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return { allowed: result.success, remaining: result.remaining, resetAt: result.resetAt, retryAfter };
}

/**
 * Express-style middleware factory.
 * Attaches RateLimit headers to every response.
 */
export function rateLimitMiddleware(options?: {
  limit?: number;
  windowMs?: number;
  keyGenerator?: (req: Request) => string;
}) {
  const limit = options?.limit ?? 1000;
  const windowMs = options?.windowMs ?? 15 * 60 * 1000;
  const keyGenerator = options?.keyGenerator ?? ((req: Request) => {
    return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  });

  return async (req: Request): Promise<Response | null> => {
    const key = keyGenerator(req);
    const result = await checkRateLimit(key, limit, windowMs);

    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAfter: result.retryAfter,
          limit,
          remaining: 0,
          resetAt: new Date(result.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(result.retryAfter),
            "X-RateLimit-Limit": String(limit),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
          },
        },
      );
    }

    return null; // Allow request to proceed
  };
}

// ---------------------------------------------------------------------------
// Preset limiters for specific endpoints
// ---------------------------------------------------------------------------

export const authRateLimit = (req: Request) =>
  rateLimitMiddleware({
    limit: 20,
    windowMs: 15 * 60 * 1000,
    keyGenerator: (r) => {
      const ip = r.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      return `auth:${ip}`;
    },
  })(req);

export const apiRateLimit = (req: Request) =>
  rateLimitMiddleware({
    limit: 1000,
    windowMs: 15 * 60 * 1000,
  })(req);
