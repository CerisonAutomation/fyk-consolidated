import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { appeals } from "#/schema";

const createSchema = z.object({
  targetType: z.enum(["photo","profile","message","ban"]),
  targetId: z.string().min(1).max(100),
  reason: z.string().min(10).max(1000),
});

export const Route = createFileRoute("/api/safety/appeals/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const list = await db.select().from(appeals).where(eq(appeals.userId, user.id)).orderBy(desc(appeals.createdAt)).limit(20);
        return json({ appeals: list, count: list.length, pending: list.filter(a => a.status === "pending").length });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `appeals:GET:${caller?.id}` } }),

      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, createSchema, 4*1024);
        const [existing] = await db.select().from(appeals).where(eq(appeals.userId, user.id)).orderBy(desc(appeals.createdAt)).limit(1);
        if (existing && existing.status === "pending") return jsonError("Already have pending appeal", 400);
        const [appeal] = await db.insert(appeals).values({ userId: user.id, targetType: body.targetType, targetId: body.targetId, reason: body.reason, status: "pending" }).returning();
        return json({ ok: true, appeal, message: "Appeal submitted, human will review" }, { status: 201 });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `appeals:POST:${caller?.id}` } }),

      DELETE: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return jsonError("id required", 400);
        const [appeal] = await db.select().from(appeals).where(eq(appeals.id, id)).limit(1);
        if (!appeal || appeal.userId !== user.id) return jsonError("Not found", 404);
        if (appeal.status !== "pending") return jsonError("Cannot cancel reviewed appeal", 400);
        await db.delete(appeals).where(eq(appeals.id, id));
        return json({ ok: true, deleted: id });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `appeals:DELETE:${caller?.id}` } }),
    },
  },
});
