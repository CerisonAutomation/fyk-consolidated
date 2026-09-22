import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, requireCaller } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { conversationMembers, messages, users } from "@/schema";
import { evaluateEscalationWindow } from "@/domains/ai/heuristic/escalation-coach";

/**
 * Escalation Coach — 25.7
 * Detects natural "ask to meet" window and nudges with low-pressure date ask.
 */

export const Route = createFileRoute("/api/ai/escalation/")({
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
            .select({ body: messages.body, senderId: messages.senderId, createdAt: messages.createdAt })
            .from(messages)
            .where(and(eq(messages.conversationId, conversationId), isNull(messages.unsentAt)))
            .orderBy(asc(messages.createdAt))
            .limit(50);

          const hasAskedToMeet = rows.some((r) => {
            const text = (r.body ?? "").toLowerCase();
            return text.includes("meet") || text.includes("coffee") || text.includes("drink") || text.includes("grab");
          });

          const bothOnline = true; // would check presence

          const positiveTone = rows.some((r) => {
            const text = (r.body ?? "").toLowerCase();
            return ["great", "awesome", "love", "fun", "nice"].some((w) => text.includes(w));
          });

          const firstMessageTime = rows[0]?.createdAt?.getTime() ?? Date.now();
          const daysTalking = Math.floor((Date.now() - firstMessageTime) / (1000 * 60 * 60 * 24));

          // Get shared interests
          const [peer] = await db
            .select({ interests: users.interests })
            .from(conversationMembers)
            .leftJoin(users, eq(users.id, conversationMembers.profileId))
            .where(and(eq(conversationMembers.conversationId, conversationId), eq(users.id, conversationMembers.profileId)))
            .limit(1);

          const [me] = await db
            .select({ interests: users.interests })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const myInterests = (me?.interests as any) ?? [];
          const theirInterests = (peer?.interests as any) ?? [];
          const sharedInterests = myInterests.filter((i: string) => theirInterests.includes(i)).length;

          const suggestion = evaluateEscalationWindow({
            sharedInterests,
            conversationLength: rows.length,
            bothOnline,
            positiveTone,
            daysTalking,
            hasAskedToMeet,
          });

          return json({
            ...suggestion,
            conversationId,
            ethics: {
              suggestOnly: true,
              neverAutoSends: true,
              humanConfirms: true,
            },
          });
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `escalation:${caller?.id}` } },
      ),
    },
  },
});
