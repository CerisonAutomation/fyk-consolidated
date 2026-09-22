import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { savedSearches } from "#/schema";

const createSchema = z.object({ name: z.string().min(1).max(60), filters: z.record(z.string(), z.any()), alertsEnabled: z.boolean().default(false) });

export const Route = createFileRoute("/api/discover/saved-searches/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const searches = await db.select().from(savedSearches).where(eq(savedSearches.userId, user.id)).orderBy(desc(savedSearches.createdAt)).limit(10);
        return json({ searches, count: searches.length, max: 10, alerts: searches.filter(s => s.alertsEnabled) });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `saved-search:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, createSchema, 8*1024);
        const existing = await db.select().from(savedSearches).where(eq(savedSearches.userId, user.id));
        if (existing.length >= 10) return jsonError("Max 10 saved searches", 400);
        const [created] = await db.insert(savedSearches).values({ userId: user.id, name: body.name, filters: body.filters as any, alertsEnabled: body.alertsEnabled }).returning();
        return json({ ok: true, search: created }, { status: 201 });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `saved-search:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return jsonError("id required", 400);
        await db.delete(savedSearches).where(eq(savedSearches.id, id));
        return json({ ok: true, deleted: id });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `saved-search:DELETE:${caller?.id}` } }),
    },
  },
});

