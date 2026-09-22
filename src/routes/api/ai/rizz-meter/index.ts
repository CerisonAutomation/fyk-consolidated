import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, requireCaller } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { conversationMembers, messages } from "@/schema";
import { calculateRizzScore, shouldCelebrate } from "@/domains/ai/heuristic/rizz-meter";

export const Route = createFileRoute("/api/ai/rizz-meter/")({
  server: {
    handlers: {
      POST: methodNotAllowed("GET"),
      PUT: methodNotAllowed("GET"),
      PATCH: methodNotAllowed("GET"),
      DELETE: methodNotAllowed("GET"),

      GET: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const conversationId = url.searchParams.get("conversationId");
          if (!conversationId) return jsonError("conversationId required", 400);

          const [member] = await db
            .select()
            .from(conversationMembers)
            .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.profileId, user.id)))
            .limit(1);

          if (!member) return jsonError("Not a member", 403);

          const rows = await db
            .select({ senderId: messages.senderId, body: messages.body, createdAt: messages.createdAt })
            .from(messages)
            .where(and(eq(messages.conversationId, conversationId), isNull(messages.unsentAt)))
            .orderBy(asc(messages.createdAt))
            .limit(50);

          const mapped = rows.map((r) => ({
            sender: (r.senderId === user.id ? "me" : "them") as "me" | "them",
            text: r.body ?? "",
            timestamp: r.createdAt?.getTime() ?? Date.now(),
            length: (r.body ?? "").length,
          }));

          const score = calculateRizzScore(mapped);
          const celebrate = shouldCelebrate(score);

          return json({
            ...score,
            celebrate,
            conversationId,
            explainability: {
              why: `Engagement ${score.engagement}, Momentum ${score.momentum}, Tone ${score.tone}`,
              factors: ["reply speed", "message length balance", "positive words", "cadence"],
            },
          });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `rizz-meter:${caller?.id}` } },
      ),
    },
  },
});
