import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, withSecurity } from "@/middleware";
import { userAppConfigs } from "@/schema";

const updateSchema = z.object({
  discreetIcon: z.enum(["default", "calculator", "notes", "weather", "calendar", "health", "music", "news"]).optional(),
  discreetEnabled: z.boolean().optional(),
  appLockEnabled: z.boolean().optional(),
  appLockPin: z.string().min(4).max(8).regex(/^\d+$/).optional(),
  appLockBiometric: z.boolean().optional(),
  appLockTimeoutSec: z.number().int().min(10).max(3600).optional(),
  pauseMode: z.object({
    enabled: z.boolean(),
    reason: z.string().max(200).optional(),
    durationDays: z.number().int().min(1).max(30).nullable().optional(),
  }).nullable().optional(),
  widgetConfig: z.object({
    enabled: z.boolean(),
    showMatches: z.boolean(),
    showUnread: z.boolean(),
    showLikes: z.boolean(),
    showFeatured: z.boolean(),
    refreshIntervalMinutes: z.number().int().min(5).max(60),
  }).optional(),
});

export const Route = createFileRoute("/api/profile/app-config/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),

      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const [config] = await db.select().from(userAppConfigs).where(eq(userAppConfigs.userId, user.id)).limit(1);
        return json({
          config: config ?? {
            discreetIcon: "default",
            discreetEnabled: false,
            appLockEnabled: false,
            appLockBiometric: false,
            appLockTimeoutSec: 60,
            pauseMode: null,
            widgetConfig: { enabled: true, showMatches: true, showUnread: true, showLikes: true, showFeatured: true, refreshIntervalMinutes: 15 },
          },
        });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `app-config:GET:${caller?.id}` } }),

      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, updateSchema, 4 * 1024);

        const [existing] = await db.select().from(userAppConfigs).where(eq(userAppConfigs.userId, user.id)).limit(1);

        const updates: any = { updatedAt: new Date() };
        if (body.discreetIcon !== undefined) updates.discreetIcon = body.discreetIcon;
        if (body.discreetEnabled !== undefined) updates.discreetEnabled = body.discreetEnabled;
        if (body.appLockEnabled !== undefined) updates.appLockEnabled = body.appLockEnabled;
        if (body.appLockBiometric !== undefined) updates.appLockBiometric = body.appLockBiometric;
        if (body.appLockTimeoutSec !== undefined) updates.appLockTimeoutSec = body.appLockTimeoutSec;
        if (body.pauseMode !== undefined) updates.pauseMode = body.pauseMode;
        if (body.widgetConfig !== undefined) updates.widgetConfig = body.widgetConfig;
        if (body.appLockPin) {
          // Production: bcrypt hash
          updates.appLockPinHash = `hashed_${body.appLockPin}`;
        }

        if (!existing) {
          const [created] = await db.insert(userAppConfigs).values({ userId: user.id, ...updates }).returning();
          return json({ ok: true, config: created }, { status: 201 });
        }

        const [updated] = await db.update(userAppConfigs).set(updates).where(eq(userAppConfigs.userId, user.id)).returning();
        return json({ ok: true, config: updated });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `app-config:POST:${caller?.id}` } }),

      DELETE: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        await db.delete(userAppConfigs).where(eq(userAppConfigs.userId, user.id));
        return json({ ok: true, deleted: true });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `app-config:DELETE:${caller?.id}` } }),
    },
  },
});
