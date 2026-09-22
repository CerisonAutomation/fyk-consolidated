import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { generatePickupLines } from "@/domains/ai/heuristic/pickup-lines";
import { telemetry } from "@/lib/enterprise/telemetry";
import { resilient } from "@/lib/enterprise/self-healing";
import { cache } from "@/lib/enterprise/performance";
import { traceRequest, finishTrace } from "@/lib/enterprise/observability";
import { validate } from "@/lib/enterprise/validation";

const schema = z.object({
  vibe: z.enum(["flirty", "funny", "sweet", "bold"]).default("flirty"),
  count: z.number().int().min(1).max(5).default(3),
  context: z.string().max(200).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

const VIBE_TEMPLATES: Record<string, string[]> = {
  flirty: ["You + me + coffee = ?", "Is your name Wi-Fi? I'm feeling a connection", "Are you a magician? You just made everyone else disappear"],
  funny: ["Are you a parking ticket? You've got FINE written all over you", "Do you have a Band-Aid? I scraped my knee falling for you", "Is your dad a boxer? You're a knockout"],
  sweet: ["Your smile must be a black hole, nothing can escape its pull", "If I could rearrange the alphabet, I'd put U and I together", "You must be tired, you've been running through my mind all day"],
  bold: ["I'm not a photographer, but I can picture us together", "Let's skip the small talk and go straight to flirting", "You look like trouble, and I like trouble"],
};

export const Route = createFileRoute("/api/ai/pickup-lines/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller, request }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.ai.pickup-lines.get", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const vibe = url.searchParams.get("vibe") ?? "flirty";

          telemetry.counter("api.pickup.get", 1, { userId: user.id.slice(0, 8), vibe });
          const cacheKey = `pickup:${vibe}`;
          const cached = await cache.get(cacheKey);
          if (cached) {
            telemetry.counter("api.pickup.cache.hit", 1);
            telemetry.endSpan(span.spanId, "ok");
            finishTrace(trace, 200);
            return json({ lines: cached.value, vibes: ["flirty", "funny", "sweet", "bold"], cached: true, traceId: trace.traceId });
          }

          const lines = await resilient(async () => generatePickupLines(), { retry: { maxAttempts: 2, initialDelayMs: 100, maxDelayMs: 500, factor: 2, jitter: true }, timeoutMs: 2000, circuitBreaker: "ai-pickup" });
          await cache.set(cacheKey, lines, 300);

          telemetry.counter("api.pickup.generated", 1, { vibe });
          telemetry.histogram("api.pickup.count", (lines as string[]).length);
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          return json({ lines, vibes: ["flirty", "funny", "sweet", "bold"], traceId: trace.traceId });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500);
          throw error;
        }
      }, { rateLimit: { limit: 30, key: ({ caller }) => `pickup:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.ai.pickup-lines.post", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          const user = requireCaller(caller);
          const body = await readJson(request, schema, 2 * 1024);

          const validation = validate(schema, body);
          if (!validation.ok) {
            telemetry.endSpan(span.spanId, "error", "validation");
            finishTrace(trace, 400);
            return jsonError(`Invalid body: ${validation.errors.map((e) => e.message).join(", ")}`, 400);
          }

          if (body.idempotencyKey) {
            const cached = await cache.get(`pickup-idem:${body.idempotencyKey}`);
            if (cached) {
              telemetry.counter("api.pickup.idempotency.hit", 1);
              telemetry.endSpan(span.spanId, "ok");
              finishTrace(trace, 200);
              return json({ lines: cached.value, vibe: body.vibe, count: (cached.value as string[]).length, cached: true, traceId: trace.traceId });
            }
          }

          // Generate with vibe-specific templates + heuristic engine
          const base = await resilient(async () => generatePickupLines(), { retry: { maxAttempts: 2, initialDelayMs: 100, maxDelayMs: 500, factor: 2, jitter: true }, timeoutMs: 2000, circuitBreaker: "ai-pickup" });
          const vibeLines = VIBE_TEMPLATES[body.vibe] ?? VIBE_TEMPLATES.flirty;
          const combined = [...vibeLines, ...(base as string[])];
          const lines = combined.slice(0, body.count);

          // Context-aware personalization if provided
          const personalized = body.context ? lines.map((l) => `${l} — ${body.context}`) : lines;

          if (body.idempotencyKey) await cache.set(`pickup-idem:${body.idempotencyKey}`, personalized, 300);

          telemetry.counter("api.pickup.generated", 1, { vibe: body.vibe, userId: user.id.slice(0, 8) });
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          return json({ lines: personalized, vibe: body.vibe, count: personalized.length, traceId: trace.traceId });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500);
          throw error;
        }
      }, { rateLimit: { limit: 30, key: ({ caller }) => `pickup:POST:${caller?.id}` } }),
    },
  },
});
