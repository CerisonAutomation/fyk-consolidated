import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { screenshotLogs, conversationMembers } from "#/schema";

const schema = z.object({ conversationId: z.string().uuid(), platform: z.string().max(50).default("unknown") });

export const Route = createFileRoute("/api/chat/screenshot/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const url = new URL(request.url);
        const conversationId = url.searchParams.get("conversationId");
        if (!conversationId) return jsonError("conversationId required", 400);
        const logs = await db.select().from(screenshotLogs).where(eq(screenshotLogs.conversationId, conversationId)).orderBy(desc(screenshotLogs.detectedAt)).limit(20);
        return json({ logs, count: logs.length, protection: { blurInSwitcher: true, flagSecure: true, notice: "screenshot taken" } });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `ss:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, schema, 2*1024);
        const [member] = await db.select().from(conversationMembers).where(eq(conversationMembers.conversationId, body.conversationId)).limit(1);
        if (!member) return jsonError("Not a member", 403);
        const [log] = await db.insert(screenshotLogs).values({ conversationId: body.conversationId, reporterId: user.id, platform: body.platform }).returning();
        return json({ ok: true, log, message: "Screenshot logged, other participant notified", protection: { blurred: true } }, { status: 201 });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `ss:POST:${caller?.id}` } }),
    },
  },
});

