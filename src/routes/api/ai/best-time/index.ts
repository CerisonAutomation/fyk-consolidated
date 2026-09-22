import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { conversationMembers, messages } from "#/schema";
import { analyzeBestTime } from "#/domains/ai/heuristic/best-time";

/**
 * Best-Time-to-Message — 25.11
 * Learns each match's reply patterns and suggests optimal send moment.
 */

export const Route = createFileRoute("/api/ai/best-time/")({
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
            .select({ senderId: messages.senderId, createdAt: messages.createdAt })
            .from(messages)
            .where(and(eq(messages.conversationId, conversationId), isNull(messages.unsentAt)))
            .orderBy(asc(messages.createdAt))
            .limit(100);

          // Build reply patterns: time between other person's messages and our replies
          const patternMessages = rows.map((r, idx) => {
            const next = rows[idx + 1];
            let responseDelay: number | undefined;
            if (next && r.senderId !== user.id && next.senderId === user.id) {
              responseDelay = (next.createdAt?.getTime() ?? 0) - (r.createdAt?.getTime() ?? 0);
            }
            return {
              timestamp: r.createdAt?.getTime() ?? Date.now(),
              responseDelay,
            };
          });

          const [otherMember] = await db
            .select({ profileId: conversationMembers.profileId })
            .from(conversationMembers)
            .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.profileId, conversationMembers.profileId)))
            .limit(1);

          const result = analyzeBestTime({
            userId: otherMember?.profileId ?? "other",
            messages: patternMessages,
          });

          if (!result) {
            return json({
              available: false,
              reason: "Not enough data yet — need 5+ messages",
              conversationId,
            });
          }

          return json({
            available: true,
            ...result,
            conversationId,
            ethics: {
              capsAtOneNudge: true,
              explainability: true,
            },
          });
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `best-time:${caller?.id}` } },
      ),
    },
  },
});
