import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { users } from "#/schema";
import { calculateCompatibility } from "#/lib/matching";

export const Route = createFileRoute("/api/discover/compatibility/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      POST: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const minScore = parseInt(url.searchParams.get("minScore") ?? "70");
        const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20"));
        const candidates = await db.select().from(users).where(eq(users.visible, true)).orderBy(desc(users.lastActiveAt)).limit(100);
        const scored = candidates.filter(c => c.id !== user.id).map(c => {
          const compat = calculateCompatibility({ id: user.id, interests: [], tribes: [], position: [], lookingFor: [], languages: [] } as any, c as any);
          return { user: c, score: Math.round(compat.total*100), dimensions: compat.dimensions };
        }).filter(s => s.score >= minScore).sort((a,b) => b.score - a.score).slice(0, limit);
        return json({ candidates: scored, count: scored.length, minScore, explainability: "Ranked by compatibility: vibe 30% + intimacy 25% + logistics 25% + lifestyle 20%" });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `discover-compat:GET:${caller?.id}` } }),
    },
  },
});

