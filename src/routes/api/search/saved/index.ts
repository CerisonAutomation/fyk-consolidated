import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { users } from "#/schema";

/**
 * Saved Searches with Alerts — 16.2, 3.8
 * Save filter sets, re-run with one tap, push alert on new matches.
 */

const saveSchema = z.object({
  name: z.string().min(1).max(60),
  filters: z.record(z.string(), z.any()),
  alertsEnabled: z.boolean().default(false),
});

export const Route = createFileRoute("/api/search/saved/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),

      GET: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);
          const [me] = await db
            .select({ filterPresets: (users as any).filterPresets })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const presets = ((me as any)?.filterPresets ?? []) as any[];

          return json({ saved: presets, count: presets.length });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `saved-search:GET:${caller?.id}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, saveSchema, 8 * 1024);

          const [me] = await db
            .select({ filterPresets: (users as any).filterPresets })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const current = ((me as any)?.filterPresets ?? []) as any[];
          if (current.length >= 10) {
            return jsonError("Max 10 saved searches", 400);
          }

          const newPreset = {
            id: crypto.randomUUID(),
            name: body.name,
            filters: body.filters,
            alertsEnabled: body.alertsEnabled,
            createdAt: new Date().toISOString(),
          };

          const updated = [...current, newPreset];

          await db.update(users).set({ filterPresets: updated } as any).where(eq(users.id, user.id));

          return json({ ok: true, saved: newPreset, count: updated.length }, { status: 201 });
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `saved-search:POST:${caller?.id}` } },
      ),

      DELETE: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const id = url.searchParams.get("id");

          if (!id) return jsonError("id required", 400);

          const [me] = await db
            .select({ filterPresets: (users as any).filterPresets })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const current = ((me as any)?.filterPresets ?? []) as any[];
          const filtered = current.filter((p: any) => p.id !== id);

          await db.update(users).set({ filterPresets: filtered } as any).where(eq(users.id, user.id));

          return json({ ok: true, removed: id, count: filtered.length });
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `saved-search:DELETE:${caller?.id}` } },
      ),
    },
  },
});
