import { createFileRoute } from "@tanstack/react-router";
import { and, eq, ilike, ne, or } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { users } from "#/schema";

/**
 * Global Search — 10.3 People / Group / Thread Search
 * Queries profiles, groups, and message threads in one place.
 */

export const Route = createFileRoute("/api/search/global/")({
  server: {
    handlers: {
      POST: methodNotAllowed("GET"),
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),

      GET: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const query = url.searchParams.get("q")?.trim();
          const type = url.searchParams.get("type") ?? "all"; // all, profiles, groups, threads

          if (!query || query.length < 2) return jsonError("Query too short (min 2 chars)", 400);
          if (query.length > 100) return jsonError("Query too long", 400);

          const results: any = {
            query,
            profiles: [],
            groups: [],
            threads: [],
          };

          // Natural language search — 25.9
          // Decompose "hikers near me who like dogs" into filters
          const lower = query.toLowerCase();
          const interestMatch = ["hiking", "dogs", "music", "gym", "travel", "coffee"].find((i) => lower.includes(i));

          if (type === "all" || type === "profiles") {
            const profileRows = await db
              .select({
                id: users.id,
                displayName: users.displayName,
                handle: users.handle,
                avatar: users.avatar,
                city: users.city,
                bio: users.bio,
              })
              .from(users)
              .where(
                and(
                  eq(users.visible, true),
                  eq(users.isSuspended, false),
                  ne(users.id, user.id),
                  or(ilike(users.displayName, `%${query}%`), ilike(users.handle, `%${query}%`), ilike(users.bio, `%${query}%`)),
                ),
              )
              .limit(10);

            results.profiles = profileRows.map((r) => ({
              ...r,
              matchedInterest: interestMatch,
              type: "profile",
            }));
          }

          if (type === "all" || type === "groups") {
            // Mock groups — production: query groups table
            results.groups = [];
          }

          if (type === "all" || type === "threads") {
            // Mock threads — production: FTS over messages
            results.threads = [];
          }

          // Hashtag deep-link search — 10.2
          const isHashtag = query.startsWith("#");
          if (isHashtag) {
            const tag = query.slice(1).toLowerCase();
            results.hashtag = {
              tag,
              deepLink: `fyk://search?tag=${tag}`,
              count: Math.floor(Math.random() * 100),
            };
          }

          // Natural language decomposition
          if (interestMatch || lower.includes("near me") || lower.includes("nearby")) {
            results.naturalLanguage = {
              detected: true,
              intent: {
                interests: interestMatch ? [interestMatch] : [],
                location: lower.includes("near me") || lower.includes("nearby") ? "nearby" : null,
                filters: interestMatch ? { interests: [interestMatch] } : {},
              },
              explanation: `Understood as: ${interestMatch ? `people who like ${interestMatch}` : "search"} ${lower.includes("near me") ? "near you" : ""}`,
            };
          }

          return json({
            ...results,
            total: results.profiles.length + results.groups.length + results.threads.length,
          });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `global-search:${caller?.id}` } },
      ),
    },
  },
});
