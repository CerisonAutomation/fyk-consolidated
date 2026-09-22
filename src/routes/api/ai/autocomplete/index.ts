import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { autocomplete, shouldShowAutocomplete } from "#/domains/ai/heuristic/autocomplete";

const schema = z.object({ prefix: z.string().min(1).max(100), stylePhrases: z.array(z.string().max(200)).max(20).optional() });

export const Route = createFileRoute("/api/ai/autocomplete/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ caller }) => {
        requireCaller(caller);
        return json({ enabled: true, minChars: 2, maxChars: 50, explainability: "Keyboard-style: predicts rest of sentence in users own voice, tap-to-accept, kept short to avoid AI-slop walls" });
      }, { rateLimit: { limit: 60, key: ({ caller }) => `ac:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const body = await readJson(request, schema, 4*1024);
        if (!shouldShowAutocomplete(body.prefix)) return json({ completion: null, show: false });
        const result = autocomplete(body.prefix, body.stylePhrases);
        return json({ completion: result, show: !!result, prefix: body.prefix, explainability: result ? `Source: ${result.source}, confidence ${result.confidence}` : "No completion" });
      }, { rateLimit: { limit: 60, key: ({ caller }) => `ac:POST:${caller?.id}` } }),
    },
  },
});

