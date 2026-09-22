import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { users } from "#/schema";
import { generateIcebreakers } from "#/domains/ai/heuristic/icebreakers";

const schema = z.object({ targetId: z.string().uuid(), count: z.number().int().min(1).max(5).default(3) });

export const Route = createFileRoute("/api/ai/icebreakers/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller }) => {
        requireCaller(caller);
        return json({ explainability: "Fresh match AI drafts 3 personalized openers from other profile, tap-to-send, banned-phrase filter" });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `ice:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const body = await readJson(request, schema, 2*1024);
        const [target] = await db.select().from(users).where(eq(users.id, body.targetId)).limit(1);
        if (!target) return json({ error: "Target not found" }, { status: 404 });
        const all = generateIcebreakers({ displayName: target.displayName ?? "there", interests: target.interests as any, aboutMe: target.bio ?? undefined } as any);
        const icebreakers = all.slice(0, body.count);
        return json({ icebreakers, count: icebreakers.length, targetId: body.targetId, explainability: "Generated from targets interests + bio + city, filtered for banned phrases" });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `ice:POST:${caller?.id}` } }),
    },
  },
});
