import { createFileRoute } from "@tanstack/react-router";
import { db } from "#/db";
import {
	methodNotAllowed,
	readJson,
	requireCaller,
	z,
} from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { notifications, taps } from "#/schema";

/**
 * `POST /api/interest/like` — "like back" from the Likes-you tab.
 *
 * Same write as a deck tap (`taps`, unique per ordered pair), kept as its own
 * route because the client's mutation and its rate-limit budget differ from the
 * deck's: liking back from a list is far more repetitive than swiping.
 */
const bodySchema = z.object({ profileId: z.uuid() });

export const Route = createFileRoute("/api/interest/like/")({
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
						return jsonError("Cannot like yourself", 400);

					const result = await db.transaction(async (tx) => {
						const inserted = await tx
							.insert(taps)
							.values({
								tapperId: user.id,
								tappedId: body.profileId,
								type: "like",
							})
							.onConflictDoNothing({ target: [taps.tapperId, taps.tappedId] })
							.returning({ id: taps.id });
						if (inserted.length === 0) return { created: false };
						// Tell them only when this is a new like, not a replay.
						await tx.insert(notifications).values({
							userId: body.profileId,
							type: "like",
							title: "Someone liked you back",
							body: "Open the deck to see who.",
							href: "/interest/taps",
							actorId: user.id,
							read: false,
						});
						return { created: true };
					});

					return json(
						{ ok: true, liked: true, ...result },
						{ status: result.created ? 201 : 200 },
					);
				},
				{
					maxBodySize: 4 * 1024,
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `interest:like:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
