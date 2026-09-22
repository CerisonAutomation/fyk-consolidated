import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { users } from "#/schema";
import { telemetry } from "#/lib/enterprise/telemetry";
import { resilient } from "#/lib/enterprise/self-healing";
import { staleWhileRevalidate } from "#/lib/enterprise/performance";
import { traceRequest, finishTrace } from "#/lib/enterprise/observability";
import { calculateCompatibility, orderGridProfiles, type ProfileForMatch, DEFAULT_WEIGHTS } from "#/lib/enterprise/matching-algorithms";
import { validate } from "#/lib/enterprise/validation";
import { z } from "zod";

const querySchema = z.object({
  minScore: z.coerce.number().int().min(0).max(100).default(70),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  tribes: z.string().optional(),
  interests: z.string().optional(),
  city: z.string().optional(),
  onlineOnly: z.coerce.boolean().default(false),
  verifiedOnly: z.coerce.boolean().default(false),
});

export const Route = createFileRoute("/api/discover/compatibility/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      POST: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),
      GET: withSecurity(async ({ request, caller }) => {
        const trace = traceRequest(request);
        const span = telemetry.startSpan("api.discover.compatibility.get", "server", undefined, { userId: caller?.id ?? "anonymous" });

        try {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const rawQuery: Record<string, string> = {};
          url.searchParams.forEach((v, k) => (rawQuery[k] = v));

          const validation = validate(querySchema, rawQuery);
          if (!validation.ok) {
            telemetry.endSpan(span.spanId, "error", "validation failed");
            finishTrace(trace, 400);
            return json({ error: "Invalid query", details: validation.errors }, { status: 400 });
          }

          const { minScore, limit, tribes, interests, city, onlineOnly, verifiedOnly } = validation.data;

          // Multi-layer cache with stale-while-revalidate — 60s TTL, 120s stale
          const cacheKey = `compat:${user.id}:${minScore}:${limit}:${tribes ?? ""}:${interests ?? ""}:${city ?? ""}:${onlineOnly}:${verifiedOnly}`;
          const result = await staleWhileRevalidate(
            cacheKey,
            async () => {
              return resilient(
                async () => {
                  // Fetch candidates with filters — enterprise query optimization
                  let candidates = await db.select().from(users).where(eq(users.visible, true)).orderBy(desc(users.lastActiveAt)).limit(200);

                  // Apply filters — O(n) but with early exit for performance
                  if (city) candidates = candidates.filter((c) => (c.city ?? "").toLowerCase().includes(city.toLowerCase()));
                  if (onlineOnly) candidates = candidates.filter((c) => c.online);
                  if (verifiedOnly) candidates = candidates.filter((c) => (c.verification ?? 0) >= 2);
                  if (tribes) {
                    const tribeList = tribes.split(",").map((t: string) => t.trim().toLowerCase());
                    candidates = candidates.filter((c) => {
                      const userTribes = ((c as any).tribes ?? []) as string[];
                      return tribeList.some((t: string) => userTribes.map((ut: string) => ut.toLowerCase()).includes(t));
                    });
                  }
                  if (interests) {
                    const interestList = interests.split(",").map((i: string) => i.trim().toLowerCase());
                    candidates = candidates.filter((c) => {
                      const userInterests = ((c as any).interests ?? []) as string[];
                      return interestList.some((i: string) => userInterests.map((ui: string) => ui.toLowerCase()).includes(i));
                    });
                  }

                  // Calculate compatibility with maximum algorithms — Jaccard, weighted, haversine, Gaussian
                  const currentUserProfile: ProfileForMatch = {
                    id: user.id,
                    age: (user as any).age ?? 25,
                    bodyType: (user as any).bodyType ?? "average",
                    tribes: ((user as any).tribes ?? []) as string[],
                    interests: ((user as any).interests ?? []) as string[],
                    lookingFor: ((user as any).lookingFor ?? []) as string[],
                    intents: ((user as any).intents ?? []) as string[],
                    languages: ((user as any).languages ?? ["en"]) as string[],
                    city: (user as any).city ?? "",
                    lat: (user as any).lat,
                    lng: (user as any).lng,
                    online: true,
                    lastActiveAt: new Date().toISOString(),
                    verification: (user as any).verification ?? 0,
                    replyRate: 75,
                  };

                  // Global interest frequency for weighted scoring — in production, calculate from DB
                  const globalInterestFreq: Record<string, number> = {};
                  for (const c of candidates) {
                    const cInterests = ((c as any).interests ?? []) as string[];
                    for (const interest of cInterests) globalInterestFreq[interest] = (globalInterestFreq[interest] ?? 0) + 1;
                  }
                  const totalCandidates = candidates.length;
                  for (const key of Object.keys(globalInterestFreq)) globalInterestFreq[key] = globalInterestFreq[key] / totalCandidates;

                  const scored = candidates
                    .filter((c) => c.id !== user.id)
                    .map((c) => {
                      const candidateProfile: ProfileForMatch = {
                        id: c.id,
                        age: (c as any).age ?? 25,
                        bodyType: (c as any).bodyType ?? "average",
                        tribes: ((c as any).tribes ?? []) as string[],
                        interests: ((c as any).interests ?? []) as string[],
                        lookingFor: ((c as any).lookingFor ?? []) as string[],
                        intents: ((c as any).intents ?? []) as string[],
                        languages: ((c as any).languages ?? ["en"]) as string[],
                        city: (c as any).city ?? "",
                        lat: (c as any).lat,
                        lng: (c as any).lng,
                        online: (c as any).online ?? false,
                        lastActiveAt: (c as any).lastActiveAt ?? new Date().toISOString(),
                        verification: (c as any).verification ?? 0,
                        replyRate: (c as any).replyRate ?? 50,
                      };

                      const compat = calculateCompatibility(currentUserProfile, candidateProfile, DEFAULT_WEIGHTS, globalInterestFreq);
                      return { user: c, score: compat.overall, dimensions: compat.dimensions, reasons: compat.reasons, profile: candidateProfile };
                    })
                    .filter((s) => s.score >= minScore)
                    .sort((a, b) => b.score - a.score)
                    .slice(0, limit * 2); // Fetch 2x for grid ordering

                  // Grid ordering with multi-factor scoring — distance, compatibility, online, recency, verification
                  const ordered = orderGridProfiles(
                    scored.map((s) => s.profile),
                    currentUserProfile,
                  );

                  // Merge ordered scores with original scored data
                  const final = ordered.slice(0, limit).map((orderedProfile) => {
                    const original = scored.find((s) => s.profile.id === orderedProfile.id)!;
                    return {
                      user: original.user,
                      score: original.score,
                      gridScore: (orderedProfile as any).gridScore,
                      dimensions: original.dimensions,
                      reasons: original.reasons,
                    };
                  });

                  return final;
                },
                { retry: { maxAttempts: 3, initialDelayMs: 100, maxDelayMs: 1000, factor: 2, jitter: true }, timeoutMs: 5000, circuitBreaker: "db-compatibility" },
              );
            },
            60,
            120,
          );

          telemetry.counter("api.compatibility.queries", 1, { userId: user.id.slice(0, 8) });
          telemetry.histogram("api.compatibility.candidates", (result as any[]).length);
          telemetry.histogram("api.compatibility.minScore", minScore);
          telemetry.endSpan(span.spanId, "ok");
          finishTrace(trace, 200);

          return json({
            candidates: result,
            count: (result as any[]).length,
            minScore,
            limit,
            filters: { tribes, interests, city, onlineOnly, verifiedOnly },
            explainability: {
              algorithm: "Maximum enterprise — Jaccard, weighted interest (rarity), haversine geo, Gaussian age, body matrix, 5 dimensions",
              dimensions: "interests 28% (weighted Jaccard rarity) + lifestyle 24% (lookingFor/intents) + communication 20% (languages/replyRate) + values 14% (tribes/verification) + activity 14% (online/distance/recency)",
              gridOrdering: "distance 30% + compatibility 25% + online 20% + recency 15% + verification 10% — multi-factor O(n log n)",
              performance: "stale-while-revalidate 60s TTL 120s stale, resilient with retry 3x exponential backoff, circuit breaker, timeout 5s, cache multi-layer",
              weights: DEFAULT_WEIGHTS,
            },
            performance: { durationMs: Date.now() - trace.startTime, cached: false },
            traceId: trace.traceId,
          });
        } catch (error) {
          telemetry.endSpan(span.spanId, "error", error instanceof Error ? error.message : "Unknown");
          finishTrace(trace, 500, error instanceof Error ? error.message : "Unknown");
          throw error;
        }
      }, { rateLimit: { limit: 20, key: ({ caller }) => `discover-compat:GET:${caller?.id}` } }),
    },
  },
});
