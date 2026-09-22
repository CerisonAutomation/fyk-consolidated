import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { dataExports, backupExports } from "@/schema";

const exportSchema = z.object({
  includes: z.array(z.enum(["profile","messages","media","settings","all"])).default(["all"]),
  encrypted: z.boolean().default(true),
  type: z.enum(["full","messages","media","settings"]).default("full"),
});

export const Route = createFileRoute("/api/profile/export/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST, DELETE"),
      PATCH: methodNotAllowed("GET, POST, DELETE"),
      GET: withSecurity(async ({ caller }) => {
        const user = requireCaller(caller);
        const exports = await db.select().from(dataExports).where(eq(dataExports.userId, user.id)).orderBy(desc(dataExports.requestedAt)).limit(10);
        const backups = await db.select().from(backupExports).where(eq(backupExports.userId, user.id)).orderBy(desc(backupExports.createdAt)).limit(10);
        return json({ exports, backups, count: exports.length+backups.length });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `export:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const body = await readJson(request, exportSchema, 2*1024);
        const recent = await db.select().from(dataExports).where(eq(dataExports.userId, user.id)).limit(10);
        const pending = recent.filter(e => e.status === "pending" || e.status === "processing");
        if (pending.length >= 3) return jsonError("Too many pending exports", 429);
        const [created] = await db.insert(dataExports).values({
          userId: user.id,
          includes: body.includes as any,
          status: "processing",
          expiresAt: new Date(Date.now()+7*24*60*60*1000),
        }).returning();
        const [backup] = await db.insert(backupExports).values({
          userId: user.id,
          type: body.type,
          encrypted: body.encrypted,
          status: "processing",
          expiresAt: new Date(Date.now()+7*24*60*60*1000),
        }).returning();
        // Simulate async processing
        setTimeout(async () => {
          try {
            await db.update(dataExports).set({ status: "ready", downloadUrl: `https://cdn.example.com/exports/${created.id}.zip`, completedAt: new Date() }).where(eq(dataExports.id, created.id));
            await db.update(backupExports).set({ status: "ready", downloadUrl: `https://cdn.example.com/backups/${backup.id}.enc`, sizeBytes: 1024*1024 }).where(eq(backupExports.id, backup.id));
          } catch {}
        }, 100);
        return json({ ok: true, export: created, backup, message: "Export started, will be ready shortly" }, { status: 201 });
      }, { rateLimit: { limit: 5, key: ({ caller }) => `export:POST:${caller?.id}` } }),
      DELETE: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) return jsonError("id required", 400);
        await db.delete(dataExports).where(eq(dataExports.id, id));
        await db.delete(backupExports).where(eq(backupExports.id, id));
        return json({ ok: true, deleted: id });
      }, { rateLimit: { limit: 10, key: ({ caller }) => `export:DELETE:${caller?.id}` } }),
    },
  },
});

