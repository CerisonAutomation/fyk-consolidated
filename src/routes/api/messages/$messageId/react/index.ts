import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
	methodNotAllowed,
	readJson,
	requireCaller,
	z,
} from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { conversationMembers, messageReactions, messages } from "@/schema";

/**
 * `POST /api/messages/{messageId}/react` — toggle a reaction.
 *
 * `message_reactions` has `PRIMARY KEY (message_id, profile_id)` and a CHECK
 * restricting `emoji` to `heart|fire|laugh|wow|like`, so one member has at most
 * one reaction per message. That is what makes this a *toggle*: the same emoji
 * twice removes it, a different emoji replaces it. Sending anything else would
 * surface as a raw CHECK violation, so the set is validated here first.
 */
const EMOJIS = ["heart", "fire", "laugh", "wow", "like"] as const;
const bodySchema = z.object({ emoji: z.enum(EMOJIS) });

export const Route = createFileRoute("/api/messages/$messageId/react/")({
	server: {
		handlers: {
			/* Every verb this route does not implement is answered in JSON (405 +
			 * Allow). Without a declaration TanStack Start treats the request as
			 * unmatched-by-path-and-method and falls through to the document handler,
			 * which answers `200 text/html` with the SPA bundle — a client parsing
			 * JSON then blames the server instead of its own verb. AUDIT §3.10. */
			GET: methodNotAllowed("POST"),
			PUT: methodNotAllowed("POST"),
			PATCH: methodNotAllowed("POST"),
			DELETE: methodNotAllowed("POST"),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const parts = new URL(request.url).pathname
						.split("/")
						.filter(Boolean);
					const candidate = parts[2];
					const parsedId = z.uuid().safeParse(candidate);
					if (!parsedId.success) return jsonError("Unknown message", 404);
					const body = await readJson(request, bodySchema, 2 * 1024);

					const [target] = await db
						.select({ id: messages.id })
						.from(messages)
						.innerJoin(
							conversationMembers,
							eq(conversationMembers.conversationId, messages.conversationId),
						)
						.where(
							and(
								eq(messages.id, parsedId.data),
								eq(conversationMembers.profileId, user.id),
							),
						)
						.limit(1);
					if (!target) return jsonError("Message not found", 404);

					await db.transaction(async (tx) => {
						const [mine] = await tx
							.select({ emoji: messageReactions.emoji })
							.from(messageReactions)
							.where(
								and(
									eq(messageReactions.messageId, target.id),
									eq(messageReactions.profileId, user.id),
								),
							)
							.limit(1);
						if (!mine) {
							await tx.insert(messageReactions).values({
								messageId: target.id,
								profileId: user.id,
								emoji: body.emoji,
							});
							return;
						}
						if (mine.emoji === body.emoji) {
							await tx
								.delete(messageReactions)
								.where(
									and(
										eq(messageReactions.messageId, target.id),
										eq(messageReactions.profileId, user.id),
									),
								);
							return;
						}
						await tx
							.update(messageReactions)
							.set({ emoji: body.emoji })
							.where(
								and(
									eq(messageReactions.messageId, target.id),
									eq(messageReactions.profileId, user.id),
								),
							);
					});

					const all = await db
						.select({
							emoji: messageReactions.emoji,
							userId: messageReactions.profileId,
						})
						.from(messageReactions)
						.where(eq(messageReactions.messageId, target.id))
						.orderBy(asc(messageReactions.createdAt));

					return json({
						ok: true,
						reactions: all.map((row) => ({
							emoji: row.emoji,
							user_id: row.userId,
						})),
					});
				},
				{
					maxBodySize: 2 * 1024,
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `react:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
