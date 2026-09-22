import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";

/**
 * Social Login — 1.3
 * Google/Apple/Facebook OAuth token exchange, account linking.
 */

const linkSchema = z.object({
  provider: z.enum(["google", "apple", "facebook"]),
  idToken: z.string().min(10).max(5000),
  accessToken: z.string().min(10).max(5000).optional(),
});

const unlinkSchema = z.object({
  action: z.literal("unlink"),
  provider: z.enum(["google", "apple", "facebook"]),
});


export const Route = createFileRoute("/api/auth/social/")({
  server: {
    handlers: {
      GET: methodNotAllowed("POST, DELETE"),
      PUT: methodNotAllowed("POST, DELETE"),
      PATCH: methodNotAllowed("POST, DELETE"),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, linkSchema, 8 * 1024);

          // Production: verify idToken with provider's JWKS
          // Google: https://www.googleapis.com/oauth2/v3/certs
          // Apple: https://appleid.apple.com/auth/keys
          // Facebook: graph.facebook.com

          // Heuristic validation for now
          if (!body.idToken.includes(".")) {
            return jsonError("Invalid token format", 400);
          }

          // Simulate linking — in production, store in auth.identities
          return json({
            ok: true,
            provider: body.provider,
            linked: true,
            userId: user.id,
            message: `${body.provider} account linked`,
          });
        },
        {
          rateLimit: { limit: 20, key: ({ caller }) => `social:link:${caller?.id ?? "anon"}` },
        },
      ),

      DELETE: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, unlinkSchema, 2 * 1024);

          return json({
            ok: true,
            provider: body.provider,
            unlinked: true,
            userId: user.id,
          });
        },
        {
          rateLimit: { limit: 20, key: ({ caller }) => `social:unlink:${caller?.id ?? "anon"}` },
        },
      ),
    },
  },
});
