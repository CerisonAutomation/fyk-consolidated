import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { deletionRequests } from "#/schema";
import { telemetry } from "#/lib/enterprise/telemetry";
import { resilient } from "#/lib/enterprise/self-healing";
import { staleWhileRevalidate } from "#/lib/enterprise/performance";
import { traceRequest, finishTrace, auditTrail } from "#/lib/enterprise/observability";
import { auditLogger } from "#/lib/enterprise/security-hardened";

export const Route = createFileRoute("/api/safety/deletion/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller, request }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.safety.deletion.get", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          const user = requireCaller(caller);

          const result = await staleWhileRevalidate(
            `deletion:${user.id}`,
            async () =>
              resilient(
                async () => db.select().from(deletionRequests).where(eq(deletionRequests.userId, user.id)).orderBy(desc(deletionRequests.requestedAt)).limit(5),
                { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-deletion" },
              ),
            60,
            120,
          );

          const requests = result as typeof deletionRequests.$inferSelect[];
          const active = requests.find((r) => r.status === "pending" || r.status === "scheduled");
          const canCancel = active && new Date((active as any).graceEndsAt ?? 0).getTime() > Date.now();

          telemetry.counter("api.deletion.queries", 1);
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          return json({
            request: active ?? null,
            history: requests,
            hasRequest: !!active,
            canCancel: !!canCancel,
            gracePeriodEnds: (active as any)?.graceEndsAt ?? null,
            gdpr: { retentionDays: 30, exportAvailable: true, exportUrl: "/api/profile/export" },
            message: active ? `Deletion scheduled for ${(active as any).graceEndsAt}` : "No active deletion request",
            traceId: trace.traceId,
          });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500);
          throw error;
        }
      }, { rateLimit: { limit: 20, key: ({ caller }) => `sdel:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ caller, request }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.safety.deletion.post", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          const user = requireCaller(caller);

          // Canonical deletion flow is /api/profile/deletion — this endpoint is read-only redirect for legacy clients
          // Enriched to provide proper guidance + audit + idempotency
          const existing = await resilient(
            async () => db.select().from(deletionRequests).where(eq(deletionRequests.userId, user.id)).limit(1),
            { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-deletion" },
          );

          auditLogger.log({ userId: user.id, action: "safety.deletion.redirect", resource: "safety", result: "success", details: { hasExisting: existing.length > 0, traceId: trace.traceId } });
          auditTrail.record({ userId: user.id, action: "safety.deletion.redirect", resource: "safety", traceId: trace.traceId });
          telemetry.counter("api.deletion.redirect", 1);
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          return json({
            message: "Use /api/profile/deletion for deletion flow",
            redirect: "/api/profile/deletion",
            existingRequest: existing[0] ?? null,
            steps: ["Request export at /api/profile/export", "Confirm deletion at /api/profile/deletion", "30-day grace period", "Permanent removal"],
            traceId: trace.traceId,
          });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500);
          throw error;
        }
      }, { rateLimit: { limit: 10, key: ({ caller }) => `sdel:POST:${caller?.id}` } }),
    },
  },
});
