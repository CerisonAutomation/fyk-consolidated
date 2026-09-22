import { createFileRoute } from "@tanstack/react-router";
import { eq, and } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { chatEphemeralSettings, conversationMembers } from "#/schema";

const schema = z.object({ conversationId: z.string().uuid(), durationSec: z.number().int().refine(v => [0,300,3600,86400,604800].includes(v)), enabled: z.boolean() });

export const Route = createFileRoute("/api/chat/ephemeral/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const conversationId = url.searchParams.get("conversationId");
        if (!conversationId) return jsonError("conversationId required", 400);
        const [settings] = await db.select().from(chatEphemeralSettings).where(and(eq(chatEphemeralSettings.conversationId, conversationId), eq(chatEphemeralSettings.userId, user.id))).limit(1);
        return json({ settings: settings ?? { durationSec: 0, enabled: false }, durations: [{ label: "Off", sec: 0 }, { label: "5 min", sec: 300 }, { label: "1 hour", sec: 3600 }, { label: "24 hours", sec: 86400 }, { label: "7 days", sec: 604800 }] });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `eph:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, schema, 2*1024);
        const [member] = await db.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, body.conversationId), eq(conversationMembers.profileId, user.id))).limit(1);
        if (!member) return jsonError("Not a member", 403);
        const [existing] = await db.select().from(chatEphemeralSettings).where(and(eq(chatEphemeralSettings.conversationId, body.conversationId), eq(chatEphemeralSettings.userId, user.id))).limit(1);
        if (!existing) {
          const [created] = await db.insert(chatEphemeralSettings).values({ conversationId: body.conversationId, userId: user.id, durationSec: body.durationSec, enabled: body.enabled }).returning();
          return json({ ok: true, settings: created }, { status: 201 });
        }
        const [updated] = await db.update(chatEphemeralSettings).set({ durationSec: body.durationSec, enabled: body.enabled, updatedAt: new Date() }).where(and(eq(chatEphemeralSettings.conversationId, body.conversationId), eq(chatEphemeralSettings.userId, user.id))).returning();
        return json({ ok: true, settings: updated });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `eph:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const conversationId = url.searchParams.get("conversationId");
        if (!conversationId) return jsonError("conversationId required", 400);
        await db.delete(chatEphemeralSettings).where(and(eq(chatEphemeralSettings.conversationId, conversationId), eq(chatEphemeralSettings.userId, user.id)));
        return json({ ok: true, disabled: true });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `eph:DELETE:${caller?.id}` } }),
    },
  },
});

