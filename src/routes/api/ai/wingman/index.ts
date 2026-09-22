import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { conversationMembers, messages } from "#/schema";

/**
 * AI Wingman / Post-Chat Coach — 25.13
 * Private debrief screen: after thread, user asks "what could I have done better?"
 */

const coachSchema = z.object({
  conversationId: z.string().uuid(),
});

export const Route = createFileRoute("/api/ai/wingman/")({
  server: {
    handlers: {
      GET: methodNotAllowed("POST"),
      PUT: methodNotAllowed("POST"),
      PATCH: methodNotAllowed("POST"),
      DELETE: methodNotAllowed("POST"),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, coachSchema, 2 * 1024);

          const [member] = await db
            .select()
            .from(conversationMembers)
            .where(and(eq(conversationMembers.conversationId, body.conversationId), eq(conversationMembers.profileId, user.id)))
            .limit(1);

          if (!member) return jsonError("Not a member", 403);

          const rows = await db
            .select({ senderId: messages.senderId, body: messages.body, createdAt: messages.createdAt })
            .from(messages)
            .where(and(eq(messages.conversationId, body.conversationId), isNull(messages.unsentAt)))
            .orderBy(asc(messages.createdAt))
            .limit(50);

          const myMessages = rows.filter((r) => r.senderId === user.id);
          const theirMessages = rows.filter((r) => r.senderId !== user.id);

          // Analyze patterns
          const patterns: string[] = [];
          const advice: string[] = [];

          if (myMessages.length > theirMessages.length * 2) {
            patterns.push("over_eager");
            advice.push("You sent twice as many messages — try matching their pace");
          }

          const avgMyLength = myMessages.reduce((s, m) => s + (m.body?.length ?? 0), 0) / Math.max(1, myMessages.length);
          if (avgMyLength < 20) {
            patterns.push("dry");
            advice.push("Your messages are quite short — try asking open-ended questions");
          }

          if (rows.length >= 5) {
            const hasAskedToMeet = rows.some((r) => (r.body ?? "").toLowerCase().includes("meet"));
            if (!hasAskedToMeet && rows.length > 15) {
              patterns.push("slow_to_escalate");
              advice.push("You've been chatting a while — consider suggesting a meetup");
            }
            if (hasAskedToMeet && rows.length < 10) {
              patterns.push("too_fast_to_escalate");
              advice.push("You asked to meet quite early — build more rapport first next time");
            }
          }

          const positive = theirMessages.length > myMessages.length * 0.5;

          return json({
            summary: {
              totalMessages: rows.length,
              myMessages: myMessages.length,
              theirMessages: theirMessages.length,
              positiveOutcome: positive,
            },
            patterns,
            advice,
            examples: [
              { issue: "over_eager", better: "Wait for their reply before double-texting" },
              { issue: "dry", better: "Instead of 'ok', try 'That's cool! What did you like about it?'" },
            ],
            conversationId: body.conversationId,
            ethics: {
              private: true,
              neverShared: true,
              constructiveOnly: true,
            },
          });
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `wingman:${caller?.id}` } },
      ),
    },
  },
});
