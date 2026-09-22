import { createFileRoute } from "@tanstack/react-router";
import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { spotlights, consumablesInventory, users } from "#/schema";

const activateSchema = z.object({ durationMinutes: z.number().int().min(10).max(1440).default(60) });

export const Route = createFileRoute("/api/monetization/spotlight/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const [active] = await db.select().from(spotlights).where(and(eq(spotlights.userId, user.id), eq(spotlights.active, true), gt(spotlights.endsAt, new Date()))).limit(1);
        const history = await db.select().from(spotlights).where(eq(spotlights.userId, user.id)).orderBy(desc(spotlights.createdAt)).limit(10);
        return json({
          active: active ?? null,
          isActive: !!active && new Date(active.endsAt).getTime() > Date.now(),
          expiresAt: active?.endsAt ?? null,
          history,
          duration: 60,
          message: active ? `Spotlight active until ${new Date(active.endsAt).toLocaleString()}` : "No active spotlight",
        });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `spotlight:GET:${caller?.id}` } }),

      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, activateSchema, 2*1024);
        const [existing] = await db.select().from(spotlights).where(and(eq(spotlights.userId, user.id), eq(spotlights.active, true), gt(spotlights.endsAt, new Date()))).limit(1);
        if (existing) return jsonError("Already have active spotlight", 400);

        // Check inventory or coins
        const [inv] = await db.select().from(consumablesInventory).where(eq(consumablesInventory.userId, user.id)).limit(10);
        const hasSpotlight = inv && (inv.quantity ?? 0) > 0;

        if (!hasSpotlight) {
          const [me] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
          const coins = (me as any)?.coins ?? 0;
          if (coins < 150) return jsonError("Need 150 coins or spotlight consumable", 402);
        }

        const endsAt = new Date(Date.now() + body.durationMinutes*60*1000);
        const [spotlight] = await db.insert(spotlights).values({ userId: user.id, startsAt: new Date(), endsAt, active: true }).returning();

        if (hasSpotlight && inv) {
          await db.update(consumablesInventory).set({ quantity: (inv.quantity ?? 1) - 1 }).where(eq(consumablesInventory.id, inv.id));
        }

        return json({ ok: true, spotlight, message: `Spotlight activated for ${body.durationMinutes} minutes!`, expiresAt: endsAt }, { status: 201 });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `spotlight:POST:${caller?.id}` } }),

      DELETE: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        await db.update(spotlights).set({ active: false }).where(and(eq(spotlights.userId, user.id), eq(spotlights.active, true)));
        return json({ ok: true, ended: true });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `spotlight:DELETE:${caller?.id}` } }),
    },
  },
});
