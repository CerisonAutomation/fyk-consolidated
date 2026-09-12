import { createFileRoute } from "@tanstack/react-router";
import { and, count, eq, or, sql } from "drizzle-orm";
import { db } from "#/db";
import { methodNotAllowed, requireCaller } from "#/lib/api-helpers";
import { json, withSecurity } from "#/middleware";
import { favorites, footprints, matches, taps } from "#/schema";

/**
 * `GET /api/interest/stats` — the four counters above the Likes screen.
 *
 * Every number is a `COUNT(*)` with the same filters the list endpoints use, so
 * a card and the tab underneath it cannot disagree (they used to be two
 * hand-written numbers in the client, which is how "3 likes" sat above an empty
 * list). `matches` counts pairs that are still open: `unmatched_at IS NULL`.
 */
export const Route = createFileRoute("/api/interest/stats/")({
	server: {
		handlers: {
			/* Every verb this route does not implement is answered in JSON (405 +
			 * Allow). Without a declaration TanStack Start treats the request as
			 * unmatched-by-path-and-method and falls through to the document handler,
			 * which answers `200 text/html` with the SPA bundle — a client parsing
			 * JSON then blames the server instead of its own verb. AUDIT §3.10. */
			POST: methodNotAllowed("GET"),
			PUT: methodNotAllowed("GET"),
			PATCH: methodNotAllowed("GET"),
			DELETE: methodNotAllowed("GET"),

			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);

					const [
						likesReceived,
						tapsSent,
						woofsSent,
						favourites,
						visitors,
						matchRows,
					] = await Promise.all([
						db
							.select({ total: count() })
							.from(taps)
							.where(and(eq(taps.tappedId, user.id), eq(taps.type, "like"))),
						db
							.select({ total: count() })
							.from(taps)
							.where(and(eq(taps.tapperId, user.id), eq(taps.type, "like"))),
						db
							.select({ total: count() })
							.from(taps)
							.where(and(eq(taps.tapperId, user.id), eq(taps.type, "woof"))),
						db
							.select({ total: count() })
							.from(favorites)
							.where(eq(favorites.userId, user.id)),
						db
							.select({ total: count() })
							.from(footprints)
							.where(eq(footprints.visitedId, user.id)),
						db
							.select({ total: count() })
							.from(matches)
							.where(
								and(
									or(eq(matches.userA, user.id), eq(matches.userB, user.id)),
									sql`${matches.unmatchedAt} is null`,
								),
							),
					]);

					return json(
						{
							stats: {
								likesReceived: Number(likesReceived[0]?.total ?? 0),
								tapsSent: Number(tapsSent[0]?.total ?? 0),
								woofsSent: Number(woofsSent[0]?.total ?? 0),
								favourites: Number(favourites[0]?.total ?? 0),
								visitors: Number(visitors[0]?.total ?? 0),
								matches: Number(matchRows[0]?.total ?? 0),
							},
						},
						{ cache: "private" },
					);
				},
				{
					rateLimit: {
						limit: 120,
						key: ({ caller }) => `interest:stats:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
