import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, withSecurity } from "@/middleware";
import { generateVoiceNote, VOICE_TONES, estimateDuration } from "@/domains/ai/heuristic/voice-note";
import { telemetry } from "@/lib/enterprise/telemetry";
import { resilient } from "@/lib/enterprise/self-healing";
import { cache } from "@/lib/enterprise/performance";
import { traceRequest, finishTrace, auditTrail } from "@/lib/enterprise/observability";
import { auditLogger } from "@/lib/enterprise/security-hardened";
import { validate } from "@/lib/enterprise/validation";

const schema = z.object({
  text: z.string().min(1).max(500).refine((s) => !s.includes("<script"), "XSS detected"),
  tone: z.enum(["warm", "casual", "flirty", "friendly"]).default("warm"),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).default("alloy"),
  conversationId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/ai/voice-note/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller, request }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.ai.voice-note.get", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          requireCaller(caller);
          telemetry.counter("api.voice-note.queries", 1);
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          return json({
            tones: VOICE_TONES,
            voices: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
            features: { tts: true, voiceClone: "premium", transcript: true, durationEstimate: true, translationDub: true },
            explainability: "Pick suggested reply + tap read it to them — generates warm voice note in users tone, receiver sees transcript+audio. Production uses ElevenLabs voice cloning with 6 voices, own clone premium.",
            maxChars: 500,
            usage: { freePerDay: 10, premium: "unlimited" },
            traceId: trace.traceId,
          });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500, error instanceof Error ? error.message : "Unknown");
          throw error;
        }
      }, { rateLimit: { limit: 30, key: ({ caller }) => `vn:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.ai.voice-note.post", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          requireCaller(caller);
          const body = await readJson(request, schema, 4 * 1024);

          const validation = validate(schema, body);
          if (!validation.ok) {
            telemetry.endSpan(span.spanId, "error", "validation");
            finishTrace(trace, 400);
            return json({ error: "Invalid body", details: validation.errors }, { status: 400 });
          }

          // Check usage limits — enterprise
          const usageKey = `voice-note:${caller?.id}`;
          const usage = await cache.get<{ count: number; resetAt: number }>(usageKey);
          const now = Date.now();
          const isPremium = (caller as any)?.isPremium ?? false;
          const limit = isPremium ? 1000 : 10;

          if (usage && usage.value.count >= limit && usage.value.resetAt > now) {
            telemetry.counter("api.voice-note.rate_limited", 1, { userId: caller?.id?.slice(0, 8) ?? "unknown" });
            telemetry.endSpan(span.spanId, "error", "usage limit");
            finishTrace(trace, 429);
            return json({ error: `Usage limit ${limit}/day exceeded`, resetAt: new Date(usage.value.resetAt).toISOString() }, { status: 429 });
          }

          const voiceNote = await resilient(
            async () => generateVoiceNote(body.text, body.tone),
            { retry: { maxAttempts: 2, initialDelayMs: 50, maxDelayMs: 500, factor: 2, jitter: true }, timeoutMs: 2000, circuitBreaker: "ai-voice-note" },
          );

          const duration = estimateDuration(body.text);

          // Update usage
          if (usage && usage.value.resetAt > now) await cache.set(usageKey, { count: usage.value.count + 1, resetAt: usage.value.resetAt }, 86400);
          else await cache.set(usageKey, { count: 1, resetAt: now + 86400000 }, 86400);

          auditLogger.log({ userId: caller?.id, action: "ai.voice-note", resource: "ai", result: "success", details: { tone: body.tone, voice: body.voice, duration, textLength: body.text.length, traceId: trace.traceId } });
          auditTrail.record({ userId: caller?.id, action: "ai.voice-note", resource: "ai", traceId: trace.traceId });
          telemetry.counter("api.voice-note.generated", 1, { tone: body.tone, voice: body.voice });
          telemetry.histogram("api.voice-note.duration", duration);
          telemetry.histogram("api.voice-note.text_length", body.text.length);
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          return json({
            voiceNote: { ...voiceNote, voice: body.voice, durationSec: duration },
            duration,
            transcript: body.text,
            usage: { count: (usage?.value.count ?? 0) + 1, limit, resetAt: new Date(now + 86400000).toISOString(), isPremium },
            explainability: `Tone: ${body.tone}, voice: ${body.voice}, ${duration}s estimated at 150 wpm, production uses ElevenLabs voice cloning, transcript included for accessibility`,
            traceId: trace.traceId,
          });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500, error instanceof Error ? error.message : "Unknown");
          throw error;
        }
      }, { rateLimit: { limit: 20, key: ({ caller }) => `vn:POST:${caller?.id}` } }),
    },
  },
});
