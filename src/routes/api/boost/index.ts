import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { methodNotAllowed, requireCaller, z } from "@/lib/api-helpers";
import { json, jsonError, withSecurity } from "@/middleware";
import { consumablesInventory, users } from "@/schema";

/**
 * `POST /api/boost` — spend one booster to go to the top of discovery.
 *
 * `#/lib/store.ts` fires this on a timer and swallowed the rejection, so
 * "boost" was a button that did nothing at all. Two things had to be real for it
 * to stop being a stub: a source of truth for what a boost costs
 * (`consumables_inventory`, type `boost`, which the shop/entitlements already
 * grant) and a *visible* effect (the new `users.boost_expires_at` column, which
 * `GET /api/discover` orders on). Nothing is recorded when either is missing.
 *
 * Semantics:
 *   - one boost consumed per call, quantity decremented, never negative;
 *   - an active boost is *extended*, not stacked into a second row;
 *   - expiry is computed server-side (`BOOST_MINUTES`); the client cannot
 *     request a permanent boost;
 *   - no boosters → `409`, which the client renders as "No boosts left".
 */
const BOOST_MINUTES = 30;

const bodySchema = z
	.object({ minutes: z.undefined().optional() })
	.passthrough();

export const Route = createFileRoute("/api/boost/")({
	server: {
		handlers: {
			/* Every verb this route does not implement is answered in JSON (405 +
			 * Allow). Without a declaration TanStack Start treats the request as
			 * unmatched-by-path-and-method and falls through to the document handler,
			 * which answers `200 text/html` with the SPA bundle — a client parsing
			 * JSON then blames the server instead of its own verb. AUDIT §3.10. */
			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					// Validated even though there is nothing to configure: a client that
					// tries to buy a longer boost gets a 400 instead of a silently ignored
					// field (see AUDIT.md on rejected-but-ignored request keys).
					const parsed = bodySchema.safeParse(
						await request.json().catch(() => ({})),
					);
					if (!parsed.success)
						return jsonError("minutes is not configurable", 400);

					const result = await db.transaction(async (tx) => {
						const [stock] = await tx
							.select({
								id: consumablesInventory.id,
								quantity: consumablesInventory.quantity,
							})
							.from(consumablesInventory)
							.where(
								and(
									eq(consumablesInventory.userId, user.id),
									eq(consumablesInventory.type, "boost"),
									sql`(${consumablesInventory.quantity} ?? 1) > 0`,
									or(
										isNull(consumablesInventory.expiresAt),
										gt(consumablesInventory.expiresAt, new Date()),
									),
								),
							)
							.orderBy(desc(consumablesInventory.expiresAt))
							.limit(1);
						if (!stock) return null;

						await tx
							.update(consumablesInventory)
							.set({ quantity: Math.max(0, Number(stock.quantity ?? 1) - 1) })
							.where(eq(consumablesInventory.id, stock.id));

						const [me] = await tx
							.select({ boostExpiresAt: users.boostExpiresAt })
							.from(users)
							.where(eq(users.id, user.id))
							.limit(1);
						const base =
							me?.boostExpiresAt && me.boostExpiresAt > new Date()
								? me.boostExpiresAt
								: new Date();
						const expiresAt = new Date(
							base.getTime() + BOOST_MINUTES * 60 * 1000,
						);
						await tx
							.update(users)
							.set({ boostExpiresAt: expiresAt, updatedAt: new Date() })
							.where(eq(users.id, user.id));

						const [remaining] = await tx
							.select({
								total: sql<number>`coalesce(sum(${consumablesInventory.quantity}), 0)::int`,
							})
							.from(consumablesInventory)
							.where(
								and(
									eq(consumablesInventory.userId, user.id),
									eq(consumablesInventory.type, "boost"),
								),
							);

						return { expiresAt, left: Number(remaining?.total ?? 0) };
					});

					if (!result) {
						return jsonError("No boosts left — earn or buy one first", 409);
					}
					return json({
						ok: true,
						expiresAt: result.expiresAt.toISOString(),
						boostsLeft: result.left,
						minutes: BOOST_MINUTES,
					});
				},
				{
					maxBodySize: 2 * 1024,
					// One boost is a 30-minute advantage: a fast loop here would make the
					// queue meaningless, so the budget is deliberately tiny.
					rateLimit: {
						limit: 5,
						windowMs: 60 * 60 * 1000,
						key: ({ caller }) => `boost:${caller?.id ?? "anon"}`,
					},
				},
			),

			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);
					const [me] = await db
						.select({ boostExpiresAt: users.boostExpiresAt })
						.from(users)
						.where(eq(users.id, user.id))
						.limit(1);
					const [stock] = await db
						.select({
							total: sql<number>`coalesce(sum(${consumablesInventory.quantity}), 0)::int`,
						})
						.from(consumablesInventory)
						.where(
							and(
								eq(consumablesInventory.userId, user.id),
								eq(consumablesInventory.type, "boost"),
							),
						);
					const active = me?.boostExpiresAt && me.boostExpiresAt > new Date();
					return json(
						{
							active: Boolean(active),
							expiresAt: active ? me?.boostExpiresAt?.toISOString() : null,
							boostsLeft: Number(stock?.total ?? 0),
						},
						{ cache: "private" },
					);
				},
				{
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `boost:GET:${caller?.id ?? "anon"}`,
					},
				},
			),
		},
	},
});
