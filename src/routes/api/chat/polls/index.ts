import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { conversationMembers, messages } from "#/schema";

/**
 * Chat Polls — 27.7
 * Inline polls posted in a thread, both sides vote, live-update bubble.
 */

const createPollSchema = z.object({
  conversationId: z.string().uuid(),
  question: z.string().min(1).max(200),
  options: z.array(z.string().min(1).max(100)).min(2).max(6),
  expiresAt: z.string().datetime().optional(),
});

export const Route = createFileRoute("/api/chat/polls/")({
  server: {
    handlers: {
      GET: methodNotAllowed("POST"),
      PUT: methodNotAllowed("POST"),
      PATCH: methodNotAllowed("POST"),
      DELETE: methodNotAllowed("POST"),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, createPollSchema, 4 * 1024);

          // Verify membership
          const [member] = await db
            .select()
            .from(conversationMembers)
            .where(and(eq(conversationMembers.conversationId, body.conversationId), eq(conversationMembers.profileId, user.id)))
            .limit(1);

          if (!member) return jsonError("Not a member of conversation", 403);

          // Create poll message
          const pollData = {
            question: body.question,
            options: body.options.map((text, index) => ({ index, text, votes: 0, voters: [] as string[] })),
            totalVotes: 0,
            expiresAt: body.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            createdBy: user.id,
          };

          const [msg] = await db
            .insert(messages)
            .values({
              conversationId: body.conversationId,
              senderId: user.id,
              type: "poll" as any,
              body: JSON.stringify(pollData),
            })
            .returning({ id: messages.id, createdAt: messages.createdAt });

          return json(
            {
              ok: true,
              poll: { id: msg.id, ...pollData, createdAt: (msg.createdAt as any)?.toISOString?.() ?? new Date().toISOString() },
            },
            { status: 201 },
          );
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `polls:create:${caller?.id}` } },
      ),
    },
  },
});


