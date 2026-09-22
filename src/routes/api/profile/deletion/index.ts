import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { deletionRequests, users } from "#/schema";

const deletionSchema = z.object({
  reason: z.string().max(500).optional(),
  confirm: z.string().min(1),
});

export const Route = createFileRoute("/api/profile/deletion/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const [request] = await db.select().from(deletionRequests).where(eq(deletionRequests.userId, user.id)).limit(1);
        if (!request) return json({ request: null, canDelete: true, graceDays: 30 });
        const graceRemaining = request.graceEndsAt ? Math.max(0, Math.ceil((new Date(request.graceEndsAt).getTime()-Date.now())/(1000*60*60*24))) : 0;
        return json({ request, graceRemaining, canCancel: request.status === "grace" || request.status === "pending" });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `deletion:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, deletionSchema, 2*1024);
        if (body.confirm !== "DELETE" && body.confirm !== user.id) return jsonError("Must confirm with DELETE or user ID", 400);
        const [existing] = await db.select().from(deletionRequests).where(eq(deletionRequests.userId, user.id)).limit(1);
        if (existing && existing.status !== "cancelled") return jsonError("Deletion already requested", 400);
        const [created] = await db.insert(deletionRequests).values({
          userId: user.id,
          reason: body.reason,
          status: "grace",
          graceEndsAt: new Date(Date.now()+30*24*60*60*1000),
        }).returning();
        // Soft hide profile immediately
        await db.update(users).set({ visible: false, hidden: true } as any).where(eq(users.id, user.id));
        return json({ ok: true, request: created, message: "Account scheduled for deletion in 30 days. You can cancel anytime." }, { status: 201 });
      }, { rateLimit: { limit: 3, key: ({ caller }) => `deletion:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const [existing] = await db.select().from(deletionRequests).where(eq(deletionRequests.userId, user.id)).limit(1);
        if (!existing) return jsonError("No deletion request", 404);
        if (existing.status === "deleted") return jsonError("Already deleted", 400);
        await db.update(deletionRequests).set({ status: "cancelled" }).where(eq(deletionRequests.userId, user.id));
        await db.update(users).set({ visible: true, hidden: false } as any).where(eq(users.id, user.id));
        return json({ ok: true, cancelled: true, message: "Deletion cancelled, welcome back!" });
      }, { rateLimit: { limit: 5, key: ({ caller }) => `deletion:DELETE:${caller?.id}` } }),
    },
  },
});

