import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
	cleanText,
	methodNotAllowed,
	readJson,
	requireCaller,
	z,
} from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { userNotes, users } from "@/schema";

/**
 * `POST /api/notes` — a private note attached to another profile.
 *
 * `user_notes` is one row per ordered pair (`UNIQUE(note_owner_id,
 * target_user_id)`), so saving twice must update rather than append. The note is
 * only ever readable by its author (see `GET /api/interest/notes`); the subject
 * of the note has no way to see it, which is why the content is length-capped
 * and control-stripped here instead of being trusted to the client.
 */
const noteSchema = z.object({
	targetId: z.uuid(),
	content: z.string().trim().min(1, "Write something first").max(1000),
});

export const Route = createFileRoute("/api/notes/")({
	server: {
		handlers: {
			/* Every verb this route does not implement is answered in JSON (405 +
			 * Allow). Without a declaration TanStack Start treats the request as
			 * unmatched-by-path-and-method and falls through to the document handler,
			 * which answers `200 text/html` with the SPA bundle — a client parsing
			 * JSON then blames the server instead of its own verb. AUDIT §3.10. */
			GET: methodNotAllowed("POST, DELETE"),
			PUT: methodNotAllowed("POST, DELETE"),
			PATCH: methodNotAllowed("POST, DELETE"),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const body = await readJson(request, noteSchema, 8 * 1024);
					const content = cleanText(body.content, 1000);
					if (!content) return jsonError("Write something first", 400);

					const [target] = await db
						.select({ id: users.id })
						.from(users)
						.where(eq(users.id, body.targetId))
						.limit(1);
					if (!target) return jsonError("Profile not found", 404);

					const [row] = await db
						.insert(userNotes)
						.values({
							noteOwnerId: user.id,
							targetUserId: target.id,
							content,
							updatedAt: new Date(),
						})
						.onConflictDoUpdate({
							target: [userNotes.noteOwnerId, userNotes.targetUserId],
							set: { content, updatedAt: new Date() },
						})
						.returning({ id: userNotes.id, updatedAt: userNotes.updatedAt });

					return json(
						{
							ok: true,
							id: row.id,
							updatedAt: row.updatedAt?.toISOString() ?? null,
						},
						{ status: 201 },
					);
				},
				{
					maxBodySize: 8 * 1024,
					rateLimit: {
						limit: 30,
						key: ({ caller }) => `notes:${caller?.id ?? "anon"}`,
					},
				},
			),

			DELETE: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const targetId = new URL(request.url).searchParams.get("targetId");
					if (!targetId) return jsonError("targetId is required", 400);
					const parsed = z.uuid().safeParse(targetId);
					if (!parsed.success) return jsonError("targetId must be a uuid", 400);

					const removed = await db
						.delete(userNotes)
						.where(
							and(
								eq(userNotes.noteOwnerId, user.id),
								eq(userNotes.targetUserId, parsed.data),
							),
						)
						.returning({ id: userNotes.id });
					if (removed.length === 0) return jsonError("Note not found", 404);
					return json({ ok: true });
				},
				{
					auth: "required",
					rateLimit: {
						limit: 30,
						key: ({ caller }) => `notes:del:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
