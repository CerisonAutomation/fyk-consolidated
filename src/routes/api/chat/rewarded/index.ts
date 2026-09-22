import { createFileRoute } from "@tanstack/react-router";
import { eq, and } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { rewardedChatGrants, conversationMembers } from "#/schema";

const grantSchema = z.object({ conversationId: z.string().uuid(), source: z.enum(["ad","coins","premium"]).default("ad") });

export const Route = createFileRoute("/api/chat/rewarded/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const conversationId = url.searchParams.get("conversationId");
        if (!conversationId) return jsonError("conversationId required", 400);
        const grants = await db.select().from(rewardedChatGrants).where(and(eq(rewardedChatGrants.userId, user.id), eq(rewardedChatGrants.conversationId, conversationId)));
        const active = grants.filter(g => new Date(g.expiresAt).getTime() > Date.now() && !g.used);
        return json({ grants, active, hasAccess: active.length > 0, expiresAt: active[0]?.expiresAt });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `rewarded:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, grantSchema, 2*1024);
        const [member] = await db.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, body.conversationId), eq(conversationMembers.profileId, user.id))).limit(1);
        if (!member) return jsonError("Not a member", 403);
        const existing = await db.select().from(rewardedChatGrants).where(and(eq(rewardedChatGrants.userId, user.id), eq(rewardedChatGrants.conversationId, body.conversationId)));
        const active = existing.filter(g => new Date(g.expiresAt).getTime() > Date.now() && !g.used);
        if (active.length > 0) return json({ ok: true, grant: active[0], alreadyGranted: true });
        const [grant] = await db.insert(rewardedChatGrants).values({ userId: user.id, conversationId: body.conversationId, source: body.source, expiresAt: new Date(Date.now()+60*60*1000) }).returning();
        return json({ ok: true, grant, message: "Chat unlocked for 1 hour", expiresIn: "1 hour" }, { status: 201 });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `rewarded:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return jsonError("id required", 400);
        await db.delete(rewardedChatGrants).where(eq(rewardedChatGrants.id, id));
        return json({ ok: true, revoked: id });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `rewarded:DELETE:${caller?.id}` } }),
    },
  },
});

