import { createFileRoute } from "@tanstack/react-router";
import { count, eq, sql } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { favorites, footprints, taps, users } from "#/schema";

/**
 * Profile View Analytics — 18.5, 27.8
 * Owner sees aggregate stats without identities unless premium.
 */

export const Route = createFileRoute("/api/profile/analytics/")({
  server: {
    handlers: {
      POST: methodNotAllowed("GET"),
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),

      GET: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);

          const [me] = await db
            .select({ tier: users.tier, trustScore: users.trustScore, verification: users.verification })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const tier = me?.tier ?? "free";
          const isPremium = tier !== "free";

          const [viewsResult] = await db
            .select({ count: count() })
            .from(footprints)
            .where(eq(footprints.visitedId, user.id));

          const [likesResult] = await db
            .select({ count: count() })
            .from(taps)
            .where(eq(taps.tappedId, user.id));

          const [favsResult] = await db
            .select({ count: count() })
            .from(favorites)
            .where(eq(favorites.targetId, user.id));

          const totalViews = viewsResult?.count ?? 0;
          const totalLikes = likesResult?.count ?? 0;
          const totalFavs = favsResult?.count ?? 0;

          // Recent views (premium sees identities)
          let recentVisitors: any[] = [];
          if (isPremium) {
            recentVisitors = await db
              .select({
                visitorId: footprints.visitorId,
                createdAt: footprints.createdAt,
                displayName: users.displayName,
                avatar: users.avatar,
              })
              .from(footprints)
              .leftJoin(users, eq(users.id, footprints.visitorId))
              .where(eq(footprints.visitedId, user.id))
              .orderBy(sql`${footprints.createdAt} DESC`)
              .limit(10);
          }

          // Photo performance (mock, would need analytics table)
          const photoStats = {
            bestPerforming: 0,
            views: [120, 85, 60],
            likes: [15, 8, 3],
          };

          // Match rate
          const matchRate = totalLikes > 0 ? Math.round((totalFavs / Math.max(1, totalLikes)) * 100) : 0;

          // Best reply time (heuristic)
          const bestReplyTime = "8-10pm";

          return json({
            views: totalViews,
            likesReceived: totalLikes,
            favoritesReceived: totalFavs,
            matchRate,
            trustScore: me?.trustScore ?? 50,
            verified: (me?.verification ?? 0) >= 2,
            recentVisitors: isPremium ? recentVisitors : undefined,
            recentVisitorsCount: totalViews,
            photoStats: isPremium ? photoStats : undefined,
            bestReplyTime: isPremium ? bestReplyTime : undefined,
            tier,
            isPremium,
            message: isPremium ? undefined : "Upgrade to see detailed analytics",
          });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `analytics:${caller?.id}` } },
      ),
    },
  },
});
