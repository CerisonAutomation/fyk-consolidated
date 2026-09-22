import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { generatePickupLines } from "#/domains/ai/heuristic/pickup-lines";

const schema = z.object({ vibe: z.enum(["flirty","funny","sweet","bold"]).default("flirty"), count: z.number().int().min(1).max(5).default(3) });

export const Route = createFileRoute("/api/ai/pickup-lines/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller }) => {
        requireCaller(caller);
        const lines = generatePickupLines();
        return json({ lines, vibes: ["flirty","funny","sweet","bold"] });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `pickup:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const body = await readJson(request, schema, 2*1024);
        const all = generatePickupLines();
        const lines = all.slice(0, body.count);
        return json({ lines, vibe: body.vibe, count: lines.length });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `pickup:POST:${caller?.id}` } }),
    },
  },
});
