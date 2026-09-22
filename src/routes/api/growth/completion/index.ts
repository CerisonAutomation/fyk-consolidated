import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, requireCaller } from "@/lib/api-helpers";
import { json, withSecurity } from "@/middleware";
import { users } from "@/schema";
import { calculateCompletion } from "@/lib/growth";

/**
 * Profile Completion Meter — 24.3
 * % bar pushing user to add photos/bio/tags; completing unlocks perk.
 */

export const Route = createFileRoute("/api/growth/completion/")({
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
              id: users.id,
              avatar: users.avatar,
              bio: users.bio,
              photos: users.photos,
              interests: users.interests,
              tribes: users.tribes,
              city: users.city,
              socialLinks: (users as any).socialLinks,
              verification: users.verification,
            })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          if (!me) return json({ percent: 0, missing: [], perksUnlocked: false });

          const completion = calculateCompletion({
            id: me.id,
            avatar: me.avatar,
            bio: me.bio,
            photos: me.photos,
            interests: me.interests,
            tribes: me.tribes,
            city: me.city,
            socialLinks: (me as any).socialLinks,
            verification: me.verification,
          });

          return json({
            ...completion,
            reward: completion.perksUnlocked ? { type: "boost", count: 1, message: "Profile complete! Free boost unlocked 🎉" } : null,
          });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `completion:${caller?.id}` } },
      ),
    },
  },
});
