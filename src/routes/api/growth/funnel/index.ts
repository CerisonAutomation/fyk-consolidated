import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { analyticsFunnel } from "#/schema";
import { trackFunnelStep, getFunnelProgress, FUNNEL_STEPS } from "#/lib/growth";
import { telemetry } from "#/lib/enterprise/telemetry";
import { resilient } from "#/lib/enterprise/self-healing";
import { cache, staleWhileRevalidate } from "#/lib/enterprise/performance";
import { traceRequest, finishTrace, auditTrail } from "#/lib/enterprise/observability";
import { auditLogger } from "#/lib/enterprise/security-hardened";

const stepSchema = z.object({
  step: z.string().min(1).max(50).refine((s) => [...FUNNEL_STEPS].includes(s as any) || s.startsWith("custom_"), "Invalid funnel step"),
  metadata: z.record(z.string(), z.any()).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/growth/funnel/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller, request }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.growth.funnel.get", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          const user = requireCaller(caller);

          const result = await staleWhileRevalidate(
            `funnel:${user.id}`,
            async () => {
              return resilient(
                async () => {
                  const steps = await db.select().from(analyticsFunnel).where(eq(analyticsFunnel.userId, user.id));
                  const progress = getFunnelProgress(steps as any);
                  return { steps, progress };
                },
                { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-funnel" },
              );
            },
            30,
            60,
          );

          const { steps, progress } = result as { steps: typeof analyticsFunnel.$inferSelect[]; progress: ReturnType<typeof getFunnelProgress> };

          // Enterprise: calculate conversion rates, drop-off analysis
          const conversionRates: Record<string, number> = {};
          for (let i = 1; i < FUNNEL_STEPS.length; i++) {
            const prevStep = FUNNEL_STEPS[i - 1];
            const currStep = FUNNEL_STEPS[i];
            const prevCount = steps.filter((s) => s.step === prevStep).length;
            const currCount = steps.filter((s) => s.step === currStep).length;
            conversionRates[`${prevStep}->${currStep}`] = prevCount > 0 ? Math.round((currCount / prevCount) * 100) : 0;
          }

          const dropOffStep = Object.entries(conversionRates).sort((a, b) => a[1] - b[1])[0];

          telemetry.counter("api.funnel.queries", 1, { userId: user.id.slice(0, 8) });
          telemetry.histogram("api.funnel.steps_count", steps.length);
          telemetry.histogram("api.funnel.progress", progress.percent);
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          return json({
            steps,
            progress,
            count: steps.length,
            funnel: [...FUNNEL_STEPS],
            analytics: {
              conversionRates,
              dropOffStep: dropOffStep ? { step: dropOffStep[0], rate: dropOffStep[1] } : null,
              completed: progress.completed,
              total: progress.total,
              percent: progress.percent,
              nextStep: progress.nextStep,
            },
            performance: { durationMs: Date.now() - trace.startTime },
            traceId: trace.traceId,
          });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500, error instanceof Error ? error.message : "Unknown");
          throw error;
        }
      }, { rateLimit: { limit: 30, key: ({ caller }) => `funnel:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.growth.funnel.post", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          const user = requireCaller(caller);
          const body = await readJson(request, stepSchema, 2 * 1024);

          // Idempotency check
          if (body.idempotencyKey) {
            const cached = await cache.get(`funnel-idempotency:${body.idempotencyKey}`);
            if (cached) {
              telemetry.counter("api.funnel.idempotency.hit", 1);
              telemetry.endSpan(span.spanId, "ok");
              finishTrace(trace, 200);
              return json({ ok: true, alreadyTracked: true, step: body.step, cached: true });
            }
          }

          const existing = await resilient(
            async () => db.select().from(analyticsFunnel).where(eq(analyticsFunnel.userId, user.id)),
            { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-funnel" },
          );

          if (existing.some((s) => s.step === body.step)) {
            telemetry.counter("api.funnel.duplicate", 1, { step: body.step });
            telemetry.endSpan(span.spanId, "ok");
            finishTrace(trace, 200);
            return json({ ok: true, alreadyTracked: true, step: body.step });
          }

          const event = trackFunnelStep(user.id, body.step as any, body.metadata);

          const [created] = await resilient(
            async () => db.insert(analyticsFunnel).values({ userId: user.id, step: body.step, metadata: body.metadata as any }).returning(),
            { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-funnel" },
          );

          // Invalidate cache
          await cache.delete(`funnel:${user.id}`);

          // Idempotency store
          if (body.idempotencyKey) await cache.set(`funnel-idempotency:${body.idempotencyKey}`, { step: body.step }, 86400);

          // Audit and observability
          auditLogger.log({ userId: user.id, action: "funnel.track", resource: "growth", result: "success", details: { step: body.step, traceId: trace.traceId } });
          auditTrail.record({ userId: user.id, action: "funnel.track", resource: "growth", traceId: trace.traceId });
          telemetry.counter("api.funnel.tracked", 1, { step: body.step });
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 201);

          return json({ ok: true, step: created, event, traceId: trace.traceId }, { status: 201 });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500, error instanceof Error ? error.message : "Unknown");
          throw error;
        }
      }, { rateLimit: { limit: 20, key: ({ caller }) => `funnel:POST:${caller?.id}` } }),
    },
  },
});
