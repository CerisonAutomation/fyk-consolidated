import { createFileRoute } from "@tanstack/react-router";
import { eq, and, gte, lte } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { calendarSync, calendarEvents } from "#/schema";

const syncSchema = z.object({ provider: z.enum(["none","google","apple","outlook"]), enabled: z.boolean(), freeSlots: z.array(z.object({ day: z.string(), start: z.string(), end: z.string() })).optional() });
const eventSchema = z.object({ title: z.string().min(1).max(100), startsAt: z.string().datetime(), endsAt: z.string().datetime(), location: z.string().max(200).optional(), isPrivate: z.boolean().default(false) });

export const Route = createFileRoute("/api/calendar/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const type = url.searchParams.get("type") ?? "all";
        const [sync] = await db.select().from(calendarSync).where(eq(calendarSync.userId, user.id)).limit(1);
        if (type === "sync") return json({ sync: sync ?? { provider: "none", enabled: false, freeSlots: [] } });
        const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date();
        const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : new Date(Date.now()+30*24*60*60*1000);
        const events = await db.select().from(calendarEvents).where(and(eq(calendarEvents.userId, user.id), gte(calendarEvents.startsAt, from), lte(calendarEvents.startsAt, to))).orderBy(calendarEvents.startsAt).limit(50);
        return json({ events, sync: sync ?? null, count: events.length, upcoming: events.filter(e => new Date(e.startsAt).getTime() > Date.now()).slice(0,3), freeSlots: sync?.freeSlots ?? [] });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `cal:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const action = url.searchParams.get("action") ?? "event";
        if (action === "sync") {
          const body = await readJson(request, syncSchema, 4*1024);
          const [existing] = await db.select().from(calendarSync).where(eq(calendarSync.userId, user.id)).limit(1);
          if (!existing) {
            const [created] = await db.insert(calendarSync).values({ userId: user.id, provider: body.provider, enabled: body.enabled, freeSlots: body.freeSlots as any, lastSyncedAt: new Date() }).returning();
            return json({ ok: true, sync: created }, { status: 201 });
          }
          const [updated] = await db.update(calendarSync).set({ provider: body.provider, enabled: body.enabled, freeSlots: body.freeSlots as any, lastSyncedAt: new Date(), updatedAt: new Date() }).where(eq(calendarSync.userId, user.id)).returning();
          return json({ ok: true, sync: updated });
        }
        const body = await readJson(request, eventSchema, 4*1024);
        if (new Date(body.endsAt).getTime() <= new Date(body.startsAt).getTime()) return jsonError("endsAt must be after startsAt", 400);
        const [event] = await db.insert(calendarEvents).values({ userId: user.id, title: body.title, startsAt: new Date(body.startsAt), endsAt: new Date(body.endsAt), location: body.location, isPrivate: body.isPrivate }).returning();
        return json({ ok: true, event }, { status: 201 });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `cal:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return jsonError("id required", 400);
        await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
        return json({ ok: true, deleted: id });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `cal:DELETE:${caller?.id}` } }),
    },
  },
});

