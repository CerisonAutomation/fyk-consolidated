import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { cardSelection, methodNotAllowed, readPagination, requireCaller, toProfileCard } from "@/lib/api-helpers";
import { json, withSecurity } from "@/middleware";
import { users } from "@/schema";

export const Route = createFileRoute("/api/discover/fresh/")({
  server: {
    handlers: {
      POST: methodNotAllowed("GET"),
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),

      GET: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const { limit } = readPagination(new URL(request.url));

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
                ne(users.id, user.id),
                sql`${users.createdAt} > now() - interval '7 days'`,
                sql`not exists (select 1 from public.blocks b where (b.blocker_id = ${users.id} and b.blocked_id = ${user.id}) or (b.blocker_id = ${user.id} and b.blocked_id = ${users.id}))`,
              ),
            )
            .orderBy(desc(users.createdAt))
            .limit(Math.min(limit, 50));

          const candidates = rows.map((row: any) => ({
            ...toProfileCard(row, viewer),
            isFresh: true,
            freshUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }));

          return json({
            candidates,
            count: candidates.length,
            meta: { freshCount: candidates.length, period: "7d" },
          });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `fresh:${caller?.id}` } },
      ),
    },
  },
});
