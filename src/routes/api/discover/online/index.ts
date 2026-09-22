import { createFileRoute } from "@tanstack/react-router";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { cardSelection, methodNotAllowed, requireCaller, toProfileCard } from "@/lib/api-helpers";
import { json, withSecurity } from "@/middleware";
import { users } from "@/schema";

/**
 * Online-Now Strip — 16.3
 * Horizontal rail of profiles currently online for instant engagement.
 */

export const Route = createFileRoute("/api/discover/online/")({
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
            .select({ lat: users.latCoarse, lng: users.lngCoarse })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const viewer = me?.lat != null && me?.lng != null ? { lat: me.lat, lng: me.lng } : null;

          const rows = await db
            .select(cardSelection)
            .from(users)
            .where(
              and(
                eq(users.visible, true),
                eq(users.hidden, false),
                eq(users.isSuspended, false),
                eq(users.online, true),
                eq(users.hideOnline, false),
                ne(users.id, user.id),
                sql`${users.lastActiveAt} > now() - interval '15 minutes'`,
              ),
            )
            .orderBy(sql`${users.lastActiveAt} DESC`)
            .limit(20);

          const onlineNow = rows.map((row) => ({
            ...toProfileCard(row, viewer),
            online: true,
            lastActiveAt: new Date().toISOString(),
          }));

          return json({
            onlineNow,
            count: onlineNow.length,
            refreshedAt: new Date().toISOString(),
          });
        },
        { rateLimit: { limit: 120, key: ({ caller }) => `online-now:${caller?.id}` } },
      ),
    },
  },
});
