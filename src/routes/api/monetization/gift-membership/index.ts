import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { users } from "@/schema";

/**
 * Membership Gifting — 22.1
 * Users can buy and gift a membership period to another profile.
 */

const giftSchema = z.object({
  toUserId: z.string().uuid(),
  tier: z.enum(["plus", "gold", "platinum"]),
  durationDays: z.number().int().min(7).max(365).default(30),
  message: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/monetization/gift-membership/")({
  server: {
    handlers: {
      GET: methodNotAllowed("POST"),
      PUT: methodNotAllowed("POST"),
      PATCH: methodNotAllowed("POST"),
      DELETE: methodNotAllowed("POST"),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, giftSchema, 4 * 1024);

          if (body.toUserId === user.id) return jsonError("Cannot gift yourself", 400);

          const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, body.toUserId)).limit(1);
          if (!target) return jsonError("Recipient not found", 404);

          const gift = {
            id: crypto.randomUUID(),
            giverId: user.id,
            receiverId: body.toUserId,
            tier: body.tier,
            durationDays: body.durationDays,
            message: body.message,
            status: "pending" as const,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30d to claim
          };

          // In production: deduct from giver's wallet, create entitlement pending claim

          return json(
            {
              ok: true,
              gift,
              message: `Gifted ${body.tier} for ${body.durationDays} days`,
            },
            { status: 201 },
          );
        },
        { rateLimit: { limit: 10, key: ({ caller }) => `gift-membership:${caller?.id}` } },
      ),
    },
  },
});
