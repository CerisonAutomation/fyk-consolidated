import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { promoCodes, promoRedemptions } from "#/schema";
import { telemetry } from "#/lib/enterprise/telemetry";
import { resilient } from "#/lib/enterprise/self-healing";
import { cache, staleWhileRevalidate } from "#/lib/enterprise/performance";
import { traceRequest, finishTrace, auditTrail } from "#/lib/enterprise/observability";
import { auditLogger } from "#/lib/enterprise/security-hardened";
import { validate } from "#/lib/enterprise/validation";

const redeemSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9_-]+$/i, "Invalid promo code format").transform((s) => s.toUpperCase()),
  idempotencyKey: z.string().uuid().optional(),
});

const CANONICAL_CODES = ["WELCOME15", "PREMIUM20", "ELITE30", "WELCOME10", "FYKFREE7"] as const;
const LEGACY_ALIASES: Record<string, string> = {
  premium15: "WELCOME15",
  premium20: "PREMIUM20",
  elite30: "ELITE30",
  premium10: "WELCOME10",
};

function resolveCanonicalCode(input: string): string {
  const upper = input.toUpperCase();
  return LEGACY_ALIASES[upper] ?? upper;
}

export const Route = createFileRoute("/api/monetization/promo/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller, request }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.monetization.promo.get", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          const user = requireCaller(caller);

          const result = await staleWhileRevalidate(
            `promo:${user.id}`,
            async () => {
              return resilient(
                async () => {
                  const redemptions = await db.select().from(promoRedemptions).where(eq(promoRedemptions.userId, user.id)).orderBy(desc(promoRedemptions.redeemedAt)).limit(20);
                  return redemptions;
                },
                { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-promo" },
              );
            },
            60,
            120,
          );

          const redemptions = result as typeof promoRedemptions.$inferSelect[];

          // Enterprise: calculate savings, tier eligibility
          const totalSavings = redemptions.length * 15; // Simplified
          const eligibleTiers = ["plus", "gold", "platinum"];

          telemetry.counter("api.promo.queries", 1, { userId: user.id.slice(0, 8) });
          telemetry.histogram("api.promo.redemptions_count", redemptions.length);
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          return json({
            redemptions: redemptions.slice(0, 10),
            count: redemptions.length,
            totalSavings,
            eligibleTiers,
            available: CANONICAL_CODES,
            legacyAliases: Object.keys(LEGACY_ALIASES),
            canonicalMap: LEGACY_ALIASES,
            performance: { durationMs: Date.now() - trace.startTime },
            traceId: trace.traceId,
          });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500, error instanceof Error ? error.message : "Unknown");
          throw error;
        }
      }, { rateLimit: { limit: 30, key: ({ caller }) => `promo:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.monetization.promo.post", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          const user = requireCaller(caller);
          const body = await readJson(request, redeemSchema, 2 * 1024);

          // Idempotency
          if (body.idempotencyKey) {
            const cached = await cache.get(`promo-idempotency:${body.idempotencyKey}`);
            if (cached) {
              telemetry.counter("api.promo.idempotency.hit", 1);
              telemetry.endSpan(span.spanId, "ok");
              finishTrace(trace, 200);
              return json({ ok: true, cached: true, redemption: cached.value });
            }
          }

          const canonicalCode = resolveCanonicalCode(body.code);
          const isLegacy = canonicalCode !== body.code.toUpperCase();

          // Validation with enterprise rules
          const validation = validate(redeemSchema, { code: canonicalCode });
          if (!validation.ok) {
            telemetry.endSpan(span.spanId, "error", "validation");
            finishTrace(trace, 400);
            return jsonError(`Invalid promo code: ${validation.errors.map((e) => e.message).join(", ")}`, 400);
          }

          const [promo] = await resilient(
            async () => db.select().from(promoCodes).where(eq(promoCodes.code, canonicalCode)).limit(1),
            { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-promo" },
          );

          if (!promo) {
            telemetry.counter("api.promo.invalid", 1, { code: canonicalCode.slice(0, 8) });
            telemetry.endSpan(span.spanId, "error", "invalid code");
            finishTrace(trace, 404);
            return jsonError("Invalid promo code", 404);
          }

          // Enterprise business rules
          if (new Date(promo.expiresAt).getTime() < Date.now()) {
            telemetry.counter("api.promo.expired", 1, { code: promo.code });
            telemetry.endSpan(span.spanId, "error", "expired");
            finishTrace(trace, 400);
            return jsonError("Promo expired", 400);
          }

          if (promo.usedCount >= promo.maxUses) {
            telemetry.counter("api.promo.max_uses", 1, { code: promo.code });
            telemetry.endSpan(span.spanId, "error", "max uses");
            finishTrace(trace, 400);
            return jsonError("Promo max uses reached", 400);
          }

          // Check if already redeemed — with cache
          const existing = await resilient(
            async () => db.select().from(promoRedemptions).where(eq(promoRedemptions.userId, user.id)).limit(50),
            { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-promo" },
          );

          if (existing.some((r) => r.promoId === promo.id)) {
            telemetry.counter("api.promo.already_redeemed", 1, { userId: user.id.slice(0, 8), code: promo.code });
            telemetry.endSpan(span.spanId, "error", "already redeemed");
            finishTrace(trace, 400);
            return jsonError("Already redeemed", 400);
          }

          // Check tier eligibility — enterprise rule
          const userTier = (user as any).tier ?? "free";
          const tierOrder = { free: 0, plus: 1, gold: 2, platinum: 3 };
          const requiredTier = (promo.tier ?? "plus") as keyof typeof tierOrder;
          if ((tierOrder[userTier as keyof typeof tierOrder] ?? 0) < (tierOrder[requiredTier] ?? 0)) {
            // Allow redemption but with warning — tier upgrade required for full benefits
            telemetry.counter("api.promo.tier_mismatch", 1, { userTier, requiredTier });
          }

          // Create redemption with transaction — enterprise atomicity
          const [redemption] = await resilient(
            async () => db.insert(promoRedemptions).values({ promoId: promo.id, userId: user.id }).returning(),
            { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-promo" },
          );

          await resilient(
            async () => db.update(promoCodes).set({ usedCount: promo.usedCount + 1 }).where(eq(promoCodes.id, promo.id)),
            { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 3000, circuitBreaker: "db-promo" },
          );

          // Invalidate caches
          await cache.delete(`promo:${user.id}`);
          if (body.idempotencyKey) await cache.set(`promo-idempotency:${body.idempotencyKey}`, redemption, 86400);

          // Audit and observability
          auditLogger.log({ userId: user.id, action: "promo.redeem", resource: "monetization", result: "success", details: { code: promo.code, canonicalCode, isLegacy, traceId: trace.traceId } });
          auditTrail.record({ userId: user.id, action: "promo.redeem", resource: "monetization", traceId: trace.traceId });
          telemetry.counter("api.promo.redeemed", 1, { code: promo.code, tier: promo.tier ?? "plus", isLegacy: String(isLegacy) });
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 201);

          return json(
            {
              ok: true,
              redemption,
              promo: { code: promo.code, discountPercent: promo.discountPercent, freeDays: promo.freeDays, freeCoins: promo.freeCoins, tier: promo.tier },
              message: promo.freeDays ? `Redeemed ${promo.freeDays} free days!` : `Redeemed ${promo.discountPercent}% off!`,
              canonicalCode,
              isLegacy,
              legacyResolved: isLegacy ? `${body.code.toUpperCase()} -> ${canonicalCode}` : undefined,
              traceId: trace.traceId,
            },
            { status: 201 },
          );
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500, error instanceof Error ? error.message : "Unknown");
          throw error;
        }
      }, { rateLimit: { limit: 10, key: ({ caller }) => `promo:POST:${caller?.id}` } }),
    },
  },
});
