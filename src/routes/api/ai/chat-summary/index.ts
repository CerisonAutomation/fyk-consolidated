import { createFileRoute } from "@tanstack/react-router";
import { eq, desc } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { messages } from "#/schema";
import { summarizeChat } from "#/domains/ai/heuristic/chat-summary";

export const Route = createFileRoute("/api/ai/chat-summary/")({
  server: {
    handlers: {
      PUT: methodNotAllowed("GET, POST"),
      PATCH: methodNotAllowed("GET, POST"),
      DELETE: methodNotAllowed("GET, POST"),
      GET: withSecurity(async ({ request, caller }) => {
        const user = requireCaller(caller);
        const url = new URL(request.url);
        const conversationId = url.searchParams.get("conversationId");
        if (!conversationId) return jsonError("conversationId required", 400);
        const msgs = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(desc(messages.createdAt)).limit(50);
        const chatMsgs = msgs.map(m => ({ text: m.body ?? "", timestamp: m.createdAt ? new Date(m.createdAt).getTime() : Date.now() }));
        const summary = summarizeChat(chatMsgs);
        return json({ summary, count: msgs.length, userId: user.id, explainability: "Long threads + groups get catch me up summary of what changed since last visit, every line links to source" });
      }, { rateLimit: { limit: 30, key: ({ caller }) => `summary:GET:${caller?.id}` } }),
      POST: withSecurity(async ({ request, caller }) => {
        requireCaller(caller);
        const body = await request.json();
        const mapped = (body.messages ?? []).map((m: any) => ({ text: m.body ?? m.text ?? "", timestamp: m.timestamp ?? Date.now() }));
        const summary = summarizeChat(mapped);
        return json({ summary, explainability: "Summarizes with source links" });
      }, { rateLimit: { limit: 20, key: ({ caller }) => `summary:POST:${caller?.id}` } }),
    },
  },
});
