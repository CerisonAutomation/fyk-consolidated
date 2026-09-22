import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { conversationMembers, users } from "#/schema";
import { shouldAutoReply, generateAutoReply, createDefaultAutoReplyConfig } from "#/domains/ai/heuristic/auto-reply";

/**
 * Auto-Reply / AI Avatar — CORE 25.1
 * Toggle AI reply while away, learns writing style, transcript review, block contacts, labeled AI.
 */

const configSchema = z.object({
  enabled: z.boolean(),
  blockedContacts: z.array(z.string().uuid()).max(100).default([]),
  customInstructions: z.string().max(500).optional(),
});

const generateSchema = z.object({
  conversationId: z.string().uuid(),
  incomingMessage: z.string().max(2000),
});

export const Route = createFileRoute("/api/ai/auto-reply/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),

      GET: withSecurity(
        async ({ caller }) => {
          const user = requireCaller(caller);

          const [me] = await db
            .select({ autoReplyConfig: (users as any).autoReplyConfig })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);

          const config = (me as any)?.autoReplyConfig ?? createDefaultAutoReplyConfig();

          return json({
            config,
            ethics: {
              labeled: true,
              proposeNeverAct: true,
              optOutAvailable: true,
              retentionDays: 90,
            },
          });
        },
        { rateLimit: { limit: 30, key: ({ caller }) => `auto-reply:GET:${caller?.id}` } },
      ),

      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const url = new URL(request.url);
          const action = url.searchParams.get("action") ?? "config";

          if (action === "config") {
            const body = await readJson(request, configSchema, 4 * 1024);

            const [me] = await db
              .select({ autoReplyConfig: (users as any).autoReplyConfig })
              .from(users)
              .where(eq(users.id, user.id))
              .limit(1);

            const current = (me as any)?.autoReplyConfig ?? createDefaultAutoReplyConfig();
            const updated = {
              ...current,
              enabled: body.enabled,
              blockedContacts: body.blockedContacts,
              customInstructions: body.customInstructions,
            };

            await db.update(users).set({ autoReplyConfig: updated } as any).where(eq(users.id, user.id));

            return json({ ok: true, config: updated });
          }

          if (action === "generate") {
            const body = await readJson(request, generateSchema, 4 * 1024);

            const [member] = await db
              .select()
              .from(conversationMembers)
              .where(and(eq(conversationMembers.conversationId, body.conversationId), eq(conversationMembers.profileId, user.id)))
              .limit(1);

            if (!member) return jsonError("Not a member", 403);

            const [me] = await db
              .select({ displayName: users.displayName, autoReplyConfig: (users as any).autoReplyConfig })
              .from(users)
              .where(eq(users.id, user.id))
              .limit(1);

            const config = (me as any)?.autoReplyConfig ?? createDefaultAutoReplyConfig();

            // Get peer info
            const [peer] = await db
              .select({ id: users.id, displayName: users.displayName })
              .from(conversationMembers)
              .leftJoin(users, eq(users.id, conversationMembers.profileId))
              .where(and(eq(conversationMembers.conversationId, body.conversationId), eq(users.id, conversationMembers.profileId)))
              .limit(1);

            const otherId = peer?.id ?? "other";
            const context = {
              lastMessages: [{ sender: "them" as const, text: body.incomingMessage, timestamp: Date.now() }],
              relationshipStage: "talking" as const,
              otherUserName: peer?.displayName ?? "there",
              myName: me?.displayName ?? "me",
            };

            const decision = shouldAutoReply(config, context, otherId);
            if (!decision.should) {
              return json({ shouldReply: false, reason: decision.reason });
            }

            const reply = generateAutoReply(config, context);

            // Guardrails: never share contact info or money
            if (reply.text.toLowerCase().includes("phone") || reply.text.toLowerCase().includes("money")) {
              return json({ shouldReply: false, reason: "blocked_topic" });
            }

            return json({
              shouldReply: true,
              reply: reply.text,
              topic: reply.topic,
              labeled: reply.labeled,
              why: reply.why,
              ethicsNotice: "AI-assisted reply — receiver will see marker",
            });
          }

          return jsonError("Invalid action", 400);
        },
        { rateLimit: { limit: 20, key: ({ caller }) => `auto-reply:POST:${caller?.id}` } },
      ),
    },
  },
});
