import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";

/**
 * Safety 2FA alias — redirects to /api/auth/2fa for consistency
 * 21.1 Two-Factor Auth
 */

export const Route = createFileRoute("/api/safety/2fa/")({
  server: {
    handlers: {
      GET: withSecurity(
        async () => {
          return json({
            message: "Use /api/auth/2fa for TOTP setup",
            endpoints: {
              setup: "POST /api/auth/2fa {action:'setup'}",
              verify: "POST /api/auth/2fa {action:'verify', code, secret}",
              enable: "POST /api/auth/2fa {action:'enable', code}",
              disable: "POST /api/auth/2fa {action:'disable', code}",
            },
          });
        },
        { rateLimit: { limit: 30, key: ({ ip }) => `safety-2fa:${ip}` } },
      ),
      POST: methodNotAllowed("GET"),
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),
    },
  },
});
