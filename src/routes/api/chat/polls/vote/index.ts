import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, readJson, requireCaller, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { messages } from "#/schema";

const voteSchema = z.object({
  messageId: z.string().uuid(),
  optionIndex: z.number().int().min(0).max(5),
});

export const Route = createFileRoute("/api/chat/polls/vote/")({
  server: {
    handlers: {
      GET: methodNotAllowed("POST"),
      POST: withSecurity(
        async ({ request, caller }) => {
          const user = requireCaller(caller);
          const body = await readJson(request, voteSchema, 2 * 1024);

          const [msg] = await db.select().from(messages).where(eq(messages.id, body.messageId)).limit(1);
          if (!msg) return jsonError("Poll not found", 404);
          if ((msg as any).type !== "poll") return jsonError("Not a poll", 400);

          let poll: any;
          try {
            poll = JSON.parse(msg.body ?? "{}");
          } catch {
            return jsonError("Invalid poll data", 400);
          }

          if (new Date(poll.expiresAt).getTime() < Date.now()) {
            return jsonError("Poll expired", 400);
          }

          for (const opt of poll.options) {
            opt.voters = (opt.voters ?? []).filter((v: string) => v !== user.id);
          }

          if (poll.options[body.optionIndex]) {
            poll.options[body.optionIndex].voters = [...(poll.options[body.optionIndex].voters ?? []), user.id];
            poll.options[body.optionIndex].votes = poll.options[body.optionIndex].voters.length;
          }

          poll.totalVotes = poll.options.reduce((sum: number, o: any) => sum + (o.votes ?? 0), 0);

          await db.update(messages).set({ body: JSON.stringify(poll) }).where(eq(messages.id, body.messageId));

          return json({ ok: true, poll });
        },
        { rateLimit: { limit: 60, key: ({ caller }) => `polls:vote:${caller?.id}` } },
      ),
    },
  },
});
