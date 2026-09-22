import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, withSecurity } from "@/middleware";
import { users } from "@/schema";

/**
 * Notification Quiet Hours / Snooze — 19.9
 * Per-conversation mute with time window, plus global DND schedule.
 */

const quietSchema = z.object({
  dndEnabled: z.boolean(),
  dndStart: z.string().regex(/^\d{2}:\d{2}$/).optional(), // HH:MM
  dndEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  mutedConversations: z.array(z.string().uuid()).max(100).default([]),
  snoozeUntil: z.string().datetime().optional(),
});

export const Route = createFileRoute("/api/chat/quiet-hours/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),

      GET: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);
          const [me] = await db
            .select({
              dndMode: users.dndMode,
              notifPrefs: users.notifPrefs,
            })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const prefs = (me?.notifPrefs as any) ?? {};

          return json({
            dndEnabled: me?.dndMode ?? false,
            dndStart: prefs.dndStart ?? "22:00",
            dndEnd: prefs.dndEnd ?? "08:00",
            mutedConversations: prefs.mutedConversations ?? [],
            snoozeUntil: prefs.snoozeUntil ?? null,
          });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `quiet:GET:${caller?.id}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, quietSchema, 4 * 1024);

          const [me] = await db
            .select({ notifPrefs: users.notifPrefs })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const current = (me?.notifPrefs as any) ?? {};
          const updated = {
            ...current,
            dndStart: body.dndStart ?? current.dndStart,
            dndEnd: body.dndEnd ?? current.dndEnd,
            mutedConversations: body.mutedConversations,
            snoozeUntil: body.snoozeUntil ?? current.snoozeUntil,
          };

          await db
            .update(users)
            .set({
              dndMode: body.dndEnabled,
              notifPrefs: updated,
            } as any)
            .where(eq(users.id, user.id));

          return json({ ok: true, ...updated, dndEnabled: body.dndEnabled });
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `quiet:POST:${caller?.id}` } },
      ),
    },
  },
});
