import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { conversationMembers, messages, users } from "#/schema";
import { generateContextAwareReplies, generateSmartIcebreakers } from "#/domains/ai/heuristic/context-replies";

/**
 * Context-Aware Reply Suggestions — CORE 25.2
 * While typing, offers 2-3 one-tap replies from live context.
 */

const suggestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  targetId: z.string().uuid().optional(), // for icebreakers on new match
  lastMessage: z.string().max(2000).optional(),
});

export const Route = createFileRoute("/api/ai/context-replies/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("POST"),
      PATCH: methodNotAllowed("POST"),
      DELETE: methodNotAllowed("POST"),
      GET: methodNotAllowed("POST"),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, suggestSchema, 4 * 1024);

          // Icebreakers for new match
          if (body.targetId) {
            const [target] = await db
              .select({
                displayName: users.displayName,
                interests: users.interests,
                bio: users.bio,
                photos: users.photos,
              })
              .from(users)
              .where(eq(users.id, body.targetId))
              .limit(1);

            if (!target) return jsonError("Profile not found", 404);

            const suggestions = generateSmartIcebreakers({
              displayName: target.displayName ?? "there",
              interests: (target.interests as any) ?? [],
              bio: target.bio ?? undefined,
              photos: Array.isArray(target.photos) ? (target.photos as any[]).length : 0,
            });

            return json({ suggestions, type: "icebreakers" });
          }

          // Context-aware for existing conversation
          if (body.conversationId) {
            const [member] = await db
              .select()
              .from(conversationMembers)
              .where(and(eq(conversationMembers.conversationId, body.conversationId), eq(conversationMembers.profileId, user.id)))
              .limit(1);

            if (!member) return jsonError("Not a member", 403);

            const [peer] = await db
              .select({ id: users.id, displayName: users.displayName, interests: users.interests })
              .from(conversationMembers)
              .leftJoin(users, eq(users.id, conversationMembers.profileId))
              .where(and(eq(conversationMembers.conversationId, body.conversationId), eq(conversationMembers.profileId, users.id)))
              .limit(1);

            const rows = await db
              .select({ senderId: messages.senderId, body: messages.body, createdAt: messages.createdAt })
              .from(messages)
              .where(and(eq(messages.conversationId, body.conversationId), isNull(messages.unsentAt)))
              .orderBy(asc(messages.createdAt))
              .limit(10);

            const contextMessages = rows.map((r) => ({
              sender: (r.senderId === user.id ? "me" : "them") as "me" | "them",
              text: r.body ?? "",
              timestamp: r.createdAt?.getTime() ?? Date.now(),
            }));

            // Determine stage
            let stage: "new_match" | "talking" | "established" | "meeting_soon" | "cold" = "talking";
            if (rows.length <= 2) stage = "new_match";
            else if (rows.length > 20) stage = "established";

            const suggestions = generateContextAwareReplies({
              messages: contextMessages,
              stage,
              otherName: (peer as any)?.displayName ?? "there",
              sharedInterests: (peer as any)?.interests ?? [],
            });

            return json({ suggestions, type: "context_aware", stage });
          }

          // Fallback: generic from lastMessage
          if (body.lastMessage) {
            const suggestions = generateContextAwareReplies({
              messages: [{ sender: "them", text: body.lastMessage, timestamp: Date.now() }],
              stage: "talking",
              otherName: "there",
            });

            return json({ suggestions, type: "generic" });
          }

          return jsonError("conversationId or targetId or lastMessage required", 400);
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `context-replies:${caller?.id}` } },
      ),
    },
  },
});
