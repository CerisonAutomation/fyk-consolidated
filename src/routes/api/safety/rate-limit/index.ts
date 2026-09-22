import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { rateLimitLogs } from "#/schema";

export const Route = createFileRoute("/api/safety/rate-limit/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      POST: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const logs = await db.select().from(rateLimitLogs).where(eq(rateLimitLogs.userId, user.id)).orderBy(desc(rateLimitLogs.createdAt)).limit(50);
        const blocked = logs.filter(l => l.blocked);
        const limits = { messages: { limit: 30, window: "1m", remaining: Math.max(0, 30 - logs.filter(l => l.endpoint.includes("message")).length) }, taps: { limit: 50, window: "1h", remaining: 50 }, reports: { limit: 10, window: "1h", remaining: 10 }, auth: { limit: 5, window: "15m", remaining: 5 } };
        return json({ logs, blocked, limits, count: logs.length, blockedCount: blocked.length, antiSpam: { velocityLimits: true, massReportThrottle: true, botHeuristics: true, tempSendLocks: true } });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `ratelimit:GET:${caller?.id}` } }),
    },
  },
});

