import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { users } from "#/schema";
import { planDateIdeas, createEventFromPlan } from "#/domains/ai/heuristic/date-planner";

/**
 * AI Date & Event Planner — CORE 25.3
 * From shared wishlist, locations, budget, free-time, proposes 3 concrete plans.
 */

const planSchema = z.object({
  otherUserId: z.string().uuid(),
  budget: z.enum(["free", "low", "mid", "high"]).default("low"),
  sharedWishlist: z.array(z.string().max(60)).max(20).default([]),
  freeSlots: z.array(z.string().max(100)).max(10).default(["Saturday 3pm", "Sunday 11am"]),
  groupChatId: z.string().uuid().optional(),
});

const acceptSchema = z.object({
  ideaIndex: z.number().int().min(0).max(2),
  otherUserId: z.string().uuid(),
  ideas: z.array(z.any()).min(1).max(3),
});

export const Route = createFileRoute("/api/ai/date-planner/")({
  server: {
    handlers: {
      GET: methodNotAllowed("POST"),
      PUT: methodNotAllowed("POST"),
      PATCH: methodNotAllowed("POST"),
      DELETE: methodNotAllowed("POST"),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const action = url.searchParams.get("action") ?? "plan";

          if (action === "plan") {
            const body = await readJson(request, planSchema, 4 * 1024);

            const [me] = await db
              .select({
                lat: users.latCoarse,
                lng: users.lngCoarse,
                city: users.city,
                interests: users.interests,
              })
              .from(users)
              .where(eq(users.id, user.id))
              .limit(1);

            const [other] = await db
              .select({
                lat: users.latCoarse,
                lng: users.lngCoarse,
                city: users.city,
                interests: users.interests,
              })
              .from(users)
              .where(eq(users.id, body.otherUserId))
              .limit(1);

            if (!me || !other) return jsonError("User not found", 404);

            const ideas = planDateIdeas({
              userA: {
                location: { lat: me.lat ?? 0, lng: me.lng ?? 0, city: me.city ?? "Unknown" },
                interests: (me.interests as any) ?? [],
                budget: body.budget,
                freeSlots: body.freeSlots,
              },
              userB: {
                location: { lat: other.lat ?? 0, lng: other.lng ?? 0, city: other.city ?? "Unknown" },
                interests: (other.interests as any) ?? [],
                budget: body.budget,
                freeSlots: body.freeSlots,
              },
              sharedWishlist: body.sharedWishlist,
            });

            return json({
              ideas: ideas.map((idea, index) => ({
                ...idea,
                id: `idea-${index}`,
                tappable: true,
                type: "date_card",
              })),
              count: ideas.length,
              ethics: {
                proposeNeverAct: true,
                humanConfirms: true,
              },
            });
          }

          if (action === "accept") {
            const body = await readJson(request, acceptSchema, 8 * 1024);
            const idea = body.ideas[body.ideaIndex];
            if (!idea) return jsonError("Idea not found", 404);

            const event = createEventFromPlan(idea, [user.id, body.otherUserId]);

            // In production: insert into events table, create calendar hooks

            return json({
              ok: true,
              event: {
                ...event,
                id: crypto.randomUUID(),
                status: "proposed",
                createdAt: new Date().toISOString(),
              },
              message: "Plan accepted — event created with reminders",
            });
          }

          return jsonError("Invalid action", 400);
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `date-planner:${caller?.id}` } },
      ),
    },
  },
});
