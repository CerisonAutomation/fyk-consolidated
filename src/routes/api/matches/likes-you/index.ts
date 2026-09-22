import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, requireCaller, toProfileCard } from "@/lib/api-helpers";
import { json, withSecurity } from "@/middleware";
import { taps, users } from "@/schema";

export const Route = createFileRoute("/api/matches/likes-you/")({
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
            .select({ tier: users.tier, lat: users.latCoarse, lng: users.lngCoarse })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const tier = me?.tier ?? "free";
          const isPremium = tier !== "free";
          const viewer = me?.lat != null && me?.lng != null ? { lat: me.lat, lng: me.lng } : null;

          const likers = await db
            .select({
              tapperId: taps.tapperId,
              type: taps.type,
              createdAt: taps.createdAt,
              displayName: users.displayName,
              avatar: users.avatar,
              age: users.age,
              city: users.city,
              verification: users.verification,
              online: users.online,
              lastActiveAt: users.lastActiveAt,
              latCoarse: users.latCoarse,
              lngCoarse: users.lngCoarse,
              hideDistance: users.hideDistance,
              hideOnline: users.hideOnline,
              hideLastOnline: users.hideLastOnline,
              incognito: users.incognito,
              lastSeen: users.lastSeen,
              id: users.id,
              handle: users.handle,
            })
            .from(taps)
            .leftJoin(users, eq(users.id, taps.tapperId))
            .where(eq(taps.tappedId, user.id))
            .limit(50);

          const likedMe = likers.map((row: any) => {
            const card = toProfileCard(
              {
                id: row.id,
                displayName: row.displayName,
                handle: row.handle,
                avatar: row.avatar,
                age: row.age,
                city: row.city,
                area: null,
                online: row.online,
                lastActiveAt: row.lastActiveAt,
                verification: row.verification,
                latCoarse: row.latCoarse,
                lngCoarse: row.lngCoarse,
                hideDistance: row.hideDistance,
                hideOnline: row.hideOnline,
                hideLastOnline: row.hideLastOnline,
                incognito: row.incognito,
                lastSeen: row.lastSeen,
              } as any,
              viewer,
            );

            return {
              ...card,
              tapType: row.type,
              tappedAt: (row.createdAt as any)?.toISOString?.() ?? new Date().toISOString(),
              blurred: !isPremium,
              preview: !isPremium
                ? { silhouette: true, city: row.city }
                : undefined,
            };
          });

          return json({
            likesYou: isPremium ? likedMe : likedMe.map((l: any) => (l.blurred ? { id: l.id, blurred: true, city: l.city, tapType: l.tapType, tappedAt: l.tappedAt } : l)),
            count: likedMe.length,
            isPremium,
            message: isPremium ? undefined : "Upgrade to see who liked you",
          });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `likes-you:${caller?.id}` } },
      ),
    },
  },
});
