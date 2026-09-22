import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { users } from "#/schema";

export const GIFT_CATALOG = [
  { id: "wink", label: "Wink", cost: 5, emoji: "😉", tier: "common", animation: "wink" },
  { id: "rose", label: "Rose", cost: 20, emoji: "🌹", tier: "common", animation: "rose" },
  { id: "heart", label: "Heart", cost: 50, emoji: "❤️", tier: "rare", animation: "hearts" },
  { id: "crown", label: "Crown", cost: 100, emoji: "👑", tier: "rare", animation: "crown" },
  { id: "diamond", label: "Diamond", cost: 250, emoji: "💎", tier: "epic", animation: "diamond" },
  { id: "throne", label: "Throne", cost: 750, emoji: "👑💎", tier: "legendary", animation: "throne" },
] as const;

const sendGiftSchema = z.object({
  toUserId: z.string().uuid(),
  giftId: z.string().min(1).max(30),
  context: z.enum(["profile", "chat", "live", "post"]).default("profile"),
  contextId: z.string().max(100).optional(),
  message: z.string().max(200).optional(),
});

export const Route = createFileRoute("/api/gifts/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),

      GET: withSecurity(
        async () => {
          return json({
            catalog: GIFT_CATALOG,
            tiers: {
              common: GIFT_CATALOG.filter((g) => g.tier === "common"),
              rare: GIFT_CATALOG.filter((g) => g.tier === "rare"),
              epic: GIFT_CATALOG.filter((g) => g.tier === "epic"),
              legendary: GIFT_CATALOG.filter((g) => g.tier === "legendary"),
            },
          });
        },
        { auth: "optional", rateLimit: { limit: 60, key: ({ ip }) => `gifts:GET:${ip}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, sendGiftSchema, 4 * 1024);

          if (body.toUserId === user.id) return jsonError("Cannot gift yourself", 400);

          const gift = GIFT_CATALOG.find((g) => g.id === body.giftId);
          if (!gift) return jsonError("Gift not found", 404);

          await db.select({ id: users.id }).from(users).where(eq(users.id, user.id)).limit(1);

          const transaction = {
            id: crypto.randomUUID(),
            from: user.id,
            to: body.toUserId,
            giftId: gift.id,
            cost: gift.cost,
            creatorReceives: Math.floor(gift.cost * 0.7),
            context: body.context,
            contextId: body.contextId,
            message: body.message,
            createdAt: new Date().toISOString(),
          };

          return json(
            {
              ok: true,
              transaction,
              gift: {
                ...gift,
                animationUrl: `/animations/${gift.animation}.json`,
              },
            },
            { status: 201 },
          );
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `gifts:POST:${caller?.id}` } },
      ),
    },
  },
});
