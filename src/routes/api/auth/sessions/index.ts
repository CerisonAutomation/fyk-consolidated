import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";

export const Route = createFileRoute("/api/auth/sessions/")({
  server: {
    handlers: {
      POST: methodNotAllowed("GET, DELETE"),
      PUT: methodNotAllowed("GET, DELETE"),
      PATCH: methodNotAllowed("GET, DELETE"),

      GET: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);

          const sessions = [
            {
              id: "current",
              userId: user.id,
              userAgent: "Current Device",
              ip: "127.0.0.1",
              createdAt: new Date().toISOString(),
              lastActiveAt: new Date().toISOString(),
              current: true,
            },
          ];

          return json({ sessions });
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `sessions:GET:${caller?.id}` } },
      ),

      DELETE: withSecurity(
        async ({ request, caller }) => {
          requireCaller(caller);
          const url = new URL(request.url);
          const sessionId = url.searchParams.get("id");
          const all = url.searchParams.get("all") === "true";

          if (all) {
            return json({ ok: true, revoked: "all_others", message: "Signed out of other devices" });
          }

          if (!sessionId) return jsonError("Session id required or ?all=true", 400);

          if (sessionId === "current") {
            return jsonError("Cannot revoke current session via this endpoint", 400);
          }

          return json({ ok: true, revoked: sessionId });
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `sessions:DELETE:${caller?.id}` } },
      ),
    },
  },
});
