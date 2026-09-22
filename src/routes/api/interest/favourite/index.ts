import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
	methodNotAllowed,
	readJson,
	requireCaller,
	z,
} from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { favorites } from "@/schema";

/**
 * `POST /api/interest/favourite` — `add` or `remove`, sent by the star on a
 * card. Unlike `POST /api/social` (which toggles because its client sends no
 * intent), this route is idempotent in the direction the client asks for, so a
 * retry after a dropped response cannot flip the star the wrong way.
 */
const bodySchema = z.object({
	profileId: z.uuid(),
	action: z.enum(["add", "remove"]),
});

export const Route = createFileRoute("/api/interest/favourite/")({
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
					const body = await readJson(request, bodySchema, 4 * 1024);
					if (body.profileId === user.id)
						return jsonError("Cannot favourite yourself", 400);

					if (body.action === "remove") {
						await db
							.delete(favorites)
							.where(
								and(
									eq(favorites.userId, user.id),
									eq(favorites.targetId, body.profileId),
								),
							);
						return json({ ok: true, isFavourite: false });
					}

					await db
						.insert(favorites)
						.values({ userId: user.id, targetId: body.profileId })
						.onConflictDoNothing({
							target: [favorites.userId, favorites.targetId],
						});
					return json({ ok: true, isFavourite: true }, { status: 201 });
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `interest:favourite:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
