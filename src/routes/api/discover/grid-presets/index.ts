import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { gridPresets } from "#/schema";

const createSchema = z.object({ name: z.string().min(1).max(50), filters: z.record(z.string(), z.any()), isQuick: z.boolean().default(false), icon: z.string().max(20).optional() });

export const Route = createFileRoute("/api/discover/grid-presets/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const type = url.searchParams.get("type") ?? "all";
        const presets = await db.select().from(gridPresets).where(eq(gridPresets.userId, user.id)).orderBy(desc(gridPresets.createdAt));
        if (type === "quick") return json({ presets: presets.filter(p => p.isQuick), count: presets.filter(p => p.isQuick).length, type: "quick" });
        if (type === "saved") return json({ presets: presets.filter(p => !p.isQuick), count: presets.filter(p => !p.isQuick).length, type: "saved" });
        return json({ presets, quick: presets.filter(p => p.isQuick), saved: presets.filter(p => !p.isQuick), count: presets.length, quickChips: [{ id: "online", label: "Online now", icon: "🟢" }, { id: "photo", label: "Photo only", icon: "📸" }, { id: "my_type", label: "My type", icon: "❤️" }, { id: "fresh", label: "Fresh", icon: "✨" }] });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `grid-presets:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, createSchema, 8*1024);
        const existing = await db.select().from(gridPresets).where(eq(gridPresets.userId, user.id));
        if (existing.length >= 20) return jsonError("Max 20 presets", 400);
        const [created] = await db.insert(gridPresets).values({ userId: user.id, name: body.name, filters: body.filters as any, isQuick: body.isQuick, icon: body.icon }).returning();
        return json({ ok: true, preset: created }, { status: 201 });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `grid-presets:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return jsonError("id required", 400);
        await db.delete(gridPresets).where(eq(gridPresets.id, id));
        return json({ ok: true, deleted: id });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `grid-presets:DELETE:${caller?.id}` } }),
    },
  },
});

