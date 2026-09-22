import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { autocomplete, shouldShowAutocomplete } from "#/domains/ai/heuristic/autocomplete";
import { telemetry } from "#/lib/enterprise/telemetry";
import { resilient } from "#/lib/enterprise/self-healing";
import { cache } from "#/lib/enterprise/performance";
import { traceRequest, finishTrace, auditTrail } from "#/lib/enterprise/observability";
import { auditLogger } from "#/lib/enterprise/security-hardened";
import { validate } from "#/lib/enterprise/validation";

const schema = z.object({
  prefix: z.string().min(1).max(100).refine((s) => !s.includes("<script"), "XSS detected"),
  stylePhrases: z.array(z.string().max(200)).max(20).optional(),
  conversationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/ai/autocomplete/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller, request }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.ai.autocomplete.get", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          requireCaller(caller);

          telemetry.counter("api.autocomplete.queries", 1);
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          return json({
            enabled: true,
            minChars: 2,
            maxChars: 50,
            features: {
              keyboardStyle: true,
              ownVoice: true,
              tapToAccept: true,
              shortToAvoidSlop: true,
              onDeviceFirst: true,
              serverFallback: true,
            },
            performance: { cache: "none", durationMs: Date.now() - trace.startTime },
            explainability: "Keyboard-style: predicts rest of sentence in users own voice, tap-to-accept, kept short to avoid AI-slop walls. Uses heuristic with style phrases, confidence scoring, source tracking.",
            traceId: trace.traceId,
          });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500, error instanceof Error ? error.message : "Unknown");
          throw error;
        }
      }, { rateLimit: { limit: 60, key: ({ caller }) => `ac:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.ai.autocomplete.post", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          requireCaller(caller);
          const body = await readJson(request, schema, 4 * 1024);

          const validation = validate(schema, body);
          if (!validation.ok) {
            telemetry.endSpan(span.spanId, "error", "validation");
            finishTrace(trace, 400);
            return json({ error: "Invalid body", details: validation.errors }, { status: 400 });
          }

          // Cache check — autocomplete results cacheable for same prefix
          const cacheKey = `autocomplete:${body.prefix.toLowerCase()}:${(body.stylePhrases ?? []).join("|").slice(0, 100)}`;
          const cached = await cache.get(cacheKey);
          if (cached) {
            telemetry.counter("api.autocomplete.cache.hit", 1);
            telemetry.endSpan(span.spanId, "ok");
            finishTrace(trace, 200);
            return json({ completion: cached.value, show: true, prefix: body.prefix, cached: true, traceId: trace.traceId });
          }

          if (!shouldShowAutocomplete(body.prefix)) {
            telemetry.counter("api.autocomplete.skipped", 1, { reason: "too_short_or_punctuation" });
            telemetry.endSpan(span.spanId, "ok");
            finishTrace(trace, 200);
            return json({ completion: null, show: false, reason: "Prefix too short or contains punctuation — no autocomplete" });
          }

          const result = await resilient(
            async () => autocomplete(body.prefix, body.stylePhrases),
            { retry: { maxAttempts: 2, initialDelayMs: 50, maxDelayMs: 500, factor: 2, jitter: true }, timeoutMs: 1000, circuitBreaker: "ai-autocomplete" },
          );

          if (result) {
            await cache.set(cacheKey, result, 300); // 5 min cache
            telemetry.counter("api.autocomplete.generated", 1, { source: result.source, confidence: String(Math.round(result.confidence * 100)) });
            telemetry.histogram("api.autocomplete.confidence", result.confidence);
            auditLogger.log({ userId: caller?.id, action: "ai.autocomplete", resource: "ai", result: "success", details: { prefix: body.prefix.slice(0, 20), source: result.source, confidence: result.confidence, traceId: trace.traceId } });
            auditTrail.record({ userId: caller?.id, action: "ai.autocomplete", resource: "ai", traceId: trace.traceId });
          } else {
            telemetry.counter("api.autocomplete.no_result", 1);
          }

          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          return json({
            completion: result,
            show: !!result,
            prefix: body.prefix,
            explainability: result ? `Source: ${result.source}, confidence ${Math.round(result.confidence * 100)}% — heuristic with style phrases` : "No completion — no matching style phrase",
            performance: { durationMs: Date.now() - trace.startTime, cached: false },
            traceId: trace.traceId,
          });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500, error instanceof Error ? error.message : "Unknown");
          throw error;
        }
      }, { rateLimit: { limit: 60, key: ({ caller }) => `ac:POST:${caller?.id}` } }),
    },
  },
});
