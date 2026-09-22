import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { users } from "#/schema";

/**
 * Daily AI Digest — 25.15
 * One daily notification: Top 3 for you + conversations need reply + actionable tip.
 */

export const Route = createFileRoute("/api/ai/digest/")({
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
            .select({ tier: users.tier })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const isPremium = (me?.tier ?? "free") !== "free";

          // Mock digest — production: query daily picks + unread counts + tips
          const digest = {
            date: new Date().toISOString().slice(0, 10),
            topPicks: [
              { id: "pick-1", reason: "High compatibility (85%) + shared interests" },
              { id: "pick-2", reason: "Recently joined + nearby" },
              { id: "pick-3", reason: "Verified + active now" },
            ],
            conversationsNeedReply: [
              { conversationId: "conv-1", otherName: "Alex", hoursSince: 5 },
              { conversationId: "conv-2", otherName: "Jordan", hoursSince: 12 },
            ],
            tip: {
              title: "Boost your profile",
              body: "Profiles with 3+ photos get 3x more matches. Add more photos!",
              action: "Add Photos",
              href: "/settings/profile",
            },
            isPremium,
            nextDigestAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          };

          return json(digest);
        },
        { rateLimit: { limit: 10, key: ({ caller }) => `digest:${caller?.id}` } },
      ),
    },
  },
});
