import { createFileRoute } from "@tanstack/react-router";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { calculateStreak } from "#/lib/growth";

/**
 * Streaks / Activity Loop — 24.2
 * Consecutive-day login or conversation streaks with visible counter.
 */

export const Route = createFileRoute("/api/growth/streak/")({
  server: {
    handlers: {
      POST: methodNotAllowed("GET"),
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),

      GET: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);

          // Mock login dates — production: query audit_events or presence logs
          const mockDates = [
            new Date().toISOString(),
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
            new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          ];

          const streak = calculateStreak(mockDates);
          streak.userId = user.id;
          streak.type = "login";

          return json({
            streak,
            celebration: streak.count >= 7 ? "Week streak! 🔥" : streak.count >= 3 ? "3 day streak!" : null,
            atRiskMessage: streak.atRisk ? "Login today to keep your streak!" : null,
          });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `streak:${caller?.id}` } },
      ),
    },
  },
});
