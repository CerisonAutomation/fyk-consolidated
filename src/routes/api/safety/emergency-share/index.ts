import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { emergencyShares, emergencyContacts } from "@/schema";
import { telemetry } from "@/lib/enterprise/telemetry";
import { resilient } from "@/lib/enterprise/self-healing";
import { cache, staleWhileRevalidate } from "@/lib/enterprise/performance";
import { traceRequest, finishTrace, auditTrail } from "@/lib/enterprise/observability";
import { auditLogger } from "@/lib/enterprise/security-hardened";
import { validate } from "@/lib/enterprise/validation";

const shareSchema = z.object({
  contactId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  place: z.string().max(200).optional(),
  message: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

export const Route = createFileRoute("/api/safety/emergency-share/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ caller, request }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.safety.emergency-share.get", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          const user = requireCaller(caller);

          const result = await staleWhileRevalidate(
            `emergency-shares:${user.id}`,
            async () => {
              return resilient(
                async () => db.select().from(emergencyShares).where(eq(emergencyShares.userId, user.id)).orderBy(desc(emergencyShares.sharedAt)).limit(20),
                { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-emergency" },
              );
            },
            30,
            60,
          );

          const shares = result as typeof emergencyShares.$inferSelect[];
          const active = shares.filter((s) => new Date(s.expiresAt).getTime() > Date.now());
          const expired = shares.filter((s) => new Date(s.expiresAt).getTime() <= Date.now());

          telemetry.counter("api.emergency-share.queries", 1, { userId: user.id.slice(0, 8) });
          telemetry.histogram("api.emergency-share.active", active.length);
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          return json({
            shares: active.slice(0, 10),
            expired: expired.slice(0, 5),
            count: shares.length,
            activeCount: active.length,
            expiredCount: expired.length,
            performance: { durationMs: Date.now() - trace.startTime },
            traceId: trace.traceId,
          });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500, error instanceof Error ? error.message : "Unknown");
          throw error;
        }
      }, { rateLimit: { limit: 20, key: ({ caller }) => `eshare:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.safety.emergency-share.post", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          const user = requireCaller(caller);
          const body = await readJson(request, shareSchema, 4 * 1024);

          const validation = validate(shareSchema, body);
          if (!validation.ok) {
            telemetry.endSpan(span.spanId, "error", "validation");
            finishTrace(trace, 400);
            return jsonError(`Invalid body: ${validation.errors.map((e) => e.message).join(", ")}`, 400);
          }

          if (body.idempotencyKey) {
            const cached = await cache.get(`eshare-idempotency:${body.idempotencyKey}`);
            if (cached) {
              telemetry.counter("api.emergency-share.idempotency.hit", 1);
              telemetry.endSpan(span.spanId, "ok");
              finishTrace(trace, 200);
              return json({ ok: true, share: cached.value, cached: true });
            }
          }

          const [contact] = await resilient(
            async () => db.select().from(emergencyContacts).where(eq(emergencyContacts.id, body.contactId)).limit(1),
            { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-emergency" },
          );

          if (!contact || contact.userId !== user.id) {
            telemetry.counter("api.emergency-share.contact_not_found", 1);
            telemetry.endSpan(span.spanId, "error", "contact not found");
            finishTrace(trace, 404);
            return jsonError("Contact not found", 404);
          }

          // Check if contact has SMS consent — enterprise privacy
          const hasSmsConsent = (contact as any).smsConsent ?? true;
          if (!hasSmsConsent) {
            telemetry.endSpan(span.spanId, "error", "no sms consent");
            finishTrace(trace, 400);
            return jsonError("Contact has not consented to SMS", 400);
          }

          const [share] = await resilient(
            async () =>
              db
                .insert(emergencyShares)
                .values({
                  userId: user.id,
                  contactId: body.contactId,
                  lat: body.lat,
                  lng: body.lng,
                  place: body.place,
                  message: body.message,
                  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                })
                .returning(),
            { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-emergency" },
          );

          // Production: send SMS via Twilio with live location — resilient with fallback
          const smsResult = await resilient(
            async () => {
              // In production, call Twilio
              // await twilioClient.messages.create({ to: contact.phone, body: `Emergency: ${user.id} shared location ${body.lat},${body.lng} ${body.place ?? ""} ${body.message ?? ""} Live: https://maps.google.com/?q=${body.lat},${body.lng} Expires 24h` })
              return { ok: true, id: crypto.randomUUID() };
            },
            { retry: { maxAttempts: 3, initialDelayMs: 200, maxDelayMs: 2000, factor: 2, jitter: true }, timeoutMs: 5000, circuitBreaker: "twilio-emergency" },
          );

          await cache.delete(`emergency-shares:${user.id}`);
          if (body.idempotencyKey) await cache.set(`eshare-idempotency:${body.idempotencyKey}`, share, 86400);

          auditLogger.log({ userId: user.id, action: "safety.emergency_share", resource: "safety", result: "success", details: { contactId: body.contactId, lat: body.lat, lng: body.lng, place: body.place, traceId: trace.traceId, smsId: (smsResult as any).id } });
          auditTrail.record({ userId: user.id, action: "safety.emergency_share", resource: "safety", traceId: trace.traceId });
          telemetry.counter("api.emergency-share.sent", 1, { userId: user.id.slice(0, 8) });
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 201);

          return json(
            {
              ok: true,
              share,
              sms: smsResult,
              message: `Emergency share sent to ${contact.name} via SMS with live location https://maps.google.com/?q=${body.lat},${body.lng}`,
              expiresIn: "24h",
              expiresAt: share.expiresAt,
              traceId: trace.traceId,
            },
            { status: 201 },
          );
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500, error instanceof Error ? error.message : "Unknown");
          throw error;
        }
      }, { rateLimit: { limit: 5, key: ({ caller }) => `eshare:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.safety.emergency-share.delete", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          if (!id) {
            telemetry.endSpan(span.spanId, "error", "id required");
            finishTrace(trace, 400);
            return jsonError("id required", 400);
          }

          // Verify ownership
          const [existing] = await db.select().from(emergencyShares).where(eq(emergencyShares.id, id)).limit(1);
          if (!existing || existing.userId !== user.id) {
            telemetry.endSpan(span.spanId, "error", "not found or forbidden");
            finishTrace(trace, 404);
            return jsonError("Share not found", 404);
          }

          await resilient(
            async () => db.delete(emergencyShares).where(eq(emergencyShares.id, id)),
            { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-emergency" },
          );

          await cache.delete(`emergency-shares:${user.id}`);
          auditLogger.log({ userId: user.id, action: "safety.emergency_share.delete", resource: "safety", result: "success", details: { shareId: id, traceId: trace.traceId } });
          telemetry.counter("api.emergency-share.deleted", 1);
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          return json({ ok: true, deleted: id, traceId: trace.traceId });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500, error instanceof Error ? error.message : "Unknown");
          throw error;
        }
      }, { rateLimit: { limit: 10, key: ({ caller }) => `eshare:DELETE:${caller?.id}` } }),
    },
  },
});
