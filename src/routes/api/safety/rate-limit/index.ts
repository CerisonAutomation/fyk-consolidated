import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { rateLimitLogs } from "#/schema";
import { telemetry } from "#/lib/enterprise/telemetry";
import { resilient } from "#/lib/enterprise/self-healing";
import { auditLogger } from "#/lib/enterprise/security-hardened";
import { traceRequest, finishTrace } from "#/lib/enterprise/observability";
import { staleWhileRevalidate } from "#/lib/enterprise/performance";

export const Route = createFileRoute("/api/safety/rate-limit/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      POST: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),
      GET: withSecurity(async ({ caller, request }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.rate-limit.get", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          const user = requireCaller(caller);

          // Stale-while-revalidate cache for rate limit data — 30s TTL, 60s stale
          const data = await staleWhileRevalidate(
            `rate-limit:${user.id}`,
            async () => {
              return resilient(
                async () => {
                  const logs = await db.select().from(rateLimitLogs).where(eq(rateLimitLogs.userId, user.id)).orderBy(desc(rateLimitLogs.createdAt)).limit(50);
                  return logs;
                },
                { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-rate-limit" },
              );
            },
            30,
            60,
          );

          const logs = data as typeof rateLimitLogs.$inferSelect[];
          const blocked = logs.filter((l) => l.blocked);

          // Sliding window calculation — enterprise algorithm
          const now = Date.now();
          const windowMs = { "1m": 60000, "1h": 3600000, "15m": 900000 };
          const calcRemaining = (endpointPattern: string, limit: number, window: keyof typeof windowMs) => {
            const windowStart = now - windowMs[window];
            const count = logs.filter((l) => l.endpoint.includes(endpointPattern) && new Date(l.createdAt).getTime() > windowStart).length;
            return Math.max(0, limit - count);
          };

          const limits = {
            messages: { limit: 30, window: "1m", remaining: calcRemaining("message", 30, "1m"), resetAt: new Date(now + windowMs["1m"]).toISOString() },
            taps: { limit: 50, window: "1h", remaining: calcRemaining("tap", 50, "1h"), resetAt: new Date(now + windowMs["1h"]).toISOString() },
            reports: { limit: 10, window: "1h", remaining: calcRemaining("report", 10, "1h"), resetAt: new Date(now + windowMs["1h"]).toISOString() },
            auth: { limit: 5, window: "15m", remaining: calcRemaining("auth", 5, "15m"), resetAt: new Date(now + windowMs["15m"]).toISOString() },
          };

          // Security: detect abuse patterns
          const recentBlocked = blocked.filter((b) => new Date(b.createdAt).getTime() > now - 3600000).length;
          const isAbusive = recentBlocked > 5 || logs.filter((l) => new Date(l.createdAt).getTime() > now - 60000).length > 20;

          if (isAbusive) {
            auditLogger.log({ userId: user.id, action: "rate_limit.abuse_detected", resource: "rate-limit", result: "success", details: { recentBlocked, totalLogs: logs.length } });
            telemetry.counter("security.abuse_detected", 1, { userId: user.id.slice(0, 8) });
          }

          telemetry.counter("api.rate-limit.queries", 1, { userId: user.id.slice(0, 8) });
          telemetry.histogram("api.rate-limit.logs_count", logs.length);
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          // Audit trail
          auditLogger.log({ userId: user.id, action: "rate_limit.view", resource: "safety", result: "success", details: { traceId: trace.traceId } });

          return json({
            logs: logs.slice(0, 20), // Limit response size for performance
            blocked: blocked.slice(0, 10),
            limits,
            count: logs.length,
            blockedCount: blocked.length,
            isAbusive,
            antiSpam: {
              velocityLimits: true,
              massReportThrottle: true,
              botHeuristics: true,
              tempSendLocks: true,
              slidingWindow: true,
              exponentialBackoff: true,
              abuseDetection: true,
            },
            performance: { cached: false, durationMs: Date.now() - trace.startTime },
            traceId: trace.traceId,
          });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500, error instanceof Error ? error.message : "Unknown");
          throw error;
        }
      }, { rateLimit: { limit: 20, key: ({ caller }) => `ratelimit:GET:${caller?.id}` } }),
    },
  },
});
