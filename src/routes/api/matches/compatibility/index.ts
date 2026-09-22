import { createFileRoute } from "@tanstack/react-router";
import { eq, and, or } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { compatibilityScores, users } from "@/schema";
import { calculateCompatibility } from "@/lib/matching";

const calcSchema = z.object({ targetId: z.string().uuid() });

export const Route = createFileRoute("/api/matches/compatibility/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const targetId = url.searchParams.get("targetId");
        if (targetId) {
          const [a,b] = [user.id, targetId].sort();
          const [score] = await db.select().from(compatibilityScores).where(and(eq(compatibilityScores.userA, a), eq(compatibilityScores.userB, b))).limit(1);
          if (score) return json({ score, cached: true });
          const [me] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
          const [them] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
          if (!me || !them) return jsonError("User not found", 404);
          const compat = calculateCompatibility(me as any, them as any);
          return json({ score: { userA: a, userB: b, score: Math.round(compat.total*100), dimensions: compat.dimensions }, cached: false, explainability: "0.3 vibe + 0.25 intimacy + 0.25 logistics + 0.2 lifestyle" });
        }
        const scores = await db.select().from(compatibilityScores).where(or(eq(compatibilityScores.userA, user.id), eq(compatibilityScores.userB, user.id))).limit(20);
        return json({ scores, count: scores.length });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `compat:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, calcSchema, 2*1024);
        if (body.targetId === user.id) return jsonError("Cannot calculate with self", 400);
        const [me] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
        const [them] = await db.select().from(users).where(eq(users.id, body.targetId)).limit(1);
        if (!me || !them) return jsonError("User not found", 404);
        const compat = calculateCompatibility(me as any, them as any);
        const [a,b] = [user.id, body.targetId].sort();
        const existing = await db.select().from(compatibilityScores).where(and(eq(compatibilityScores.userA, a), eq(compatibilityScores.userB, b))).limit(1);
        if (existing.length > 0) {
          const [updated] = await db.update(compatibilityScores).set({ score: Math.round(compat.total*100), dimensions: compat.dimensions as any, calculatedAt: new Date() }).where(and(eq(compatibilityScores.userA, a), eq(compatibilityScores.userB, b))).returning();
          return json({ ok: true, score: updated });
        }
        const [created] = await db.insert(compatibilityScores).values({ userA: a, userB: b, score: Math.round(compat.total*100), dimensions: compat.dimensions as any }).returning();
        return json({ ok: true, score: created, explainability: "4-axis: vibe, intimacy, logistics, lifestyle" }, { status: 201 });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `compat:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const targetId = url.searchParams.get("targetId");
        if (!targetId) return jsonError("targetId required", 400);
        const [a,b] = [user.id, targetId].sort();
        await db.delete(compatibilityScores).where(and(eq(compatibilityScores.userA, a), eq(compatibilityScores.userB, b)));
        return json({ ok: true, deleted: true });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `compat:DELETE:${caller?.id}` } }),
    },
  },
});

