import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { users } from "@/schema";

/**
 * Moderation Queue — D10.2, 11.1, 21.6
 * Admin queue sorted with URGENT priority, actions warn/suspend/ban.
 */

const actionSchema = z.object({
  reportId: z.string().uuid(),
  action: z.enum(["warn", "suspend", "ban", "dismiss"]),
  reason: z.string().max(500).optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
});

export const Route = createFileRoute("/api/admin/moderation/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),

      GET: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);

          // Check admin role
          const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, user.id)).limit(1);
          if (me?.role !== "admin") {
            return jsonError("Admin only", 403);
          }

          const url = new URL(request.url);
          const status = url.searchParams.get("status") ?? "open";
          const priority = url.searchParams.get("priority");

          // Mock reports — production: query reports table with priority sorting
          const mockReports = [
            {
              id: crypto.randomUUID(),
              reporterId: "reporter-1",
              targetId: "target-1",
              targetType: "profile",
              reason: "underage",
              details: "Suspicious age",
              status: "open",
              priority: "URGENT",
              createdAt: new Date().toISOString(),
            },
            {
              id: crypto.randomUUID(),
              reporterId: "reporter-2",
              targetId: "target-2",
              targetType: "message",
              reason: "harassment",
              details: "Threatening messages",
              status: "open",
              priority: "HIGH",
              createdAt: new Date().toISOString(),
            },
          ];

          const filtered = mockReports.filter((r) => {
            if (status !== "all" && r.status !== status) return false;
            if (priority && r.priority !== priority) return false;
            return true;
          });

          // Sort URGENT first
          const sorted = filtered.sort((a, b) => {
            const order = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
            return (order[a.priority as keyof typeof order] ?? 99) - (order[b.priority as keyof typeof order] ?? 99);
          });

          return json({
            reports: sorted,
            count: sorted.length,
            priorities: { URGENT: sorted.filter((r) => r.priority === "URGENT").length },
          });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `mod:GET:${caller?.id}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);

          const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, user.id)).limit(1);
          if (me?.role !== "admin") {
            return jsonError("Admin only", 403);
          }

          const body = await readJson(request, actionSchema, 4 * 1024);

          // In production: update report, apply action to target, audit log

          return json({
            ok: true,
            reportId: body.reportId,
            action: body.action,
            appliedBy: user.id,
            appliedAt: new Date().toISOString(),
          });
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `mod:POST:${caller?.id}` } },
      ),
    },
  },
});
