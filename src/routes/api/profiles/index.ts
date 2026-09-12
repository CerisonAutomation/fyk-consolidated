import { createFileRoute } from "@tanstack/react-router";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "#/db";
import { cardSelection, requireCaller, toProfileCard, z } from "#/lib/api-helpers";
import { json, jsonError, withSecurity } from "#/middleware";
import { blocks, hides as hidesTable, users } from "#/schema";
import { or } from "drizzle-orm";

/**
 * `GET /api/profiles?ids=…` — several public profiles in one round trip.
 *
 * `/settings/blocked` and `/settings/hidden` both list edges and then need the
 * person behind each one; without a bulk read they fired a request per row (or,
 * as here, asked an endpoint that did not exist and rendered "Anonymous" for
 * everyone). Ids are validated, capped, and the result is filtered by the same
 * visibility rules as a single profile read — a suspended account and anyone who
 * blocked the caller stay out of the payload.
 */
const MAX_IDS = 50;

export const Route = createFileRoute("/api/profiles/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					const raw = new URL(request.url).searchParams.get("ids") ?? "";
					const parsed = z
						.array(z.uuid())
						.max(MAX_IDS)
						.safeParse(raw.split(",").map((value) => value.trim()).filter(Boolean));
					if (!parsed.success) {
						return jsonError(`ids must be up to ${MAX_IDS} uuids, comma separated`, 400);
					}
					const ids = [...new Set(parsed.data)].filter((id) => id !== user.id);
					if (ids.length === 0) return json({ profiles: [], total: 0 }, { cache: "private" });

					const rows = await db
						.select(cardSelection)
						.from(users)
						.where(and(inArray(users.id, ids), eq(users.isSuspended, false)));

					const [blockRows, hideRows] = await Promise.all([
						db
							.select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
							.from(blocks)
							.where(or(inArray(blocks.blockedId, ids), inArray(blocks.blockerId, ids))),
						db
							.select({ hiderId: hidesTable.hiderId, hiddenId: hidesTable.hiddenId })
							.from(hidesTable)
							.where(eq(hidesTable.hiderId, user.id)),
					]);
					const cut = new Set<string>();
					for (const row of blockRows) {
						if (row.blockerId === user.id || row.blockedId === user.id) {
							cut.add(row.blockerId === user.id ? row.blockedId : row.blockerId);
						}
					}
					for (const row of hideRows) if (row.hiddenId) cut.add(row.hiddenId);

					const byId = new Map(rows.map((row) => [row.id, row]));
					// Order follows the request, so a list screen keeps its own sequence.
					const profiles = ids
						.filter((id) => byId.has(id) && !cut.has(id))
						.map((id) => {
							const card = toProfileCard(byId.get(id)!, null);
							return { ...card, profileId: card.id, displayName: card.name };
						});

					return json({ profiles, total: profiles.length }, { cache: "private" });
				},
				{ rateLimit: { limit: 120, key: ({ caller }) => `profiles:list:${caller?.id ?? "anon"}` } },
			),
		},
	},
});
