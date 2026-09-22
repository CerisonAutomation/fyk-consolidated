import { createFileRoute } from "@tanstack/react-router";
import { eq, and, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { secretAdmirers } from "#/schema";

const admireSchema = z.object({ admiredId: z.string().uuid() });

export const Route = createFileRoute("/api/matches/secret-admirer/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const type = url.searchParams.get("type") ?? "received";
        if (type === "received") {
          const admirers = await db.select().from(secretAdmirers).where(eq(secretAdmirers.admiredId, user.id)).orderBy(desc(secretAdmirers.createdAt)).limit(20);
          return json({ admirers: admirers.map(a => ({ id: a.id, revealed: a.revealed, createdAt: a.createdAt, message: a.revealed ? null : "Someone secretly admires you — match to reveal" })), count: admirers.length, type: "received" });
        }
        const sent = await db.select().from(secretAdmirers).where(eq(secretAdmirers.admirerId, user.id)).orderBy(desc(secretAdmirers.createdAt)).limit(20);
        return json({ admirers: sent, count: sent.length, type: "sent" });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `secret:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, admireSchema, 2*1024);
        if (body.admiredId === user.id) return jsonError("Cannot admire self", 400);
        const existing = await db.select().from(secretAdmirers).where(and(eq(secretAdmirers.admirerId, user.id), eq(secretAdmirers.admiredId, body.admiredId))).limit(1);
        if (existing.length > 0) return jsonError("Already admiring", 400);
        const [created] = await db.insert(secretAdmirers).values({ admirerId: user.id, admiredId: body.admiredId }).returning();
        return json({ ok: true, admirer: created, message: "Secret admiration sent — they will see: Someone secretly admires you — match to reveal" }, { status: 201 });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `secret:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return jsonError("id required", 400);
        await db.delete(secretAdmirers).where(eq(secretAdmirers.id, id));
        return json({ ok: true, deleted: id });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `secret:DELETE:${caller?.id}` } }),
    },
  },
});

