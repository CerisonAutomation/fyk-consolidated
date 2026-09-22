import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import {
	methodNotAllowed,
	readJson,
	requireCaller,
	unexpected,
	z,
} from "@/lib/api-helpers";
import {
	isPaidTier,
	isTier,
	MONTHLY_BOOSTS,
	PAYMENTS_UNAVAILABLE,
	paymentsConfigured,
	TIER_ORDER,
	TIER_PERKS,
	type Tier,
	tapLimitFor,
	tierName,
	tierPrice,
} from "@/lib/economy";
import { tapQuota } from "@/lib/tap.server";
import {
	activateTier,
	activeSubscription,
	cancelTier,
	currentTier,
	walletBalance,
} from "@/lib/wallet.server";
import { ApiError, json, jsonError, withSecurity } from "@/middleware";
import { consumablesInventory, entityPromotions, spotlights } from "@/schema";

/**
 * `GET/POST /api/premium` — what this account is paying for, and what the ladder costs.
 *
 * The screen fetched `/api/premium` and got an HTML 404, so it rendered a tier list
 * from a hard-coded copy of the perks. Two copies of a price list is how a screen
 * ends up promising something the charge does not deliver, so the ladder here is
 * computed from `#/lib/economy` — the same module `#/routes/api/wallet` charges from
 * and `#/lib/tap.server` enforces against.
 *
 * `activate` shares `#/lib/wallet.server#activateTier` with `POST /api/wallet
 * {action:'subscribe'}`: one definition of a tier grant, two ways to reach it. Both
 * refuse with 503 and the standard message when no payment provider is configured,
 * rather than granting a tier nobody paid for.
 */

const actionSchema = z.discriminatedUnion("action", [
	z
		.object({
			action: z.literal("activate"),
			tier: z.enum(TIER_ORDER.filter((t) => t !== "free") as [Tier, ...Tier[]]),
			months: z.number().int().min(1).max(12).optional(),
		})
		.strict(),
	z.object({ action: z.literal("cancel") }).strict(),
]);

/** `Infinity` is not JSON, and "unlimited" is the honest value for a paid tier. */
function serialiseLimit(limit: number): number | null {
	return Number.isFinite(limit) ? limit : null;
}

export const Route = createFileRoute("/api/premium/")({
	server: {
		handlers: {
			GET: withSecurity(
				async ({ caller }) => {
					const user = requireCaller(caller);
					try {
						const [
							tier,
							subscription,
							balance,
							quota,
							inventory,
							spotlight,
							promotions,
						] = await Promise.all([
							currentTier(user.id),
							activeSubscription(user.id),
							walletBalance(user.id),
							tapQuota(user.id),
							db
								.select({
									type: consumablesInventory.type,
									quantity: consumablesInventory.quantity,
									expiresAt: consumablesInventory.expiresAt,
								})
								.from(consumablesInventory)
								.where(
									and(
										eq(consumablesInventory.userId, user.id),
										gt(consumablesInventory.quantity, 0),
									),
								)
								.orderBy(desc(consumablesInventory.quantity)),
							db
								.select({ endsAt: spotlights.endsAt })
								.from(spotlights)
								.where(
									and(
										eq(spotlights.userId, user.id),
										eq(spotlights.active, true),
										gt(spotlights.endsAt, new Date()),
									),
								)
								.orderBy(desc(spotlights.endsAt))
								.limit(1),
							// What the account is currently paying to have promoted, and what
							// that spend has bought so far: `impressions` is the receipt.
							db
								.select({
									entityType: entityPromotions.entityType,
									entityId: entityPromotions.entityId,
									endsAt: entityPromotions.endsAt,
									cost: entityPromotions.cost,
									impressions: entityPromotions.impressions,
								})
								.from(entityPromotions)
								.where(
									and(
										eq(entityPromotions.userId, user.id),
										gt(entityPromotions.endsAt, new Date()),
									),
								)
								.orderBy(desc(entityPromotions.endsAt))
								.limit(20),
						]);

						const boosts = inventory
							.filter((row) => row.type === "boost")
							.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);

						return json({
							tier,
							tierName: tierName(tier),
							paid: isPaidTier(tier),
							renewsAt: subscription?.current_period_end?.toISOString() ?? null,
							subscriptionStatus: subscription?.status ?? null,
							ladder: TIER_ORDER.map((entry) => ({
								tier: entry,
								name: tierName(entry),
								price: tierPrice(entry),
								perks: TIER_PERKS[entry],
								monthlyBoosts: MONTHLY_BOOSTS[entry],
								// The promise, from the same function `/api/taps` enforces with.
								tapLimit: serialiseLimit(tapLimitFor(entry)),
								current: entry === tier,
								sellable: entry !== "free",
							})),
							balance,
							boosts,
							inventory: inventory.map((row) => ({
								type: row.type,
								quantity: Number(row.quantity ?? 0),
								expiresAt: row.expiresAt?.toISOString() ?? null,
							})),
							usage: {
								tapsToday: quota.used,
								tapLimit: serialiseLimit(quota.limit),
							},
							spotlight: spotlight[0]
								? { endsAt: spotlight[0].endsAt.toISOString() }
								: null,
							promotions: promotions.map((row) => ({
								entityType: row.entityType,
								entityId: row.entityId,
								endsAt: row.endsAt.toISOString(),
								cost: Number(row.cost ?? 0),
								impressions: Number(row.impressions ?? 0),
							})),
							payments: {
								configured: paymentsConfigured(),
								unavailableMessage: PAYMENTS_UNAVAILABLE,
							},
						});
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("premium/state", error);
					}
				},
				{
					auth: "required",
					rateLimit: {
						limit: 60,
						key: ({ caller }) => `premium:read:${caller?.id ?? "anon"}`,
					},
				},
			),

			POST: withSecurity(
				async ({ request, caller }) => {
					const user = requireCaller(caller);
					try {
						const body = await readJson(request, actionSchema, 2 * 1024);

						if (body.action === "cancel") {
							const result = await db.transaction((tx) =>
								cancelTier(user.id, tx),
							);
							return json({
								ok: true,
								tier: result.tier,
								note: "Cancelled. Paid features stop now; anything already bought stays in the inventory.",
							});
						}

						if (!isTier(body.tier) || body.tier === "free")
							return jsonError("Choose a tier above free", 400);
						if (!paymentsConfigured())
							return jsonError(PAYMENTS_UNAVAILABLE, 503);

						const granted = await db.transaction((tx) =>
							activateTier(
								{
									userId: user.id,
									tier: body.tier,
									// Named so an audit can tell a provider-backed grant from a
									// dev-mode one without reading the ledger.
									source: "premium-screen",
									months: body.months,
								},
								tx,
							),
						);
						return json({
							ok: true,
							tier: granted.tier,
							tierName: tierName(granted.tier),
							renewsAt: granted.renewsAt.toISOString(),
							monthlyBoosts: granted.monthlyBoosts,
							balance: await walletBalance(user.id),
						});
					} catch (error) {
						if (error instanceof ApiError)
							return jsonError(error.message, error.status);
						return unexpected("premium/action", error);
					}
				},
				{
					auth: "required",
					maxBodySize: 2 * 1024,
					rateLimit: {
						limit: 10,
						windowMs: 60 * 60 * 1000,
						key: ({ caller }) => `premium:write:${caller?.id ?? "anon"}`,
					},
				},
			),

			PUT: methodNotAllowed("GET, POST"),
			PATCH: methodNotAllowed("GET, POST"),
			DELETE: methodNotAllowed("GET, POST"),
		},
	},
});
