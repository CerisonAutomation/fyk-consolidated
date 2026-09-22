import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, readJson, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { conversationMembers, messages } from "@/schema";

/**
 * Share Location in Chat — 19.3
 * Location attachment (map pin + place name) sent as message.
 */

const shareSchema = z.object({
  conversationId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  placeName: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  expiresInMinutes: z.number().int().min(5).max(1440).default(60), // live location duration
  isLive: z.boolean().default(false),
});

export const Route = createFileRoute("/api/chat/location/")({
  server: {
    handlers: {
      GET: methodNotAllowed("POST"),
      PUT: methodNotAllowed("POST"),
      PATCH: methodNotAllowed("POST"),
      DELETE: methodNotAllowed("POST"),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, shareSchema, 4 * 1024);

          const [member] = await db
            .select()
            .from(conversationMembers)
            .where(and(eq(conversationMembers.conversationId, body.conversationId), eq(conversationMembers.profileId, user.id)))
            .limit(1);

          if (!member) return jsonError("Not a member", 403);

          const locationData = {
            lat: body.lat,
            lng: body.lng,
            placeName: body.placeName ?? "Shared location",
            address: body.address,
            isLive: body.isLive,
            expiresAt: body.isLive ? new Date(Date.now() + body.expiresInMinutes * 60 * 1000).toISOString() : undefined,
            sharedBy: user.id,
          };

          const [msg] = await db
            .insert(messages)
            .values({
              conversationId: body.conversationId,
              senderId: user.id,
              type: "location" as any,
              body: JSON.stringify(locationData),
            })
            .returning({ id: messages.id, createdAt: messages.createdAt });

          return json(
            {
              ok: true,
              message: {
                id: msg.id,
                type: "location",
                location: locationData,
                createdAt: (msg.createdAt as any)?.toISOString?.() ?? new Date().toISOString(),
              },
            },
            { status: 201 },
          );
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `chat:location:${caller?.id}` } },
      ),
    },
  },
});
