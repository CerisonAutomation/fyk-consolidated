import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { users } from "#/schema";
import { createPause, isPaused, getPauseRemaining, PAUSE_DURATIONS } from "#/lib/pause-mode";

const pauseSchema = z.object({
  enabled: z.boolean(),
  durationDays: z.number().int().min(1).max(30).nullable().default(null),
  reason: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/profile/pause/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),

      GET: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);
          const [me] = await db
            .select({ pauseMode: (users as any).pauseMode })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const pauseMode = (me as any)?.pauseMode ?? { enabled: false };

          return json({
            pauseMode,
            isPaused: isPaused(pauseMode),
            remaining: getPauseRemaining(pauseMode),
            durations: PAUSE_DURATIONS,
          });
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `pause:GET:${caller?.id}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, pauseSchema, 2 * 1024);

          if (!body.enabled) {
            await db.update(users).set({ pauseMode: { enabled: false } } as any).where(eq(users.id, user.id));
            // Also set visible=true, hidden=false to restore
            await db.update(users).set({ visible: true, hidden: false } as any).where(eq(users.id, user.id));

            return json({ ok: true, paused: false, message: "Welcome back! Profile restored" });
          }

          const pause = createPause(body.durationDays, body.reason);

          await db.update(users).set({ pauseMode: pause } as any).where(eq(users.id, user.id));
          // When paused, make invisible in browse
          await db.update(users).set({ visible: false } as any).where(eq(users.id, user.id));

          return json({
            ok: true,
            paused: true,
            pauseMode: pause,
            remaining: getPauseRemaining(pause),
            message: body.durationDays ? `Paused for ${body.durationDays} days` : "Paused indefinitely",
          });
        },
        { rateLimit: { limit: 10, key: ({ caller }) => `pause:POST:${caller?.id}` } },
      ),
    },
  },
});
