import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "#/db";
import {
	cleanText,
	methodNotAllowed,
	readJson,
	requireCaller,
	z,
} from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { conversationMembers, messages } from "#/schema";

/**
 * `PATCH /api/messages/{messageId}` — pin, unpin, edit, recall.
 *
 * The chat UI has shipped these four actions from the start
 * (`#/components/chat/chat-view.tsx` posts `{action, value}` and renders a
 * pinned strip), and every one of them was dead: no route, and `is_pinned` did
 * not even exist as a column (added by `0017_message_actions.sql`).
 *
 * Authorisation, in order, for every action:
 *   1. the caller must be a **member** of the conversation the message belongs
 *      to — membership is what makes an id addressable at all;
 *   2. `edit` and `recall` additionally require **ownership**: you cannot rewrite
 *      or un-send somebody else's words. Pinning is a shared-thread action, so
 *      any member may do it (that is what the pinned bar is for).
 *
 * Recall sets `unsent_at` rather than deleting: the moderation and safety
 * history needs the row to survive, and the read path renders it as a recalled
 * placeholder instead of a body.
 */
const actionSchema = z.object({
	action: z.enum(["pin", "unpin", "edit", "recall"]),
	value: z.string().max(4000).optional(),
});

export const Route = createFileRoute("/api/messages/$messageId/")({
	server: {
		handlers: {
			/* Every verb this route does not implement is answered in JSON (405 +
			 * Allow). Without a declaration TanStack Start treats the request as
			 * unmatched-by-path-and-method and falls through to the document handler,
			 * which answers `200 text/html` with the SPA bundle — a client parsing
			 * JSON then blames the server instead of its own verb. AUDIT §3.10. */
			GET: methodNotAllowed("PATCH"),
			POST: methodNotAllowed("PATCH"),
			PUT: methodNotAllowed("PATCH"),
			DELETE: methodNotAllowed("PATCH"),

			PATCH: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const messageId = messageIdFrom(request.url);
					if (!messageId) return jsonError("Unknown message", 404);
					const body = await readJson(request, actionSchema, 16 * 1024);

					const [row] = await db
						.select({
							id: messages.id,
							senderId: messages.senderId,
							type: messages.type,
							conversationId: messages.conversationId,
							isPinned: messages.isPinned,
							unsentAt: messages.unsentAt,
						})
						.from(messages)
						.innerJoin(
							conversationMembers,
							eq(conversationMembers.conversationId, messages.conversationId),
						)
						.where(
							and(
								eq(messages.id, messageId),
								// Membership, enforced in the same statement as the read:
								// a guessed message id from another thread matches nothing.
								eq(conversationMembers.profileId, user.id),
							),
						)
						.limit(1);
					if (!row) return jsonError("Message not found", 404);

					const owns = row.senderId === user.id;
					if ((body.action === "edit" || body.action === "recall") && !owns) {
						return jsonError("You can only change your own messages", 403);
					}

					const set: Record<string, unknown> = {};
					switch (body.action) {
						case "pin":
							set.isPinned = true;
							set.pinnedAt = new Date();
							break;
						case "unpin":
							set.isPinned = false;
							set.pinnedAt = null;
							break;
						case "edit": {
							if (row.type !== "text")
								return jsonError("Only text messages can be edited", 400);
							const next = cleanText(body.value ?? "", 4000);
							if (!next)
								return jsonError("Edited message cannot be empty", 400);
							// The original body stays in the row's history only as long as
							// the DB keeps it; `edited_at` is what tells the UI to show
							// "(edited)" rather than a silently rewritten bubble.
							set.body = next;
							set.editedAt = new Date();
							break;
						}
						case "recall":
							if (row.unsentAt) return jsonError("Already recalled", 409);
							set.unsentAt = new Date();
							break;
					}

					const [updated] = await db
						.update(messages)
						.set(set)
						.where(eq(messages.id, row.id))
						.returning({
							id: messages.id,
							isPinned: messages.isPinned,
							pinnedAt: messages.pinnedAt,
							editedAt: messages.editedAt,
							unsentAt: messages.unsentAt,
						});

					return json({
						ok: true,
						message: {
							id: updated.id,
							is_pinned: updated.isPinned,
							pinned_at: updated.pinnedAt?.toISOString() ?? null,
							is_edited: updated.editedAt !== null,
							is_recalled: updated.unsentAt !== null,
						},
					});
				},
				{
					maxBodySize: 16 * 1024,
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `message:patch:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});

/** `withSecurity` exposes `{request, caller, ip}`, so the path param comes off the URL. */
function messageIdFrom(url: string): string | null {
	const parts = new URL(url).pathname.split("/").filter(Boolean);
	const candidate = parts[2];
	return candidate && z.uuid().safeParse(candidate).success ? candidate : null;
}
