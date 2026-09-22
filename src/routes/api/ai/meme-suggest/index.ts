import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { suggestMemes, suggestByIntent } from "#/domains/ai/heuristic/meme-suggest";

const schema = z.object({ message: z.string().min(1).max(500), intent: z.string().max(50).optional(), limit: z.number().int().min(1).max(12).default(6) });

export const Route = createFileRoute("/api/ai/meme-suggest/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const url = new URL(request.url);
        const intent = url.searchParams.get("intent");
        if (intent) {
          const memes = suggestByIntent(intent);
          return json({ memes, count: memes.length, intent });
        }
        return json({ intents: ["empathy","celebration","flirty","humor","activity"], explainability: "GIF/sticker picker pre-filters semantically from current message" });
      }, { rateLimit: { limit: 60, key: ({ caller }) => `meme:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const body = await readJson(request, schema, 4*1024);
        const memes = body.intent ? suggestByIntent(body.intent) : suggestMemes(body.message, body.limit);
        return json({ memes, count: memes.length, query: body.message, explainability: memes.length > 0 ? memes[0].reason : "No match, showing trending" });
      }, { rateLimit: { limit: 60, key: ({ caller }) => `meme:POST:${caller?.id}` } }),
    },
  },
});

