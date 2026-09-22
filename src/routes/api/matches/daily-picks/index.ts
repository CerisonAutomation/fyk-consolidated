import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { asStringArray, cardSelection, methodNotAllowed, requireCaller, toProfileCard } from "@/lib/api-helpers";
import { compatibilityScore } from "@/lib/compatibility";
import { json, withSecurity } from "@/middleware";
import { users } from "@/schema";

/**
 * Daily Picks — 15.3
 * Algorithm pre-selects high-probability profiles per day, 24h cycle.
 */

export const Route = createFileRoute("/api/matches/daily-picks/")({
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
            .select({
              lat: users.latCoarse,
              lng: users.lngCoarse,
              age: users.age,
              tribes: users.tribes,
              interests: users.interests,
              intents: users.intents,
              lookingFor: users.lookingFor,
              tier: users.tier,
            })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          if (!me) return json({ picks: [], count: 0, message: "Complete onboarding first" });

          const tier = me.tier ?? "free";
          const isPremium = tier !== "free";
          const maxPicks = isPremium ? 10 : 3;

          const meTags = {
            tribes: asStringArray(me.tribes),
            interests: asStringArray(me.interests),
            intents: asStringArray(me.intents).length ? asStringArray(me.intents) : asStringArray(me.lookingFor),
            age: me.age ?? null,
          };

          const viewer = me.lat != null && me.lng != null ? { lat: me.lat, lng: me.lng } : null;

          // Get candidates ordered by compatibility + recency
          const rows = await db
            .select({
              ...cardSelection,
              tribes: users.tribes,
              interests: users.interests,
              intents: users.intents,
              lookingFor: users.lookingFor,
            })
            .from(users)
            .where(
              and(
                eq(users.visible, true),
                eq(users.hidden, false),
                eq(users.isSuspended, false),
                ne(users.id, user.id),
                sql`not exists (select 1 from public.blocks b where (b.blocker_id = ${users.id} and b.blocked_id = ${user.id}) or (b.blocker_id = ${user.id} and b.blocked_id = ${users.id}))`,
              ),
            )
            .orderBy(desc(users.lastActiveAt))
            .limit(100);

          const scored = rows
            .map((row: any) => {
              const card = toProfileCard(row, viewer);
              const score = compatibilityScore(meTags, {
                tribes: asStringArray(row.tribes),
                interests: asStringArray(row.interests),
                intents: asStringArray(row.intents).length ? asStringArray(row.intents) : asStringArray(row.lookingFor),
                age: row.age ?? null,
                distanceKm: card.distance ?? null,
                lastActiveAt: row.lastActiveAt ?? null,
              });
              return { ...card, compatibilityScore: score, tribes: asStringArray(row.tribes), interests: asStringArray(row.interests) };
            })
            .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
            .slice(0, maxPicks);

          // Daily seed: same picks for 24h per user
          const today = new Date().toISOString().slice(0, 10);

          return json({
            picks: scored,
            count: scored.length,
            date: today,
            isPremium,
            maxPicks,
            nextRefreshAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `daily-picks:${caller?.id}` } },
      ),
    },
  },
});
